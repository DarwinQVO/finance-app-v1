# Flow 4: Merchant Normalization

**Cómo "STARBUCKS STORE #12345" se convierte en "Starbucks"**

## Funcionalidad

Normaliza merchant names de PDFs bancarios.

**Ejemplo**:
```
Input:
  STARBUCKS STORE #12345 SANTA MONICA CA
  STARBUCKS STORE #67890 LOS ANGELES CA
  STARBUCKS #11111

Output:
  Starbucks (3 transacciones agrupadas)
```

---

## Implementación: 2-step normalization

### Step 1: Clustering
Agrupar strings similares.

```
Cluster 1: "Starbucks"
  - STARBUCKS STORE #12345 SANTA MONICA CA
  - STARBUCKS STORE #67890 LOS ANGELES CA
  - STARBUCKS #11111

Cluster 2: "Amazon"
  - AMAZON.COM*M89JF2K3 AMZN.COM/BILL WA
  - AMAZON.COM*K12HS8PQ AMZN.COM/BILL WA

Cluster 3: "Uber"
  - UBER *TRIP HLP.UBER.COM CA
  - UBER *EATS HLP.UBER.COM CA
```

### Step 2: Normalization
Aplicar reglas para limpiar.

```
STARBUCKS STORE #12345 → Starbucks
AMAZON.COM*M89JF2K3 → Amazon
UBER *TRIP HLP.UBER.COM → Uber
```

---

## Story: el usuario sube PDFs y ve normalización automática

### Escena 1: PDF raw

el usuario sube `bofa_2025_09.pdf`. El PDF tiene esto:

```
Sep 28  STARBUCKS STORE #12345 SANTA MONICA CA    -5.67
Sep 15  STARBUCKS STORE #67890 LOS ANGELES CA     -6.23
Sep 3   STARBUCKS #11111                          -4.89
```

### Escena 2: Pipeline corre

**Stage 1: Clustering**
```javascript
// Encuentra que los 3 strings son similares
similarity("STARBUCKS STORE #12345", "STARBUCKS STORE #67890") = 0.89
similarity("STARBUCKS STORE #12345", "STARBUCKS #11111") = 0.82

// Los agrupa en cluster_abc123
```

**Stage 2: Normalization**
```javascript
// Load rule from normalization_rules table
SELECT * FROM normalization_rules
WHERE is_active = TRUE AND pattern LIKE '%STARBUCKS%';

// Result:
// pattern: "STARBUCKS.*#?\d+"
// normalized_merchant: "Starbucks"

// Aplica regla (UPDATE transactions.merchant)
UPDATE transactions SET merchant = 'Starbucks'
WHERE original_description LIKE '%STARBUCKS%';

// Result:
// "STARBUCKS STORE #12345" → "Starbucks"
// "STARBUCKS STORE #67890" → "Starbucks"
// "STARBUCKS #11111" → "Starbucks"
```

### Escena 3: Timeline limpio

el usuario ve esto:
```
┌──────────────────────────────────────────────────┐
│  Sep 28  Starbucks              -$5.67  USD     │
│  Sep 15  Starbucks              -$6.23  USD     │
│  Sep 3   Starbucks              -$4.89  USD     │
└──────────────────────────────────────────────────┘
```

**¡Perfecto!** 3 merchants normalizados. Todo se ve limpio.

---

## Stage 2: Clustering (Detalle técnico)

### Algoritmo: String similarity

Usamos **Levenshtein distance** (via `string-similarity` library).

```javascript
import stringSimilarity from 'string-similarity';

function clusterMerchants(observations) {
  const clusters = {};
  const clusterMap = {}; // observation.id → cluster_id

  observations.forEach(obs => {
    const desc = obs.description.toUpperCase();

    // Buscar cluster existente con similarity > threshold
    let foundCluster = null;
    let maxSimilarity = 0;

    for (const [clusterId, members] of Object.entries(clusters)) {
      // Comparar con el primer miembro del cluster (representativo)
      const similarity = stringSimilarity.compareTwoStrings(desc, members[0]);

      if (similarity > 0.8 && similarity > maxSimilarity) {
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

  return clusterMap; // { obs_id: cluster_id }
}
```

**Config-driven threshold**: Configurable via `stages.clustering.similarityThreshold` (default: 0.8).

```javascript
// From pipeline config
const threshold = config.stages.clustering.similarityThreshold || 0.8;
```

**Resultado**: Transactions agrupadas por similitud (ephemeral clusters, no persisted).

---

### Ejemplo de clustering

**Input**:
```
obs_1: "STARBUCKS STORE #12345"
obs_2: "STARBUCKS STORE #67890"
obs_3: "AMAZON.COM*M89JF2K3"
obs_4: "STARBUCKS #11111"
```

**Proceso**:
```
1. obs_1 → nuevo cluster → cluster_abc
   clusters = {
     cluster_abc: ["STARBUCKS STORE #12345"]
   }

2. obs_2 → similarity con obs_1 = 0.89 (>0.8) → agregar a cluster_abc
   clusters = {
     cluster_abc: ["STARBUCKS STORE #12345", "STARBUCKS STORE #67890"]
   }

3. obs_3 → similarity con obs_1 = 0.15 (<0.8) → nuevo cluster → cluster_def
   clusters = {
     cluster_abc: ["STARBUCKS STORE #12345", "STARBUCKS STORE #67890"],
     cluster_def: ["AMAZON.COM*M89JF2K3"]
   }

4. obs_4 → similarity con obs_1 = 0.82 (>0.8) → agregar a cluster_abc
   clusters = {
     cluster_abc: ["STARBUCKS STORE #12345", "STARBUCKS STORE #67890", "STARBUCKS #11111"],
     cluster_def: ["AMAZON.COM*M89JF2K3"]
   }
```

**Output**:
```javascript
{
  obs_1: "cluster_abc",
  obs_2: "cluster_abc",
  obs_3: "cluster_def",
  obs_4: "cluster_abc"
}
```

---

## Stage 2: Normalization (Detalle técnico)

### LEGO Architecture: DB-Driven Rules 🧱

Las reglas se cargan desde la tabla `normalization_rules` - NO hardcodeadas.

```javascript
// Load rules from DB (NOT hardcoded array)
async function loadNormalizationRules() {
  return await db.all(`
    SELECT id, pattern, normalized_merchant, priority, category_hint
    FROM normalization_rules
    WHERE is_active = TRUE
    ORDER BY priority DESC
  `);
}

async function normalizeTransactions({ transactions, clusterMap, config }) {
  // Load rules dynamically
  const rules = await loadNormalizationRules();

  const updates = [];

  for (const txn of transactions) {
    let normalizedMerchant = null;
    let matchedRuleId = null;

    // Try rules first
    if (config.useRules) {
      for (const rule of rules) {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(txn.original_description)) {
          normalizedMerchant = rule.normalized_merchant;
          matchedRuleId = rule.id;
          break;
        }
      }
    }

    // Fallback to cluster
    if (!normalizedMerchant && config.useClusters && clusterMap.has(txn.id)) {
      normalizedMerchant = normalizeFromCluster(
        txn.original_description,
        clusterMap.get(txn.id)
      );
    }

    // Fallback to original
    if (!normalizedMerchant && config.fallbackToOriginal) {
      normalizedMerchant = cleanString(txn.original_description);
    }

    // UPDATE merchant field (not INSERT)
    if (normalizedMerchant) {
      await db.run(`
        UPDATE transactions
        SET merchant = ?,
            normalization_rule_id = ?,
            updated_at = ?
        WHERE id = ?
      `, normalizedMerchant, matchedRuleId, new Date().toISOString(), txn.id);

      updates.push({ id: txn.id, merchant: normalizedMerchant });
    }
  }

  return { updates, stats: { rulesMatched: updates.length } };
}
```

**Add rule WITHOUT code change**:
```sql
-- el usuario adds new rule via SQL or UI
INSERT INTO normalization_rules (pattern, normalized_merchant, priority, is_active)
VALUES ('WHOLE\s*FOODS.*#?\d+', 'Whole Foods', 100, TRUE);

-- Next pipeline run uses this rule automatically ✅
```

---

### Método 2: Fallback a Cluster

Si no hay regla, usamos el cluster para normalizar (ephemeral, no persisted).

```javascript
function normalizeFromCluster(description, clusterId) {
  // Get cluster members from ephemeral clusterMap (not DB)
  // clusterMap is passed from Stage 1 (clustering)

  // In practice, take the shortest member of the cluster
  // (shortest strings are usually cleanest)
  const clusterMembers = getClusterMembers(clusterId);

  const shortest = clusterMembers
    .sort((a, b) => a.length - b.length)[0];

  // Clean: remove numbers, normalize caps, trim
  return cleanString(shortest);
}

function cleanString(str) {
  return str
    .replace(/#\d+/g, '')                 // Remove #12345
    .replace(/\*[A-Z0-9]+/g, '')          // Remove *M89JF2K3
    .replace(/\s+/g, ' ')                 // Normalize spaces
    .replace(/[^a-zA-Z0-9\s&]/g, '')      // Remove weird symbols
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
```

**Ejemplo**:
```
Input: "STARBUCKS STORE #12345 SANTA MONICA CA"
Shortest in cluster: "STARBUCKS #11111"
After clean: "Starbucks"
```

**Note**: Clusters are NOT stored in DB - they're computed on-demand during pipeline execution.

---

## Confidence Score

Calculamos un score (0.0-1.0) para indicar qué tan segura es la normalización.

```javascript
function calculateConfidence(txn, normalizedMerchant, matchedRuleId, clusterId) {
  let confidence = 0.0;

  // +50% if matched DB rule
  if (matchedRuleId) {
    const rule = await db.get(
      'SELECT priority FROM normalization_rules WHERE id = ?',
      matchedRuleId
    );

    // Higher priority rules = higher confidence
    if (rule.priority >= 100) {
      confidence += 0.5;
    } else if (rule.priority >= 50) {
      confidence += 0.4;
    } else {
      confidence += 0.3;
    }
  }

  // +30% if cluster has >5 members
  if (clusterId) {
    const clusterSize = getClusterSize(clusterId);
    if (clusterSize >= 5) {
      confidence += 0.3;
    } else if (clusterSize >= 3) {
      confidence += 0.2;
    } else {
      confidence += 0.1;
    }
  }

  // +20% if similarity average is high
  if (clusterId) {
    const avgSimilarity = getAverageClusterSimilarity(clusterId);
    if (avgSimilarity >= 0.9) {
      confidence += 0.2;
    } else if (avgSimilarity >= 0.8) {
      confidence += 0.1;
    }
  }

  return Math.min(confidence, 1.0);
}
```

**Ejemplos**:
```
"STARBUCKS STORE #12345"
→ Matched DB rule (priority: 100) ✓ (+0.5)
→ Cluster size: 12 ✓ (+0.3)
→ Avg similarity: 0.92 ✓ (+0.2)
→ Confidence: 1.0 (100%)

"RANDOM MERCHANT XYZ"
→ No rule match ✗ (+0.0)
→ Cluster size: 1 ✗ (+0.1)
→ Avg similarity: N/A (+0.0)
→ Confidence: 0.1 (10%)
```

---

## Extensibility: Adding Rules 🧱

**Current State**: DB-driven LEGO architecture (✅ already implemented).

el usuario puede agregar reglas de 2 formas:

### Method 1: SQL Insert
```sql
INSERT INTO normalization_rules (
  pattern, normalized_merchant, priority, category_hint, is_active
) VALUES (
  'TARGET.*T-\d+', 'Target', 95, 'Shopping', TRUE
);
```

### Method 2: Via UI (future)
```
┌─────────────────────────────────────┐
│  Add Normalization Rule             │
├─────────────────────────────────────┤
│  Pattern (regex):                   │
│  [TARGET.*T-\d+           ]         │
│                                     │
│  Normalized Merchant:               │
│  [Target                  ]         │
│                                     │
│  Priority: [95           ]          │
│  Category: [Shopping ▼   ]          │
│                                     │
│  [Cancel]  [Save Rule]              │
└─────────────────────────────────────┘
```

**No code changes needed** - next pipeline run uses new rule automatically.

**Future**: ML learns from manual corrections and suggests rules.

---

## Testing normalization

el usuario puede ver qué cluster tiene cada merchant.

### UI: "View cluster"

En el panel de detalles:
```
┌─────────────────────────────────────────┐
│  Starbucks                              │
│  -$5.67 USD                             │
├─────────────────────────────────────────┤
│  🔗 Cluster                             │
│  cluster_abc123 (12 members)            │
│                                         │
│  [View all members]                     │
└─────────────────────────────────────────┘
```

**Click en "View all members"**:
```
┌─────────────────────────────────────────┐
│  Cluster: cluster_abc123                │
├─────────────────────────────────────────┤
│  12 members:                            │
│                                         │
│  • STARBUCKS STORE #12345               │
│  • STARBUCKS STORE #67890               │
│  • STARBUCKS #11111                     │
│  • STARBUCKS STORE #22222               │
│  • STARBUCKS #33333                     │
│  ... 7 more                             │
│                                         │
│  Normalized to: "Starbucks"             │
│  Confidence: 95%                        │
│                                         │
│  [Close]                                │
└─────────────────────────────────────────┘
```

**Uso**: el usuario puede verificar que el clustering es correcto.

---

## Edge cases

### 1. Cluster con 1 miembro

**Síntoma**: Merchant único, no hay otros similares.

**Resultado**:
```
Cluster: cluster_xyz (1 member)
Normalized: "Random Merchant Xyz" (cleaned)
Confidence: 10%
```

**OK**: La normalización funciona, pero con bajo confidence.

---

### 2. False positive en clustering

**Síntoma**: Dos merchants diferentes pero strings similares.

**Ejemplo**:
```
"SHELL GAS STATION #1234"
"SHELL OIL COMPANY PAYMENT"
```

Similarity = 0.85 → Agrupados en mismo cluster.

**Problema**: Son merchants diferentes.

**Solución inicial**: Hardcodear regla específica:
```javascript
{ pattern: /SHELL GAS STATION/, normalized: 'Shell Gas' },
{ pattern: /SHELL OIL COMPANY/, normalized: 'Shell Oil' },
```

**Solución futura**: Permitir split cluster manualmente.

---

### 3. Threshold muy bajo

**Síntoma**: Si threshold = 0.5, agrupa merchants demasiado diferentes.

**Ejemplo**:
```
"STARBUCKS" similarity con "STARTBUCKS" = 0.9 ✓ (typo)
"STARBUCKS" similarity con "STAR MARKET" = 0.6 ✗ (diferente)
```

**Valor óptimo**: 0.8 (encontrado empíricamente).

---

## Performance

### Clustering de 12,000 observations

```javascript
// Naïve approach: O(n²)
for each observation {
  for each cluster {
    calculate similarity
  }
}
// ~144,000,000 comparaciones → lento
```

### Optimización: Comparar solo con primer miembro

```javascript
// Optimized: O(n * k) donde k = # clusters
for each observation {
  for each cluster {
    compare with cluster[0] only
  }
}
// ~12,000 * 50 = 600,000 comparaciones → rápido
```

**Tiempo**: ~5 segundos para 12k observations en laptop promedio.

---

## Regenerar Normalización

Si el usuario cambia las reglas, puede re-correr el pipeline para actualizar los merchants.

```javascript
async function regenerateNormalization() {
  // 1. Get all transactions
  const transactions = await db.all('SELECT * FROM transactions');

  // 2. Re-cluster (ephemeral)
  const { clusterMap } = await clusterMerchants(transactions, {
    similarityThreshold: 0.8
  });

  // 3. Re-normalize (UPDATE merchant field)
  await normalizeTransactions({
    transactions,
    clusterMap,
    config: {
      useRules: true,
      useClusters: true,
      fallbackToOriginal: true
    }
  });

  // 4. Re-classify types (if needed)
  await classifyTransactions({ transactions, config });

  // 5. Re-link transfers (if needed)
  await linkTransfers(transactions, config);
}
```

**Key Difference from 2-table architecture**:
- No DELETE/INSERT (preserves transaction IDs and history)
- Only UPDATE fields: `merchant`, `type`, `transfer_pair_id`
- `original_description` remains immutable
- Faster and safer (no data loss risk)

**Tiempo**: ~5 segundos for 12k transactions.

**Uso**: el usuario adds rule → re-runs pipeline → sees updated merchants.

---

## Tabla de reglas (inicial)

| Pattern | Normalized | Notes |
|---------|-----------|-------|
| `STARBUCKS.*#\d+` | Starbucks | Store number variable |
| `AMAZON\.COM\*` | Amazon | Order ID variable |
| `UBER \*TRIP` | Uber | Ride |
| `UBER \*EATS` | Uber Eats | Food delivery |
| `NETFLIX` | Netflix | Subscription |
| `SPOTIFY` | Spotify | Music |
| `SHELL.*\d{5}` | Shell | Gas station |
| `CHEVRON.*\d{5}` | Chevron | Gas station |
| `COSTCO.*\d{4}` | Costco | Wholesale |
| `TARGET.*T-\d+` | Target | Store code |
| `WALMART.*\d{4}` | Walmart | Store number |
| `DOORDASH` | DoorDash | Food delivery |
| `GRUBHUB` | GrubHub | Food delivery |
| `SCE PAYMENT` | Southern California Edison | Utility |
| `AT&T` | AT&T | Phone/Internet |

**Expandir a ~50 reglas** durante desarrollo al ver merchants reales.

---

## Resumen

### Stage 1: Clustering
- **Input**: Transactions with `original_description`
- **Algorithm**: String similarity (Levenshtein)
- **Threshold**: Config-driven (default: 0.8)
- **Output**: Ephemeral `clusterMap` (NOT stored in DB)
- **LEGO Score**: 9/10 (optional, swappable, config-driven)
- **LOC**: ~50

### Stage 2: Normalization
- **Input**: Transactions + clusterMap (from Stage 1)
- **Method 1**: DB-driven rules from `normalization_rules` table
- **Method 2**: Fallback to cluster (shortest + clean)
- **Method 3**: Fallback to `original_description` (cleaned)
- **Output**: UPDATE `transactions.merchant` field
- **LEGO Score**: 9/10 (DB-driven, extensible, no code changes)
- **LOC**: ~100

### LEGO Criteria Met ✅
1. ✅ Config-driven (rules in DB, threshold configurable)
2. ✅ Swappable (can replace clustering algorithm)
3. ✅ Optional (can disable via config)
4. ✅ Extensible (add rules via SQL INSERT)
5. ✅ Testable (unit tests work independently)
6. ✅ Clear interface (see `0-pipeline-interfaces.md`)
7. ✅ Fault-tolerant (errors don't cascade)

### Total Pipeline Performance
- Clustering: ~3 sec for 12k transactions
- Normalization: ~2 sec
- **Total**: ~5 sec

---

**Próximo flow**: Lee [flow-5-transfer-linking.md](flow-5-transfer-linking.md) para entender cómo se linkean transfers.
