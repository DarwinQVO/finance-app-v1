# Stage 0: PDF Extraction & Parsing

> ✅ **LEGO Architecture**: This stage is config-driven, swappable, and uses parser plugins.

**Objetivo**: Parsear PDF/CSV → INSERT transactions en tabla `transactions`

---

## Interface Contract

**Ver contratos completos en**: [0-pipeline-interfaces.md](0-pipeline-interfaces.md)

**Input**:
```typescript
interface PDFExtractionInput {
  file: File;                          // PDF or CSV file
  accountId: string;                   // 'bofa_checking', 'apple_card', etc.
  config: {
    autoDetect: boolean;               // Auto-detect bank from PDF content?
    parserOverride?: string;           // Force specific parser
    skipDuplicates: boolean;           // Check source_hash for dedup?
  };
}
```

**Output**:
```typescript
interface PDFExtractionOutput {
  transactions: Transaction[];         // Inserted transactions
  errors: ParseError[];
  metadata: {
    linesProcessed: number;
    linesRejected: number;
    parserUsed: string;
    duplicatesSkipped: number;
  };
}

interface ParseError {
  line: number;
  raw: string;
  reason: string;
  severity: 'error' | 'warning';
}
```

**Side effects**: INSERT into `transactions` table with:
- `original_description` (immutable)
- `merchant` = `original_description` (will be normalized later)
- `amount` (parsed from amount_raw)
- `type` = null (will be classified later)

**Can I skip?**: NO - This is the entry point

**Can I swap?**: YES - Replace with OCR-based parser, AI parser, CSV importer, etc.

---

## 1-Table Architecture

### ✅ Direct INSERT to transactions

```sql
-- Single transactions table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,

  -- Original data (IMMUTABLE - never changes after INSERT)
  original_description TEXT NOT NULL,  -- "STARBUCKS STORE #12345"
  original_merchant TEXT,               -- From parser (if extracted separately)
  amount_raw TEXT,                      -- "-5.67" or "(5.67)" - kept for audit

  -- Processed data (MUTABLE - updated by pipeline stages)
  merchant TEXT NOT NULL,               -- Initially = original_description
  merchant_confidence REAL,             -- Initially null
  amount REAL NOT NULL,                 -- -5.67 (parsed float)
  type TEXT,                            -- Initially null (Stage 3 sets this)

  -- Metadata
  date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transfer_pair_id TEXT,                -- Stage 4 sets this
  category_id TEXT,                     -- Phase 2 sets this

  -- Provenance (immutable)
  source_type TEXT NOT NULL,            -- 'pdf' | 'csv' | 'manual'
  source_file TEXT NOT NULL,            -- 'BofA_Sep2025.pdf'
  source_hash TEXT NOT NULL,            -- SHA256 for dedup

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_txn_source_hash ON transactions(source_hash);
CREATE INDEX idx_txn_account_date ON transactions(account_id, date);
```

**Key principle**:
- Parser ONLY inserts rows
- Later stages UPDATE rows (merchant, type, category, etc.)
- `original_*` fields NEVER change (audit trail)

---

## Parser Architecture: Config-Driven

### Parser Discovery

```javascript
// lib/parsers/registry.js

async function detectParser(pdfText, config) {
  // Load all parser configs from DB
  const parserConfigs = await db.all(`
    SELECT * FROM parser_configs WHERE is_active = TRUE
  `);

  // Try to detect bank from keywords
  for (const parser of parserConfigs) {
    const keywords = JSON.parse(parser.detection_keywords);
    const matched = keywords.some(keyword =>
      pdfText.toUpperCase().includes(keyword.toUpperCase())
    );

    if (matched) {
      return parser;
    }
  }

  throw new Error('Could not detect bank from PDF. Please specify parser manually.');
}
```

**Example parser_configs rows**:

```sql
INSERT INTO parser_configs (id, name, detection_keywords, field_config) VALUES
('bofa', 'Bank of America', '["Bank of America", "Member FDIC", "bankofamerica.com"]', '{...}'),
('apple_card', 'Apple Card', '["Apple Card", "Goldman Sachs", "card.apple.com"]', '{...}'),
('wise', 'Wise', '["Wise", "wise.com", "TransferWise"]', '{...}');
```

---

## Parsing Algorithm

### Step 1: Extract Text from PDF

```javascript
// lib/parsers/pdf-extractor.js

const pdfParse = require('pdf-parse');

async function extractTextFromPDF(file) {
  const dataBuffer = fs.readFileSync(file.path);
  const pdfData = await pdfParse(dataBuffer);

  return {
    text: pdfData.text,
    pages: pdfData.numpages,
    metadata: pdfData.info
  };
}
```

### Step 2: Parse Transactions Using Config

```javascript
// lib/parsers/parse.js

async function parseTransactions(pdfText, parserConfig, accountId) {
  const fieldConfig = JSON.parse(parserConfig.field_config);
  const lines = pdfText.split('\n');
  const transactions = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines or headers
    if (!line || isHeaderLine(line, fieldConfig)) {
      continue;
    }

    try {
      // Extract fields using regex from config
      const txn = {
        id: generateId(),
        account_id: accountId,
        date: extractField(line, fieldConfig.date),
        original_description: extractField(line, fieldConfig.description),
        amount_raw: extractField(line, fieldConfig.amount),
        currency: fieldConfig.currency || 'USD',
        source_type: 'pdf',
        source_file: file.name,
        source_hash: generateHash(line),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Parse amount (convert string to float)
      txn.amount = parseAmount(txn.amount_raw);

      // Initially, merchant = original_description
      txn.merchant = txn.original_description;

      // Type is null (will be set by Stage 3: Classification)
      txn.type = null;

      transactions.push(txn);
    } catch (err) {
      errors.push({
        line: i + 1,
        raw: line,
        reason: err.message,
        severity: 'error'
      });
    }
  }

  return { transactions, errors };
}

function extractField(line, fieldDef) {
  if (fieldDef.regex) {
    const regex = new RegExp(fieldDef.regex);
    const match = line.match(regex);
    if (match) {
      return match[1] || match[0];
    }
  }

  if (fieldDef.position) {
    // Fixed-width parsing
    const start = fieldDef.position.start;
    const end = fieldDef.position.end;
    return line.substring(start, end).trim();
  }

  throw new Error(`Could not extract field: ${fieldDef.name}`);
}
```

### Step 3: Insert into Database

```javascript
async function insertTransactions(transactions, config) {
  let inserted = 0;
  let duplicatesSkipped = 0;

  for (const txn of transactions) {
    // Check for duplicates (same source_hash)
    if (config.skipDuplicates) {
      const exists = await db.get(
        'SELECT id FROM transactions WHERE source_hash = ?',
        txn.source_hash
      );

      if (exists) {
        duplicatesSkipped++;
        continue;
      }
    }

    // Insert transaction
    await db.run(`
      INSERT INTO transactions (
        id, account_id, date, original_description, original_merchant,
        amount_raw, amount, merchant, type, currency,
        source_type, source_file, source_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      txn.id,
      txn.account_id,
      txn.date,
      txn.original_description,
      txn.original_merchant || null,
      txn.amount_raw,
      txn.amount,
      txn.merchant,  // Initially same as original_description
      txn.type,      // null - will be set by Stage 3
      txn.currency,
      txn.source_type,
      txn.source_file,
      txn.source_hash,
      txn.created_at,
      txn.updated_at
    ]);

    inserted++;
  }

  return { inserted, duplicatesSkipped };
}
```

---

## Amount Parsing (Helper)

```javascript
function parseAmount(amountRaw) {
  let amount = amountRaw.trim();

  // Handle parentheses (negative)
  if (amount.startsWith('(') && amount.endsWith(')')) {
    amount = '-' + amount.slice(1, -1);
  }

  // Handle "CR" suffix (credit = positive)
  if (amount.endsWith('CR') || amount.endsWith('cr')) {
    amount = amount.replace(/CR/i, '').trim();
    return Math.abs(parseFloat(amount.replace(/,/g, '')));
  }

  // Handle "DB" suffix (debit = negative)
  if (amount.endsWith('DB') || amount.endsWith('db')) {
    amount = amount.replace(/DB/i, '').trim();
    return -Math.abs(parseFloat(amount.replace(/,/g, '')));
  }

  // Handle "DR" suffix (debit = negative)
  if (amount.endsWith('DR') || amount.endsWith('dr')) {
    amount = amount.replace(/DR/i, '').trim();
    return -Math.abs(parseFloat(amount.replace(/,/g, '')));
  }

  // Normal: remove commas and parse
  return parseFloat(amount.replace(/,/g, ''));
}
```

**Test cases**:
```javascript
parseAmount('-5.67')        // → -5.67
parseAmount('(5.67)')       // → -5.67 (parentheses = negative)
parseAmount('100.00 CR')    // → 100.00 (credit = positive)
parseAmount('50.00 DB')     // → -50.00 (debit = negative)
parseAmount('1,234.56')     // → 1234.56 (remove comma)
```

---

## Complete Extraction Function (LEGO)

```javascript
// lib/parsers/extract.js

async function extractFromPDF(input) {
  const { file, accountId, config } = input;

  // Step 1: Extract text from PDF
  const { text, pages } = await extractTextFromPDF(file);

  // Step 2: Detect parser (or use override)
  const parserConfig = config.parserOverride
    ? await db.get('SELECT * FROM parser_configs WHERE id = ?', config.parserOverride)
    : await detectParser(text, config);

  if (!parserConfig) {
    throw new Error('No parser found for this PDF');
  }

  // Step 3: Parse transactions
  const { transactions, errors } = await parseTransactions(text, parserConfig, accountId);

  // Step 4: Insert into database
  const { inserted, duplicatesSkipped } = await insertTransactions(transactions, config);

  return {
    transactions,
    errors,
    metadata: {
      linesProcessed: transactions.length + errors.length,
      linesRejected: errors.length,
      parserUsed: parserConfig.name,
      duplicatesSkipped,
      pages
    }
  };
}

module.exports = { extractFromPDF };
```

---

## Example: End-to-End

### Scenario: Upload BofA PDF

**Input**:
```javascript
const result = await extractFromPDF({
  file: { path: '/uploads/BofA_Sep2025.pdf', name: 'BofA_Sep2025.pdf' },
  accountId: 'bofa_checking_darwin',
  config: {
    autoDetect: true,
    skipDuplicates: true
  }
});
```

**Step 1: Extract text**
```
Bank of America
Statement Period: Sep 1 - Sep 30, 2025

Date       Description                Amount
09/05      STARBUCKS STORE #1234      -5.67
09/07      SALARY DEPOSIT           3,500.00 CR
09/10      AMAZON.COM*M89JF2K3        -45.99
```

**Step 2: Detect parser**
```javascript
// "Bank of America" found in text
// → parserConfig.id = 'bofa'
```

**Step 3: Parse transactions**
```javascript
transactions = [
  {
    id: 'txn_abc123',
    account_id: 'bofa_checking_darwin',
    date: '2025-09-05',
    original_description: 'STARBUCKS STORE #1234',
    amount_raw: '-5.67',
    amount: -5.67,
    merchant: 'STARBUCKS STORE #1234',  // Initially same
    type: null,  // Will be set by Stage 3
    currency: 'USD',
    source_type: 'pdf',
    source_file: 'BofA_Sep2025.pdf',
    source_hash: 'sha256_...'
  },
  {
    id: 'txn_def456',
    date: '2025-09-07',
    original_description: 'SALARY DEPOSIT',
    amount_raw: '3,500.00 CR',
    amount: 3500.00,  // Positive (CR)
    merchant: 'SALARY DEPOSIT',
    type: null,
    ...
  },
  ...
];
```

**Step 4: Insert**
```sql
INSERT INTO transactions (...) VALUES (...);
-- 3 transactions inserted
-- 0 duplicates skipped
```

**Output**:
```javascript
{
  transactions: [...],  // 3 transactions
  errors: [],
  metadata: {
    linesProcessed: 3,
    linesRejected: 0,
    parserUsed: 'Bank of America',
    duplicatesSkipped: 0,
    pages: 2
  }
}
```

---

## Parser Config Example (YAML)

**File**: `configs/parsers/bofa.yaml`

```yaml
id: bofa
name: Bank of America
detection_keywords:
  - Bank of America
  - Member FDIC
  - bankofamerica.com

parsing:
  date:
    regex: "^(\\d{2}/\\d{2})"
    format: MM/DD

  description:
    regex: "^\\d{2}/\\d{2}\\s+(.+?)\\s+[\\d,\\-\\.]+"
    required: true

  amount:
    regex: "([\\d,\\.]+)\\s*(CR|DB)?$"
    type: number
    required: true

currency: USD

transfer_keywords:
  - TRANSFER
  - WIRE
  - ACH
  - ZELLE

income_keywords:
  - SALARY
  - DEPOSIT
  - REFUND
```

**Load into DB**:
```sql
INSERT INTO parser_configs (id, name, detection_keywords, field_config)
VALUES (
  'bofa',
  'Bank of America',
  '["Bank of America", "Member FDIC"]',
  '{...}'  -- JSON version of parsing config
);
```

---

## Deduplication Strategy

**Source hash**:
```javascript
function generateHash(line) {
  // Hash: date + description + amount
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(line)
    .digest('hex');
}
```

**Check for duplicates**:
```javascript
const exists = await db.get(
  'SELECT id FROM transactions WHERE source_hash = ?',
  txn.source_hash
);

if (exists) {
  console.log(`Skipping duplicate: ${txn.original_description}`);
  continue;
}
```

**Why this works**:
- Same PDF uploaded twice → same hashes → skipped
- Different PDF with same transaction → different hashes (different formatting) → inserted

---

## Error Handling

### Parse Errors

```javascript
{
  errors: [
    {
      line: 45,
      raw: 'INVALID LINE FORMAT',
      reason: 'Could not extract date',
      severity: 'error'
    },
    {
      line: 67,
      raw: 'FOOTER TEXT',
      reason: 'Skipped (footer detected)',
      severity: 'warning'
    }
  ]
}
```

### Recovery Strategy

```javascript
try {
  const txn = parseTransaction(line);
  transactions.push(txn);
} catch (err) {
  // Log error but continue parsing
  errors.push({
    line: i,
    raw: line,
    reason: err.message,
    severity: 'error'
  });
  // Don't throw - continue to next line
}
```

**Principle**: Parse as much as possible, log errors, don't fail entire upload.

---

## Testing

### Unit Test: Amount Parsing

```javascript
describe('Amount Parsing', () => {
  it('should parse negative amounts', () => {
    expect(parseAmount('-5.67')).toBe(-5.67);
  });

  it('should parse parentheses as negative', () => {
    expect(parseAmount('(100.00)')).toBe(-100.00);
  });

  it('should parse CR as positive', () => {
    expect(parseAmount('50.00 CR')).toBe(50.00);
  });

  it('should parse DB as negative', () => {
    expect(parseAmount('75.00 DB')).toBe(-75.00);
  });

  it('should remove commas', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });
});
```

### Integration Test: Full Extraction

```javascript
it('should extract transactions from BofA PDF', async () => {
  const result = await extractFromPDF({
    file: { path: './test/fixtures/bofa_sample.pdf' },
    accountId: 'test_account',
    config: { autoDetect: true, skipDuplicates: false }
  });

  expect(result.transactions).toHaveLength(15);
  expect(result.errors).toHaveLength(0);
  expect(result.metadata.parserUsed).toBe('Bank of America');

  // Verify first transaction
  const first = result.transactions[0];
  expect(first.original_description).toContain('STARBUCKS');
  expect(first.amount).toBeLessThan(0);  // Expense
  expect(first.type).toBeNull();  // Not yet classified
});
```

---

## Integration with Pipeline

```javascript
// lib/pipeline/index.js

async function runPipeline(file, accountId) {
  // Stage 0: PDF Extraction (THIS STAGE)
  const extractionResult = await extractFromPDF({
    file,
    accountId,
    config: {
      autoDetect: true,
      skipDuplicates: true
    }
  });

  console.log(`Extracted ${extractionResult.transactions.length} transactions`);
  console.log(`Errors: ${extractionResult.errors.length}`);
  console.log(`Duplicates skipped: ${extractionResult.metadata.duplicatesSkipped}`);

  // Stage 1: Clustering (optional)
  let clusterMap = new Map();
  if (config.stages.clustering.enabled) {
    const result = await clusterMerchants(extractionResult.transactions);
    clusterMap = result.clusterMap;
  }

  // Stage 2: Normalization
  await normalizeTransactions({
    transactions: extractionResult.transactions,
    clusterMap,
    config: config.stages.normalization
  });

  // Stage 3: Classification
  await classifyTransactions(extractionResult.transactions);

  // Stage 4: Transfer Linking
  await linkTransfers(extractionResult.transactions);

  return {
    success: true,
    transactions: extractionResult.transactions,
    errors: extractionResult.errors
  };
}
```

---

## LOC Estimate

- `extractFromPDF()`: ~40 LOC
- `parseTransactions()`: ~60 LOC
- `extractField()`: ~20 LOC
- `parseAmount()`: ~25 LOC
- `insertTransactions()`: ~30 LOC
- `detectParser()`: ~20 LOC
- `generateHash()`: ~10 LOC

**Total**: ~205 LOC

---

## Summary: LEGO Architecture

### ✅ Why This is LEGO (Not Blob)

1. **Config-driven**: Parsers defined in `parser_configs` table (YAML)
2. **Swappable**: Can replace with OCR, AI parser, manual entry
3. **Pluggable**: Add new parsers by adding DB row (no code change)
4. **Clear interface**: Explicit Input/Output types (see [0-pipeline-interfaces.md](0-pipeline-interfaces.md))
5. **Error tolerant**: Parse errors don't stop entire upload
6. **Deduplication**: Automatic via source_hash
7. **Single responsibility**: Only inserts transactions, doesn't normalize/classify

### 🔴 What Would Make This a Blob

- ❌ Hardcoded parser logic (if/else for each bank)
- ❌ Creating multiple tables (observations + transactions)
- ❌ Doing normalization during parsing (mixed concerns)
- ❌ No deduplication strategy
- ❌ Failing entire upload on single parse error

### ✅ This Implementation Avoids All Blobs

**Evidence**:
- Parsers loaded from `parser_configs` table (line 9-19)
- Direct INSERT to transactions (line 126-150)
- Parse errors logged but don't stop upload (line 91-100)
- Single responsibility: parse + insert only (line 164-185)

---

**Próximo stage**: [3-clustering.md](3-clustering.md) - Group similar merchants

**Ver contratos**: [0-pipeline-interfaces.md](0-pipeline-interfaces.md)

**Ver 1-table architecture**: [ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md)

**Ver parser examples**: [parser-bofa.md](../03-parsers/parser-bofa.md)
