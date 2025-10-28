# Architecture - Finance App V1

**2 tablas, 4 pasos, 1 timeline**

## Overview

Finance App V1 está construida sobre dos principios:

1. **Two-store architecture**: Guardamos raw (observations) y clean (transactions)
2. **Truth construction pipeline**: 4 pasos automáticos transforman raw → clean

```
PDF → Parse → ObservationStore → Clustering → Normalization → CanonicalStore → UI
```

---

## Database Schema

### SQLite con 2 tablas

#### Tabla 1: `observations`

**Propósito**: Guardar el PDF parseado AS-IS, sin transformaciones.

```sql
CREATE TABLE observations (
  id TEXT PRIMARY KEY,              -- uuid
  account TEXT NOT NULL,            -- 'bofa' | 'apple-card' | 'wise' | 'scotia'
  pdf_filename TEXT NOT NULL,       -- 'bofa_2024_03.pdf'
  pdf_hash TEXT NOT NULL,           -- sha256 para dedup
  statement_date TEXT NOT NULL,     -- '2024-03-31'

  -- Datos raw del PDF
  date TEXT NOT NULL,               -- '2024-03-15'
  description TEXT NOT NULL,        -- 'STARBUCKS STORE #12345'
  amount_raw TEXT NOT NULL,         -- '-45.67' (string como viene)
  currency TEXT NOT NULL,           -- 'USD' | 'MXN'

  -- Metadata
  line_number INTEGER,              -- Línea del PDF donde apareció
  created_at TEXT NOT NULL,         -- Timestamp de insert

  -- Relación con canonical
  canonical_id TEXT                 -- FK a transactions.id (nullable)
);

CREATE INDEX idx_obs_account ON observations(account);
CREATE INDEX idx_obs_pdf ON observations(pdf_hash);
CREATE INDEX idx_obs_canonical ON observations(canonical_id);
```

**Key points**:
- `amount_raw` es STRING (porque el PDF puede tener formatos raros)
- `canonical_id` conecta observation → transaction
- Inmutable: una vez insertado, nunca se edita

---

#### Tabla 2: `transactions`

**Propósito**: La verdad canónica limpia para mostrar en UI.

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,              -- uuid
  account TEXT NOT NULL,            -- 'bofa' | 'apple-card' | 'wise' | 'scotia'

  -- Datos normalizados
  date TEXT NOT NULL,               -- '2024-03-15' (ISO format)
  merchant TEXT NOT NULL,           -- 'Starbucks' (normalizado)
  amount REAL NOT NULL,             -- -45.67 (número limpio)
  currency TEXT NOT NULL,           -- 'USD' | 'MXN'

  -- Clasificación
  type TEXT NOT NULL,               -- 'expense' | 'income' | 'transfer'

  -- Linking
  transfer_pair_id TEXT,            -- ID de la otra mitad del transfer

  -- Metadata
  cluster_id TEXT,                  -- ID del cluster de merchants
  confidence REAL,                  -- 0.0-1.0 qué tan seguro está el pipeline
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_txn_account ON transactions(account);
CREATE INDEX idx_txn_date ON transactions(date);
CREATE INDEX idx_txn_merchant ON transactions(merchant);
CREATE INDEX idx_txn_transfer ON transactions(transfer_pair_id);
```

**Key points**:
- `amount` es REAL (número limpio)
- `merchant` está normalizado ("Starbucks", no "STARBUCKS #123")
- `transfer_pair_id` linkea transferencias entre cuentas
- `confidence` indica qué tan seguro está el clustering/normalización

---

## 4-Stage Pipeline

### Stage 1: Parse → ObservationStore

**Input**: PDF file
**Output**: Rows en tabla `observations`

```javascript
function parsePDF(pdfPath, account) {
  const text = extractText(pdfPath);
  const hash = sha256(pdfPath);

  // Parser específico por banco
  const parser = getParser(account); // bofa | apple-card | wise | scotia
  const rows = parser.parse(text);

  // Insert raw en observations
  rows.forEach(row => {
    db.insert('observations', {
      id: uuid(),
      account,
      pdf_filename: basename(pdfPath),
      pdf_hash: hash,
      date: row.date,
      description: row.description,
      amount_raw: row.amount,
      currency: row.currency,
      line_number: row.lineNumber,
      created_at: now()
    });
  });
}
```

**Características**:
- Un parser por banco (4 parsers hardcodeados)
- Guarda TODO, incluso si parece basura
- Deduplicación por `pdf_hash` (si ya procesaste ese PDF, skip)

---

### Stage 2: Clustering

**Input**: Observations sin cluster
**Output**: `cluster_id` asignado

```javascript
function clusterMerchants() {
  const observations = db.query('SELECT * FROM observations WHERE canonical_id IS NULL');

  // Agrupar por similitud de string
  const clusters = {};

  observations.forEach(obs => {
    const desc = obs.description.toUpperCase();

    // Buscar cluster existente similar
    let foundCluster = null;
    for (const [clusterId, members] of Object.entries(clusters)) {
      const similarity = stringSimilarity(desc, members[0]);
      if (similarity > 0.8) { // threshold hardcodeado
        foundCluster = clusterId;
        break;
      }
    }

    // Asignar a cluster existente o crear nuevo
    if (foundCluster) {
      clusters[foundCluster].push(desc);
    } else {
      const newClusterId = uuid();
      clusters[newClusterId] = [desc];
    }
  });

  return clusters;
}
```

**Características**:
- String similarity con threshold de 0.8 (hardcoded)
- ~50 LOC, no ML
- Agrupa "STARBUCKS #123" con "STARBUCKS #456"

---

### Stage 3: Normalization

**Input**: Observations con cluster
**Output**: Merchant normalizado

```javascript
function normalizeMerchant(description, clusterId) {
  // Paso 1: Reglas hardcodeadas
  const rules = [
    { pattern: /STARBUCKS.*#\d+/, normalized: 'Starbucks' },
    { pattern: /AMAZON\.COM.*AMZN\.COM/, normalized: 'Amazon' },
    { pattern: /UBER.*TRIP/, normalized: 'Uber' },
    // ... más reglas
  ];

  for (const rule of rules) {
    if (rule.pattern.test(description)) {
      return rule.normalized;
    }
  }

  // Paso 2: Usar el cluster (tomar el string más corto)
  const clusterMembers = getClusterMembers(clusterId);
  const shortest = clusterMembers.sort((a, b) => a.length - b.length)[0];

  // Limpiar: quitar números, caps, trim
  return cleanString(shortest);
}
```

**Características**:
- Reglas con regex (empezar con ~20 reglas comunes)
- Fallback a cluster si no hay regla
- Limpieza básica (remove caps, números, trim)

---

### Stage 4: Canonical Store

**Input**: Observation + merchant normalizado
**Output**: Row en tabla `transactions`

```javascript
function createCanonicalTransaction(observation, normalizedMerchant) {
  const txn = {
    id: uuid(),
    account: observation.account,
    date: observation.date,
    merchant: normalizedMerchant,
    amount: parseFloat(observation.amount_raw),
    currency: observation.currency,
    type: classifyType(observation), // 'expense' | 'income' | 'transfer'
    confidence: calculateConfidence(observation),
    created_at: now(),
    updated_at: now()
  };

  db.insert('transactions', txn);

  // Link observation → transaction
  db.update('observations', { canonical_id: txn.id }, { id: observation.id });

  return txn;
}
```

**Características**:
- Convierte `amount_raw` (string) → `amount` (float)
- Clasifica tipo (expense/income/transfer)
- Calcula confidence score
- Linkea observation → transaction

---

## Transfer Linking

**Problema**: Cuando mueves $1000 de BofA a Wise, son 2 transactions separadas.

**Solución**: Detectar y linkear.

```javascript
function linkTransfers() {
  const candidates = db.query(`
    SELECT * FROM transactions
    WHERE type = 'transfer'
    AND transfer_pair_id IS NULL
  `);

  for (const txn of candidates) {
    // Buscar pareja: mismo monto, fechas cercanas, cuentas diferentes
    const pair = db.queryOne(`
      SELECT * FROM transactions
      WHERE id != ?
      AND type = 'transfer'
      AND transfer_pair_id IS NULL
      AND ABS(amount + ?) < 0.01
      AND ABS(julianday(date) - julianday(?)) <= 3
      AND account != ?
    `, [txn.id, txn.amount, txn.date, txn.account]);

    if (pair) {
      // Link bidireccional
      db.update('transactions', { transfer_pair_id: pair.id }, { id: txn.id });
      db.update('transactions', { transfer_pair_id: txn.id }, { id: pair.id });
    }
  }
}
```

**Heurística**:
- Mismo monto (± $0.01 para tolerancia)
- Fechas cercanas (± 3 días)
- Cuentas diferentes
- Ambos tipo = 'transfer'

---

## Tech Stack

### Backend
- **Node.js** - Runtime
- **better-sqlite3** - SQLite driver (síncrono, rápido)
- **pdf-parse** - Extraer texto de PDFs
- **string-similarity** - Clustering (basado en Levenshtein)
- **crypto** - Hashing PDFs para dedup

### Frontend
- **Electron** - Desktop app
- **React** - UI framework
- **TailwindCSS** - Styling
- **date-fns** - Manejo de fechas
- **Recharts** - (Opcional) Para visualizaciones futuras

### Database
- **SQLite** - Local, rápido, sin servidor
- **2 tablas**: observations + transactions
- **~10 índices** para queries rápidas

---

## File Structure

```
finance-app/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── db.js            # SQLite connection
│   │   ├── parsers/         # 4 parsers
│   │   │   ├── bofa.js
│   │   │   ├── apple-card.js
│   │   │   ├── wise.js
│   │   │   └── scotia.js
│   │   ├── pipeline/        # 4 stages
│   │   │   ├── parse.js
│   │   │   ├── cluster.js
│   │   │   ├── normalize.js
│   │   │   └── canonical.js
│   │   └── main.js          # Entry point
│   │
│   ├── renderer/            # Electron renderer (React)
│   │   ├── components/
│   │   │   ├── Timeline.jsx
│   │   │   ├── TransactionDetail.jsx
│   │   │   ├── Filters.jsx
│   │   │   └── UploadZone.jsx
│   │   ├── App.jsx
│   │   └── index.jsx
│   │
│   └── shared/              # Código compartido
│       ├── types.js         # TypeScript types (opcional)
│       └── utils.js
│
├── docs/                    # Esta documentación
├── db/                      # SQLite file (gitignored)
├── uploads/                 # PDFs temporales (gitignored)
├── package.json
└── README.md
```

**LOC estimado**:
- Parsers: ~400 LOC (100 por parser)
- Pipeline: ~200 LOC (50 por stage)
- UI: ~800 LOC
- DB/utils: ~200 LOC
- **Total: ~1,600 LOC** (más ~200 de boilerplate = ~1,800)

---

## Data Flow Completo

```
1. Usuario arrastra PDF a UploadZone
   ↓
2. Electron main process recibe path
   ↓
3. getParser(account).parse(pdf)
   → Insert en observations
   ↓
4. clusterMerchants()
   → Asigna cluster_id
   ↓
5. normalizeMerchant(description, cluster)
   → Merchant limpio
   ↓
6. createCanonicalTransaction()
   → Insert en transactions
   → Link observation.canonical_id
   ↓
7. linkTransfers()
   → Detecta y linkea pares
   ↓
8. UI re-fetch transactions
   → Timeline se actualiza
   ↓
9. Usuario ve transacciones limpias
```

**Tiempo total**: ~2-5 segundos para un PDF con 100 transacciones.

---

## Principios de diseño

### 1. Immutable observations
Una vez guardado, nunca se edita. Si hay error, delete y re-upload.

### 2. Regenerable canonical
Si cambias reglas de normalización, puedes regenerar `transactions` desde `observations`.

```javascript
function regenerateCanonical() {
  db.execute('DELETE FROM transactions');
  const observations = db.query('SELECT * FROM observations');
  observations.forEach(obs => {
    // Re-run pipeline desde stage 2
    const cluster = findCluster(obs);
    const merchant = normalizeMerchant(obs.description, cluster);
    createCanonicalTransaction(obs, merchant);
  });
  linkTransfers();
}
```

### 3. Simple over clever
- No ML, solo string similarity
- Hardcoded rules OK
- Threshold fijos (0.8 para similarity, 3 días para transfers)

### 4. Local first
- Todo en SQLite
- No API calls
- No network needed (excepto initial download de app)

---

## Próximo paso

Lee los **User Flows** para entender cómo Darwin usa la app:

- [flow-1-timeline-continuo.md](flow-1-timeline-continuo.md) ⭐ Empieza aquí
- [flow-2-upload-pdf.md](flow-2-upload-pdf.md)
- [flow-3-view-transaction.md](flow-3-view-transaction.md)
- [flow-4-merchant-normalization.md](flow-4-merchant-normalization.md)
- [flow-5-transfer-linking.md](flow-5-transfer-linking.md)
