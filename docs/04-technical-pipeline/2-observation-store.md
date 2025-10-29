# ⚠️ LEGACY REFERENCE - Stage 1: Observation Store

> **⚠️ WARNING**: Este doc usa arquitectura ANTIGUA (2 tablas). Ver [_LEGACY_WARNING.md](../99-legacy/_LEGACY_WARNING.md)
>
> **Arquitectura correcta**: [ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md) (1 tabla con campo `original_description`)

---

**Guardar el PDF parseado AS-IS, sin transformaciones**

## Principio fundamental

> **"La observación es inmutable. Una vez guardada, nunca se edita."**

El Observation Store es el **source of truth** original. Todo lo demás (clustering, normalización, canonical) se puede regenerar desde aquí.

---

## ¿Por qué guardar raw?

### Razón 1: Reproducibilidad

Si cambias las reglas de normalización, puedes **regenerar todo** desde observations.

```javascript
// Cambié una regla de normalización
NORMALIZATION_RULES.push({
  pattern: /NEW MERCHANT PATTERN/,
  normalized: 'New Merchant'
});

// Regenerar canonical
regenerateCanonical(); // Re-corre pipeline desde observations
```

### Razón 2: Debugging

Si algo sale mal, siempre puedes ver el **raw original**.

```
Usuario: "Esta transacción se normalizó mal"
Dev: *Abre observation*
Dev: "Ah, el PDF decía 'RANDOM MERCHANT XYZ', no teníamos regla para eso"
```

### Razón 3: Auditoría

```
"¿De dónde salió esta transacción?"
→ Check observation
→ Ve: pdf_filename = "bofa_2025_09.pdf", line_number = 47
→ Abre el PDF, va a la línea 47, lo verifica
```

---

## Schema de tabla `observations`

```sql
CREATE TABLE observations (
  id TEXT PRIMARY KEY,              -- uuid
  account TEXT NOT NULL,            -- 'bofa' | 'apple-card' | 'wise' | 'scotia'
  pdf_filename TEXT NOT NULL,       -- 'bofa_2025_09.pdf'
  pdf_hash TEXT NOT NULL,           -- sha256 del archivo
  statement_date TEXT NOT NULL,     -- '2025-09-30' (fecha del statement)

  -- Datos raw del PDF
  date TEXT NOT NULL,               -- '2025-09-28'
  description TEXT NOT NULL,        -- 'STARBUCKS STORE #12345' (AS-IS)
  amount_raw TEXT NOT NULL,         -- '-5.67' (STRING, como viene del PDF)
  currency TEXT NOT NULL,           -- 'USD' | 'MXN' | 'EUR'

  -- Metadata
  line_number INTEGER,              -- Línea del PDF donde apareció
  created_at TEXT NOT NULL,         -- Timestamp de insert

  -- Link a canonical
  canonical_id TEXT                 -- FK a transactions.id (nullable)
);

CREATE INDEX idx_obs_account ON observations(account);
CREATE INDEX idx_obs_pdf ON observations(pdf_hash);
CREATE INDEX idx_obs_canonical ON observations(canonical_id);
CREATE INDEX idx_obs_date ON observations(date);
```

---

## Insert flow

```javascript
// main/pipeline/parse.js

async function processUpload(pdfPath, account) {
  // 1. Hash del PDF para deduplicación
  const hash = sha256(pdfPath);

  // 2. Check si ya existe
  const exists = db.queryOne(
    'SELECT 1 FROM observations WHERE pdf_hash = ?',
    [hash]
  );

  if (exists) {
    return { status: 'skipped', reason: 'Already processed' };
  }

  // 3. Extraer texto
  const text = await extractText(pdfPath);

  // 4. Parsear con parser específico
  const parser = getParser(account);
  const transactions = parser.parse(text);

  // 5. Insert cada transacción como observation
  const statementDate = parser.extractStatementDate(text);

  transactions.forEach((txn, index) => {
    insertObservation({
      account,
      pdf_filename: path.basename(pdfPath),
      pdf_hash: hash,
      statement_date: statementDate,
      date: txn.date,
      description: txn.description,
      amount_raw: txn.amount, // STRING!
      currency: txn.currency,
      line_number: index + 1
    });
  });

  return {
    status: 'success',
    count: transactions.length
  };
}

function insertObservation(obs) {
  db.execute(`
    INSERT INTO observations (
      id, account, pdf_filename, pdf_hash, statement_date,
      date, description, amount_raw, currency,
      line_number, created_at, canonical_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `, [
    uuid(),
    obs.account,
    obs.pdf_filename,
    obs.pdf_hash,
    obs.statement_date,
    obs.date,
    obs.description,
    obs.amount_raw,
    obs.currency,
    obs.line_number,
    new Date().toISOString()
  ]);
}
```

---

## Deduplicación por hash

**Problema**: Darwin arrastra el mismo PDF 2 veces.

**Solución**: Hash SHA256 del archivo.

```javascript
const crypto = require('crypto');
const fs = require('fs');

function sha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}
```

**Resultado**: Aunque el filename sea diferente, el hash será igual.

```javascript
sha256('/Downloads/bofa_sept.pdf') === sha256('/Documents/bofa_september_2025.pdf')
// true (si es el mismo archivo)
```

---

## ¿Por qué `amount_raw` es STRING?

**Razón**: Los PDFs pueden tener formatos raros.

### Formato 1: Normal
```
-5.67
```
→ Fácil de parsear.

### Formato 2: Con comas
```
-1,234.56
```
→ Hay que quitar la coma.

### Formato 3: Sin signo
```
5.67 CR
```
→ "CR" = credit = positivo.

### Formato 4: Con paréntesis
```
(5.67)
```
→ Paréntesis = negativo.

**Solución**: Guardar como STRING en observations. Limpiar después en canonical.

```javascript
// En observation
amount_raw: "(1,234.56)"  // STRING AS-IS

// En canonical (después)
amount: -1234.56  // REAL limpio
```

---

## Linking: observation → canonical

Cada observation tiene un `canonical_id` que apunta a `transactions.id`.

```sql
-- Al crear canonical transaction
UPDATE observations
SET canonical_id = ?
WHERE id = ?
```

**Resultado**: Bidirectional link.

```
observation.canonical_id → transaction.id
transaction.id ← múltiples observations (en teoría, pero en práctica es 1:1)
```

---

## Queries útiles

### Ver todas las observations de un PDF

```sql
SELECT * FROM observations
WHERE pdf_filename = 'bofa_2025_09.pdf'
ORDER BY line_number;
```

### Ver observations sin canonical

```sql
SELECT * FROM observations
WHERE canonical_id IS NULL;
```

Estas son las que faltan procesar con el pipeline.

### Ver observations de una cuenta específica

```sql
SELECT * FROM observations
WHERE account = 'bofa'
AND date >= '2025-09-01'
ORDER BY date DESC;
```

---

## Regenerar canonical

Si cambias reglas de normalización, puedes regenerar todo.

```javascript
function regenerateCanonical() {
  // 1. Delete todo de canonical
  db.execute('DELETE FROM transactions');

  // 2. Reset canonical_id en observations
  db.execute('UPDATE observations SET canonical_id = NULL');

  // 3. Re-run pipeline desde Stage 2
  const observations = db.query('SELECT * FROM observations ORDER BY date');

  // Stage 2: Clustering
  const clusterMap = clusterMerchants(observations);

  // Stage 3: Normalization + Stage 4: Canonical
  observations.forEach(obs => {
    const clusterId = clusterMap[obs.id];
    const merchant = normalizeMerchant(obs.description, clusterId);
    const confidence = calculateConfidence(obs, merchant, clusterId);

    const txn = createCanonicalTransaction({
      observation_id: obs.id,
      account: obs.account,
      date: obs.date,
      merchant,
      amount: parseFloat(obs.amount_raw),
      currency: obs.currency,
      confidence
    });

    // Link back
    db.execute(
      'UPDATE observations SET canonical_id = ? WHERE id = ?',
      [txn.id, obs.id]
    );
  });

  // Stage 5: Transfer linking
  linkTransfers();

  console.log('Canonical regenerated successfully');
}
```

**Tiempo**: ~10-15 segundos para 12k observations.

---

## Testing observation store

### Test 1: Insert observation

```javascript
const obs = {
  account: 'bofa',
  pdf_filename: 'test.pdf',
  pdf_hash: 'abc123',
  statement_date: '2025-09-30',
  date: '2025-09-28',
  description: 'STARBUCKS STORE #12345',
  amount_raw: '-5.67',
  currency: 'USD',
  line_number: 1
};

insertObservation(obs);

const result = db.queryOne(
  'SELECT * FROM observations WHERE pdf_hash = ?',
  ['abc123']
);

expect(result.description).toBe('STARBUCKS STORE #12345');
expect(result.amount_raw).toBe('-5.67'); // STRING
```

### Test 2: Deduplicación

```javascript
const pdfPath = '/tmp/test.pdf';
const hash = sha256(pdfPath);

// Primera vez
processUpload(pdfPath, 'bofa');
const count1 = db.queryOne('SELECT COUNT(*) as c FROM observations').c;

// Segunda vez (mismo archivo)
processUpload(pdfPath, 'bofa');
const count2 = db.queryOne('SELECT COUNT(*) as c FROM observations').c;

expect(count1).toBe(count2); // No se insertó duplicado
```

---

## Immutability

**Regla**: Una vez insertado, NUNCA se edita.

```javascript
// ❌ NUNCA hacer esto
db.execute('UPDATE observations SET description = ? WHERE id = ?', [...]);

// ✓ Si hay error, DELETE y re-insert
db.execute('DELETE FROM observations WHERE pdf_hash = ?', [hash]);
processUpload(pdfPath, account); // Re-procesar
```

**Razón**: Observations son el source of truth. Si las editas, pierdes reproducibilidad.

---

## Delete observation

Si el usuario borra una transacción, se borra de **ambas** tablas.

```javascript
function deleteTransaction(transactionId) {
  // 1. Delete de transactions
  db.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);

  // 2. Delete de observations
  db.execute('DELETE FROM observations WHERE canonical_id = ?', [transactionId]);
}
```

**Nota**: Si vuelves a subir el mismo PDF, la observation volverá a crearse.

---

## LOC estimate

- Schema + indexes: ~10 LOC (SQL)
- `insertObservation()`: ~20 LOC
- `sha256()`: ~10 LOC
- `processUpload()`: ~40 LOC
- `regenerateCanonical()`: ~30 LOC

**Total**: ~110 LOC

---

## Resumen

### Qué ES
- Source of truth original
- Datos AS-IS del PDF
- Inmutable
- Con link a canonical

### Qué NO es
- NO es la vista para el usuario (eso es transactions)
- NO tiene normalización
- NO tiene clustering

### Reglas
1. **Nunca editar**: Solo insert o delete
2. **amount_raw es STRING**: Se limpia después
3. **Dedup por hash**: Prevenir duplicados
4. **Link bidireccional**: observation ↔ transaction

---

**Próximo stage**: Lee [3-clustering.md](3-clustering.md)
