# Flow 4: Merchant Normalization

**Cómo "STARBUCKS STORE #12345" se convierte en "Starbucks"**

## El problema

Los PDFs bancarios tienen merchants FEOS:

```
STARBUCKS STORE #12345 SANTA MONICA CA
STARBUCKS STORE #67890 LOS ANGELES CA
STARBUCKS #11111
AMAZON.COM*M89JF2K3 AMZN.COM/BILL WA
AMAZON.COM*K12HS8PQ AMZN.COM/BILL WA
UBER *TRIP HLP.UBER.COM CA
UBER *EATS HLP.UBER.COM CA
```

**Resultado**: 7 merchants diferentes cuando debería ser 3 (Starbucks, Amazon, Uber).

---

## La solución: 2-step normalization

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

## Story: Darwin sube PDFs y ve normalización automática

### Escena 1: PDF raw

Darwin sube `bofa_2025_09.pdf`. El PDF tiene esto:

```
Sep 28  STARBUCKS STORE #12345 SANTA MONICA CA    -5.67
Sep 15  STARBUCKS STORE #67890 LOS ANGELES CA     -6.23
Sep 3   STARBUCKS #11111                          -4.89
```

### Escena 2: Pipeline corre

**Stage 2: Clustering**
```javascript
// Encuentra que los 3 strings son similares
similarity("STARBUCKS STORE #12345", "STARBUCKS STORE #67890") = 0.89
similarity("STARBUCKS STORE #12345", "STARBUCKS #11111") = 0.82

// Los agrupa en cluster_abc123
```

**Stage 3: Normalization**
```javascript
// Busca regla
pattern: /STARBUCKS.*#\d+/
normalized: "Starbucks"

// Aplica regla
"STARBUCKS STORE #12345" → "Starbucks"
"STARBUCKS STORE #67890" → "Starbucks"
"STARBUCKS #11111" → "Starbucks"
```

### Escena 3: Timeline limpio

Darwin ve esto:
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

**Threshold hardcodeado**: 0.8 (80% similarity).

**Resultado**: Observations agrupadas por similitud.

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

## Stage 3: Normalization (Detalle técnico)

### Método 1: Reglas hardcodeadas

Empezamos con ~20 reglas para los merchants más comunes de Darwin.

```javascript
const NORMALIZATION_RULES = [
  // Starbucks
  { pattern: /STARBUCKS.*#\d+/, normalized: 'Starbucks' },

  // Amazon
  { pattern: /AMAZON\.COM\*[A-Z0-9]+/, normalized: 'Amazon' },
  { pattern: /AMZN\.COM/, normalized: 'Amazon' },

  // Uber
  { pattern: /UBER \*TRIP/, normalized: 'Uber' },
  { pattern: /UBER \*EATS/, normalized: 'Uber Eats' },

  // Netflix, Spotify, etc
  { pattern: /NETFLIX/, normalized: 'Netflix' },
  { pattern: /SPOTIFY/, normalized: 'Spotify' },

  // Gas stations
  { pattern: /SHELL.*\d{5}/, normalized: 'Shell' },
  { pattern: /CHEVRON.*\d{5}/, normalized: 'Chevron' },

  // Grocery
  { pattern: /COSTCO.*\d{4}/, normalized: 'Costco' },
  { pattern: /TARGET.*T-\d+/, normalized: 'Target' },
  { pattern: /WALMART.*\d{4}/, normalized: 'Walmart' },

  // Food delivery
  { pattern: /DOORDASH/, normalized: 'DoorDash' },
  { pattern: /GRUBHUB/, normalized: 'GrubHub' },

  // Utilities
  { pattern: /SCE PAYMENT/, normalized: 'Southern California Edison' },
  { pattern: /AT&T/, normalized: 'AT&T' },

  // ... más reglas
];

function normalizeMerchant(description, clusterId) {
  // Buscar match en reglas
  for (const rule of NORMALIZATION_RULES) {
    if (rule.pattern.test(description)) {
      return rule.normalized;
    }
  }

  // Si no hay regla, usar cluster
  return normalizeFromCluster(description, clusterId);
}
```

---

### Método 2: Fallback a cluster

Si no hay regla, usamos el cluster para normalizar.

```javascript
function normalizeFromCluster(description, clusterId) {
  // Obtener todos los miembros del cluster
  const members = db.query(
    `SELECT DISTINCT description
     FROM observations
     WHERE cluster_id = ?`,
    [clusterId]
  );

  // Tomar el string más corto (suele ser el más limpio)
  const shortest = members
    .map(m => m.description)
    .sort((a, b) => a.length - b.length)[0];

  // Limpiar: quitar números, caps, trim
  return cleanString(shortest);
}

function cleanString(str) {
  return str
    .replace(/#\d+/g, '')        // Quitar #12345
    .replace(/\*[A-Z0-9]+/g, '') // Quitar *M89JF2K3
    .replace(/\s+/g, ' ')        // Normalizar espacios
    .replace(/[^a-zA-Z0-9\s]/g, '') // Quitar símbolos raros
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
```

**Ejemplo**:
```
Input: "STARBUCKS STORE #12345 SANTA MONICA CA"
Shortest en cluster: "STARBUCKS #11111"
Después de clean: "Starbucks"
```

---

## Confidence score

Calculamos un score (0.0-1.0) para indicar qué tan segura es la normalización.

```javascript
function calculateConfidence(observation, normalizedMerchant, clusterId) {
  let confidence = 0.0;

  // +50% si matched con regla
  const matchedRule = NORMALIZATION_RULES.find(r =>
    r.pattern.test(observation.description)
  );
  if (matchedRule) {
    confidence += 0.5;
  }

  // +30% si cluster tiene >5 miembros
  const clusterSize = getClusterSize(clusterId);
  if (clusterSize >= 5) {
    confidence += 0.3;
  } else if (clusterSize >= 3) {
    confidence += 0.2;
  } else {
    confidence += 0.1;
  }

  // +20% si similarity promedio es alta
  const avgSimilarity = getAverageClusterSimilarity(clusterId);
  if (avgSimilarity >= 0.9) {
    confidence += 0.2;
  } else if (avgSimilarity >= 0.8) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}
```

**Ejemplos**:
```
"STARBUCKS STORE #12345"
→ Matched rule ✓ (+0.5)
→ Cluster size: 12 ✓ (+0.3)
→ Avg similarity: 0.92 ✓ (+0.2)
→ Confidence: 1.0 (100%)

"RANDOM MERCHANT XYZ"
→ No rule ✗ (+0.0)
→ Cluster size: 1 ✗ (+0.1)
→ Avg similarity: N/A (+0.0)
→ Confidence: 0.1 (10%)
```

---

## Evolución de las reglas

**Phase 1**: Hardcodeadas (~20 reglas).

**Phase 2**: Darwin puede agregar reglas desde UI.

**Future**: ML aprende de las correcciones manuales.

Pero en Phase 1, hardcodeado está bien.

---

## Testing normalization

Darwin puede ver qué cluster tiene cada merchant.

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

**Uso**: Darwin puede verificar que el clustering es correcto.

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

## Regenerar normalización

Si Darwin cambia las reglas, puede regenerar todas las transacciones.

```javascript
function regenerateCanonical() {
  // 1. Delete todas las transactions
  db.execute('DELETE FROM transactions');

  // 2. Re-cluster
  const observations = db.query('SELECT * FROM observations');
  const clusterMap = clusterMerchants(observations);

  // 3. Re-normalize + re-create canonical
  observations.forEach(obs => {
    const clusterId = clusterMap[obs.id];
    const merchant = normalizeMerchant(obs.description, clusterId);
    const confidence = calculateConfidence(obs, merchant, clusterId);

    createCanonicalTransaction({
      ...obs,
      merchant,
      confidence
    });
  });

  // 4. Re-link transfers
  linkTransfers();
}
```

**Tiempo**: ~10 segundos para 12k transactions.

**Uso**: Darwin tweakea reglas → regenera → ve resultado nuevo.

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

### Stage 2: Clustering
- **Input**: Observations con description raw
- **Algorithm**: String similarity (Levenshtein)
- **Threshold**: 0.8 (hardcoded)
- **Output**: cluster_id por observation
- **LOC**: ~50

### Stage 3: Normalization
- **Input**: Observation + cluster_id
- **Method 1**: Reglas con regex (~20 reglas iniciales)
- **Method 2**: Fallback a cluster (tomar shortest + clean)
- **Output**: Merchant normalizado + confidence score
- **LOC**: ~100

### Total pipeline
- Clustering: ~5 seg para 12k observations
- Normalization: ~2 seg
- **Total**: ~7 seg

---

**Próximo flow**: Lee [flow-5-transfer-linking.md](flow-5-transfer-linking.md) para entender cómo se linkean transfers.
