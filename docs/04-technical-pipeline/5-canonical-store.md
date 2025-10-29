# Stage 3: Transaction Classification & Type Detection

> ✅ **LEGO Architecture**: This stage is independent, swappable, and operates on 1-table architecture.

**Objetivo**: Clasificar transactions como `expense`, `income`, o `transfer`

---

## Interface Contract

**Ver contratos completos en**: [0-pipeline-interfaces.md](0-pipeline-interfaces.md)

**Input**:
```typescript
interface ClassificationInput {
  transactions: Transaction[];         // From transactions table
  config: {
    useKeywords: boolean;              // Use keyword-based classification?
    useAmountSign: boolean;            // Fallback to amount sign?
    transferKeywords: string[];        // Custom transfer keywords
    incomeKeywords: string[];          // Custom income keywords
  };
}
```

**Output**:
```typescript
interface ClassificationOutput {
  updates: ClassificationUpdate[];
  stats: {
    transfers: number;
    income: number;
    expenses: number;
    unclassified: number;
  };
}

interface ClassificationUpdate {
  transactionId: string;
  oldType: string | null;
  newType: 'expense' | 'income' | 'transfer';
  confidence: number;
  method: 'keyword' | 'amount' | 'manual';
}
```

**Side effects**: Updates `transactions.type` field

**Can I skip?**: NO - Type is required for financial reports

**Can I swap?**: YES - Replace with LLM classification, ML model, manual review

---

## 1-Table Architecture

### ✅ NEW (1-Table - LEGO)

```sql
-- Single transactions table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,

  -- Original data (immutable)
  original_description TEXT NOT NULL,  -- "STARBUCKS STORE #12345"
  original_merchant TEXT,               -- From parser (if available)
  amount_raw TEXT,                      -- "-5.67" or "(5.67)" or "5.67 CR"

  -- Processed data (mutable by pipeline)
  merchant TEXT NOT NULL,               -- "Starbucks" (normalized)
  merchant_confidence REAL,             -- 0.0-1.0
  amount REAL NOT NULL,                 -- -5.67 (parsed float)

  -- Classification (THIS STAGE)
  type TEXT NOT NULL,                   -- 'expense' | 'income' | 'transfer'

  -- Other fields...
  date TEXT NOT NULL,
  currency TEXT NOT NULL,
  transfer_pair_id TEXT,
  category_id TEXT,

  -- Provenance
  source_type TEXT NOT NULL,            -- 'pdf' | 'csv' | 'manual'
  source_file TEXT,
  source_hash TEXT NOT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Key principle**:
- `original_description` = immutable (never changes after INSERT)
- `type` = mutable (set by classification stage)
- NO separate "observations" or "canonical" tables

---

## Classification Algorithm

### Step 1: Load Transfer Keywords (DB-Driven)

```javascript
async function loadTransferKeywords() {
  const config = await db.get(`
    SELECT transfer_keywords, income_keywords
    FROM parser_configs
    WHERE id = 'classification'
  `);

  return {
    transfer: JSON.parse(config.transfer_keywords || '[]'),
    income: JSON.parse(config.income_keywords || '[]')
  };
}

// Default keywords (can be overridden in DB)
const DEFAULT_TRANSFER_KEYWORDS = [
  'TRANSFER', 'WIRE', 'ACH', 'ZELLE', 'VENMO', 'PAYPAL',
  'SPEI', 'TRANSFERENCIA', 'CASH APP'
];

const DEFAULT_INCOME_KEYWORDS = [
  'SALARY', 'DEPOSIT', 'REFUND', 'PAYMENT RECEIVED',
  'RECIBIDA', 'ABONO', 'PAYROLL', 'REEMBOLSO'
];
```

### Step 2: Classify Transaction

```javascript
function classifyTransaction(txn, keywords) {
  const desc = txn.original_description.toUpperCase();

  // Priority 1: Transfer keywords
  for (const keyword of keywords.transfer) {
    if (desc.includes(keyword)) {
      return {
        type: 'transfer',
        confidence: 0.9,
        method: 'keyword'
      };
    }
  }

  // Priority 2: Income keywords
  for (const keyword of keywords.income) {
    if (desc.includes(keyword)) {
      return {
        type: 'income',
        confidence: 0.85,
        method: 'keyword'
      };
    }
  }

  // Priority 3: Fallback to amount sign
  if (txn.amount < 0) {
    return {
      type: 'expense',
      confidence: 0.7,
      method: 'amount'
    };
  } else {
    return {
      type: 'income',
      confidence: 0.7,
      method: 'amount'
    };
  }
}
```

---

## Complete Classification Function (LEGO)

```javascript
// lib/classification/classify.js

async function classifyTransactions(input) {
  const { transactions, config } = input;
  const updates = [];
  const stats = { transfers: 0, income: 0, expenses: 0, unclassified: 0 };

  // Load keywords from DB (or use defaults)
  const keywords = config.useKeywords
    ? await loadTransferKeywords()
    : { transfer: DEFAULT_TRANSFER_KEYWORDS, income: DEFAULT_INCOME_KEYWORDS };

  for (const txn of transactions) {
    // Skip if already classified and not forcing re-classification
    if (txn.type && !config.forceReclassify) {
      continue;
    }

    // Classify
    const result = classifyTransaction(txn, keywords);

    // Update transaction in DB
    await db.run(`
      UPDATE transactions
      SET type = ?, updated_at = ?
      WHERE id = ?
    `, result.type, new Date().toISOString(), txn.id);

    // Track stats
    stats[result.type === 'transfer' ? 'transfers' : result.type === 'income' ? 'income' : 'expenses']++;

    updates.push({
      transactionId: txn.id,
      oldType: txn.type,
      newType: result.type,
      confidence: result.confidence,
      method: result.method
    });
  }

  return { updates, stats };
}

module.exports = { classifyTransactions };
```

---

## Amount Parsing (Helper)

**Already done in Stage 0 (PDF Extraction)**, but here's the reference:

```javascript
function parseAmount(amountRaw) {
  let amount = amountRaw.trim();

  // Handle parentheses (negative)
  if (amount.startsWith('(') && amount.endsWith(')')) {
    amount = '-' + amount.slice(1, -1);
  }

  // Handle "CR" suffix (credit = positive)
  if (amount.endsWith('CR')) {
    amount = amount.replace('CR', '').trim();
    return Math.abs(parseFloat(amount.replace(/,/g, '')));
  }

  // Handle "DB" suffix (debit = negative)
  if (amount.endsWith('DB')) {
    amount = amount.replace('DB', '').trim();
    return -Math.abs(parseFloat(amount.replace(/,/g, '')));
  }

  // Normal: remove commas and parse
  return parseFloat(amount.replace(/,/g, ''));
}
```

**Note**: Amount parsing happens in Stage 0 during PDF extraction. This stage only classifies type based on `amount` (already a float).

---

## Type Classification Examples

### Example 1: Transfer (Keyword Match)

**Input**:
```javascript
const txn = {
  id: 'txn_123',
  original_description: 'TRANSFER TO WISE',
  amount: -1000.00,
  type: null  // Not classified yet
};
```

**Step 1**: Check transfer keywords
```javascript
'TRANSFER TO WISE'.includes('TRANSFER')  // TRUE
```

**Step 2**: Classify
```javascript
result = {
  type: 'transfer',
  confidence: 0.9,
  method: 'keyword'
};
```

**Step 3**: Update DB
```sql
UPDATE transactions SET type = 'transfer' WHERE id = 'txn_123';
```

---

### Example 2: Income (Keyword Match)

**Input**:
```javascript
const txn = {
  id: 'txn_456',
  original_description: 'SALARY DEPOSIT',
  amount: 3500.00,
  type: null
};
```

**Classification**:
```javascript
'SALARY DEPOSIT'.includes('SALARY')  // TRUE
result = { type: 'income', confidence: 0.85, method: 'keyword' };
```

---

### Example 3: Expense (Amount Fallback)

**Input**:
```javascript
const txn = {
  id: 'txn_789',
  original_description: 'STARBUCKS STORE #1234',
  amount: -5.67,
  type: null
};
```

**Classification**:
```javascript
// No keyword match
// amount < 0 → expense
result = { type: 'expense', confidence: 0.7, method: 'amount' };
```

---

## Configuration Options

### Enable/Disable Keywords

```javascript
const config = {
  useKeywords: true,       // Load from parser_configs table
  useAmountSign: true,     // Fallback to amount sign
  forceReclassify: false   // Re-classify already classified txns
};
```

### Custom Keywords (DB-Driven)

```sql
-- Add custom transfer keyword
UPDATE parser_configs
SET transfer_keywords = JSON_INSERT(
  transfer_keywords,
  '$[#]',
  'CASH APP'
)
WHERE id = 'classification';

-- Add custom income keyword
UPDATE parser_configs
SET income_keywords = JSON_INSERT(
  income_keywords,
  '$[#]',
  'REIMBURSEMENT'
)
WHERE id = 'classification';
```

---

## Testing

### Unit Test: Keyword Classification

```javascript
describe('Classification - Keywords', () => {
  it('should classify transfer by keyword', () => {
    const txn = {
      original_description: 'TRANSFER TO WISE',
      amount: -1000.00
    };

    const keywords = {
      transfer: ['TRANSFER'],
      income: ['SALARY']
    };

    const result = classifyTransaction(txn, keywords);

    expect(result.type).toBe('transfer');
    expect(result.confidence).toBe(0.9);
    expect(result.method).toBe('keyword');
  });

  it('should classify income by keyword', () => {
    const txn = {
      original_description: 'SALARY DEPOSIT',
      amount: 3500.00
    };

    const result = classifyTransaction(txn, keywords);

    expect(result.type).toBe('income');
  });
});
```

### Unit Test: Amount Fallback

```javascript
it('should fallback to amount sign', () => {
  const txn = {
    original_description: 'UNKNOWN MERCHANT',
    amount: -5.67
  };

  const keywords = { transfer: [], income: [] };

  const result = classifyTransaction(txn, keywords);

  expect(result.type).toBe('expense');
  expect(result.method).toBe('amount');
  expect(result.confidence).toBe(0.7);  // Lower confidence
});
```

### Integration Test: Re-classification

```javascript
it('should not re-classify by default', async () => {
  // Transaction already classified
  await db.run(`
    INSERT INTO transactions (id, original_description, amount, type)
    VALUES ('txn_1', 'STARBUCKS', -5.67, 'expense')
  `);

  const txns = [{ id: 'txn_1', original_description: 'STARBUCKS', amount: -5.67, type: 'expense' }];

  const result = await classifyTransactions({
    transactions: txns,
    config: { forceReclassify: false }
  });

  // Should skip (already classified)
  expect(result.updates).toHaveLength(0);
});

it('should re-classify when forced', async () => {
  const result = await classifyTransactions({
    transactions: txns,
    config: { forceReclassify: true }  // Force re-classification
  });

  expect(result.updates).toHaveLength(1);
});
```

---

## Edge Cases

### Edge Case 1: Ambiguous Transactions

```javascript
// Description: "PAYMENT TO VENDOR"
// Could be: expense (paying vendor) OR income (receiving payment)

// Solution: Prefer keyword over amount
'PAYMENT TO'.includes('PAYMENT RECEIVED')  // FALSE
// Fallback to amount sign
amount < 0 → expense
```

### Edge Case 2: Transfers Between Same Account Types

```javascript
// BofA Checking → BofA Savings
// Both are "BofA" accounts

// Classification: Still 'transfer' (keyword match)
// Transfer linking will handle matching (Stage 4)
```

### Edge Case 3: Zero Amount

```javascript
amount = 0.00

// Solution: Cannot infer from amount
// Must use keyword or default to 'expense'
```

---

## Integration with Pipeline

```javascript
// lib/pipeline/index.js

async function runPipeline(file, accountId) {
  // Stage 0: Parse PDF → INSERT transactions
  const newTransactions = await parsePDF(file, accountId);

  // Stage 1: Clustering (optional)
  let clusterMap = new Map();
  if (config.stages.clustering.enabled) {
    const result = await clusterMerchants(newTransactions);
    clusterMap = result.clusterMap;
  }

  // Stage 2: Normalization
  await normalizeTransactions({
    transactions: newTransactions,
    clusterMap,
    config: config.stages.normalization
  });

  // Stage 3: Classification (THIS STAGE)
  const classificationResult = await classifyTransactions({
    transactions: newTransactions,
    config: config.stages.classification
  });

  console.log(`Classified: ${classificationResult.stats.transfers} transfers, ${classificationResult.stats.income} income, ${classificationResult.stats.expenses} expenses`);

  // Stage 4: Transfer Linking (next)
  if (config.stages.transferLinking.enabled) {
    await linkTransfers(newTransactions, config.stages.transferLinking);
  }

  return { success: true, transactions: newTransactions };
}
```

**Key difference from old architecture**:
- ❌ OLD: `createCanonicalTransaction()` created NEW rows in transactions table
- ✅ NEW: `classifyTransactions()` UPDATES existing rows (already inserted in Stage 0)

---

## Comparison: 2-Table vs 1-Table

### ❌ OLD (2-Table Architecture)

```javascript
// Stage 0: Parse → INSERT into observations
// Stage 3+4: Create canonical → INSERT into transactions

observations.forEach(obs => {
  const merchant = normalizeMerchant(obs.description, ...);
  const type = classifyType(obs.description, obs.amount);

  // Create NEW transaction row
  db.run(`INSERT INTO transactions (...) VALUES (...)`, [merchant, type, ...]);

  // Link observation → transaction
  db.run(`UPDATE observations SET canonical_id = ? WHERE id = ?`, [txnId, obs.id]);
});
```

**Problems**:
- Two tables to maintain (observations + transactions)
- Bidirectional FK (observations.canonical_id ↔ transactions.id)
- Delete cascade complexity
- "Canonical" creation mixed with normalization

### ✅ NEW (1-Table Architecture)

```javascript
// Stage 0: Parse → INSERT into transactions with original_description

// Stage 2: Normalize → UPDATE transactions.merchant

// Stage 3: Classify → UPDATE transactions.type

const newTransactions = await db.all(`SELECT * FROM transactions WHERE type IS NULL`);

await classifyTransactions({
  transactions: newTransactions,
  config: { useKeywords: true }
});

// Result: transactions.type field updated
```

**Benefits**:
- Single source of truth (transactions table)
- No bidirectional FKs
- Each stage is independent UPDATE
- Clear separation of concerns

---

## LOC Estimate

- `classifyTransaction()`: ~30 LOC
- `classifyTransactions()`: ~40 LOC
- `loadTransferKeywords()`: ~15 LOC
- `parseAmount()`: ~25 LOC (helper, usually in Stage 0)

**Total**: ~110 LOC

---

## Summary: LEGO Architecture

### ✅ Why This is LEGO (Not Blob)

1. **Config-driven**: Keywords in DB (`parser_configs` table)
2. **Swappable**: Can replace with LLM classification (`GPT-4o` for type detection)
3. **Independent**: Only reads/writes `transactions.type` field (doesn't create rows)
4. **Clear interface**: Explicit Input/Output types (see [0-pipeline-interfaces.md](0-pipeline-interfaces.md))
5. **Testable**: Each function can be unit tested independently
6. **Fault-tolerant**: If classification fails, transaction still exists (just type = null)
7. **No side effects**: Only updates `transactions.type`, nothing else

### 🔴 What Would Make This a Blob

- ❌ Creating new rows in transactions table (mixed concerns)
- ❌ Depending on normalization stage's internal `clusterMap`
- ❌ Updating observations.canonical_id (bidirectional coupling)
- ❌ Hardcoded keywords in JavaScript array

### ✅ This Implementation Avoids All Blobs

**Evidence**:
- Keywords loaded from `parser_configs` table (line 9-20)
- Only UPDATE operations, no INSERT (line 57-61)
- Clear interface contract (line 9-49)
- Independent of clustering/normalization (only reads `original_description` and `amount`)
- Can skip via `config.useKeywords = false` (line 44-46)

---

## Next Steps

1. **Implement Transfer Linking** (Stage 4) - See [flow-5-transfer-linking.md](../02-user-flows/flow-5-transfer-linking.md)
2. **Add Categorization** (Stage 5 - Phase 2) - Auto-assign categories based on merchant
3. **Add Manual Review UI** - Allow users to correct misclassified types

---

**Próximo stage**: Transfer Linking (Stage 4) - Link transfers between accounts

**Ver contratos**: [0-pipeline-interfaces.md](0-pipeline-interfaces.md)

**Ver 1-table architecture**: [ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md)
