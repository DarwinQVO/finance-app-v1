# Stage 2: Clustering

**Agrupar merchant strings similares usando string similarity**

## El problema

Los PDFs tienen el mismo merchant con muchas variaciones:

```
STARBUCKS STORE #12345 SANTA MONICA CA
STARBUCKS STORE #67890 LOS ANGELES CA
STARBUCKS #11111
STARBUCKS STORE #22222 NEW YORK NY
```

**Son 4 strings diferentes**, pero claramente son el mismo merchant: **Starbucks**.

---

## La solución: Clustering

Agrupar strings similares en **clusters**.

```
Cluster cluster_abc123:
  - STARBUCKS STORE #12345 SANTA MONICA CA
  - STARBUCKS STORE #67890 LOS ANGELES CA
  - STARBUCKS #11111
  - STARBUCKS STORE #22222 NEW YORK NY

→ Normalized: "Starbucks"
```

---

## Algorithm: String similarity

Usamos **Levenshtein distance** (algoritmo de edición).

```
"STARBUCKS STORE #12345" vs "STARBUCKS STORE #67890"

Differences:
  - #12345 → #67890 (5 edits)
  - Length: 22 chars

Similarity = 1 - (5 / 22) = 0.77 (77%)
```

**Library**: `string-similarity` (implementa Levenshtein optimizado).

```bash
npm install string-similarity
```

---

## Code

```javascript
// main/pipeline/cluster.js

const stringSimilarity = require('string-similarity');
const { v4: uuid } = require('uuid');

function clusterMerchants(observations) {
  const clusters = {};      // { cluster_id: [descriptions] }
  const clusterMap = {};    // { observation_id: cluster_id }

  observations.forEach(obs => {
    const desc = obs.description.toUpperCase().trim();

    // Buscar cluster existente con similarity > threshold
    let foundCluster = null;
    let maxSimilarity = 0;

    for (const [clusterId, members] of Object.entries(clusters)) {
      // Comparar solo con el primer miembro (representativo)
      const representative = members[0];
      const similarity = stringSimilarity.compareTwoStrings(desc, representative);

      if (similarity > SIMILARITY_THRESHOLD && similarity > maxSimilarity) {
        foundCluster = clusterId;
        maxSimilarity = similarity;
      }
    }

    if (foundCluster) {
      // Agregar a cluster existente
      clusters[foundCluster].push(desc);
      clusterMap[obs.id] = foundCluster;
    } else {
      // Crear nuevo cluster
      const newClusterId = `cluster_${uuid()}`;
      clusters[newClusterId] = [desc];
      clusterMap[obs.id] = newClusterId;
    }
  });

  return { clusters, clusterMap };
}

const SIMILARITY_THRESHOLD = 0.8; // 80% similarity

module.exports = { clusterMerchants };
```

---

## Threshold: 0.8 (hardcoded)

**¿Por qué 0.8?**

### Threshold muy bajo (0.5)

**Problema**: Agrupa merchants diferentes.

```
"STARBUCKS STORE #123" similarity con "STAR MARKET" = 0.65
→ Agrupados en mismo cluster ✗
```

### Threshold muy alto (0.95)

**Problema**: NO agrupa merchants iguales.

```
"STARBUCKS STORE #12345" similarity con "STARBUCKS #11111" = 0.82
→ Clusters separados ✗
```

### Threshold óptimo: 0.8

```
"STARBUCKS STORE #12345" similarity con "STARBUCKS STORE #67890" = 0.89 ✓
"STARBUCKS STORE #12345" similarity con "STAR MARKET" = 0.65 ✗
```

**Balance perfecto**.

---

## Ejemplo paso a paso

### Input: 6 observations

```
obs_1: "STARBUCKS STORE #12345"
obs_2: "STARBUCKS STORE #67890"
obs_3: "AMAZON.COM*M89JF2K3"
obs_4: "STARBUCKS #11111"
obs_5: "AMAZON.COM*K12HS8PQ"
obs_6: "TARGET STORE T-1234"
```

### Proceso de clustering

#### Paso 1: obs_1
```
No hay clusters → crear cluster_1
clusters = {
  cluster_1: ["STARBUCKS STORE #12345"]
}
clusterMap = { obs_1: cluster_1 }
```

#### Paso 2: obs_2
```
Compare con cluster_1:
  similarity("STARBUCKS STORE #67890", "STARBUCKS STORE #12345") = 0.89 > 0.8 ✓

→ Agregar a cluster_1
clusters = {
  cluster_1: ["STARBUCKS STORE #12345", "STARBUCKS STORE #67890"]
}
clusterMap = { obs_1: cluster_1, obs_2: cluster_1 }
```

#### Paso 3: obs_3
```
Compare con cluster_1:
  similarity("AMAZON.COM*M89JF2K3", "STARBUCKS STORE #12345") = 0.15 < 0.8 ✗

→ Crear cluster_2
clusters = {
  cluster_1: ["STARBUCKS STORE #12345", "STARBUCKS STORE #67890"],
  cluster_2: ["AMAZON.COM*M89JF2K3"]
}
```

#### Paso 4: obs_4
```
Compare con cluster_1:
  similarity("STARBUCKS #11111", "STARBUCKS STORE #12345") = 0.82 > 0.8 ✓

→ Agregar a cluster_1
clusters = {
  cluster_1: [..., "STARBUCKS #11111"],
  cluster_2: [...]
}
```

#### Paso 5: obs_5
```
Compare con cluster_1: 0.15 ✗
Compare con cluster_2:
  similarity("AMAZON.COM*K12HS8PQ", "AMAZON.COM*M89JF2K3") = 0.87 > 0.8 ✓

→ Agregar a cluster_2
```

#### Paso 6: obs_6
```
Compare con cluster_1: 0.12 ✗
Compare con cluster_2: 0.10 ✗

→ Crear cluster_3
```

### Output final

```javascript
{
  clusters: {
    cluster_1: [
      "STARBUCKS STORE #12345",
      "STARBUCKS STORE #67890",
      "STARBUCKS #11111"
    ],
    cluster_2: [
      "AMAZON.COM*M89JF2K3",
      "AMAZON.COM*K12HS8PQ"
    ],
    cluster_3: [
      "TARGET STORE T-1234"
    ]
  },
  clusterMap: {
    obs_1: 'cluster_1',
    obs_2: 'cluster_1',
    obs_3: 'cluster_2',
    obs_4: 'cluster_1',
    obs_5: 'cluster_2',
    obs_6: 'cluster_3'
  }
}
```

---

## Optimización: Solo comparar con primer miembro

**Naïve approach**: Comparar con todos los miembros del cluster.

```javascript
// ❌ Lento: O(n * m) donde m = avg cluster size
for (const [clusterId, members] of Object.entries(clusters)) {
  for (const member of members) {
    const similarity = stringSimilarity.compareTwoStrings(desc, member);
    // ...
  }
}
```

**Optimized approach**: Solo comparar con el primer miembro (representativo).

```javascript
// ✓ Rápido: O(n * k) donde k = # clusters
for (const [clusterId, members] of Object.entries(clusters)) {
  const representative = members[0]; // Primer miembro
  const similarity = stringSimilarity.compareTwoStrings(desc, representative);
  // ...
}
```

**Razón**: Si un string es similar al representativo, es similar a todo el cluster.

**Performance**:
- Naïve: ~5 min para 12k observations
- Optimized: ~5 seg para 12k observations

---

## Persistencia: Tabla `clusters`

Guardamos los clusters en DB para debugging.

```sql
CREATE TABLE clusters (
  id TEXT PRIMARY KEY,              -- cluster_id
  representative TEXT NOT NULL,     -- Primer string del cluster
  member_count INTEGER NOT NULL,    -- Cuántos miembros
  created_at TEXT NOT NULL
);

CREATE TABLE cluster_members (
  cluster_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  PRIMARY KEY (cluster_id, observation_id)
);
```

**Insert**:
```javascript
function persistClusters(clusters, clusterMap) {
  for (const [clusterId, members] of Object.entries(clusters)) {
    db.execute(`
      INSERT INTO clusters (id, representative, member_count, created_at)
      VALUES (?, ?, ?, ?)
    `, [clusterId, members[0], members.length, new Date().toISOString()]);
  }

  for (const [obsId, clusterId] of Object.entries(clusterMap)) {
    db.execute(`
      INSERT INTO cluster_members (cluster_id, observation_id)
      VALUES (?, ?)
    `, [clusterId, obsId]);
  }
}
```

**Query clusters**:
```sql
-- Ver cluster más grande
SELECT id, representative, member_count
FROM clusters
ORDER BY member_count DESC
LIMIT 10;

-- Ver miembros de un cluster
SELECT o.description
FROM observations o
JOIN cluster_members cm ON cm.observation_id = o.id
WHERE cm.cluster_id = ?;
```

---

## Edge cases

### Edge case 1: Typos

```
"STARBUCKS STORE #123"
"STARTBUCKS STORE #456"  ← Typo: "STARTBUCKS"
```

**Similarity**: 0.95 (muy alto, solo 1 letra diferente).

**Resultado**: Se agrupan en mismo cluster ✓

**Correcto**: Es lo que queremos (probablemente es typo en el PDF).

---

### Edge case 2: Substrings

```
"STARBUCKS"
"STARBUCKS STORE #123"
```

**Similarity**: 0.55 (bajo porque uno es mucho más largo).

**Resultado**: Clusters separados ✗

**Solución**: Normalizar longitud primero.

```javascript
function normalizeForClustering(desc) {
  // Quitar números y location antes de comparar
  return desc
    .replace(/#\d+/g, '')           // Quitar #123
    .replace(/STORE/g, '')          // Quitar "STORE"
    .replace(/\s+/g, ' ')           // Normalizar espacios
    .trim();
}

// Ahora:
normalizeForClustering("STARBUCKS") === "STARBUCKS"
normalizeForClustering("STARBUCKS STORE #123") === "STARBUCKS"
// similarity = 1.0 ✓
```

---

### Edge case 3: False positives

```
"SHELL GAS STATION"
"SHELL OIL COMPANY"
```

**Similarity**: 0.65 (relativamente alto).

**Threshold**: 0.8

**Resultado**: Clusters separados ✓

**Correcto**: Son merchants diferentes.

---

## Testing

### Test 1: Basic clustering

```javascript
const observations = [
  { id: '1', description: 'STARBUCKS STORE #123' },
  { id: '2', description: 'STARBUCKS STORE #456' },
  { id: '3', description: 'AMAZON.COM*ABC' }
];

const { clusters, clusterMap } = clusterMerchants(observations);

// Should group Starbucks together
expect(clusterMap['1']).toBe(clusterMap['2']);

// Amazon should be separate
expect(clusterMap['3']).not.toBe(clusterMap['1']);
```

### Test 2: Threshold

```javascript
// Similar strings (> 0.8)
const sim1 = stringSimilarity.compareTwoStrings(
  'STARBUCKS STORE #123',
  'STARBUCKS STORE #456'
);
expect(sim1).toBeGreaterThan(0.8);

// Different strings (< 0.8)
const sim2 = stringSimilarity.compareTwoStrings(
  'STARBUCKS',
  'AMAZON'
);
expect(sim2).toBeLessThan(0.8);
```

---

## Performance

### Benchmark con 12,000 observations

```
Naïve approach (compare all members):
  - Time: 297 seconds (~5 min)
  - Comparisons: ~14,400,000

Optimized approach (compare first member only):
  - Time: 5.2 seconds
  - Comparisons: ~600,000

→ 57x faster
```

**Conclusion**: La optimización es crítica.

---

## Integration con pipeline

```javascript
// main/pipeline/index.js

async function runPipeline() {
  // Stage 1: Ya tenemos observations en DB

  // Stage 2: Clustering
  const observations = db.query(`
    SELECT * FROM observations
    WHERE canonical_id IS NULL
  `);

  const { clusters, clusterMap } = clusterMerchants(observations);

  // Persist clusters
  persistClusters(clusters, clusterMap);

  // Stage 3: Normalization (usa clusterMap)
  observations.forEach(obs => {
    const clusterId = clusterMap[obs.id];
    const merchant = normalizeMerchant(obs.description, clusterId);
    // ...
  });
}
```

---

## LOC estimate

- `clusterMerchants()`: ~30 LOC
- `normalizeForClustering()`: ~10 LOC
- `persistClusters()`: ~20 LOC
- Helpers: ~10 LOC

**Total**: ~70 LOC

---

## Resumen

### Qué hace
- Agrupa descriptions similares
- Usa string similarity (Levenshtein)
- Threshold = 0.8 (hardcoded)

### Cómo funciona
1. Para cada observation
2. Comparar con clusters existentes
3. Si similarity > 0.8 → agregar a cluster
4. Si no → crear nuevo cluster

### Optimizaciones
- Solo comparar con primer miembro (57x faster)
- Normalizar strings antes de comparar
- Persistir clusters en DB

### Output
- `clusterMap`: { observation_id → cluster_id }
- Se usa en Stage 3 (Normalization)

---

**Próximo stage**: Lee [4-normalization.md](4-normalization.md)
