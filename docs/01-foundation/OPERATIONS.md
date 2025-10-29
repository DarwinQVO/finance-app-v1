# Operations & Maintenance Guide

**Cómo manejar TODOS los casos operacionales, edge cases, y situaciones críticas**

---

## 🎯 Overview

Este doc cubre TODOS los casos que no son "agregar features nuevas":
- ✅ Data migrations
- ✅ Bulk operations
- ✅ Data corruption & recovery
- ✅ Performance optimization
- ✅ Schema versioning
- ✅ Parser evolution
- ✅ Data integrity
- ✅ **Data invariants & reconciliation** (NEW!)
- ✅ Backup & restore
- ✅ Testing strategy
- ✅ Monitoring & observability
- ✅ Error recovery
- ✅ Rollback strategies
- ✅ Data validation
- ✅ Deprecation
- ✅ GDPR compliance

---

## 1️⃣ Data Migrations

**⚠️ IMPORTANTE**: Nuestra arquitectura NO requiere cambios de schema entre phases porque **TODOS los campos existen desde Phase 1**.

### Lo que SÍ cambia entre phases:

**Phase 1 → Phase 2**: NO cambios en `transactions` table, solo:
1. ✅ Crear tabla AUXILIAR `categories`
2. ✅ Llenar campos que YA existían (`category_id` pasa de NULL → valores)

**Phase 2 → Phase 3**: NO cambios en `transactions` table, solo:
1. ✅ Agregar logic de reports
2. ✅ Usar campos que YA existían

**Phase 3 → Phase 4**: NO cambios en `transactions` table, solo:
1. ✅ Crear tabla AUXILIAR `users`
2. ✅ Llenar campo `user_id` que YA existía

---

### Escenario: Phase 1 → Phase 2 (Adding categories)

**⚠️ NO es un "migration" de schema, es "agregar tabla auxiliar + poblar campos existentes"**

**Phase 1 Estado**:
```sql
-- transactions table YA TIENE category_id
CREATE TABLE transactions (
  ...,
  category_id TEXT,  -- ✅ Ya existe, solo está NULL
  ...
);

SELECT * FROM transactions WHERE category_id IS NOT NULL;
-- Result: 0 rows (todos NULL en Phase 1)
```

**Phase 2 "Migration" (really just table creation + data population)**:
```sql
-- Step 1: Create AUXILIARY table (NOT changing transactions)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT,
  icon TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL
);

-- Step 2: Populate default categories
INSERT INTO categories (id, name, color, icon, is_system, created_at) VALUES
  ('cat_food', 'Food & Dining', '#FF6B6B', '🍔', TRUE, datetime('now')),
  ('cat_transport', 'Transportation', '#4ECDC4', '🚗', TRUE, datetime('now'));
  -- ... 20 more default categories

-- Step 3: Populate EXISTING field (NO ALTER TABLE)
UPDATE transactions
SET category_id = 'cat_food'
WHERE merchant IN ('Starbucks', 'McDonald''s', 'Chipotle');

UPDATE transactions
SET category_id = 'cat_transport'
WHERE merchant IN ('Shell', 'Uber', 'Lyft');

-- Step 4: Mark as complete
INSERT INTO schema_migrations VALUES
  (2, 'add_categories_feature', datetime('now'));
```

**Rollback Strategy**:
```sql
-- Simple: drop auxiliary table + clear field
DROP TABLE IF EXISTS categories;
UPDATE transactions SET category_id = NULL;
DELETE FROM schema_migrations WHERE version = 2;

-- transactions table schema NEVER changed ✅
```

---

### Escenario REAL que SÍ requiere migration: Fix bug en campo

**Example**: Descubres que `is_edited` debe ser JSON, no BOOLEAN

**❌ Esto SÍ es un cambio de schema** (pero raro, debería estar correcto desde inicio):

```sql
-- BEFORE (wrong design)
CREATE TABLE transactions (
  ...,
  is_edited BOOLEAN DEFAULT FALSE,
  ...
);

-- AFTER (fixed design)
ALTER TABLE transactions RENAME COLUMN is_edited TO is_edited_old;
ALTER TABLE transactions ADD COLUMN is_edited TEXT;  -- Now JSON

-- Migrate data
UPDATE transactions
SET is_edited = json_object('manual', is_edited_old)
WHERE is_edited_old = TRUE;

-- Drop old column (SQLite doesn't support DROP COLUMN easily, so keep it NULL)
```

**⚠️ Este tipo de migration debería ser RARO** porque diseñamos bien desde el inicio

**⚠️ En nuestro diseño, NO deberías necesitar ADD COLUMN porque todos los campos existen desde Phase 1**

---

### Safe Migration Rules (si eventualmente necesitas fix algo):

1. ✅ Always test on copy of production data first
2. ✅ Create backup BEFORE any schema change
3. ✅ Use transactions (BEGIN/COMMIT/ROLLBACK)
4. ✅ Record every operation in `schema_migrations`
5. ✅ Have rollback script ready BEFORE applying
6. ✅ Verify data integrity after migration

---

## 2️⃣ Bulk Operations

### Scenario: Recategorize 500 Starbucks transactions

**Safe Bulk Update Pattern**:

```javascript
async function bulkRecategorize(merchant, newCategoryId) {
  // Step 1: Get affected transactions
  const affected = await db.all(
    'SELECT id FROM transactions WHERE merchant = ?',
    merchant
  );

  console.log(`Will update ${affected.length} transactions`);

  // Step 2: Confirm with user
  const confirmed = await promptUser(`Update ${affected.length} transactions?`);
  if (!confirmed) return;

  // Step 3: Create backup
  await db.run(`
    CREATE TABLE IF NOT EXISTS transactions_backup_${Date.now()} AS
    SELECT * FROM transactions WHERE id IN (${affected.map(() => '?').join(',')})
  `, affected.map(t => t.id));

  // Step 4: Update in transaction
  await db.run('BEGIN TRANSACTION');

  try {
    for (const txn of affected) {
      await db.run(
        `UPDATE transactions
         SET category_id = ?,
             edited_fields = json_set(COALESCE(edited_fields, '{}'), '$.category_id', 'bulk_update'),
             updated_at = ?
         WHERE id = ?`,
        newCategoryId,
        new Date().toISOString(),
        txn.id
      );
    }

    await db.run('COMMIT');
    console.log(`✅ Updated ${affected.length} transactions`);

  } catch (error) {
    await db.run('ROLLBACK');
    console.error('❌ Bulk update failed, rolled back:', error);
    throw error;
  }
}
```

**Key Safety Features**:
1. ✅ Preview affected count
2. ✅ User confirmation
3. ✅ Create backup before operation
4. ✅ Use database transaction
5. ✅ Track changes in `edited_fields`
6. ✅ Rollback on error

---

### Scenario: Bulk Delete (Close account)

**Example**: User closes BofA account, wants to archive/delete all transactions

```javascript
async function archiveAccount(accountId) {
  // Step 1: Get stats
  const stats = await db.get(`
    SELECT
      COUNT(*) as count,
      MIN(date) as earliest,
      MAX(date) as latest
    FROM transactions
    WHERE account_id = ?
  `, accountId);

  console.log(`Account has ${stats.count} transactions from ${stats.earliest} to ${stats.latest}`);

  // Step 2: Export to JSON (backup)
  const transactions = await db.all(
    'SELECT * FROM transactions WHERE account_id = ?',
    accountId
  );

  const backupFile = `backups/account_${accountId}_${Date.now()}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(transactions, null, 2));
  console.log(`✅ Backup saved to ${backupFile}`);

  // Step 3: Soft delete (recommended)
  await db.run(`
    UPDATE accounts
    SET is_active = FALSE,
        archived_at = ?
    WHERE id = ?
  `, new Date().toISOString(), accountId);

  await db.run(`
    UPDATE transactions
    SET is_archived = TRUE,
        archived_at = ?
    WHERE account_id = ?
  `, new Date().toISOString(), accountId);

  // OR Step 3 Alternative: Hard delete (NOT recommended)
  // await db.run('DELETE FROM transactions WHERE account_id = ?', accountId);
  // await db.run('DELETE FROM accounts WHERE id = ?', accountId);

  console.log('✅ Account archived');
}
```

**Recommendation**: Always soft delete (mark as archived), never hard delete.

---

## 3️⃣ Data Corruption & Recovery

### Scenario: Parser creates duplicates

**Detection**:
```sql
-- Find potential duplicates
SELECT
  account_id,
  date,
  merchant,
  amount,
  COUNT(*) as count
FROM transactions
WHERE source_type = 'pdf'
GROUP BY account_id, date, merchant, amount
HAVING count > 1;
```

**Recovery**:
```javascript
async function deduplicateTransactions() {
  // Find duplicates
  const duplicates = await db.all(`
    SELECT
      account_id,
      date,
      merchant,
      amount,
      GROUP_CONCAT(id) as ids
    FROM transactions
    GROUP BY account_id, date, merchant, amount
    HAVING COUNT(*) > 1
  `);

  console.log(`Found ${duplicates.length} duplicate groups`);

  for (const dup of duplicates) {
    const ids = dup.ids.split(',');

    // Keep the first one, mark others as duplicates
    const [keepId, ...deleteIds] = ids;

    await db.run('BEGIN TRANSACTION');

    try {
      // Mark as duplicates (soft delete)
      await db.run(`
        UPDATE transactions
        SET is_duplicate = TRUE,
            duplicate_of = ?
        WHERE id IN (${deleteIds.map(() => '?').join(',')})
      `, keepId, ...deleteIds);

      await db.run('COMMIT');
      console.log(`Marked ${deleteIds.length} transactions as duplicates of ${keepId}`);

    } catch (error) {
      await db.run('ROLLBACK');
      console.error('Deduplication failed:', error);
    }
  }
}
```

---

### Scenario: SQLite Database Corrupted

**Detection**:
```bash
sqlite3 finance.db "PRAGMA integrity_check;"
```

**Recovery Options**:

**Option 1: Restore from backup**
```bash
# Restore from most recent backup
cp backups/finance_2025-10-28.db finance.db
```

**Option 2: Export/Import (if partially corrupted)**
```bash
# Export to SQL
sqlite3 finance.db ".dump" > backup.sql

# Create new DB
rm finance.db
sqlite3 finance.db < backup.sql
```

**Option 3: Recover what you can**
```javascript
async function recoverCorruptedData() {
  const newDb = new Database('finance_recovered.db');

  // Initialize fresh schema
  await initializeSchema(newDb);

  try {
    // Try to read transactions from corrupted DB
    const transactions = await oldDb.all('SELECT * FROM transactions');

    // Insert into new DB with validation
    for (const txn of transactions) {
      try {
        await newDb.run(`
          INSERT INTO transactions (id, account_id, date, merchant, amount, currency, type, ...)
          VALUES (?, ?, ?, ?, ?, ?, ?, ...)
        `, txn.id, txn.account_id, txn.date, txn.merchant, txn.amount, txn.currency, txn.type);
      } catch (error) {
        console.warn(`Skipped corrupted transaction ${txn.id}:`, error);
      }
    }

    console.log('✅ Recovery complete');
  } catch (error) {
    console.error('❌ Recovery failed:', error);
  }
}
```

**Prevention**:
1. ✅ Daily automatic backups
2. ✅ PRAGMA integrity_check on startup
3. ✅ Write-ahead logging (WAL mode)
4. ✅ Never hard-kill the app during writes

---

## 4️⃣ Performance Optimization

### Scenario: 100k+ transactions slow

**Indexes (Critical)**:
```sql
-- Core indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON transactions(account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_date
  ON transactions(date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant
  ON transactions(merchant);

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON transactions(category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_type
  ON transactions(type);

CREATE INDEX IF NOT EXISTS idx_transactions_source_hash
  ON transactions(source_hash);

-- Composite index for filters
CREATE INDEX IF NOT EXISTS idx_transactions_filters
  ON transactions(account_id, type, date DESC);
```

**Query Optimization**:

```javascript
// BAD: No pagination
const allTransactions = await db.all('SELECT * FROM transactions');

// GOOD: Paginated with index
const transactions = await db.all(`
  SELECT * FROM transactions
  WHERE account_id = ?
  AND date >= ? AND date <= ?
  ORDER BY date DESC
  LIMIT ? OFFSET ?
`, accountId, startDate, endDate, 100, offset);
```

**Batch Operations**:
```javascript
// BAD: Insert one by one
for (const txn of transactions) {
  await db.run('INSERT INTO transactions VALUES (...)');
}

// GOOD: Batch insert
await db.run('BEGIN TRANSACTION');
for (const txn of transactions) {
  await db.run('INSERT INTO transactions VALUES (...)');
}
await db.run('COMMIT');
```

**Virtual Tables for Full-Text Search**:
```sql
-- For searching merchants/descriptions
CREATE VIRTUAL TABLE transactions_fts USING fts5(
  merchant,
  original_description,
  content=transactions,
  content_rowid=id
);

-- Search becomes fast
SELECT * FROM transactions_fts
WHERE transactions_fts MATCH 'starbucks OR amazon'
LIMIT 50;
```

---

## 5️⃣ Schema Versioning

### Migration System

```javascript
// migrations/001_initial_schema.sql
// migrations/002_add_categories.sql
// migrations/003_add_budgets.sql
// ...

const MIGRATIONS = [
  { version: 1, name: 'initial_schema', file: '001_initial_schema.sql' },
  { version: 2, name: 'add_categories', file: '002_add_categories.sql' },
  { version: 3, name: 'add_budgets', file: '003_add_budgets.sql' },
];

async function getCurrentVersion() {
  try {
    const result = await db.get('SELECT MAX(version) as version FROM schema_migrations');
    return result.version || 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

async function runMigrations() {
  const currentVersion = await getCurrentVersion();
  const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    console.log('✅ Database is up to date');
    return;
  }

  console.log(`Running ${pendingMigrations.length} migrations...`);

  for (const migration of pendingMigrations) {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);

    await db.run('BEGIN TRANSACTION');

    try {
      // Read migration SQL
      const sql = fs.readFileSync(`migrations/${migration.file}`, 'utf8');

      // Execute migration
      await db.exec(sql);

      // Record migration
      await db.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString()
      );

      await db.run('COMMIT');
      console.log(`✅ Applied migration ${migration.version}`);

    } catch (error) {
      await db.run('ROLLBACK');
      console.error(`❌ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  console.log('✅ All migrations applied successfully');
}

// Run on app startup
await runMigrations();
```

---

## 6️⃣ Parser Evolution

### Scenario: Bank changes PDF format

**Problem**: BofA changes from "Date Description Amount" to "Date | Description | Amount"

**Solution: Versioned Parsers**

```sql
-- parser_configs with versioning
CREATE TABLE parser_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,        -- NEW: Version
  effective_from TEXT NOT NULL,    -- NEW: When this version became active
  effective_to TEXT,                -- NEW: When this version was deprecated

  -- ... existing fields ...

  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,

  UNIQUE(id, version)
);

-- Insert both versions
INSERT INTO parser_configs VALUES
  ('bofa', 'Bank of America', 1, '2020-01-01', '2025-09-30', ...),  -- Old format
  ('bofa', 'Bank of America', 2, '2025-10-01', NULL, ...);          -- New format
```

**Auto-detect version**:
```javascript
async function detectParserVersion(pdfText, bankId) {
  const configs = await db.all(
    'SELECT * FROM parser_configs WHERE id = ? ORDER BY version DESC',
    bankId
  );

  for (const config of configs) {
    // Try detection patterns
    const keywords = JSON.parse(config.detection_keywords);
    if (keywords.every(kw => pdfText.includes(kw))) {
      // Check format-specific marker
      const patterns = JSON.parse(config.detection_patterns);
      for (const pattern of patterns) {
        if (new RegExp(pattern.regex).test(pdfText)) {
          console.log(`Detected ${bankId} version ${config.version}`);
          return config;
        }
      }
    }
  }

  throw new Error(`No parser found for ${bankId}`);
}
```

**Re-parsing Historical Data**:
```javascript
async function reparseAccount(accountId, newParserVersion) {
  // Get all PDFs for this account
  const files = await db.all(
    'SELECT DISTINCT source_file FROM transactions WHERE account_id = ?',
    accountId
  );

  console.log(`Will reparse ${files.length} files`);

  for (const file of files) {
    // Backup existing transactions
    await db.run(`
      UPDATE transactions
      SET is_archived = TRUE,
          archived_reason = 'reparse'
      WHERE source_file = ?
    `, file.source_file);

    // Parse with new parser
    const pdfText = fs.readFileSync(file.source_file, 'utf8');
    const parsed = await parseWithConfig(pdfText, accountId, newParserVersion);

    // Insert new transactions
    for (const txn of parsed) {
      await insertTransaction(txn);
    }

    console.log(`✅ Reparsed ${file.source_file}`);
  }
}
```

---

## 7️⃣ Data Integrity

### Orphaned Data Detection

```sql
-- Find transactions without accounts
SELECT COUNT(*) FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
WHERE a.id IS NULL;

-- Find transactions with deleted categories
SELECT COUNT(*) FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.category_id IS NOT NULL AND c.id IS NULL;

-- Find transfers without pairs
SELECT COUNT(*) FROM transactions
WHERE type = 'transfer' AND transfer_pair_id IS NULL;
```

**Auto-fix Script**:
```javascript
async function fixDataIntegrity() {
  console.log('Running data integrity checks...');

  // Fix 1: Orphaned category references
  const orphanedCategories = await db.all(`
    SELECT t.id
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.category_id IS NOT NULL AND c.id IS NULL
  `);

  if (orphanedCategories.length > 0) {
    await db.run(`
      UPDATE transactions
      SET category_id = NULL
      WHERE category_id NOT IN (SELECT id FROM categories)
    `);
    console.log(`Fixed ${orphanedCategories.length} orphaned category references`);
  }

  // Fix 2: Broken transfer pairs
  const brokenTransfers = await db.all(`
    SELECT id FROM transactions
    WHERE type = 'transfer'
    AND (
      transfer_pair_id IS NULL
      OR transfer_pair_id NOT IN (SELECT id FROM transactions)
    )
  `);

  if (brokenTransfers.length > 0) {
    // Try to re-link transfers
    await relinkTransfers();
    console.log(`Attempted to fix ${brokenTransfers.length} broken transfers`);
  }

  // Fix 3: Invalid dates
  await db.run(`
    UPDATE transactions
    SET date = created_at
    WHERE date IS NULL OR date = ''
  `);

  console.log('✅ Data integrity checks complete');
}

// Run periodically
setInterval(fixDataIntegrity, 24 * 60 * 60 * 1000); // Daily
```

---

## 7.5️⃣ Data Invariants & Reconciliation

**QUÉ ES**: Reglas matemáticas o lógicas que SIEMPRE deben cumplirse en tu sistema. Si un invariante falla, significa que hay errores: transacciones faltantes, duplicados, o datos corruptos.

---

### Invariant 1: Balance Reconciliation

**Regla matemática**:
```
saldo_inicial + ingresos - gastos = saldo_final
```

**Aplica cuando**: El PDF del banco incluye saldo inicial y final (BofA, Chase, etc.)

**Ejemplo concreto**:
```
BofA Statement - October 2025
- Saldo inicial:  $1,000.00
- Ingresos:       $  500.00
- Gastos:         $  300.00
- Saldo final:    $1,200.00

Verificación: $1,000 + $500 - $300 = $1,200 ✅ CORRECTO
```

**Si NO cuadra**:
```
❌ Balance mismatch detected!
Expected: $1,200.00
Actual:   $1,150.00
Difference: -$50.00

Posibles causas:
- Faltó parsear una transacción
- Duplicado que no se detectó
- Signo invertido (débito como crédito)
- Decimal mal procesado ($5.00 → $50.00)
```

**Implementación (referencia)**:
```javascript
async function checkBalanceInvariant(accountId, month) {
  // 1. Get initial balance from statement metadata
  const statement = await db.get(`
    SELECT initial_balance, final_balance
    FROM statements
    WHERE account_id = ? AND month = ?
  `, accountId, month);

  // 2. Calculate from transactions
  const calculated = await db.get(`
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE account_id = ? AND strftime('%Y-%m', date) = ?
  `, accountId, month);

  const expected = statement.initial_balance + calculated.income - calculated.expense;
  const actual = statement.final_balance;
  const diff = Math.abs(expected - actual);

  if (diff > 0.01) { // Tolerance for floating point
    console.error(`❌ Balance mismatch: ${accountId} ${month}`);
    console.error(`Expected: $${expected.toFixed(2)}`);
    console.error(`Actual: $${actual.toFixed(2)}`);
    console.error(`Difference: $${diff.toFixed(2)}`);

    // Alert user
    await createAlert({
      type: 'BALANCE_MISMATCH',
      severity: 'HIGH',
      accountId,
      month,
      difference: diff
    });
  }
}
```

---

### Invariant 2: Transfer Balance

**Regla matemática**:
```
Σ(transfer debits) = Σ(transfer credits)
```

**Ejemplo concreto**:
```
Transfer: BofA → Apple Card ($500)
- BofA:       -$500.00 (debit)
- Apple Card: +$500.00 (credit)

Verificación: |-$500| = |+$500| ✅ CORRECTO
```

**Si NO cuadra**:
```
❌ Unbalanced transfers detected!
Debit total:  $500.00
Credit total: $450.00
Missing:      $50.00

Posibles causas:
- Transfer fee no detectado como fee separado
- Una parte del par no se parseó
- Monedas diferentes sin conversión
```

**Implementación (referencia)**:
```javascript
async function checkTransferInvariant() {
  const result = await db.get(`
    SELECT
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as debit_total,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credit_total
    FROM transactions
    WHERE type = 'transfer'
  `);

  const diff = Math.abs(result.debit_total - result.credit_total);

  if (diff > 0.01) {
    console.error(`❌ Transfer imbalance: $${diff.toFixed(2)}`);

    // Find unlinked transfers
    const unlinked = await db.all(`
      SELECT * FROM transactions
      WHERE type = 'transfer'
      AND (transfer_pair_id IS NULL
           OR transfer_pair_id NOT IN (SELECT id FROM transactions))
    `);

    console.log(`Found ${unlinked.length} unlinked transfers`);
  }
}
```

---

### Invariant 3: Parse Completeness

**Regla matemática**:
```
filas_en_PDF = filas_guardadas + filas_rechazadas
```

**Ejemplo concreto**:
```
BofA PDF - October 2025
- Total lines in PDF: 127
- Transactions saved:  120
- Rejected/ignored:      7
  - 3 pending (no balance yet)
  - 2 headers/footers
  - 2 malformed lines

Verificación: 127 = 120 + 7 ✅ CORRECTO
```

**Si NO cuadra**:
```
❌ Parse completeness check failed!
PDF lines:        127
Saved:            115
Rejected:           5
Missing:            7  ← PROBLEMA

Acción: Re-parse PDF con logging detallado
```

**Implementación (referencia)**:
```javascript
async function parseWithCompleteness(pdfPath, accountId) {
  const lines = await extractPDFLines(pdfPath);
  const stats = {
    total: lines.length,
    saved: 0,
    rejected: 0,
    rejectionReasons: {}
  };

  for (const line of lines) {
    try {
      const parsed = parseLine(line);

      if (shouldReject(parsed)) {
        stats.rejected++;
        const reason = getRejectionReason(parsed);
        stats.rejectionReasons[reason] = (stats.rejectionReasons[reason] || 0) + 1;
        continue;
      }

      await saveTransaction(parsed, accountId);
      stats.saved++;

    } catch (error) {
      stats.rejected++;
      stats.rejectionReasons['parse_error'] = (stats.rejectionReasons['parse_error'] || 0) + 1;
    }
  }

  // Verify invariant
  if (stats.total !== stats.saved + stats.rejected) {
    console.error(`❌ Parse completeness failed!`);
    console.error(`Total: ${stats.total}, Saved: ${stats.saved}, Rejected: ${stats.rejected}`);
    console.error(`Missing: ${stats.total - stats.saved - stats.rejected}`);
  }

  // Save stats for audit trail
  await db.run(`
    INSERT INTO parse_stats (pdf_path, account_id, total_lines, saved, rejected, stats_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `, pdfPath, accountId, stats.total, stats.saved, stats.rejected, JSON.stringify(stats));

  return stats;
}
```

---

### Invariant 4: Count Reconciliation by Period

**Regla matemática**:
```
transacciones_esperadas ≈ transacciones_actuales (±tolerance)
```

**Ejemplo concreto**:
```
Darwin típicamente tiene:
- BofA:       40-50 transacciones/mes
- Apple Card: 30-40 transacciones/mes
- Wise:       10-15 transacciones/mes

Octubre 2025:
- BofA:       48 ✅ (en rango)
- Apple Card: 12 ❌ (muy bajo, esperaba 30-40)
- Wise:       11 ✅ (en rango)

Alerta: "Apple Card Oct 2025: Only 12 transactions (expected 30-40). PDF incomplete?"
```

**Implementación (referencia)**:
```javascript
async function checkCountInvariant(accountId, month) {
  // Get historical average
  const avg = await db.get(`
    SELECT AVG(count) as avg_count
    FROM (
      SELECT COUNT(*) as count
      FROM transactions
      WHERE account_id = ?
      GROUP BY strftime('%Y-%m', date)
    )
  `, accountId);

  // Get current month count
  const current = await db.get(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE account_id = ? AND strftime('%Y-%m', date) = ?
  `, accountId, month);

  const tolerance = 0.5; // 50% tolerance
  const expectedMin = avg.avg_count * (1 - tolerance);
  const expectedMax = avg.avg_count * (1 + tolerance);

  if (current.count < expectedMin) {
    console.warn(`⚠️ Low transaction count for ${accountId} ${month}`);
    console.warn(`Expected: ${expectedMin.toFixed(0)}-${expectedMax.toFixed(0)}`);
    console.warn(`Actual: ${current.count}`);

    await createAlert({
      type: 'LOW_TRANSACTION_COUNT',
      severity: 'MEDIUM',
      accountId,
      month,
      expected: avg.avg_count,
      actual: current.count
    });
  }
}
```

---

### Invariant 5: Timeline Completeness (Gap Detection)

**Regla lógica**:
```
No deben haber gaps > threshold en el timeline
```

**Ejemplo concreto**:
```
Timeline esperado:
Jan 2025: ✅ 45 txns
Feb 2025: ✅ 48 txns
Mar 2025: ❌ 0 txns   ← GAP!
Apr 2025: ✅ 52 txns
May 2025: ✅ 47 txns

Alerta: "Gap detected: BofA missing March 2025 statement"
```

**Implementación (referencia)**:
```javascript
async function checkTimelineGaps(accountId) {
  const gaps = await db.all(`
    WITH months AS (
      SELECT DISTINCT strftime('%Y-%m', date) as month
      FROM transactions
      WHERE account_id = ?
      ORDER BY month
    ),
    gaps AS (
      SELECT
        month as start_month,
        LEAD(month) OVER (ORDER BY month) as next_month,
        CAST((julianday(LEAD(month) OVER (ORDER BY month) || '-01') -
              julianday(month || '-01')) / 30 AS INTEGER) as months_diff
      FROM months
    )
    SELECT * FROM gaps
    WHERE months_diff > 1  -- Gap greater than 1 month
  `, accountId);

  if (gaps.length > 0) {
    console.error(`❌ Timeline gaps detected for ${accountId}:`);
    for (const gap of gaps) {
      console.error(`Gap between ${gap.start_month} and ${gap.next_month} (${gap.months_diff} months)`);

      await createAlert({
        type: 'TIMELINE_GAP',
        severity: 'HIGH',
        accountId,
        startMonth: gap.start_month,
        endMonth: gap.next_month,
        gapSize: gap.months_diff
      });
    }
  }
}
```

---

### Alert & Monitoring System

**Cuándo alertar**:

| Invariant | Threshold | Severity |
|-----------|-----------|----------|
| Balance mismatch | > $1.00 | 🔴 HIGH |
| Transfer imbalance | > $0.50 | 🔴 HIGH |
| Parse completeness | Missing > 5% | 🟡 MEDIUM |
| Count reconciliation | < 50% expected | 🟡 MEDIUM |
| Timeline gap | > 1 month | 🔴 HIGH |

**Implementación (referencia)**:
```javascript
async function runAllInvariants() {
  console.log('Running data invariant checks...');

  const accounts = await db.all('SELECT id FROM accounts');

  for (const account of accounts) {
    // Run all checks
    await checkBalanceInvariant(account.id, getCurrentMonth());
    await checkCountInvariant(account.id, getCurrentMonth());
    await checkTimelineGaps(account.id);
  }

  await checkTransferInvariant();

  console.log('✅ Invariant checks complete');
}

// Run daily
setInterval(runAllInvariants, 24 * 60 * 60 * 1000);

// Also run after each PDF upload
app.on('pdf_processed', async () => {
  await runAllInvariants();
});
```

---

### Audit Trail

**Guardar resultados de cada check**:
```sql
CREATE TABLE invariant_checks (
  id TEXT PRIMARY KEY,
  check_type TEXT NOT NULL,  -- 'balance', 'transfer', 'parse', 'count', 'gap'
  status TEXT NOT NULL,      -- 'pass', 'fail'
  account_id TEXT,
  period TEXT,
  expected_value REAL,
  actual_value REAL,
  difference REAL,
  details TEXT,              -- JSON con info adicional
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_invariant_checks_status ON invariant_checks(status);
CREATE INDEX idx_invariant_checks_type ON invariant_checks(check_type);
```

**Dashboard view**:
```sql
-- Ver últimos fallos
SELECT
  check_type,
  account_id,
  period,
  difference,
  checked_at
FROM invariant_checks
WHERE status = 'fail'
ORDER BY checked_at DESC
LIMIT 20;

-- Ver tasa de éxito por tipo
SELECT
  check_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as passed,
  ROUND(100.0 * SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM invariant_checks
GROUP BY check_type;
```

---

## 8️⃣ Backup & Restore

### Automated Backup Strategy

```javascript
async function createBackup() {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = `backups/finance_${timestamp}.db`;

  // Copy SQLite file
  fs.copyFileSync('finance.db', backupPath);

  // Compress
  const gzip = zlib.createGzip();
  const source = fs.createReadStream(backupPath);
  const destination = fs.createWriteStream(`${backupPath}.gz`);
  source.pipe(gzip).pipe(destination);

  // Delete uncompressed
  destination.on('finish', () => {
    fs.unlinkSync(backupPath);
    console.log(`✅ Backup created: ${backupPath}.gz`);
  });

  // Keep only last 30 days
  cleanOldBackups(30);
}

function cleanOldBackups(days) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const backups = fs.readdirSync('backups');

  for (const file of backups) {
    const filePath = `backups/${file}`;
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old backup: ${file}`);
    }
  }
}

// Schedule daily backups
const cron = require('node-cron');
cron.schedule('0 2 * * *', createBackup); // Every day at 2 AM
```

### Restore from Backup

```javascript
async function restoreBackup(backupFile) {
  console.log(`Restoring from ${backupFile}...`);

  // Decompress if needed
  if (backupFile.endsWith('.gz')) {
    const gunzip = zlib.createGunzip();
    const source = fs.createReadStream(backupFile);
    const destination = fs.createWriteStream('finance_temp.db');

    await new Promise((resolve, reject) => {
      source.pipe(gunzip).pipe(destination)
        .on('finish', resolve)
        .on('error', reject);
    });

    backupFile = 'finance_temp.db';
  }

  // Verify backup integrity
  const testDb = new Database(backupFile, { readonly: true });
  await testDb.get('PRAGMA integrity_check');
  testDb.close();

  // Create safety backup of current DB
  fs.copyFileSync('finance.db', `finance_before_restore_${Date.now()}.db`);

  // Replace current DB
  fs.copyFileSync(backupFile, 'finance.db');

  console.log('✅ Restore complete');
}
```

---

## 9️⃣ Testing Strategy

### Unit Tests (Jest)

```javascript
// __tests__/parsers/bofa.test.js
describe('BofA Parser', () => {
  test('parses basic transaction', () => {
    const pdfText = `
      Statement Date: September 30, 2025
      Date        Description                              Amount
      Sep 28      STARBUCKS STORE #12345                    -5.67
    `;

    const result = parseBofA(pdfText);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2025-09-28',
      merchant: 'STARBUCKS STORE #12345',
      amount: -5.67,
      currency: 'USD'
    });
  });

  test('handles multiline descriptions', () => {
    // ...
  });

  test('detects transfers', () => {
    // ...
  });
});
```

### Integration Tests

```javascript
// __tests__/integration/upload-flow.test.js
describe('Upload Flow', () => {
  let db;

  beforeEach(async () => {
    db = await setupTestDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  test('complete upload flow: PDF → transactions', async () => {
    // Upload PDF
    const pdfPath = 'test-data/bofa-statement.pdf';
    await uploadPDF(pdfPath, 'bofa-checking');

    // Verify transactions created
    const transactions = await db.all('SELECT * FROM transactions');
    expect(transactions.length).toBeGreaterThan(0);

    // Verify normalization
    const starbucks = transactions.find(t => t.merchant === 'Starbucks');
    expect(starbucks).toBeDefined();
    expect(starbucks.original_description).toContain('STARBUCKS STORE #12345');
  });
});
```

### E2E Tests (Playwright)

```javascript
// e2e/upload.spec.js
test('user can upload PDF and see transactions', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Upload PDF
  await page.setInputFiles('input[type="file"]', 'test-data/bofa-statement.pdf');

  // Wait for processing
  await page.waitForSelector('.upload-success');

  // Verify timeline shows transactions
  const transactions = await page.locator('.transaction-row').all();
  expect(transactions.length).toBeGreaterThan(0);

  // Verify first transaction
  const firstTxn = transactions[0];
  await expect(firstTxn.locator('.merchant')).toHaveText('Starbucks');
  await expect(firstTxn.locator('.amount')).toContain('-$5.67');
});
```

---

## 🔟 Monitoring & Observability

### Error Tracking (Sentry)

```javascript
const Sentry = require('@sentry/electron');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Automatic error capture
app.on('error', (error) => {
  Sentry.captureException(error);
});

// Manual tracking
async function uploadPDF(file) {
  const transaction = Sentry.startTransaction({ name: 'upload-pdf' });

  try {
    await processFile(file);
    transaction.setStatus('ok');
  } catch (error) {
    transaction.setStatus('error');
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
}
```

### Performance Monitoring

```javascript
// Simple performance logger
class PerformanceMonitor {
  static timers = new Map();

  static start(name) {
    this.timers.set(name, Date.now());
  }

  static end(name) {
    const start = this.timers.get(name);
    const duration = Date.now() - start;

    console.log(`⏱️ ${name}: ${duration}ms`);

    // Log slow operations
    if (duration > 1000) {
      console.warn(`⚠️ Slow operation: ${name} took ${duration}ms`);
    }

    this.timers.delete(name);
    return duration;
  }
}

// Usage
PerformanceMonitor.start('upload-pdf');
await uploadPDF(file);
PerformanceMonitor.end('upload-pdf');
```

---

## 1️⃣1️⃣ Rollback Strategies

### Application Version Rollback

```javascript
// Before deploying new version
async function createRestorePoint() {
  const version = require('./package.json').version;

  // Backup database
  fs.copyFileSync('finance.db', `backups/pre-update-${version}.db`);

  // Backup app state
  const state = {
    version,
    dbVersion: await getCurrentSchemaVersion(),
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('backups/restore-point.json', JSON.stringify(state, null, 2));
}

// If new version has issues
async function rollback() {
  const restorePoint = JSON.parse(fs.readFileSync('backups/restore-point.json'));

  // Restore database
  fs.copyFileSync(
    `backups/pre-update-${restorePoint.version}.db`,
    'finance.db'
  );

  console.log(`✅ Rolled back to version ${restorePoint.version}`);
}
```

### Transaction Rollback (User Action)

```javascript
// Every significant operation creates an undo entry
CREATE TABLE undo_log (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,           -- 'bulk_update', 'delete', 'import'
  affected_records TEXT NOT NULL,    -- JSON array of IDs
  before_state TEXT,                 -- JSON snapshot
  timestamp TEXT NOT NULL
);

async function bulkUpdateWithUndo(operation) {
  // Snapshot before state
  const before = await captureState(operation.affectedIds);

  // Create undo entry
  const undoId = generateId();
  await db.run(
    'INSERT INTO undo_log (id, operation, affected_records, before_state, timestamp) VALUES (?, ?, ?, ?, ?)',
    undoId,
    operation.type,
    JSON.stringify(operation.affectedIds),
    JSON.stringify(before),
    new Date().toISOString()
  );

  // Perform operation
  await operation.execute();

  return undoId;
}

async function undo(undoId) {
  const log = await db.get('SELECT * FROM undo_log WHERE id = ?', undoId);
  const before = JSON.parse(log.before_state);

  await db.run('BEGIN TRANSACTION');

  try {
    // Restore previous state
    for (const record of before) {
      await db.run(
        'UPDATE transactions SET ... WHERE id = ?',
        // ... restore all fields
        record.id
      );
    }

    await db.run('COMMIT');
    console.log('✅ Undo successful');

  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
```

---

## 1️⃣2️⃣ Data Validation

### Input Validation

```javascript
const Joi = require('joi');

const transactionSchema = Joi.object({
  account_id: Joi.string().required(),
  date: Joi.string().isoDate().required(),
  merchant: Joi.string().min(1).max(200).required(),
  amount: Joi.number().required(),
  currency: Joi.string().length(3).required(),
  type: Joi.string().valid('expense', 'income', 'transfer').required(),
  category_id: Joi.string().allow(null),
  notes: Joi.string().max(1000).allow(null, '')
});

async function validateTransaction(data) {
  try {
    return await transactionSchema.validateAsync(data);
  } catch (error) {
    throw new Error(`Invalid transaction data: ${error.message}`);
  }
}
```

### Database Constraints

```sql
-- Enforce data integrity at DB level
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL CHECK(date LIKE '____-__-__'),  -- YYYY-MM-DD
  amount REAL NOT NULL CHECK(amount != 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'transfer')),

  -- Referential integrity
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

---

## 1️⃣3️⃣ Deprecation Strategy

### Scenario: Deprecate `observations` table (if we had started with 2-table approach)

```javascript
// Phase 1: Mark as deprecated
await db.run(`
  ALTER TABLE observations RENAME TO observations_deprecated;
  CREATE VIEW observations AS SELECT * FROM observations_deprecated;
`);

console.warn('⚠️ observations table is deprecated. Use transactions table instead.');

// Phase 2: Migration period (keep both for 3 months)
// Log warnings when observations is accessed

// Phase 3: Remove
await db.run('DROP VIEW observations');
await db.run('DROP TABLE observations_deprecated');
```

---

## 1️⃣4️⃣ GDPR Compliance

### User Data Export

```javascript
async function exportUserData(userId) {
  const data = {
    user: await db.get('SELECT * FROM users WHERE id = ?', userId),
    accounts: await db.all('SELECT * FROM accounts WHERE user_id = ?', userId),
    transactions: await db.all('SELECT * FROM transactions WHERE user_id = ?', userId),
    categories: await db.all('SELECT * FROM categories WHERE user_id = ?', userId),
    budgets: await db.all('SELECT * FROM budgets WHERE user_id = ?', userId)
  };

  const exportFile = `exports/user_${userId}_${Date.now()}.json`;
  fs.writeFileSync(exportFile, JSON.stringify(data, null, 2));

  return exportFile;
}
```

### User Data Deletion

```javascript
async function deleteUserData(userId) {
  await db.run('BEGIN TRANSACTION');

  try {
    // Delete in correct order (foreign keys)
    await db.run('DELETE FROM transactions WHERE user_id = ?', userId);
    await db.run('DELETE FROM budgets WHERE user_id = ?', userId);
    await db.run('DELETE FROM categories WHERE user_id = ? AND is_system = FALSE', userId);
    await db.run('DELETE FROM accounts WHERE user_id = ?', userId);
    await db.run('DELETE FROM users WHERE id = ?', userId);

    await db.run('COMMIT');
    console.log('✅ User data deleted');

  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
```

---

## ✅ Resumen - TODOS los Casos Cubiertos

| Caso | Solución | Riesgo |
|------|----------|--------|
| **Data migrations** | Schema versioning + migrations table | ⚠️ MEDIO |
| **Bulk operations** | Backups + transactions + confirmations | ⚠️ MEDIO |
| **Data corruption** | Integrity checks + recovery scripts | 🔴 ALTO |
| **Performance** | Indexes + pagination + batching | ⚠️ MEDIO |
| **Schema evolution** | Migration system + rollbacks | ⚠️ MEDIO |
| **Parser changes** | Versioned parsers + re-parsing | ⚠️ MEDIO |
| **Data integrity** | Foreign keys + auto-fix scripts | ⚠️ MEDIO |
| **Backups** | Daily automated + 30-day retention | 🟢 BAJO |
| **Testing** | Unit + integration + E2E | 🟢 BAJO |
| **Monitoring** | Error tracking + performance logs | 🟢 BAJO |
| **Rollbacks** | Restore points + undo log | ⚠️ MEDIO |
| **Validation** | Joi + DB constraints | 🟢 BAJO |
| **Deprecation** | Phased removal + warnings | 🟢 BAJO |
| **GDPR** | Export + deletion tools | 🟢 BAJO |

---

## 🚨 Critical Operations Checklist

Before ANY major operation:

- [ ] Create backup
- [ ] Test on copy of production data
- [ ] Have rollback plan ready
- [ ] Use database transactions
- [ ] Log all changes
- [ ] Verify integrity after operation

---

**Status**: ✅ TODOS los casos operacionales cubiertos
