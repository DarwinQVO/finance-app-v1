# Validations & Balance Checks

**Sistema simple de validación para detectar errores e inconsistencias**

---

## 🎯 Objetivo

Detectar problemas comunes al importar transacciones:
- Duplicados
- Fechas inválidas
- Amounts incorrectos
- Balances que no cuadran (opcional)

**Principio**: Simple, no invasivo, útil sin ser complejo

---

## 📊 Validaciones por Phase

### Phase 1: Validaciones Básicas (Al importar)

**Ejecutan automáticamente** cada vez que se sube un PDF:

```javascript
// 1. Check duplicados (por source_hash)
async function checkDuplicates(sourceHash) {
  const exists = await db.get(
    'SELECT id FROM transactions WHERE source_hash = ?',
    [sourceHash]
  );

  if (exists) {
    throw new Error('PDF ya fue importado');
  }
}

// 2. Check fechas válidas
function validateDate(date) {
  const txnDate = new Date(date);
  const today = new Date();

  if (txnDate > today) {
    return { valid: false, error: 'Fecha futura no permitida' };
  }

  return { valid: true };
}

// 3. Check amounts válidos
function validateAmount(amount) {
  if (amount === 0) {
    return { valid: false, error: 'Amount no puede ser 0' };
  }

  if (isNaN(amount)) {
    return { valid: false, error: 'Amount debe ser número' };
  }

  return { valid: true };
}

// 4. Check cuenta existe
async function validateAccount(accountId) {
  const account = await db.get(
    'SELECT id FROM accounts WHERE id = ?',
    [accountId]
  );

  if (!account) {
    return { valid: false, error: 'Cuenta no existe' };
  }

  return { valid: true };
}
```

**Cuándo ejecutar**:
```javascript
// En el upload flow (Stage 0)
async function importPDF(file, accountId) {
  // 1. Parse PDF
  const transactions = await parsePDF(file);

  // 2. Validar
  for (const txn of transactions) {
    // Check date
    const dateCheck = validateDate(txn.date);
    if (!dateCheck.valid) {
      errors.push({ line: txn.line, error: dateCheck.error });
      continue;
    }

    // Check amount
    const amountCheck = validateAmount(txn.amount);
    if (!amountCheck.valid) {
      errors.push({ line: txn.line, error: amountCheck.error });
      continue;
    }
  }

  // 3. Check duplicados
  await checkDuplicates(fileHash);

  // 4. Si todo OK, insertar
  if (errors.length === 0) {
    await insertTransactions(transactions);
  }

  return { imported: transactions.length - errors.length, errors };
}
```

---

### Phase 3: Balance Check (Opcional)

**User ingresa balance esperado**, sistema lo compara con calculado.

#### Schema

```sql
CREATE TABLE balance_checks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  check_date TEXT NOT NULL,        -- Fecha del check

  -- Balances
  expected_balance REAL NOT NULL,  -- User ingresa esto
  calculated_balance REAL NOT NULL,-- Sistema calcula
  difference REAL NOT NULL,        -- expected - calculated

  -- Status
  status TEXT CHECK(status IN ('ok', 'warning', 'error')),
  notes TEXT,                      -- User puede agregar notas

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,                -- Cuando se resuelve la discrepancia

  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_balance_checks_account ON balance_checks(account_id);
CREATE INDEX idx_balance_checks_date ON balance_checks(check_date);
```

#### Logic

```javascript
// Calcular balance hasta cierta fecha
async function calculateBalance(accountId, upToDate) {
  const result = await db.get(`
    SELECT SUM(
      CASE
        WHEN type = 'income' THEN amount
        WHEN type = 'expense' THEN -amount
        ELSE 0
      END
    ) as balance
    FROM transactions
    WHERE account_id = ?
    AND date <= ?
  `, [accountId, upToDate]);

  return result?.balance || 0;
}

// Crear balance check
async function createBalanceCheck(accountId, date, expectedBalance) {
  const calculated = await calculateBalance(accountId, date);
  const difference = expectedBalance - calculated;

  // Determinar status
  let status = 'ok';
  if (Math.abs(difference) > 0.01 && Math.abs(difference) < 10) {
    status = 'warning';
  } else if (Math.abs(difference) >= 10) {
    status = 'error';
  }

  const id = nanoid();

  await db.run(`
    INSERT INTO balance_checks (
      id, account_id, check_date,
      expected_balance, calculated_balance, difference, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, accountId, date, expectedBalance, calculated, difference, status]);

  return { id, difference, status };
}

// Obtener checks pendientes
async function getPendingChecks(accountId) {
  return await db.all(`
    SELECT * FROM balance_checks
    WHERE account_id = ?
    AND status IN ('warning', 'error')
    AND resolved_at IS NULL
    ORDER BY check_date DESC
  `, [accountId]);
}
```

#### UI

```
┌─────────────────────────────────────────────┐
│  Balance Check                              │
├─────────────────────────────────────────────┤
│                                             │
│  Account: Bank of America Checking          │
│                                             │
│  Check Date:                                │
│  ┌─────────────┐                            │
│  │ Oct 29, 2025│                            │
│  └─────────────┘                            │
│                                             │
│  Expected Balance (from bank statement):    │
│  ┌─────────────┐                            │
│  │ $ 1,234.56  │                            │
│  └─────────────┘                            │
│                                             │
│                    [Check Balance]          │
└─────────────────────────────────────────────┘

After check:
┌─────────────────────────────────────────────┐
│  ✅ Balance Check Result                    │
├─────────────────────────────────────────────┤
│                                             │
│  Expected:   $1,234.56                      │
│  Calculated: $1,230.00                      │
│  Difference:    -$4.56  ⚠️                   │
│                                             │
│  Possible reasons:                          │
│  • Missing transaction                      │
│  • Pending charge not yet posted            │
│  • Manual entry error                       │
│                                             │
│  [View Transactions]  [Mark as Resolved]    │
└─────────────────────────────────────────────┘
```

---

## 📋 Validation Summary Table

| Validación | Phase | Tipo | Cuándo | Acción si falla |
|-----------|-------|------|--------|-----------------|
| Duplicados | 1 | Automática | Al importar | Rechaza import |
| Fecha válida | 1 | Automática | Al importar | Skip transaction |
| Amount válido | 1 | Automática | Al importar | Skip transaction |
| Cuenta existe | 1 | Automática | Al importar | Error |
| Balance check | 3 | Manual | User triggered | Muestra diferencia |

---

## 🔧 Configuración

```sql
-- Tabla de configuración (opcional)
CREATE TABLE validation_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Ejemplos de config
INSERT INTO validation_config VALUES
  ('allow_future_dates', 'false'),
  ('balance_check_threshold', '10.00'),  -- Warning si diff > $10
  ('max_transaction_amount', '10000.00'); -- Warning si amount > $10k
```

---

## 🎯 Errores Comunes & Soluciones

### 1. Diferencia de $0.01 - $1.00

**Causa**: Redondeo de decimales, pending charges

**Solución**: Status = 'warning', no bloquea

### 2. Diferencia > $10

**Causa**: Transacción faltante, error en import

**Solución**:
- Status = 'error'
- User revisa transactions en ese periodo
- Puede agregar manual entry si falta algo

### 3. PDF duplicado

**Causa**: User subió mismo PDF dos veces

**Solución**: Rechazar import, mostrar mensaje claro

### 4. Fecha futura

**Causa**: PDF mal formateado, error en parser

**Solución**: Skip transaction, agregar a errores

---

## 📊 Dashboard de Validación (Phase 3)

```
┌─────────────────────────────────────────────────┐
│  🔍 Data Quality Dashboard                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  Overall Status: ✅ Good                        │
│                                                 │
│  Recent Checks:                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Oct 29  BofA Checking     ✅ OK         │   │
│  │ Oct 29  Apple Card        ⚠️  -$4.56    │   │
│  │ Oct 15  Wise EUR          ✅ OK         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Import Errors (Last 7 days):                   │
│  • 0 duplicates rejected                        │
│  • 2 future dates skipped                       │
│  • 0 invalid amounts                            │
│                                                 │
│  Pending Discrepancies:                         │
│  • 1 warning (Apple Card -$4.56)                │
│                                                 │
│                     [Run Balance Check]         │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Order

### Phase 1 (Core - MVP)
1. ✅ Duplicate check (by source_hash) - **Ya existe**
2. ✅ Date validation
3. ✅ Amount validation
4. ✅ Account validation

**LOC**: ~100 líneas

### Phase 3 (Analysis)
1. ✅ `balance_checks` table
2. ✅ Balance calculation function
3. ✅ Create balance check
4. ✅ UI for balance check

**LOC**: ~200 líneas

### Phase 5 (Optional - Advanced)
1. ⏭️ Validation dashboard
2. ⏭️ Historical balance tracking
3. ⏭️ Automated alerts for discrepancies

**LOC**: ~150 líneas

---

## 🎯 Key Principles

1. **Simple over complex** - No contratos genéricos en DB
2. **User-triggered** - Balance checks son opcionales, no automáticos
3. **Non-blocking** - Warnings no impiden usar la app
4. **Transparent** - Mostrar siempre el "por qué" de cada error
5. **Fixable** - User puede resolver discrepancias fácilmente

---

## ✅ Success Metrics

**Phase 1**:
- 0 PDFs duplicados importados
- < 1% transactions con fecha inválida
- 0 crashes por amount inválido

**Phase 3**:
- User puede identificar discrepancias en < 30 segundos
- 90% de balance checks con status = 'ok'
- Tiempo promedio para resolver discrepancia: < 5 minutos

---

**Total LOC estimado**:
- Phase 1: ~100 líneas (validaciones básicas)
- Phase 3: ~200 líneas (balance checks)
- **Total: ~300 líneas**

vs. sistema completo de contratos (~500+ líneas)

**Conclusión**: 60% menos código, 100% de utilidad práctica
