# Stage 2: Merchant Normalization (DB-Driven)

> ✅ **LEGO Architecture**: This stage is config-driven (NOT hardcoded). Rules live in `normalization_rules` table.

**Objetivo**: Convertir "STARBUCKS STORE #12345" en "Starbucks"

---

## Interface Contract

**Ver contratos completos en**: [0-pipeline-interfaces.md](0-pipeline-interfaces.md)

**Input**:
```typescript
interface NormalizationInput {
  transactions: Transaction[];          // From 1-table (transactions table)
  clusterMap: Map<string, string>;      // Optional - from clustering stage
  config: {
    useRules: boolean;                  // Load from normalization_rules table?
    useClusters: boolean;               // Use cluster hints?
    fallbackToOriginal: boolean;        // Keep original if no match?
  };
}
```

**Output**:
```typescript
interface NormalizationOutput {
  updates: NormalizationUpdate[];
  stats: {
    rulesMatched: number;
    clusterMatched: number;
    unchanged: number;
  };
}

interface NormalizationUpdate {
  transactionId: string;
  oldMerchant: string;
  newMerchant: string;
  confidence: number;                   // 0.0-1.0
  method: 'rule' | 'cluster' | 'unchanged';
  ruleId?: string;
}
```

**Side effects**: Updates `transactions.merchant` and `transactions.merchant_confidence`

**Can I skip?**: NO (but can disable rules/clusters via config)

**Can I swap?**: YES - Replace with LLM normalization, manual review, etc.

---

## Architecture: DB-Driven Rules

### ❌ OLD (Hardcoded - BLOB)

```javascript
// BAD: Hardcoded array
const NORMALIZATION_RULES = [
  { pattern: /STARBUCKS.*#?\d+/, normalized: 'Starbucks' },
  { pattern: /DUNKIN.*DONUTS?/, normalized: 'Dunkin' },
  // ... 50+ rules hardcoded in code
];

// Problem: Adding Starbucks rule = code change + redeploy
```

### ✅ NEW (DB-Driven - LEGO)

```javascript
// GOOD: Load from database
async function loadNormalizationRules() {
  return await db.all(`
    SELECT id, pattern, normalized_merchant, priority, category_hint
    FROM normalization_rules
    WHERE is_active = TRUE
    ORDER BY priority DESC
  `);
}

// Benefit: Adding Starbucks rule = INSERT query (no code change)
```

---

## normalization_rules Table

**Schema** (ver [ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md)):

```sql
CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,

  -- Matching
  rule_type TEXT NOT NULL,             -- 'regex' | 'exact' | 'contains'
  pattern TEXT NOT NULL,               -- "STARBUCKS.*#?\d+" or "STARBUCKS"

  -- Output
  normalized_merchant TEXT NOT NULL,   -- "Starbucks"
  category_hint TEXT,                  -- "Food & Drink" (optional)

  -- Control
  priority INTEGER DEFAULT 0,          -- Higher priority runs first
  is_active BOOLEAN DEFAULT TRUE,      -- Can disable without deleting

  -- Metadata
  created_by TEXT,                     -- 'system' | 'user'
  usage_count INTEGER DEFAULT 0,       -- How many times used

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_normalization_priority ON normalization_rules(priority DESC);
CREATE INDEX idx_normalization_active ON normalization_rules(is_active);
```

---

## Adding Rules (No Code Changes)

### Via SQL

```sql
-- Add new rule for Starbucks
INSERT INTO normalization_rules (
  id, rule_type, pattern, normalized_merchant, priority, is_active
) VALUES (
  'rule_starbucks',
  'regex',
  'STARBUCKS.*#?\d+',
  'Starbucks',
  100,
  TRUE
);

-- Add exact match rule
INSERT INTO normalization_rules (
  id, rule_type, pattern, normalized_merchant, category_hint, priority
) VALUES (
  'rule_netflix',
  'contains',
  'NETFLIX',
  'Netflix',
  'Entertainment',
  90
);
```

### Via UI (Future)

```
Dashboard > Settings > Normalization Rules > Add Rule

┌──────────────────────────────────────┐
│ Add Normalization Rule               │
├──────────────────────────────────────┤
│ Pattern: STARBUCKS.*#?\d+            │
│ Type: [ Regex ▼ ]                    │
│ Normalized: Starbucks                │
│ Category Hint: Food & Drink          │
│ Priority: 100                        │
│                                      │
│   [Cancel]  [Save Rule]              │
└──────────────────────────────────────┘
```

**Benefit**: Business users can add rules without touching code.

---

## Two-Step Normalization Algorithm

### Step 1: Rule Matching (Priority)

```javascript
async function normalizeWithRules(description, rules) {
  const desc = description.toUpperCase().trim();

  // Try rules in priority order
  for (const rule of rules) {
    const matched = matchRule(desc, rule);

    if (matched) {
      // Update usage count (analytics)
      await db.run(
        'UPDATE normalization_rules SET usage_count = usage_count + 1 WHERE id = ?',
        rule.id
      );

      return {
        merchant: rule.normalized_merchant,
        confidence: 1.0,
        method: 'rule',
        ruleId: rule.id,
        categoryHint: rule.category_hint
      };
    }
  }

  return null; // No rule matched
}

function matchRule(description, rule) {
  switch (rule.rule_type) {
    case 'regex':
      const regex = new RegExp(rule.pattern, 'i');
      return regex.test(description);

    case 'exact':
      return description === rule.pattern.toUpperCase();

    case 'contains':
      return description.includes(rule.pattern.toUpperCase());

    default:
      return false;
  }
}
```

### Step 2: Cluster Fallback (If No Rule)

```javascript
function normalizeFromCluster(description, clusterId, clusters) {
  // No cluster available
  if (!clusterId || !clusters[clusterId]) {
    return {
      merchant: cleanString(description),
      confidence: 0.5,
      method: 'unchanged'
    };
  }

  // Get cluster members
  const members = clusters[clusterId];

  // Use shortest string (usually cleanest)
  const shortest = members.reduce((a, b) =>
    a.length < b.length ? a : b
  );

  return {
    merchant: cleanString(shortest),
    confidence: calculateClusterConfidence(clusterId, clusters),
    method: 'cluster'
  };
}

function cleanString(str) {
  return str
    .replace(/#\d+/g, '')                // Remove #12345
    .replace(/\*[A-Z0-9]+/g, '')         // Remove *M89JF2K3
    .replace(/\bSTORE\b/gi, '')          // Remove "STORE"
    .replace(/\s+/g, ' ')                // Normalize spaces
    .replace(/[^a-zA-Z0-9\s'&-]/g, '')   // Keep apostrophes, ampersands, hyphens
    .trim()
    .split(' ')
    .map(word => {
      // Title case (except numbers)
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
```

---

## Complete Normalization Function (LEGO)

```javascript
// lib/normalization/normalize.js

async function normalizeTransactions(input) {
  const { transactions, clusterMap, config } = input;
  const updates = [];
  const stats = { rulesMatched: 0, clusterMatched: 0, unchanged: 0 };

  // Load rules from DB (NOT hardcoded)
  const rules = config.useRules
    ? await loadNormalizationRules()
    : [];

  for (const txn of transactions) {
    let result = null;

    // Step 1: Try rule matching
    if (config.useRules) {
      result = await normalizeWithRules(txn.original_description, rules);
      if (result) stats.rulesMatched++;
    }

    // Step 2: Fallback to cluster
    if (!result && config.useClusters) {
      const clusterId = clusterMap.get(txn.id);
      result = normalizeFromCluster(txn.original_description, clusterId, clusters);
      if (result.method === 'cluster') stats.clusterMatched++;
    }

    // Step 3: Fallback to original
    if (!result) {
      result = {
        merchant: config.fallbackToOriginal
          ? cleanString(txn.original_description)
          : txn.original_description,
        confidence: 0.5,
        method: 'unchanged'
      };
      stats.unchanged++;
    }

    // Update transaction in DB
    await db.run(`
      UPDATE transactions
      SET merchant = ?, merchant_confidence = ?, updated_at = ?
      WHERE id = ?
    `, result.merchant, result.confidence, new Date().toISOString(), txn.id);

    updates.push({
      transactionId: txn.id,
      oldMerchant: txn.merchant,
      newMerchant: result.merchant,
      confidence: result.confidence,
      method: result.method,
      ruleId: result.ruleId
    });
  }

  return { updates, stats };
}

module.exports = { normalizeTransactions };
```

---

## Confidence Scoring

```javascript
function calculateConfidence(transaction, result, clusterId, clusters) {
  let confidence = 0.0;

  // Factor 1: Matched rule? (+50%)
  if (result.method === 'rule') {
    confidence += 0.5;
  }

  // Factor 2: Cluster size (+30%)
  if (clusterId && clusters[clusterId]) {
    const clusterSize = clusters[clusterId].length;
    if (clusterSize >= 5) {
      confidence += 0.3;
    } else if (clusterSize >= 3) {
      confidence += 0.2;
    } else {
      confidence += 0.1;
    }
  }

  // Factor 3: Cluster similarity (+20%)
  if (clusterId && clusters[clusterId]) {
    const avgSimilarity = calculateAverageClusterSimilarity(
      clusterId,
      clusters
    );
    if (avgSimilarity >= 0.9) {
      confidence += 0.2;
    } else if (avgSimilarity >= 0.8) {
      confidence += 0.1;
    }
  }

  return Math.min(confidence, 1.0);
}
```

---

## Example: End-to-End

### Scenario: New Starbucks transaction

**Input**:
```javascript
const transaction = {
  id: 'txn_123',
  original_description: 'STARBUCKS STORE #12345 SANTA MONICA CA',
  merchant: null  // Not normalized yet
};
```

**Step 1: Load rules from DB**
```sql
SELECT * FROM normalization_rules WHERE is_active = TRUE;

-- Result:
[
  {
    id: 'rule_starbucks',
    pattern: 'STARBUCKS.*#?\d+',
    normalized_merchant: 'Starbucks',
    priority: 100
  },
  ...
]
```

**Step 2: Match rule**
```javascript
const matched = /STARBUCKS.*#?\d+/i.test('STARBUCKS STORE #12345...');
// matched = true

const result = {
  merchant: 'Starbucks',
  confidence: 1.0,
  method: 'rule',
  ruleId: 'rule_starbucks'
};
```

**Step 3: Update transaction**
```sql
UPDATE transactions
SET merchant = 'Starbucks', merchant_confidence = 1.0
WHERE id = 'txn_123';
```

**Output**:
```javascript
{
  transactionId: 'txn_123',
  oldMerchant: null,
  newMerchant: 'Starbucks',
  confidence: 1.0,
  method: 'rule'
}
```

---

## Seeding Initial Rules

**File**: `scripts/seed-normalization-rules.js`

```javascript
const INITIAL_RULES = [
  // Coffee
  { pattern: 'STARBUCKS.*#?\\d+', normalized: 'Starbucks', priority: 100 },
  { pattern: 'DUNKIN.*DONUTS?', normalized: 'Dunkin', priority: 100 },
  { pattern: 'PEET\'?S COFFEE', normalized: "Peet's Coffee", priority: 100 },

  // E-commerce
  { pattern: 'AMAZON\\.COM\\*[A-Z0-9]+', normalized: 'Amazon', priority: 90 },
  { pattern: 'AMZN\\.COM', normalized: 'Amazon', priority: 90 },
  { pattern: 'EBAY', normalized: 'eBay', priority: 90 },

  // Rideshare
  { pattern: 'UBER \\*TRIP', normalized: 'Uber', priority: 85 },
  { pattern: 'UBER \\*EATS', normalized: 'Uber Eats', priority: 85 },
  { pattern: 'LYFT \\*RIDE', normalized: 'Lyft', priority: 85 },

  // Streaming
  { pattern: 'NETFLIX', normalized: 'Netflix', priority: 80 },
  { pattern: 'SPOTIFY', normalized: 'Spotify', priority: 80 },
  { pattern: 'DISNEY\\+', normalized: 'Disney+', priority: 80 },

  // Gas stations
  { pattern: 'SHELL.*\\d{5}', normalized: 'Shell', priority: 75 },
  { pattern: 'CHEVRON.*\\d{5}', normalized: 'Chevron', priority: 75 },
  { pattern: 'PEMEX.*\\d{4}', normalized: 'Pemex', priority: 75 },

  // Grocery
  { pattern: 'COSTCO.*\\d{4}', normalized: 'Costco', priority: 70 },
  { pattern: 'TARGET.*T-?\\d+', normalized: 'Target', priority: 70 },
  { pattern: 'WALMART.*\\d{4}', normalized: 'Walmart', priority: 70 },
  { pattern: 'WHOLE FOODS', normalized: 'Whole Foods', priority: 70 },
  { pattern: 'TRADER JOE\'?S', normalized: "Trader Joe's", priority: 70 },

  // Food delivery
  { pattern: 'DOORDASH', normalized: 'DoorDash', priority: 65 },
  { pattern: 'GRUBHUB', normalized: 'GrubHub', priority: 65 },
  { pattern: 'POSTMATES', normalized: 'Postmates', priority: 65 },

  // Utilities (US)
  { pattern: 'AT&T', normalized: 'AT&T', priority: 60 },
  { pattern: 'VERIZON', normalized: 'Verizon', priority: 60 },
  { pattern: 'COMCAST', normalized: 'Comcast', priority: 60 },

  // Utilities (Mexico)
  { pattern: 'CFE\\s*RECIBO', normalized: 'CFE (Electricidad)', priority: 60 },
  { pattern: 'TELMEX', normalized: 'Telmex', priority: 60 },

  // Convenience (Mexico)
  { pattern: 'OXXO.*\\d{4}', normalized: 'Oxxo', priority: 55 },
  { pattern: '7\\s*ELEVEN.*\\d{4}', normalized: '7-Eleven', priority: 55 },
];

async function seedRules(db) {
  for (const rule of INITIAL_RULES) {
    await db.run(`
      INSERT INTO normalization_rules (
        id, rule_type, pattern, normalized_merchant, priority, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      generateId(),
      'regex',
      rule.pattern,
      rule.normalized,
      rule.priority,
      true,
      'system'
    );
  }

  console.log(`✓ Seeded ${INITIAL_RULES.length} normalization rules`);
}
```

**Run**: `node scripts/seed-normalization-rules.js`

**Benefit**: Start with 25 common rules, add more via UI/SQL as needed.

---

## Expanding Rules (Analytics-Driven)

### Find merchants with low confidence

```sql
SELECT merchant, COUNT(*) as txn_count, AVG(merchant_confidence) as avg_conf
FROM transactions
WHERE merchant_confidence < 0.7
GROUP BY merchant
HAVING txn_count >= 5
ORDER BY txn_count DESC
LIMIT 20;
```

**Output**:
```
| merchant              | txn_count | avg_conf |
|----------------------|-----------|----------|
| Random Local Cafe    | 78        | 0.3      |
| Some Gas Station #4  | 45        | 0.2      |
| Unknown Store        | 32        | 0.5      |
```

### Add rules for top merchants

```sql
INSERT INTO normalization_rules (id, rule_type, pattern, normalized_merchant, priority)
VALUES
  ('rule_random_cafe', 'contains', 'RANDOM LOCAL CAFE', 'Random Local Cafe', 50),
  ('rule_gas_station', 'regex', 'SOME GAS STATION #\\d+', 'Some Gas Station', 50);
```

### Re-run normalization

```javascript
// Re-normalize all transactions with low confidence
const lowConfTxns = await db.all(`
  SELECT * FROM transactions WHERE merchant_confidence < 0.7
`);

await normalizeTransactions({
  transactions: lowConfTxns,
  clusterMap: new Map(),
  config: { useRules: true, useClusters: false, fallbackToOriginal: true }
});
```

**Result**: Confidence improved from 0.3 → 1.0 for 78 transactions

---

## Configuration Options

### Enable/Disable Rules

```javascript
const config = {
  useRules: true,          // Load from normalization_rules table
  useClusters: false,      // Skip clustering hints
  fallbackToOriginal: true // Keep original if no match
};
```

### Disable Specific Rule

```sql
-- Temporarily disable Starbucks rule
UPDATE normalization_rules SET is_active = FALSE WHERE id = 'rule_starbucks';
```

### Change Rule Priority

```sql
-- Make Amazon rule run first
UPDATE normalization_rules SET priority = 200 WHERE id = 'rule_amazon';
```

---

## Testing

### Unit Test: Rule Matching

```javascript
describe('Normalization - DB Rules', () => {
  beforeEach(async () => {
    await db.run(`
      INSERT INTO normalization_rules (id, pattern, normalized_merchant, rule_type)
      VALUES ('test_rule', 'STARBUCKS.*', 'Starbucks', 'regex')
    `);
  });

  it('should match rule from DB', async () => {
    const txns = [
      { id: '1', original_description: 'STARBUCKS STORE #1234' }
    ];

    const result = await normalizeTransactions({
      transactions: txns,
      clusterMap: new Map(),
      config: { useRules: true, useClusters: false }
    });

    expect(result.updates[0].newMerchant).toBe('Starbucks');
    expect(result.updates[0].method).toBe('rule');
    expect(result.stats.rulesMatched).toBe(1);
  });

  it('should work without rules (fallback)', async () => {
    const txns = [
      { id: '1', original_description: 'UNKNOWN MERCHANT' }
    ];

    const result = await normalizeTransactions({
      transactions: txns,
      clusterMap: new Map(),
      config: { useRules: false, useClusters: false, fallbackToOriginal: true }
    });

    expect(result.updates[0].newMerchant).toBe('Unknown Merchant');
    expect(result.updates[0].method).toBe('unchanged');
  });
});
```

### Integration Test: Adding Rule via SQL

```javascript
it('should use newly added rule immediately', async () => {
  // Add rule via SQL (simulating UI action)
  await db.run(`
    INSERT INTO normalization_rules (id, pattern, normalized_merchant, rule_type, priority)
    VALUES ('new_rule', 'ACME.*', 'Acme Corp', 'regex', 100)
  `);

  // Run normalization
  const txns = [{ id: '1', original_description: 'ACME STORE #123' }];
  const result = await normalizeTransactions({
    transactions: txns,
    clusterMap: new Map(),
    config: { useRules: true }
  });

  // Should use new rule
  expect(result.updates[0].newMerchant).toBe('Acme Corp');
  expect(result.updates[0].ruleId).toBe('new_rule');
});
```

---

## Edge Cases

### Apostrophes & Special Characters

```javascript
// Preserve apostrophes
"TRADER JOE'S" → "Trader Joe's" ✓

// Preserve ampersands
"AT&T" → "AT&T" ✓ (via exact rule)

// Preserve hyphens
"7-ELEVEN" → "7-Eleven" ✓
```

**Solution**: Update `cleanString()` to preserve `'`, `&`, `-`

### Multiple Rules Match

```javascript
// Rule 1: "AMAZON.*" → "Amazon"
// Rule 2: "AMAZON\.COM\*" → "Amazon.com"

// Description: "AMAZON.COM*M89JF2K3"
// Both match!

// Solution: Use PRIORITY (higher priority wins)
```

### Rule Type: exact vs contains vs regex

```sql
-- Exact match (fastest)
{ rule_type: 'exact', pattern: 'NETFLIX' }

-- Contains (case-insensitive)
{ rule_type: 'contains', pattern: 'STARBUCKS' }

-- Regex (most flexible)
{ rule_type: 'regex', pattern: 'STARBUCKS.*#?\d+' }
```

---

## Integration with Pipeline

```javascript
// lib/pipeline/index.js

async function runPipeline(file, accountId) {
  // Stage 0: Parse PDF
  const transactions = await parsePDF(file, accountId);

  // Stage 1: Clustering (optional)
  let clusterMap = new Map();
  if (config.stages.clustering.enabled) {
    const result = await clusterMerchants(transactions);
    clusterMap = result.clusterMap;
  }

  // Stage 2: Normalization (THIS STAGE)
  const normalizationResult = await normalizeTransactions({
    transactions,
    clusterMap,
    config: {
      useRules: true,
      useClusters: config.stages.clustering.enabled,
      fallbackToOriginal: true
    }
  });

  console.log(`Normalized ${normalizationResult.stats.rulesMatched} via rules`);

  // Stage 3: Transfer linking (next)
  // ...
}
```

---

## LOC Estimate

- `normalizeTransactions()`: ~40 LOC
- `normalizeWithRules()`: ~25 LOC
- `normalizeFromCluster()`: ~20 LOC
- `cleanString()`: ~15 LOC
- `calculateConfidence()`: ~30 LOC
- `loadNormalizationRules()`: ~10 LOC
- `seedRules()`: ~60 LOC (seed script)

**Total**: ~200 LOC

---

## Summary: LEGO Architecture

### ✅ Why This is LEGO (Not Blob)

1. **Config-driven**: Rules in DB, not hardcoded array
2. **Swappable**: Can replace rule engine with LLM normalization
3. **Optional**: Can disable rules via config (`useRules: false`)
4. **Extensible**: Add rules via SQL/UI (no code change)
5. **Testable**: Each function can be unit tested independently
6. **Clear interface**: Explicit Input/Output types (see [0-pipeline-interfaces.md](0-pipeline-interfaces.md))
7. **Fault-tolerant**: If rule matching fails, falls back to cluster/original

### 🔴 What Would Make This a Blob

- ❌ Hardcoded `NORMALIZATION_RULES` array in code
- ❌ Cannot add rules without changing code
- ❌ Cannot disable normalization stage
- ❌ Normalization depends on internal implementation of clustering

### ✅ This Implementation Avoids All Blobs

**Evidence**:
- Rules loaded from `normalization_rules` table (line 17-25)
- Can skip via `config.useRules = false` (line 85-86)
- Clear interface contract (line 7-36)
- Independent of clustering (works with empty `clusterMap`)

---

**Próximo stage**: [5-canonical-store.md](5-canonical-store.md) (will be rewritten for 1-table architecture)

**Ver contratos**: [0-pipeline-interfaces.md](0-pipeline-interfaces.md)
