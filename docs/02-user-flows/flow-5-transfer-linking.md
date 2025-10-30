# Flow 5: Transfer Linking

**Cómo detectamos cuando mueves plata entre cuentas**

## Funcionalidad

Detecta y linkea transfers entre cuentas propias.

**Caso típico**:
```
BofA statement:
  Sep 26  TRANSFER TO WISE    -$1,000.00 USD

Wise statement:
  Sep 27  TRANSFER FROM BANK  +$1,000.00 USD
```

Sin linking: 2 transacciones independientes (gasto + ingreso)
Con linking: 1 transfer (movimiento interno, net = $0)

---

## Implementación: Transfer linking

Detectar automáticamente que estas 2 transacciones son la misma operación.

**Resultado**:
```
Sep 26-27  ↔️ Transfer: BofA → Wise
           -$1,000.00 USD (BofA)
           +$1,000.00 USD (Wise)
```

Ahora es claro: moviste plata entre cuentas, no gastaste ni ganaste.

---

## Story: el usuario mueve plata de BofA a Wise

### Escena 1: La transferencia real

el usuario necesita pagar algo en EUR (Europa). Mueve $1,000 de BofA a Wise.

**26 de septiembre**: Hace transfer desde BofA app → Wise.
**27 de septiembre**: Wise recibe el dinero (1 día después).

### Escena 2: Sube los PDFs

el usuario sube `bofa_2025_09.pdf` y `wise_2025_09.pdf`.

**Pipeline procesa ambos PDFs**:

1. BofA statement:
   ```
   Sep 26  TRANSFER TO WISE  -$1,000.00 USD
   ```
   → Crea `txn_bofa_001` en transactions

2. Wise statement:
   ```
   Sep 27  TRANSFER FROM BANK  +$1,000.00 USD
   ```
   → Crea `txn_wise_001` en transactions

**Ambas tienen `type = 'transfer'`** (detectado por keywords).

### Escena 3: Transfer linking corre

El pipeline ejecuta `linkTransfers()`:

```javascript
// Busca pares de transfers
// Heurística: mismo monto, fechas cercanas, cuentas diferentes

Found pair:
  txn_bofa_001: -$1,000.00 USD, Sep 26, BofA
  txn_wise_001: +$1,000.00 USD, Sep 27, Wise

Match criteria:
  ✓ Amount matches: |-1000| = |+1000|
  ✓ Dates close: |Sep 26 - Sep 27| = 1 day (< 3 days)
  ✓ Accounts different: BofA ≠ Wise
  ✓ Both type = 'transfer'

→ Link them: transfer_pair_id
```

**Resultado en DB**:
```sql
UPDATE transactions SET transfer_pair_id = 'txn_wise_001' WHERE id = 'txn_bofa_001';
UPDATE transactions SET transfer_pair_id = 'txn_bofa_001' WHERE id = 'txn_wise_001';
```

### Escena 4: el usuario ve el timeline

```
┌──────────────────────────────────────────────────┐
│  Sep 27  ↔️ Transfer: BofA → Wise               │
│          -$1,000.00 USD  [BofA]                  │
│          +$1,000.00 USD  [Wise]  ⛓️             │
│                                                  │
│  Sep 25  Starbucks              -$5.67  USD     │
│  Sep 24  Amazon                 -$89.99 USD     │
└──────────────────────────────────────────────────┘
```

**Perfecto**:
- Se muestra como 1 operación visual (agrupado)
- Icon ↔️ indica transfer
- Icon ⛓️ indica linked
- Fechas diferentes OK (Sep 26-27)

---

## Detección de type = 'transfer'

**¿Cómo sabe el pipeline que es un transfer?**

### Método 1: Keywords

```javascript
function classifyType(observation) {
  const desc = observation.description.toUpperCase();

  // Transfer keywords
  if (
    desc.includes('TRANSFER') ||
    desc.includes('WIRE') ||
    desc.includes('ACH') ||
    desc.includes('ZELLE') ||
    desc.includes('VENMO')
  ) {
    return 'transfer';
  }

  // Income keywords
  if (
    desc.includes('SALARY') ||
    desc.includes('DEPOSIT') ||
    desc.includes('REFUND') ||
    desc.includes('PAYMENT RECEIVED')
  ) {
    return 'income';
  }

  // Default: expense si amount < 0, income si amount > 0
  return observation.amount < 0 ? 'expense' : 'income';
}
```

### Método 2: Bank-specific patterns

Cada banco tiene su propio formato para transfers.

```javascript
// parser-bofa.js
function classifyTypeBofA(description) {
  if (/TRANSFER TO|TRANSFER FROM|ONLINE TRANSFER/.test(description)) {
    return 'transfer';
  }
  // ...
}

// parser-wise.js
function classifyTypeWise(description) {
  if (/TRANSFER FROM BANK|TRANSFER TO BANK/.test(description)) {
    return 'transfer';
  }
  // ...
}
```

---

## Linking algorithm

```javascript
function linkTransfers() {
  // 1. Obtener todos los transfers sin pareja
  const unlinkedTransfers = db.query(`
    SELECT * FROM transactions
    WHERE type = 'transfer'
    AND transfer_pair_id IS NULL
    ORDER BY date ASC
  `);

  // 2. Para cada transfer, buscar pareja
  for (const txn of unlinkedTransfers) {
    const pair = findTransferPair(txn);
    if (pair) {
      linkPair(txn, pair);
    }
  }
}

function findTransferPair(txn) {
  // Buscar transacción que cumple:
  // - Monto opuesto (si txn = -1000, buscar +1000)
  // - Fechas cercanas (± 3 días)
  // - Cuenta diferente
  // - Tipo = 'transfer'
  // - Sin pareja aún

  const pair = db.queryOne(`
    SELECT * FROM transactions
    WHERE id != ?
    AND type = 'transfer'
    AND transfer_pair_id IS NULL
    AND ABS(amount + ?) < 0.01
    AND ABS(julianday(date) - julianday(?)) <= 3
    AND account != ?
    LIMIT 1
  `, [txn.id, txn.amount, txn.date, txn.account]);

  return pair;
}

function linkPair(txn1, txn2) {
  // Link bidireccional
  db.execute(`
    UPDATE transactions
    SET transfer_pair_id = ?
    WHERE id = ?
  `, [txn2.id, txn1.id]);

  db.execute(`
    UPDATE transactions
    SET transfer_pair_id = ?
    WHERE id = ?
  `, [txn1.id, txn2.id]);
}
```

---

## Heurística de matching

### Criterio 1: Monto opuesto

```javascript
// txn1: -$1,000.00
// txn2: +$1,000.00

Math.abs(txn1.amount + txn2.amount) < 0.01
// |-1000 + 1000| = 0 < 0.01 ✓
```

**Tolerancia**: $0.01 (para redondeos).

### Criterio 2: Fechas cercanas

```javascript
// txn1: Sep 26
// txn2: Sep 27

Math.abs(julianday('2025-09-26') - julianday('2025-09-27')) = 1
1 <= 3 ✓
```

**Ventana**: ± 3 días.

**¿Por qué 3 días?**
- ACH transfers: 1-3 días business
- Wire transfers: mismo día o +1
- International: 2-3 días

### Criterio 3: Cuentas diferentes

```javascript
txn1.account !== txn2.account
'bofa' !== 'wise' ✓
```

**Obvio**: No puedes transferir de BofA a BofA.

### Criterio 4: Ambos tipo = 'transfer'

```javascript
txn1.type === 'transfer' && txn2.type === 'transfer' ✓
```

---

## Edge cases

### Edge case 1: Mismo monto, mismo día, 2 pares

**Escenario**: el usuario hace 2 transfers de $500 el mismo día.

```
Sep 26  BofA → Wise    -$500  (txn_1)
Sep 26  BofA → Scotia  -$500  (txn_2)
Sep 26  Wise receipt   +$500  (txn_3)
Sep 26  Scotia receipt +$500  (txn_4)
```

**Problema**: ¿Cómo saber cuál va con cuál?

**Solución inicial**: **First-come, first-matched**.

```javascript
// Procesamos en orden cronológico
linkTransfers();

// txn_1 busca pareja → encuentra txn_3 → link
// txn_2 busca pareja → encuentra txn_4 → link
```

**Limitación**: Si el orden es incorrecto, puede linkear mal.

**Solución futura**: Revisar merchant/description para hints.

---

### Edge case 2: Fechas fuera de ventana

**Escenario**: Transfer tarda más de 3 días.

```
Sep 26  BofA → International  -$1,000
Oct 2   Foreign bank receipt  +$1,000  (6 días después)
```

**Problema**: |Sep 26 - Oct 2| = 6 días > 3 días → no match.

**Solución**: el usuario puede linkear manualmente (future feature).

**Solución inicial**: Aumentar ventana a 5 días para international banks.

```javascript
function getWindowDays(account1, account2) {
  if (isInternational(account1) || isInternational(account2)) {
    return 5; // ventana más grande
  }
  return 3; // ventana normal
}

function isInternational(account) {
  return account === 'wise'; // Wise es international
}
```

---

### Edge case 3: Amounts con fees

**Escenario**: BofA cobra fee por wire transfer.

```
Sep 26  BofA wire       -$1,000.00
Sep 26  BofA wire fee   -$15.00
Sep 27  Wise receipt    +$1,000.00
```

**Problema**: El fee es una transacción separada.

**Solución**: Solo linkear el transfer principal. El fee queda como expense aparte.

```
Timeline:
Sep 27  ↔️ Transfer: BofA → Wise
        -$1,000.00 [BofA]
        +$1,000.00 [Wise]

Sep 26  Wire Transfer Fee  -$15.00 [BofA]  (sin link)
```

**Correcto**: El fee NO es parte del transfer, es un expense legítimo.

---

### Edge case 4: Currency conversion

**Escenario**: Transfer de USD a MXN.

```
Sep 26  BofA          -$1,000.00 USD
Sep 27  Scotia        +$19,850.00 MXN  (@ 19.85 rate)
```

**Problema**: Montos diferentes (1000 ≠ 19850).

**Solución inicial**: **No linkear automáticamente**. Currencies diferentes = no match.

```javascript
function findTransferPair(txn) {
  const pair = db.queryOne(`
    SELECT * FROM transactions
    WHERE ...
    AND currency = ?  -- Mismo currency
  `, [txn.currency]);

  return pair;
}
```

**Solución futura**: Considerar exchange rate (más complejo).

```javascript
function findTransferPairCrossCurrency(txn) {
  // Buscar pareja con currency diferente
  const candidates = db.query(`
    SELECT * FROM transactions
    WHERE ...
    AND currency != ?
  `, [txn.currency]);

  // Calcular exchange rate implícito
  for (const candidate of candidates) {
    const rate = Math.abs(candidate.amount / txn.amount);

    // ¿Es un exchange rate razonable?
    if (rate >= 15 && rate <= 25) { // MXN/USD típicamente 17-22
      return candidate;
    }
  }

  return null;
}
```

**Para Phase 1**: No linkear cross-currency (demasiado complejo).

---

## UI: Transfers en timeline

### Opción A: Agrupados visualmente

```
┌──────────────────────────────────────────────────┐
│  Sep 27  ↔️ Transfer: BofA → Wise  ⛓️           │
│          ┌─────────────────────────────────────┐ │
│          │ -$1,000.00 USD  [BofA]              │ │
│          │ +$1,000.00 USD  [Wise]              │ │
│          └─────────────────────────────────────┘ │
│                                                  │
│  Sep 25  Starbucks              -$5.67  USD     │
└──────────────────────────────────────────────────┘
```

**Ventajas**: Muy claro que son 1 operación.

---

### Opción B: Inline con icon

```
┌──────────────────────────────────────────────────┐
│  Sep 27  ↔️ BofA → Wise         -$1,000.00 USD ⛓️│
│  Sep 27  ↔️ BofA → Wise         +$1,000.00 USD ⛓️│
│                                                  │
│  Sep 25  Starbucks              -$5.67  USD     │
└──────────────────────────────────────────────────┘
```

**Ventajas**: Más simple de implementar.

---

**Phase 1 usa Opción B** (más simple).

---

## UI: Transfer details

el usuario hace click en un transfer.

```
┌─────────────────────────────────────────┐
│  Transfer to Wise                       │
│  Sep 26, 2025                           │
├─────────────────────────────────────────┤
│  💰 Amount                              │
│  -$1,000.00 USD                         │
│                                         │
│  🏦 From Account                        │
│  Bank of America                        │
│                                         │
│  ↔️ Linked Transfer  ⛓️                │
│  ┌─────────────────────────────────┐   │
│  │ +$1,000.00 USD                 │   │
│  │ Wise                           │   │
│  │ Sep 27, 2025 (1 day later)    │   │
│  │                                │   │
│  │ [View details →]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📄 Original                            │
│  TRANSFER TO WISE                       │
│                                         │
│  [Unlink] [Delete pair] [Close]        │
└─────────────────────────────────────────┘
```

**Actions**:
- **View details**: Abre el otro lado
- **Unlink**: Rompe el link (si fue error)
- **Delete pair**: Borra ambas transacciones

---

## Manual linking (future feature)

**Caso**: El auto-linking falló. el usuario quiere linkear manualmente.

### UI: Select 2 transactions → "Link as transfer"

```
1. Shift+Click en 2 transacciones
2. Right-click → "Link as transfer"
3. Confirmación: "¿Linkear estas 2 transacciones?"
4. Link created
```

---

## Unlink transfer

**Caso**: El auto-linking linkeó mal.

### UI: "Unlink"

```
1. Click en transfer
2. Click "Unlink"
3. Confirmación: "¿Separar este transfer?"
4. transfer_pair_id = NULL para ambas
```

---

## Delete transfer pair

**Caso**: Transfer fue error (cancelado, duplicado).

### UI: "Delete pair"

```
1. Click en transfer
2. Click "Delete pair"
3. Confirmación: "¿Borrar ambas transacciones?"
4. Delete txn_1 y txn_2 de transactions
5. Delete observations correspondientes
```

---

## Testing transfer linking

el usuario puede ver todos los transfers.

### UI: Filter by type

```
┌──────────────────────────────────────────────────┐
│  Filters: [All accounts] [All time] [Transfers]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Sep 27  ↔️ BofA → Wise     -$1,000 USD ⛓️      │
│  Sep 27  ↔️ BofA → Wise     +$1,000 USD ⛓️      │
│                                                  │
│  Sep 15  ↔️ Wise → Scotia   -$500 USD ⛓️        │
│  Sep 16  ↔️ Wise → Scotia   +$9,925 MXN ⛓️      │
│                                                  │
│  Aug 30  ↔️ BofA → Apple Card  -$2,000 USD ⛓️   │
│  Aug 30  ↔️ BofA → Apple Card  +$2,000 USD ⛓️   │
│                                                  │
│  12 transfers (6 pairs)                          │
└──────────────────────────────────────────────────┘
```

---

## Resumen

### Detección de transfers
- **Método**: Keywords en description
- **Keywords**: TRANSFER, WIRE, ACH, ZELLE, VENMO
- **Bank-specific**: Cada parser tiene reglas específicas

### Linking heurística
- **Monto opuesto**: |-1000 + 1000| < $0.01
- **Fechas cercanas**: ± 3 días (5 para international)
- **Cuentas diferentes**: BofA ≠ Wise
- **Ambos transfers**: type = 'transfer'

### Edge cases Phase 1
- ✅ Mismo monto, mismo día → First-come, first-matched
- ✅ Fees separados → No linkear fee
- ❌ Currency conversion → No linkear (future)
- ❌ Fechas >3 días → No linkear (manual en futuras fases)

### UI
- Icon ↔️ para transfers
- Icon ⛓️ para linked
- Agrupación visual
- Panel de detalles con link bidireccional
- Actions: Unlink, Delete pair

---

**Próximos docs**: Lee [Batch 3: Parsers](../03-parsers/parser-bofa.md) para ver cómo parsear cada banco.
