# Stage 3: Normalization

**Convertir "STARBUCKS STORE #12345" en "Starbucks"**

## El objetivo

Tomar el description raw + cluster info y producir un **merchant name limpio**.

```
Input:  "STARBUCKS STORE #12345 SANTA MONICA CA"
Output: "Starbucks"
```

---

## Two-step approach

### Step 1: Reglas hardcodeadas (Preferred)

Si hay una regla con regex que hace match, usar eso.

```javascript
const RULES = [
  { pattern: /STARBUCKS.*#\d+/, normalized: 'Starbucks' }
];

// Match! → "Starbucks"
```

### Step 2: Fallback a cluster (Si no hay regla)

Tomar el string más corto del cluster y limpiarlo.

```javascript
// Cluster members:
// - "STARBUCKS STORE #12345"
// - "STARBUCKS #11111"
// - "STARBUCKS STORE #67890"

// Shortest: "STARBUCKS #11111"
// Clean: "Starbucks"
```

---

## Code: Normalization

```javascript
// main/pipeline/normalize.js

const NORMALIZATION_RULES = [
  // Coffee
  { pattern: /STARBUCKS.*#?\d+/, normalized: 'Starbucks' },
  { pattern: /DUNKIN.*DONUTS?/, normalized: 'Dunkin' },
  { pattern: /PEET'?S COFFEE/, normalized: "Peet's Coffee" },

  // E-commerce
  { pattern: /AMAZON\.COM\*[A-Z0-9]+/, normalized: 'Amazon' },
  { pattern: /AMZN\.COM/, normalized: 'Amazon' },
  { pattern: /EBAY/, normalized: 'eBay' },

  // Rideshare
  { pattern: /UBER \*TRIP/, normalized: 'Uber' },
  { pattern: /UBER \*EATS/, normalized: 'Uber Eats' },
  { pattern: /LYFT \*RIDE/, normalized: 'Lyft' },

  // Streaming
  { pattern: /NETFLIX/, normalized: 'Netflix' },
  { pattern: /SPOTIFY/, normalized: 'Spotify' },
  { pattern: /DISNEY\+/, normalized: 'Disney+' },
  { pattern: /HBO MAX/, normalized: 'HBO Max' },

  // Gas
  { pattern: /SHELL.*\d{5}/, normalized: 'Shell' },
  { pattern: /CHEVRON.*\d{5}/, normalized: 'Chevron' },
  { pattern: /EXXON.*\d{5}/, normalized: 'Exxon' },
  { pattern: /PEMEX.*\d{4}/, normalized: 'Pemex' },

  // Grocery
  { pattern: /COSTCO.*\d{4}/, normalized: 'Costco' },
  { pattern: /TARGET.*T-?\d+/, normalized: 'Target' },
  { pattern: /WALMART.*\d{4}/, normalized: 'Walmart' },
  { pattern: /WHOLE FOODS/, normalized: 'Whole Foods' },
  { pattern: /TRADER JOE'?S/, normalized: "Trader Joe's" },

  // Food delivery
  { pattern: /DOORDASH/, normalized: 'DoorDash' },
  { pattern: /GRUBHUB/, normalized: 'GrubHub' },
  { pattern: /POSTMATES/, normalized: 'Postmates' },

  // Utilities (US)
  { pattern: /SCE PAYMENT/, normalized: 'Southern California Edison' },
  { pattern: /AT&T/, normalized: 'AT&T' },
  { pattern: /VERIZON/, normalized: 'Verizon' },
  { pattern: /COMCAST/, normalized: 'Comcast' },

  // Utilities (Mexico)
  { pattern: /CFE\s*RECIBO/, normalized: 'CFE (Electricidad)' },
  { pattern: /TELMEX/, normalized: 'Telmex' },

  // Convenience stores (Mexico)
  { pattern: /OXXO.*\d{4}/, normalized: 'Oxxo' },
  { pattern: /7\s*ELEVEN.*\d{4}/, normalized: '7-Eleven' },

  // ... más reglas (expandir a ~50 durante desarrollo)
];

function normalizeMerchant(description, clusterId, clusters) {
  const desc = description.toUpperCase().trim();

  // Step 1: Buscar regla
  for (const rule of NORMALIZATION_RULES) {
    if (rule.pattern.test(desc)) {
      return rule.normalized;
    }
  }

  // Step 2: Fallback a cluster
  return normalizeFromCluster(description, clusterId, clusters);
}

function normalizeFromCluster(description, clusterId, clusters) {
  // Obtener miembros del cluster
  const members = clusters[clusterId];

  if (!members || members.length === 0) {
    // Cluster vacío (raro), usar description raw limpio
    return cleanString(description);
  }

  // Tomar el más corto (suele ser el más limpio)
  const shortest = members.reduce((a, b) => a.length < b.length ? a : b);

  // Limpiar
  return cleanString(shortest);
}

function cleanString(str) {
  return str
    .replace(/#\d+/g, '')              // Quitar #12345
    .replace(/\*[A-Z0-9]+/g, '')       // Quitar *M89JF2K3
    .replace(/STORE/gi, '')            // Quitar "STORE"
    .replace(/\s+/g, ' ')              // Normalizar espacios
    .replace(/[^a-zA-Z0-9\s']/g, '')   // Quitar símbolos raros (excepto apostrophe)
    .trim()
    .split(' ')
    .map(word => {
      // Title case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

module.exports = { normalizeMerchant };
```

---

## Ejemplo paso a paso

### Ejemplo 1: Con regla

```javascript
const description = "STARBUCKS STORE #12345 SANTA MONICA CA";
const clusterId = "cluster_abc";

// Step 1: Buscar regla
for (const rule of NORMALIZATION_RULES) {
  if (rule.pattern.test(description)) {
    // MATCH: /STARBUCKS.*#?\d+/
    return rule.normalized; // "Starbucks"
  }
}
```

**Output**: `"Starbucks"` ✓

---

### Ejemplo 2: Sin regla (usar cluster)

```javascript
const description = "RANDOM COFFEE SHOP #456";
const clusterId = "cluster_xyz";
const clusters = {
  cluster_xyz: [
    "RANDOM COFFEE SHOP #456",
    "RANDOM COFFEE SHOP #789",
    "RANDOM COFFEE #111"
  ]
};

// Step 1: No hay regla → fallback

// Step 2: Cluster
const members = clusters[clusterId];
const shortest = "RANDOM COFFEE #111"; // Más corto

// Clean
cleanString("RANDOM COFFEE #111")
  → "RANDOM COFFEE" (quita #111)
  → "Random Coffee" (title case)
```

**Output**: `"Random Coffee"` ✓

---

## Confidence score

Calculamos un score (0.0-1.0) para indicar qué tan segura es la normalización.

```javascript
function calculateConfidence(observation, normalizedMerchant, clusterId, clusters) {
  let confidence = 0.0;

  // Factor 1: ¿Matched con regla? (+50%)
  const matchedRule = NORMALIZATION_RULES.find(r =>
    r.pattern.test(observation.description)
  );
  if (matchedRule) {
    confidence += 0.5;
  }

  // Factor 2: Tamaño del cluster (+30%)
  const clusterSize = clusters[clusterId]?.length || 1;
  if (clusterSize >= 5) {
    confidence += 0.3;
  } else if (clusterSize >= 3) {
    confidence += 0.2;
  } else {
    confidence += 0.1;
  }

  // Factor 3: Similarity promedio del cluster (+20%)
  const avgSimilarity = calculateAverageClusterSimilarity(clusterId, clusters);
  if (avgSimilarity >= 0.9) {
    confidence += 0.2;
  } else if (avgSimilarity >= 0.8) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

function calculateAverageClusterSimilarity(clusterId, clusters) {
  const members = clusters[clusterId];
  if (!members || members.length < 2) return 1.0;

  const representative = members[0];
  let totalSimilarity = 0;

  for (let i = 1; i < members.length; i++) {
    const sim = stringSimilarity.compareTwoStrings(representative, members[i]);
    totalSimilarity += sim;
  }

  return totalSimilarity / (members.length - 1);
}
```

---

## Ejemplos de confidence

### Alto confidence (1.0)

```
Description: "STARBUCKS STORE #12345"
Matched rule: ✓ (+0.5)
Cluster size: 15 members ✓ (+0.3)
Avg similarity: 0.92 ✓ (+0.2)

Confidence: 1.0 (100%)
```

### Medio confidence (0.6)

```
Description: "LOCAL CAFE #123"
Matched rule: ✗ (+0.0)
Cluster size: 3 members (+0.2)
Avg similarity: 0.85 (+0.1)

Confidence: 0.3 (30%)
```

**Fix**: Agregar regla para "LOCAL CAFE".

### Bajo confidence (0.1)

```
Description: "UNKNOWN MERCHANT XYZ"
Matched rule: ✗ (+0.0)
Cluster size: 1 member (+0.1)
Avg similarity: N/A (+0.0)

Confidence: 0.1 (10%)
```

**Acción**: Revisar manualmente (V2 feature).

---

## Expandir reglas

**V1**: Empezar con ~20 reglas comunes.

**Durante desarrollo**: Agregar más reglas al ver merchants reales.

```javascript
// Ver merchants con bajo confidence
SELECT merchant, COUNT(*) as count, AVG(confidence) as avg_conf
FROM transactions
GROUP BY merchant
HAVING avg_conf < 0.5
ORDER BY count DESC
LIMIT 20;

// Output:
// - "Random Local Cafe" (78 txns, conf: 0.3)
// - "Some Gas Station" (45 txns, conf: 0.2)
// ...

// Agregar reglas para estos
NORMALIZATION_RULES.push(
  { pattern: /RANDOM LOCAL CAFE/, normalized: 'Random Local Cafe' },
  { pattern: /SOME GAS STATION/, normalized: 'Some Gas Station' }
);

// Regenerar canonical
regenerateCanonical();
```

**Objetivo**: Llegar a ~50 reglas que cubran el 80% de las transacciones.

---

## Testing normalization

### Test 1: Con regla

```javascript
const desc = "STARBUCKS STORE #12345";
const result = normalizeMerchant(desc, null, {});

expect(result).toBe('Starbucks');
```

### Test 2: Sin regla (cluster)

```javascript
const desc = "RANDOM COFFEE #123";
const clusterId = "cluster_1";
const clusters = {
  cluster_1: ["RANDOM COFFEE #123", "RANDOM COFFEE #456"]
};

const result = normalizeMerchant(desc, clusterId, clusters);

expect(result).toBe('Random Coffee');
```

### Test 3: Confidence

```javascript
const obs = {
  description: "STARBUCKS STORE #12345"
};
const merchant = "Starbucks";
const clusterId = "cluster_1";
const clusters = {
  cluster_1: [
    "STARBUCKS STORE #12345",
    "STARBUCKS STORE #67890",
    "STARBUCKS #11111"
  ]
};

const confidence = calculateConfidence(obs, merchant, clusterId, clusters);

expect(confidence).toBeGreaterThan(0.8); // High confidence
```

---

## Edge cases

### Edge case 1: Apostrophes

```
"TRADER JOE'S" → "Trader Joe's"  ✓
"TRADER JOES"  → "Trader Joes"   ✗
```

**Solución**: Preservar apostrophes en `cleanString()`.

```javascript
.replace(/[^a-zA-Z0-9\s']/g, '') // Keep apostrophe
```

---

### Edge case 2: Ampersands

```
"AT&T" → "At&t"  ✗ (title case lo rompe)
```

**Solución**: Regla especial.

```javascript
{ pattern: /AT&T/, normalized: 'AT&T' } // Preserve exact
```

---

### Edge case 3: Números en merchant name

```
"7 ELEVEN" → "7 Eleven"  ✓
"7-ELEVEN" → "7-Eleven"  ✓
```

**Solución**: Preservar números.

```javascript
.replace(/[^a-zA-Z0-9\s'-]/g, '') // Keep numbers and hyphens
```

---

## Integration con pipeline

```javascript
// main/pipeline/index.js

async function runPipeline() {
  // Stage 1: Observations ✓
  // Stage 2: Clustering ✓
  const { clusters, clusterMap } = clusterMerchants(observations);

  // Stage 3: Normalization
  observations.forEach(obs => {
    const clusterId = clusterMap[obs.id];
    const merchant = normalizeMerchant(obs.description, clusterId, clusters);
    const confidence = calculateConfidence(obs, merchant, clusterId, clusters);

    // Stage 4: Create canonical (next)
    createCanonicalTransaction({
      observation_id: obs.id,
      merchant,
      confidence,
      ...
    });
  });
}
```

---

## LOC estimate

- `normalizeMerchant()`: ~20 LOC
- `normalizeFromCluster()`: ~15 LOC
- `cleanString()`: ~15 LOC
- `calculateConfidence()`: ~30 LOC
- `NORMALIZATION_RULES`: ~50 LOC (array de reglas)

**Total**: ~130 LOC

---

## Resumen

### Qué hace
- Convierte descriptions raw en merchant names limpios
- Usa reglas con regex (preferred)
- Fallback a cluster si no hay regla
- Calcula confidence score

### Two-step approach
1. **Reglas hardcodeadas**: Pattern matching con regex
2. **Cluster fallback**: Tomar shortest string + clean

### Confidence factors
- Matched rule: +50%
- Cluster size: +10-30%
- Avg similarity: +10-20%

### Output
- Merchant normalizado (string limpio)
- Confidence score (0.0-1.0)
- Se usa en Stage 4 (Canonical Store)

---

**Próximo stage**: Lee [5-canonical-store.md](5-canonical-store.md)
