# Stage 4: Canonical Store

**La verdad limpia que ve el usuario**

## El objetivo

Tomar toda la info procesada (observation + cluster + normalized merchant) y crear una **transaction limpia** en la tabla `transactions`.

```
Input:  observation + merchant normalizado + confidence
Output: Row en tabla `transactions`
```

Esta es la tabla que el UI consulta. El usuario **nunca ve observations**.

---

## Schema: Tabla `transactions`

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,              -- uuid
  account TEXT NOT NULL,            -- 'bofa' | 'apple-card' | 'wise' | 'scotia'

  -- Datos normalizados
  date TEXT NOT NULL,               -- '2025-09-28' (ISO format)
  merchant TEXT NOT NULL,           -- 'Starbucks' (normalizado)
  amount REAL NOT NULL,             -- -5.67 (FLOAT limpio, no string)
  currency TEXT NOT NULL,           -- 'USD' | 'MXN' | 'EUR'

  -- Clasificación
  type TEXT NOT NULL,               -- 'expense' | 'income' | 'transfer'

  -- Linking
  transfer_pair_id TEXT,            -- ID de la otra mitad del transfer

  -- Metadata
  cluster_id TEXT,                  -- ID del cluster usado
  confidence REAL,                  -- 0.0-1.0 qué tan segura es la normalización
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_txn_account ON transactions(account);
CREATE INDEX idx_txn_date ON transactions(date);
CREATE INDEX idx_txn_merchant ON transactions(merchant);
CREATE INDEX idx_txn_type ON transactions(type);
CREATE INDEX idx_txn_transfer ON transactions(transfer_pair_id);
CREATE INDEX idx_txn_confidence ON transactions(confidence);
```

---

## Code: Create canonical transaction

```javascript
// main/pipeline/canonical.js

function createCanonicalTransaction(data) {
  // data = {
  //   observation_id,
  //   account,
  //   date,
  //   merchant,
  //   amount_raw,
  //   currency,
  //   cluster_id,
  //   confidence,
  //   description (original, para clasificar type)
  // }

  const txnId = uuid();

  // Parse amount (convert string → float)
  const amount = parseAmount(data.amount_raw);

  // Classify type
  const type = classifyType(data.description, amount);

  // Insert transaction
  db.execute(`
    INSERT INTO transactions (
      id, account, date, merchant, amount, currency,
      type, transfer_pair_id, cluster_id, confidence,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `, [
    txnId,
    data.account,
    data.date,
    data.merchant,
    amount,
    data.currency,
    type,
    data.cluster_id,
    data.confidence,
    new Date().toISOString(),
    new Date().toISOString()
  ]);

  // Link observation → transaction
  db.execute(`
    UPDATE observations
    SET canonical_id = ?
    WHERE id = ?
  `, [txnId, data.observation_id]);

  return { id: txnId, ...data, amount, type };
}

function parseAmount(amountRaw) {
  // amountRaw puede ser:
  // - "-5.67"
  // - "(5.67)"  → paréntesis = negativo
  // - "5.67 CR" → CR = credit = positivo

  let amount = amountRaw.trim();

  // Handle paréntesis
  if (amount.startsWith('(') && amount.endsWith(')')) {
    amount = '-' + amount.slice(1, -1);
  }

  // Handle "CR" suffix
  if (amount.endsWith('CR')) {
    amount = amount.replace('CR', '').trim();
    // Es credit, forzar positivo
    amount = Math.abs(parseFloat(amount.replace(/,/g, '')));
    return amount;
  }

  // Handle "DB" suffix (debit)
  if (amount.endsWith('DB')) {
    amount = amount.replace('DB', '').trim();
    // Es debit, forzar negativo
    amount = -Math.abs(parseFloat(amount.replace(/,/g, '')));
    return amount;
  }

  // Normal: quitar comas y parsear
  return parseFloat(amount.replace(/,/g, ''));
}

function classifyType(description, amount) {
  const desc = description.toUpperCase();

  // Transfer keywords
  if (
    desc.includes('TRANSFER') ||
    desc.includes('WIRE') ||
    desc.includes('ACH') ||
    desc.includes('ZELLE') ||
    desc.includes('VENMO') ||
    desc.includes('SPEI')
  ) {
    return 'transfer';
  }

  // Income keywords
  if (
    desc.includes('SALARY') ||
    desc.includes('DEPOSIT') ||
    desc.includes('REFUND') ||
    desc.includes('PAYMENT RECEIVED') ||
    desc.includes('RECIBIDA') ||
    desc.includes('ABONO')
  ) {
    return 'income';
  }

  // Default: inferir de amount
  return amount < 0 ? 'expense' : 'income';
}

module.exports = { createCanonicalTransaction };
```

---

## Diferencias: observations vs transactions

| Campo | observations | transactions |
|-------|-------------|-------------|
| description | "STARBUCKS STORE #12345" | N/A |
| merchant | N/A | "Starbucks" |
| amount_raw | "-5.67" (STRING) | N/A |
| amount | N/A | -5.67 (REAL) |
| type | N/A | "expense" |
| cluster_id | N/A | "cluster_abc" |
| confidence | N/A | 0.95 |
| canonical_id | → transactions.id | N/A |

**observations**: Raw, immutable, source of truth.

**transactions**: Clean, queryable, user-facing.

---

## Type classification

```
type = 'expense'  → User gastó plata
type = 'income'   → User recibió plata
type = 'transfer' → User movió plata entre cuentas
```

### Heurísticas

1. **Keywords primero**:
   - "TRANSFER" → transfer
   - "SALARY" → income

2. **Fallback a amount**:
   - amount < 0 → expense
   - amount > 0 → income

### Ejemplos

```javascript
classifyType("STARBUCKS", -5.67)           → "expense"
classifyType("SALARY DEPOSIT", 3500.00)    → "income"
classifyType("TRANSFER TO WISE", -1000.00) → "transfer"
classifyType("REFUND", 12.99)              → "income"
```

---

## Transfer linking (Stage 5)

Después de crear todas las transactions, corremos `linkTransfers()`.

```javascript
function linkTransfers() {
  // Obtener todos los transfers sin pareja
  const unlinkedTransfers = db.query(`
    SELECT * FROM transactions
    WHERE type = 'transfer'
    AND transfer_pair_id IS NULL
    ORDER BY date ASC
  `);

  for (const txn of unlinkedTransfers) {
    // Buscar pareja
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

    if (pair) {
      // Link bidireccional
      db.execute(`
        UPDATE transactions
        SET transfer_pair_id = ?,
            updated_at = ?
        WHERE id = ?
      `, [pair.id, new Date().toISOString(), txn.id]);

      db.execute(`
        UPDATE transactions
        SET transfer_pair_id = ?,
            updated_at = ?
        WHERE id = ?
      `, [txn.id, new Date().toISOString(), pair.id]);
    }
  }
}
```

---

## Full pipeline integration

```javascript
// main/pipeline/index.js

async function runPipeline() {
  console.log('Starting pipeline...');

  // Stage 1: Parse → observations (ya ejecutado en upload)

  // Stage 2: Clustering
  console.log('Stage 2: Clustering...');
  const observations = db.query(`
    SELECT * FROM observations
    WHERE canonical_id IS NULL
  `);
  const { clusters, clusterMap } = clusterMerchants(observations);

  // Stage 3: Normalization + Stage 4: Canonical
  console.log('Stage 3+4: Normalization + Canonical...');
  observations.forEach(obs => {
    const clusterId = clusterMap[obs.id];
    const merchant = normalizeMerchant(obs.description, clusterId, clusters);
    const confidence = calculateConfidence(obs, merchant, clusterId, clusters);

    createCanonicalTransaction({
      observation_id: obs.id,
      account: obs.account,
      date: obs.date,
      merchant,
      amount_raw: obs.amount_raw,
      currency: obs.currency,
      cluster_id: clusterId,
      confidence,
      description: obs.description
    });
  });

  // Stage 5: Transfer linking
  console.log('Stage 5: Transfer linking...');
  linkTransfers();

  console.log('Pipeline complete!');
}
```

---

## Queries útiles

### Ver todas las transactions de un mes

```sql
SELECT * FROM transactions
WHERE date >= '2025-09-01'
AND date < '2025-10-01'
ORDER BY date DESC;
```

### Ver transactions por merchant

```sql
SELECT merchant, COUNT(*) as count, SUM(amount) as total
FROM transactions
WHERE date >= '2025-01-01'
GROUP BY merchant
ORDER BY count DESC;
```

### Ver transfers linkeados

```sql
SELECT
  t1.date as date1,
  t1.merchant as merchant1,
  t1.amount as amount1,
  t1.account as account1,
  t2.date as date2,
  t2.merchant as merchant2,
  t2.amount as amount2,
  t2.account as account2
FROM transactions t1
JOIN transactions t2 ON t1.transfer_pair_id = t2.id
WHERE t1.type = 'transfer'
AND t1.id < t2.id; -- Para evitar duplicados
```

### Ver transactions con bajo confidence

```sql
SELECT merchant, date, amount, confidence
FROM transactions
WHERE confidence < 0.5
ORDER BY date DESC;
```

---

## Delete transaction

Si el usuario borra una transaction, borrar de **ambas** tablas.

```javascript
function deleteTransaction(transactionId) {
  // Delete from transactions
  db.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);

  // Delete from observations
  db.execute('DELETE FROM observations WHERE canonical_id = ?', [transactionId]);

  // Si tenía pareja (transfer), unlink la pareja
  db.execute(`
    UPDATE transactions
    SET transfer_pair_id = NULL
    WHERE transfer_pair_id = ?
  `, [transactionId]);
}
```

---

## Update transaction

En V1, **NO permitimos edits**. Solo delete.

**Razón**: Si editas transactions, se desincroniza con observations.

**V2**: Permitir edit → marcar observation como "overridden" → no regenerar ese canonical.

---

## Regenerar canonical (completo)

```javascript
function regenerateCanonical() {
  console.log('Regenerating canonical store...');

  // 1. Delete todas las transactions
  db.execute('DELETE FROM transactions');

  // 2. Reset canonical_id en observations
  db.execute('UPDATE observations SET canonical_id = NULL');

  // 3. Re-run pipeline completo
  runPipeline();

  console.log('Regeneration complete!');
}
```

**Uso**: Cuando cambias reglas de normalización y quieres ver el resultado.

---

## Testing

### Test 1: Create canonical

```javascript
const data = {
  observation_id: 'obs_1',
  account: 'bofa',
  date: '2025-09-28',
  merchant: 'Starbucks',
  amount_raw: '-5.67',
  currency: 'USD',
  cluster_id: 'cluster_1',
  confidence: 0.95,
  description: 'STARBUCKS STORE #12345'
};

const txn = createCanonicalTransaction(data);

expect(txn.amount).toBe(-5.67); // FLOAT
expect(txn.type).toBe('expense');
expect(txn.merchant).toBe('Starbucks');
```

### Test 2: Type classification

```javascript
expect(classifyType('TRANSFER TO WISE', -1000)).toBe('transfer');
expect(classifyType('SALARY DEPOSIT', 3500)).toBe('income');
expect(classifyType('STARBUCKS', -5.67)).toBe('expense');
```

### Test 3: Transfer linking

```javascript
// Create 2 transactions
createCanonicalTransaction({
  account: 'bofa',
  date: '2025-09-26',
  merchant: 'Transfer to Wise',
  amount_raw: '-1000.00',
  type: 'transfer'
  // ...
});

createCanonicalTransaction({
  account: 'wise',
  date: '2025-09-27',
  merchant: 'Transfer from Bank',
  amount_raw: '1000.00',
  type: 'transfer'
  // ...
});

// Link
linkTransfers();

// Check
const txns = db.query(`
  SELECT * FROM transactions
  WHERE type = 'transfer'
`);

expect(txns[0].transfer_pair_id).toBe(txns[1].id);
expect(txns[1].transfer_pair_id).toBe(txns[0].id);
```

---

## LOC estimate

- `createCanonicalTransaction()`: ~40 LOC
- `parseAmount()`: ~30 LOC
- `classifyType()`: ~25 LOC
- `linkTransfers()`: ~30 LOC
- `deleteTransaction()`: ~15 LOC
- `regenerateCanonical()`: ~10 LOC

**Total**: ~150 LOC

---

## Resumen del pipeline completo

### Stage 1: Parse → ObservationStore
- **Input**: PDF file
- **Output**: Rows en `observations`
- **LOC**: ~110

### Stage 2: Clustering
- **Input**: Observations
- **Output**: cluster_id por observation
- **LOC**: ~70

### Stage 3: Normalization
- **Input**: Observation + cluster
- **Output**: Merchant normalizado + confidence
- **LOC**: ~130

### Stage 4: Canonical Store
- **Input**: Todo lo anterior
- **Output**: Rows en `transactions`
- **LOC**: ~150

### Total pipeline LOC: ~460

(Muy cerca del objetivo de ~500 ✓)

---

## Principios de diseño

### 1. Two-store architecture
- **observations**: Raw, immutable
- **transactions**: Clean, queryable

### 2. Reproducibilidad
- Puedes regenerar `transactions` desde `observations`
- Cambiar reglas → regenerar → nuevo resultado

### 3. UI solo ve transactions
- User nunca ve observations
- observations son para auditoría y debugging

### 4. Linking bidireccional
- observation.canonical_id → transaction.id
- Permite trace back

---

**Próximos docs**: Lee [Batch 5: UI/UX](6-ui-timeline.md)
