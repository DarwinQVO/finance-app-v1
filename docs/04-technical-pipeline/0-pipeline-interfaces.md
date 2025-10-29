# Pipeline Interfaces & Contracts

## 🎯 LEGO Architecture Principles

Este documento define los **contratos claros** entre componentes del pipeline. Cada stage es un **LEGO** - self-contained, swappable, con interfaces explícitas.

**Principio clave**: "Cambiar Stage 2 NO debe romper Stage 4"

---

## Interface Philosophy

### ✅ LEGO Component (Good)
```javascript
// Input contract claro
interface StageInput {
  transactions: Transaction[];
  config: Config;
}

// Output contract claro
interface StageOutput {
  transactions: Transaction[];
  metadata: StageMetadata;
}

// Self-contained
async function runStage(input: StageInput): Promise<StageOutput> {
  // No depende de otros stages
  // No modifica global state
  // Retorna nuevo objeto (immutable)
}
```

### 🔴 Playdough Blob (Bad)
```javascript
// NO clear contracts
function runStage() {
  // Lee global observations
  const obs = globalState.observations;

  // Modifica directamente
  obs.forEach(o => o.merchant = normalize(o.description));

  // Siguiente stage DEBE conocer formato interno
  globalState.clusters = clusterMerchants(obs);
}
```

---

## Core Data Types

### Transaction (1-Table Architecture)

```typescript
interface Transaction {
  // Identity
  id: string;                          // UUID
  user_id: string;
  account_id: string;

  // Core transaction data
  date: string;                        // ISO 8601
  amount: number;                      // Decimal (e.g., 45.67)
  currency: string;                    // 'USD', 'MXN', 'EUR'
  type: 'income' | 'expense' | 'transfer';

  // Original data (immutable)
  original_description: string;        // "STARBUCKS STORE #1234"
  original_merchant: string | null;    // From parser

  // Processed data (mutable by pipeline)
  merchant: string;                    // "Starbucks" (normalized)
  merchant_confidence: number;         // 0.0-1.0

  // Categorization
  category_id: string | null;
  category_confidence: number | null;

  // Transfer linking
  transfer_pair_id: string | null;     // Links A→B and B←A

  // Source provenance
  source_type: 'pdf' | 'csv' | 'manual' | 'api' | 'invoice';
  source_file: string | null;
  source_hash: string;                 // For deduplication

  // Metadata
  notes: string | null;
  tags: string | null;                 // JSON array

  // Audit
  created_at: string;
  updated_at: string;
}
```

**Key principle**:
- `original_*` fields = NEVER modified after insert (provenance)
- `merchant`, `category_id` = Modified by pipeline stages
- NO separate "observations" table

---

## Pipeline Stages (LEGO Architecture)

### Stage 0: PDF Extraction

**Purpose**: Parse PDF/CSV → Extract raw transactions

**Input**:
```typescript
interface PDFExtractionInput {
  file: File;                          // PDF or CSV file
  institution_id: string;              // 'bofa', 'apple_card', etc.
  account_id: string;
}
```

**Output**:
```typescript
interface PDFExtractionOutput {
  transactions: RawTransaction[];      // Extracted transactions
  errors: ParseError[];
  metadata: {
    linesProcessed: number;
    linesRejected: number;
    parserUsed: string;
  };
}

interface RawTransaction {
  date: string;
  original_description: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  source_file: string;
  source_hash: string;
}
```

**Side effects**:
- Inserts into `transactions` table with `merchant = original_description`
- NO clustering, NO normalization yet

**Can I skip?**: NO - This is the entry point

**Can I swap?**: YES - Replace with different parser engine (regex-based, LLM-based, etc.)

---

### Stage 1: Clustering (OPTIONAL)

**Purpose**: Group similar merchants → Improve normalization accuracy

**Input**:
```typescript
interface ClusteringInput {
  transactions: Transaction[];         // Only new/unprocessed ones
  config: {
    similarityThreshold: number;       // 0.0-1.0 (default: 0.8)
    algorithm: 'levenshtein' | 'cosine' | 'jaro-winkler';
    minClusterSize: number;            // Ignore clusters < N
  };
}
```

**Output**:
```typescript
interface ClusteringOutput {
  clusterMap: Map<string, string>;     // transactionId → clusterId
  clusters: Cluster[];
  metadata: {
    totalClusters: number;
    largestCluster: number;
    singletonCount: number;
  };
}

interface Cluster {
  id: string;
  representative: string;              // Most common description
  members: string[];                   // Transaction IDs
  confidence: number;
}
```

**Side effects**: NONE (does NOT modify database)

**Can I skip?**: YES
```javascript
// Skip clustering - use empty map
const clusterMap = new Map();
// Normalization will still work (rules-only)
```

**Can I swap?**: YES - Replace with different clustering algorithm

**Storage**: Clusters are ephemeral (NOT stored in DB). Only used to assist normalization.

---

### Stage 2: Normalization (REQUIRED)

**Purpose**: Clean merchant names using DB rules + clustering hints

**Input**:
```typescript
interface NormalizationInput {
  transactions: Transaction[];
  clusterMap: Map<string, string>;     // Optional (can be empty)
  config: {
    useRules: boolean;                 // Use normalization_rules table?
    useClusters: boolean;              // Use cluster hints?
    fallbackToOriginal: boolean;       // If no rule matched?
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
  confidence: number;                  // 0.0-1.0
  method: 'rule' | 'cluster' | 'unchanged';
  ruleId?: string;                     // If matched a rule
}
```

**Side effects**: Updates `transactions.merchant` and `transactions.merchant_confidence`

**Rules loaded from DB**:
```sql
SELECT * FROM normalization_rules
WHERE is_active = TRUE
ORDER BY priority DESC;
```

**Algorithm**:
```javascript
async function normalizeTransaction(txn, clusterMap, rules) {
  const description = txn.original_description.toLowerCase();

  // Priority 1: Exact rule match
  for (const rule of rules) {
    if (rule.pattern.test(description)) {
      return {
        merchant: rule.normalized_merchant,
        confidence: 1.0,
        method: 'rule',
        ruleId: rule.id
      };
    }
  }

  // Priority 2: Cluster representative
  const clusterId = clusterMap.get(txn.id);
  if (clusterId && clusters[clusterId]) {
    return {
      merchant: clusters[clusterId].representative,
      confidence: clusters[clusterId].confidence,
      method: 'cluster'
    };
  }

  // Priority 3: Keep original
  return {
    merchant: txn.original_description,
    confidence: 0.5,
    method: 'unchanged'
  };
}
```

**Can I skip?**: NO (but can disable rules/clusters via config)

**Can I swap?**: YES - Replace with LLM-based normalization, manual review, etc.

---

### Stage 3: Transfer Linking (OPTIONAL)

**Purpose**: Link transfers between accounts (A→B and B←A)

**Input**:
```typescript
interface TransferLinkingInput {
  transactions: Transaction[];         // Only unlinked transfers
  config: {
    timeWindowDays: number;            // Look ±N days (default: 3)
    amountTolerance: number;           // 0.0-1.0 (default: 0.01 = 1%)
    requireSameUser: boolean;          // Only link within same user?
  };
}
```

**Output**:
```typescript
interface TransferLinkingOutput {
  linkedPairs: TransferPair[];
  unlinkedTransfers: string[];         // Transaction IDs
  stats: {
    pairsFound: number;
    ambiguousPairs: number;            // Multiple candidates
  };
}

interface TransferPair {
  transferPairId: string;              // UUID for the pair
  debitTransaction: string;            // A→B (negative)
  creditTransaction: string;           // B←A (positive)
  confidence: number;
  matchedOn: ('amount' | 'date' | 'description')[];
}
```

**Side effects**: Updates `transactions.transfer_pair_id` for linked pairs

**Can I skip?**: YES
```javascript
// Disable transfer linking
const config = { enabled: false };
// Transactions remain unlinked
```

**Can I swap?**: YES - Replace with ML-based matching, manual review UI, etc.

---

### Stage 4: Categorization (OPTIONAL - Phase 2)

**Purpose**: Auto-assign categories using rules

**Input**:
```typescript
interface CategorizationInput {
  transactions: Transaction[];         // Uncategorized only
  config: {
    useRules: boolean;
    useMerchantHistory: boolean;       // Learn from past categorizations
    threshold: number;                 // Min confidence to auto-assign
  };
}
```

**Output**:
```typescript
interface CategorizationOutput {
  updates: CategoryUpdate[];
  stats: {
    rulesMatched: number;
    historyMatched: number;
    uncategorized: number;
  };
}

interface CategoryUpdate {
  transactionId: string;
  categoryId: string;
  confidence: number;
  method: 'rule' | 'history' | 'manual';
}
```

**Side effects**: Updates `transactions.category_id` and `transactions.category_confidence`

**Can I skip?**: YES (Phase 1 doesn't require categorization)

**Can I swap?**: YES - Replace with LLM categorization, manual UI, etc.

---

## Error Handling Contracts

### Error Types

```typescript
interface PipelineError {
  stage: string;                       // 'clustering', 'normalization', etc.
  severity: 'error' | 'warning' | 'info';
  code: string;                        // 'PARSE_FAILED', 'NO_RULES_MATCHED'
  message: string;
  transactionId?: string;              // Affected transaction
  recoverable: boolean;                // Can pipeline continue?
}
```

### Stage Error Behavior

| Stage | On Error | Next Stage |
|-------|----------|------------|
| PDF Extraction | FAIL - cannot continue | N/A |
| Clustering | WARN - use empty clusterMap | Continue |
| Normalization | WARN - keep original_description | Continue |
| Transfer Linking | WARN - leave unlinked | Continue |
| Categorization | WARN - leave uncategorized | Continue |

**Principle**: Stages are **fault-tolerant**. If Stage 2 fails, Stage 3 can still run.

---

## Configuration Interface

### Global Config

```typescript
interface PipelineConfig {
  stages: {
    clustering: {
      enabled: boolean;
      similarityThreshold: number;
      algorithm: string;
    };
    normalization: {
      enabled: boolean;
      useRules: boolean;
      useClusters: boolean;
    };
    transferLinking: {
      enabled: boolean;
      timeWindowDays: number;
      amountTolerance: number;
    };
    categorization: {
      enabled: boolean;
      autoAssignThreshold: number;
    };
  };
}
```

**Stored in**: `pipeline_config` table or JSON file

**Benefit**: Disable entire stages without code changes

---

## Stage Orchestration (Event-Driven)

### Sequential Orchestrator (Simple)

```javascript
async function runPipeline(file, accountId, config) {
  const errors = [];

  // Stage 0: Parse
  const { transactions, errors: parseErrors } = await parsePDF(file, accountId);
  errors.push(...parseErrors);

  if (transactions.length === 0) {
    return { success: false, errors };
  }

  // Stage 1: Cluster (optional)
  let clusterMap = new Map();
  if (config.stages.clustering.enabled) {
    try {
      const result = await clusterMerchants(transactions, config.stages.clustering);
      clusterMap = result.clusterMap;
    } catch (err) {
      errors.push({ stage: 'clustering', severity: 'warning', message: err.message, recoverable: true });
      // Continue with empty clusterMap
    }
  }

  // Stage 2: Normalize (required)
  try {
    await normalizeMerchants(transactions, clusterMap, config.stages.normalization);
  } catch (err) {
    errors.push({ stage: 'normalization', severity: 'error', message: err.message, recoverable: false });
    return { success: false, errors };
  }

  // Stage 3: Link transfers (optional)
  if (config.stages.transferLinking.enabled) {
    try {
      await linkTransfers(transactions, config.stages.transferLinking);
    } catch (err) {
      errors.push({ stage: 'transferLinking', severity: 'warning', message: err.message, recoverable: true });
      // Continue without linking
    }
  }

  return { success: true, transactions, errors };
}
```

**Key properties**:
- Each stage is `try/catch` isolated
- Errors don't cascade
- Optional stages can be disabled
- Each stage returns explicit output (no global state mutation)

---

### Event-Driven Orchestrator (Advanced)

```javascript
// Each stage emits events
eventBus.on('pdf.parsed', async (transactions) => {
  if (config.stages.clustering.enabled) {
    const clusters = await clusterMerchants(transactions);
    eventBus.emit('clustering.completed', clusters);
  } else {
    eventBus.emit('clustering.skipped');
  }
});

eventBus.on('clustering.completed', async (clusters) => {
  const normalized = await normalizeMerchants(transactions, clusters);
  eventBus.emit('normalization.completed', normalized);
});

// Benefits:
// - Easy to add new stages
// - Easy to disable stages
// - Easy to parallelize (if stages are independent)
```

---

## Testing Stages Independently

### Unit Test Example

```javascript
describe('Normalization Stage', () => {
  it('should normalize Starbucks variants', async () => {
    const input = {
      transactions: [
        { id: '1', original_description: 'STARBUCKS STORE #1234' },
        { id: '2', original_description: 'Starbucks Coffee' }
      ],
      clusterMap: new Map(), // Empty - test rules only
      config: { useRules: true, useClusters: false }
    };

    const output = await normalizeTransactions(input);

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0].newMerchant).toBe('Starbucks');
    expect(output.updates[1].newMerchant).toBe('Starbucks');
  });

  it('should work without clustering', async () => {
    // Clustering stage disabled
    const clusterMap = new Map();

    // Normalization should still work
    const output = await normalizeTransactions({
      transactions,
      clusterMap, // Empty
      config: { useRules: true, useClusters: false }
    });

    expect(output.stats.rulesMatched).toBeGreaterThan(0);
  });
});
```

**Key**: Each stage can be tested in isolation with mocked inputs.

---

## Swappable Stage Examples

### Example 1: Replace Clustering Algorithm

```javascript
// BEFORE: Levenshtein-based clustering
import { clusterMerchantsLevenshtein } from './clustering-levenshtein.js';

// AFTER: ML-based clustering
import { clusterMerchantsML } from './clustering-ml.js';

// Same interface, different implementation
const clusterMap = await clusterMerchantsML(transactions, config);
```

### Example 2: Add LLM Normalization

```javascript
// New stage: LLM-based normalization
async function normalizeMerchantsLLM(transactions, config) {
  const prompt = `Normalize these merchants: ${JSON.stringify(transactions)}`;
  const response = await openai.complete(prompt);

  return {
    updates: parseResponse(response),
    stats: { llmCalls: 1 }
  };
}

// Plug into pipeline
if (config.stages.normalization.useLLM) {
  await normalizeMerchantsLLM(transactions, config);
} else {
  await normalizeMerchantsRules(transactions, config);
}
```

### Example 3: Disable Transfer Linking

```javascript
// In config
const config = {
  stages: {
    transferLinking: {
      enabled: false  // Entire stage skipped
    }
  }
};

// No code changes needed
```

---

## Database as Interface Boundary

### Rules Table = Configuration Interface

```sql
-- Add new rule (no code change)
INSERT INTO normalization_rules (pattern, normalized_merchant, priority, is_active)
VALUES ('AMAZON\.COM\*[A-Z0-9]+', 'Amazon', 100, TRUE);

-- Disable rule (no code change)
UPDATE normalization_rules SET is_active = FALSE WHERE id = 'rule_123';

-- Change priority (no code change)
UPDATE normalization_rules SET priority = 200 WHERE id = 'rule_456';
```

**Benefit**: Business logic in database, not code. Users can modify rules via UI.

### Parser Configs Table = Parser Interface

```sql
-- Add new bank (no code change)
INSERT INTO parser_configs (id, name, field_config)
VALUES ('chase', 'Chase Bank', '{"date": {"regex": "..."}}');

-- Disable parser (no code change)
UPDATE parser_configs SET is_active = FALSE WHERE id = 'bofa';
```

---

## Summary: LEGO vs Playdough

### ✅ This Architecture is LEGO if:

1. **Clear interfaces**: Each stage has explicit Input/Output types
2. **Optional stages**: Can disable clustering, transfer linking, categorization
3. **Swappable stages**: Can replace clustering algorithm without changing normalization
4. **DB-driven config**: Rules, parsers, thresholds in database (not hardcoded)
5. **Fault isolation**: Stage 2 error doesn't crash Stage 3
6. **Testable**: Each stage can be unit tested independently
7. **No global state**: Stages don't mutate shared variables

### 🔴 This is Playdough if:

1. **Hardcoded rules**: `const RULES = [...]` in code
2. **Tight coupling**: Stage 3 depends on Stage 2's internal implementation
3. **No interfaces**: Function signatures are `runStage()` with no types
4. **Cannot skip**: Must run all stages in fixed order
5. **Cannot swap**: Replacing clustering breaks normalization
6. **Global state**: Stages mutate shared `observations` object
7. **Cascading failures**: One stage fails, entire pipeline fails

---

## Next Steps

1. **Rewrite 4-normalization.md** to use `normalization_rules` table (not hardcoded)
2. **Rewrite 5-canonical-store.md** to use 1-table architecture (no observations table)
3. **Add config examples** to each stage doc showing how to enable/disable
4. **Document stage orchestration** in new doc (sequential vs event-driven)

---

**File**: `docs/04-technical-pipeline/0-pipeline-interfaces.md`
**Purpose**: Define clear contracts between LEGO components
**Next**: Apply these interfaces to rewrite existing pipeline docs
