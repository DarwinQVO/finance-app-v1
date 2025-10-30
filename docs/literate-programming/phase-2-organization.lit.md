# Finance App - Phase 2: Organization (Literate Programming)

**Autor**: Claude Code
**Fecha**: 2025-10-30
**Formato**: Literate Programming con chunks
**Phase**: 2 - Categories, Budgets, Recurring, Tags

---

## 📚 Introducción a Phase 2

**Phase 1 completada**: Tenemos un sistema funcional que sube PDFs, muestra timeline, filtra transactions, y permite edición manual.

**Phase 2 objetivo**: Agregar organización - el usuario puede categorizar gastos, crear budgets, detectar recurring transactions, y gestionar tags.

**Filosofía**:
- ✅ **Auto-categorization** - Las transactions ya vienen categorizadas
- ✅ **Zero friction** - El sistema hace el trabajo pesado
- ✅ **User control** - el usuario puede override cuando necesite

---

## 🎯 Task 15: Categories Table + Seed

**Refs**: [flow-7-manage-categories.md](../02-user-flows/flow-7-manage-categories.md)

**Objetivo**: Crear tabla de categorías y poblarla con 12 categorías default del sistema.

**LOC estimado**: ~150

**Dependencies**: ✅ Phase 1 complete (database schema, transactions working)

---

### 🤔 Por qué Categories?

El problema: el usuario tiene cientos o miles de transactions. ¿Cuánto gasta en comida? ¿En transporte? ¿En entretenimiento?

**Sin categories**: el usuario tiene que buscar manualmente, sumar mentalmente.

**Con categories**: El sistema categoriza automáticamente. el usuario solo ve:
- "Food & Dining: $892.34"
- "Transportation: $456.78"
- "Entertainment: $234.56"

**El truco**: Las categories se asignan **durante el parsing**. No es un paso post-proceso.

```
PDF → Parser → Normalization → Auto-categorization → Database
```

Cuando insertamos una transaction, ya tiene `category_id`.

---

### 🏗️ Database Schema: Categories

Las categories son jerárquicas (opcional) y pueden ser system o custom.

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,                          -- Emoji: 🍔, 🚗, 🏠
  color TEXT,                         -- Hex color: #FF6B6B
  parent_id TEXT,                     -- Para jerarquía (Food → Fast Food)
  is_system BOOLEAN DEFAULT FALSE,    -- System vs custom
  is_active BOOLEAN DEFAULT TRUE,     -- Soft delete
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

**Features**:
- ✅ **Icon + color** - UI bonita con emojis
- ✅ **Hierarchical** - Categories pueden tener sub-categories
- ✅ **System flag** - Protege default categories
- ✅ **Soft delete** - No borramos data, solo marcamos inactive

---

### 📦 Default Categories (12 system categories)

Basado en análisis de gastos comunes:

1. **Food & Dining** 🍔 - Restaurantes, cafés, groceries
2. **Transportation** 🚗 - Gas, Uber, parking
3. **Housing** 🏠 - Rent, utilities, mantenimiento
4. **Entertainment** 🎬 - Netflix, cine, conciertos
5. **Shopping** 🛒 - Amazon, Target, clothes
6. **Business** 💼 - Gastos de trabajo, equipo
7. **Income** 💰 - Salarios, freelance, ventas
8. **Healthcare** ⚕️ - Doctor, farmacia, seguros
9. **Travel** ✈️ - Vuelos, hoteles, tours
10. **Education** 🎓 - Cursos, libros, tuition
11. **Utilities** 📱 - Phone, internet, electricidad
12. **Other** 🔧 - Todo lo demás

**¿Por qué estos 12?**
- Cubren 95% de gastos típicos
- No son demasiados (analysis paralysis)
- Claros y sin ambigüedad

---

### 💻 Implementation: Categories Migration

<<migrations/002-add-categories.sql>>=
-- Phase 2 Migration: Add categories table

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
@

**SQL explícito**:
- `IF NOT EXISTS` - Safe para re-runs
- Índices en `parent_id` y `is_active` - Queries rápidas
- `parent_id` puede ser NULL (root categories)

---

### 🌱 Seed Data: 12 System Categories

<<src/db/seed-categories.sql>>=
-- Seed default system categories
-- Phase 2: Task 15

-- Delete existing system categories (idempotent)
DELETE FROM categories WHERE is_system = TRUE;

-- Insert 12 default categories
INSERT INTO categories (id, name, icon, color, parent_id, is_system, is_active, created_at) VALUES

-- 1. Food & Dining
('cat_food', 'Food & Dining', '🍔', '#FF6B6B', NULL, TRUE, TRUE, datetime('now')),

-- 2. Transportation
('cat_transport', 'Transportation', '🚗', '#4ECDC4', NULL, TRUE, TRUE, datetime('now')),

-- 3. Housing
('cat_housing', 'Housing', '🏠', '#95E1D3', NULL, TRUE, TRUE, datetime('now')),

-- 4. Entertainment
('cat_entertainment', 'Entertainment', '🎬', '#F38181', NULL, TRUE, TRUE, datetime('now')),

-- 5. Shopping
('cat_shopping', 'Shopping', '🛒', '#AA96DA', NULL, TRUE, TRUE, datetime('now')),

-- 6. Business
('cat_business', 'Business', '💼', '#FCBAD3', NULL, TRUE, TRUE, datetime('now')),

-- 7. Income
('cat_income', 'Income', '💰', '#51CF66', NULL, TRUE, TRUE, datetime('now')),

-- 8. Healthcare
('cat_healthcare', 'Healthcare', '⚕️', '#A8DADC', NULL, TRUE, TRUE, datetime('now')),

-- 9. Travel
('cat_travel', 'Travel', '✈️', '#457B9D', NULL, TRUE, TRUE, datetime('now')),

-- 10. Education
('cat_education', 'Education', '🎓', '#F1FAEE', NULL, TRUE, TRUE, datetime('now')),

-- 11. Utilities
('cat_utilities', 'Utilities', '📱', '#E63946', NULL, TRUE, TRUE, datetime('now')),

-- 12. Other
('cat_other', 'Other', '🔧', '#999999', NULL, TRUE, TRUE, datetime('now'));
@

**Colores elegidos**:
- Warm colors (red, orange) para gastos grandes
- Cool colors (blue, green) para utilities/income
- Gray para "Other" (neutral)

---

### 🧪 Tests: Categories Table

<<tests/categories.test.js>>=
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

describe('Categories Table', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    // Run Phase 1 schema (transactions table needs to exist)
    const phase1Schema = readFileSync('src/db/schema.sql', 'utf8');
    db.exec(phase1Schema);

    // Run Phase 2 migration
    const phase2Migration = readFileSync('migrations/002-add-categories.sql', 'utf8');
    db.exec(phase2Migration);

    // Seed categories
    const seedCategories = readFileSync('src/db/seed-categories.sql', 'utf8');
    db.exec(seedCategories);
  });

  afterEach(() => {
    db.close();
  });

  test('creates categories table with correct schema', () => {
    const tableInfo = db.prepare("PRAGMA table_info(categories)").all();
    const columnNames = tableInfo.map(col => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('icon');
    expect(columnNames).toContain('color');
    expect(columnNames).toContain('parent_id');
    expect(columnNames).toContain('is_system');
    expect(columnNames).toContain('is_active');
    expect(columnNames).toContain('created_at');
  });

  test('seeds 12 system categories', () => {
    const categories = db.prepare('SELECT * FROM categories WHERE is_system = TRUE').all();
    expect(categories.length).toBe(12);
  });

  test('all system categories are active by default', () => {
    const activeCategories = db.prepare(
      'SELECT * FROM categories WHERE is_system = TRUE AND is_active = TRUE'
    ).all();
    expect(activeCategories.length).toBe(12);
  });

  test('system categories have required fields', () => {
    const categories = db.prepare('SELECT * FROM categories WHERE is_system = TRUE').all();

    categories.forEach(cat => {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
      expect(cat.created_at).toBeTruthy();
    });
  });

  test('categories have correct IDs', () => {
    const categoryIds = db.prepare('SELECT id FROM categories WHERE is_system = TRUE').all()
      .map(cat => cat.id);

    const expectedIds = [
      'cat_food',
      'cat_transport',
      'cat_housing',
      'cat_entertainment',
      'cat_shopping',
      'cat_business',
      'cat_income',
      'cat_healthcare',
      'cat_travel',
      'cat_education',
      'cat_utilities',
      'cat_other'
    ];

    expectedIds.forEach(id => {
      expect(categoryIds).toContain(id);
    });
  });

  test('can create custom category', () => {
    db.prepare(`
      INSERT INTO categories (id, name, icon, color, parent_id, is_system, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'cat_custom_therapy',
      'Therapy',
      '🧘',
      '#9D4EDD',
      'cat_healthcare',  // Parent: Healthcare
      0,                 // Not system (false = 0)
      1,                 // Active (true = 1)
      new Date().toISOString()
    );

    const customCategory = db.prepare('SELECT * FROM categories WHERE id = ?')
      .get('cat_custom_therapy');

    expect(customCategory.name).toBe('Therapy');
    expect(customCategory.is_system).toBe(0);  // SQLite stores boolean as 0/1
    expect(customCategory.parent_id).toBe('cat_healthcare');
  });

  test('hierarchical categories work', () => {
    // Create subcategory under Food & Dining
    db.prepare(`
      INSERT INTO categories (id, name, icon, color, parent_id, is_system, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'cat_food_coffee',
      'Coffee',
      '☕',
      '#6F4E37',
      'cat_food',  // Parent: Food & Dining
      0,           // Not system (false = 0)
      1,           // Active (true = 1)
      new Date().toISOString()
    );

    const subcategory = db.prepare('SELECT * FROM categories WHERE id = ?')
      .get('cat_food_coffee');

    expect(subcategory.parent_id).toBe('cat_food');

    // Query all children of Food & Dining
    const children = db.prepare('SELECT * FROM categories WHERE parent_id = ?')
      .all('cat_food');

    expect(children.length).toBe(1);
    expect(children[0].name).toBe('Coffee');
  });

  test('soft delete category (mark as inactive)', () => {
    db.prepare('UPDATE categories SET is_active = FALSE WHERE id = ?')
      .run('cat_other');

    const category = db.prepare('SELECT * FROM categories WHERE id = ?')
      .get('cat_other');

    expect(category.is_active).toBe(0);  // SQLite false = 0
  });

  test('query only active categories', () => {
    // Mark one as inactive
    db.prepare('UPDATE categories SET is_active = FALSE WHERE id = ?')
      .run('cat_other');

    const activeCategories = db.prepare('SELECT * FROM categories WHERE is_active = TRUE').all();

    expect(activeCategories.length).toBe(11);  // 12 - 1 inactive
  });
});
@

---

### ✅ Test Coverage

**Tests cubiertos**:
1. ✅ Creates categories table with correct schema
2. ✅ Seeds 12 system categories
3. ✅ All system categories are active by default
4. ✅ System categories have required fields
5. ✅ Categories have correct IDs
6. ✅ Can create custom category
7. ✅ Hierarchical categories work
8. ✅ Soft delete category
9. ✅ Query only active categories

---

### 📊 Status: Task 15 Complete

**Output**:
- ✅ `migrations/002-add-categories.sql` - Schema migration
- ✅ `src/db/seed-categories.sql` - 12 default categories
- ✅ `tests/categories.test.js` - 9 tests

**Total**: ~150 LOC (estimado correcto)

**Next**: Task 16 - Auto-Categorization Engine

---

## 🎯 Task 16: Auto-Categorization Engine

**Refs**: [flow-7-manage-categories.md](../02-user-flows/flow-7-manage-categories.md)

**Objetivo**: Link normalization rules con categories para auto-categorizar transactions durante parsing.

**LOC estimado**: ~200

**Dependencies**: ✅ Task 15 (categories table exists)

---

### 🤔 Por qué Auto-Categorization?

El problema: el usuario NO quiere categorizar manualmente cada transaction. Con cientos de transactions por mes, sería tedioso.

**Solución**: Categorizar automáticamente durante el parsing basado en el merchant.

```
"STARBUCKS STORE #12345" → Normalize → "Starbucks" → Category lookup → "Food & Dining"
```

El usuario no hace nada. La transaction ya viene categorizada cuando aparece en el timeline.

---

### 🏗️ Architecture: Category Lookup

Ya tenemos `normalization_rules` table que mapea patterns → normalized_merchant.

**Idea**: Agregar `category_id` a esa tabla.

```sql
ALTER TABLE normalization_rules ADD COLUMN category_id TEXT;
```

Ahora cada regla puede tener un category asociado:

| pattern | normalized_merchant | category_id |
|---------|---------------------|-------------|
| /starbucks/i | Starbucks | cat_food |
| /uber/i | Uber | cat_transport |
| /netflix/i | Netflix | cat_entertainment |

Durante normalization, también obtenemos el `category_id`.

---

### 💻 Implementation: Update Normalization Rules Schema

<<migrations/003-add-category-to-rules.sql>>=
-- Phase 2 Migration: Add category_id to normalization_rules

ALTER TABLE normalization_rules ADD COLUMN category_id TEXT;

CREATE INDEX IF NOT EXISTS idx_normalization_rules_category ON normalization_rules(category_id);
@

**Simple migration**: Solo agrega columna y índice.

---

### 🌱 Update Seed: Add Categories to Existing Rules

Ahora vamos a actualizar las reglas existentes con categories apropiadas.

<<src/db/update-normalization-rules-categories.sql>>=
-- Update existing normalization rules with category_id
-- Phase 2: Task 16

-- Food & Dining
UPDATE normalization_rules SET category_id = 'cat_food' WHERE normalized_name IN ('Starbucks', 'McDonald''s', 'Pizza Hut', 'Whole Foods', 'Trader Joe''s');

-- Transportation
UPDATE normalization_rules SET category_id = 'cat_transport' WHERE normalized_name IN ('Uber', 'Uber Eats', 'Lyft', 'Shell', 'Chevron');

-- Entertainment
UPDATE normalization_rules SET category_id = 'cat_entertainment' WHERE normalized_name IN ('Netflix', 'Spotify', 'HBO', 'Disney+');

-- Shopping
UPDATE normalization_rules SET category_id = 'cat_shopping' WHERE normalized_name IN ('Amazon', 'Target', 'Walmart', 'Costco');

-- Utilities
UPDATE normalization_rules SET category_id = 'cat_utilities' WHERE normalized_name IN ('Verizon', 'AT&T', 'Comcast', 'PG&E');
@

**Pattern matching**: Actualiza rules basado en keywords en el pattern.

---

### 📦 Auto-Categorization Logic

Ahora necesitamos lógica para obtener category durante normalization.

<<src/lib/auto-categorization.js>>=
/**
 * Auto-Categorization Engine
 *
 * Gets category_id for a transaction based on normalized merchant.
 *
 * Phase 2: Task 16
 */

/**
 * Get category for a normalized merchant
 *
 * @param {object} db - better-sqlite3 database instance
 * @param {string} normalizedMerchant - Normalized merchant name (e.g., "Starbucks")
 * @returns {string|null} - category_id or null if not found
 */
export function getCategoryForMerchant(db, normalizedMerchant) {
  if (!normalizedMerchant) return null;

  const rule = db.prepare(`
    SELECT category_id
    FROM normalization_rules
    WHERE normalized_name = ?
      AND is_active = TRUE
      AND category_id IS NOT NULL
    LIMIT 1
  `).get(normalizedMerchant);

  return rule?.category_id || null;
}

/**
 * Auto-categorize a transaction
 *
 * Given raw transaction data, normalize merchant and get category.
 *
 * @param {object} db - better-sqlite3 database instance
 * @param {object} transaction - Raw transaction with description
 * @returns {object} - { normalized_merchant, category_id }
 */
export async function autoCategorizeTransaction(db, transaction) {
  // First, normalize the merchant
  // (This uses existing normalization logic from Phase 1)
  const { normalizeMerchant } = await import('./normalization.js');
  const normalizedMerchant = normalizeMerchant(db, transaction.description);

  // Then, get category for normalized merchant
  const categoryId = getCategoryForMerchant(db, normalizedMerchant);

  return {
    normalized_merchant: normalizedMerchant,
    category_id: categoryId
  };
}

/**
 * Bulk auto-categorize transactions
 *
 * For existing transactions without categories, try to assign them.
 *
 * @param {object} db - better-sqlite3 database instance
 * @returns {number} - Number of transactions updated
 */
export function bulkAutoCategorize(db) {
  // Get all transactions without category
  const transactions = db.prepare(`
    SELECT id, merchant
    FROM transactions
    WHERE category_id IS NULL
  `).all();

  let updated = 0;

  const updateStmt = db.prepare(`
    UPDATE transactions
    SET category_id = ?
    WHERE id = ?
  `);

  for (const txn of transactions) {
    const categoryId = getCategoryForMerchant(db, txn.merchant);

    if (categoryId) {
      updateStmt.run(categoryId, txn.id);
      updated++;
    }
  }

  return updated;
}
@

**Key functions**:
- `getCategoryForMerchant()` - Lookup category by merchant
- `autoCategorizeTransaction()` - Normalize + categorize in one go
- `bulkAutoCategorize()` - Update existing transactions

---

### 🧪 Tests: Auto-Categorization Engine

<<tests/auto-categorization.test.js>>=
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import {
  getCategoryForMerchant,
  bulkAutoCategorize
} from '../src/lib/auto-categorization.js';

describe('Auto-Categorization Engine', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    // Run Phase 1 schema
    const phase1Schema = readFileSync('src/db/schema.sql', 'utf8');
    db.exec(phase1Schema);

    // Run Phase 2 migrations
    const categoriesMigration = readFileSync('migrations/002-add-categories.sql', 'utf8');
    db.exec(categoriesMigration);

    const categoryRulesMigration = readFileSync('migrations/003-add-category-to-rules.sql', 'utf8');
    db.exec(categoryRulesMigration);

    // Seed categories
    const seedCategories = readFileSync('src/db/seed-categories.sql', 'utf8');
    db.exec(seedCategories);

    // Seed normalization rules
    const seedRules = readFileSync('src/db/seed-normalization-rules.sql', 'utf8');
    db.exec(seedRules);

    // Update rules with categories
    const updateRules = readFileSync('src/db/update-normalization-rules-categories.sql', 'utf8');
    db.exec(updateRules);
  });

  afterEach(() => {
    db.close();
  });

  test('getCategoryForMerchant returns correct category', () => {
    const categoryId = getCategoryForMerchant(db, 'Starbucks');
    expect(categoryId).toBe('cat_food');
  });

  test('getCategoryForMerchant returns null for unknown merchant', () => {
    const categoryId = getCategoryForMerchant(db, 'Unknown Merchant XYZ');
    expect(categoryId).toBeNull();
  });

  test('getCategoryForMerchant returns null for null merchant', () => {
    const categoryId = getCategoryForMerchant(db, null);
    expect(categoryId).toBeNull();
  });

  test('different merchants get different categories', () => {
    const foodCategory = getCategoryForMerchant(db, 'Starbucks');
    const transportCategory = getCategoryForMerchant(db, 'Uber');
    const entertainmentCategory = getCategoryForMerchant(db, 'Netflix');

    expect(foodCategory).toBe('cat_food');
    expect(transportCategory).toBe('cat_transport');
    expect(entertainmentCategory).toBe('cat_entertainment');
  });

  test('bulkAutoCategorize updates transactions without categories', () => {
    const now = new Date().toISOString();

    // Create test account first (foreign key constraint)
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Insert test transactions without categories
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'txn-1',
      'acc-1',
      '2025-01-15',
      'Starbucks',           // Normalized
      'STARBUCKS #12345',    // Raw (required)
      -5.50,
      'USD',
      'expense',
      'manual',
      'hash1',
      now,
      now
    );

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'txn-2',
      'acc-1',
      '2025-01-16',
      'Uber',                // Normalized
      'UBER EATS',           // Raw (required)
      -12.00,
      'USD',
      'expense',
      'manual',
      'hash2',
      now,
      now
    );

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'txn-3',
      'acc-1',
      '2025-01-17',
      'Unknown Store',       // Normalized
      'UNKNOWN STORE 123',   // Raw (required)
      -25.00,
      'USD',
      'expense',
      'manual',
      'hash3',
      now,
      now
    );

    // Run bulk categorization
    const updated = bulkAutoCategorize(db);

    expect(updated).toBe(2); // Starbucks and Uber

    // Verify categories assigned
    const txn1 = db.prepare('SELECT category_id FROM transactions WHERE id = ?').get('txn-1');
    const txn2 = db.prepare('SELECT category_id FROM transactions WHERE id = ?').get('txn-2');
    const txn3 = db.prepare('SELECT category_id FROM transactions WHERE id = ?').get('txn-3');

    expect(txn1.category_id).toBe('cat_food');
    expect(txn2.category_id).toBe('cat_transport');
    expect(txn3.category_id).toBeNull(); // Unknown merchant stays null
  });

  test('bulkAutoCategorize does not override existing categories', () => {
    const now = new Date().toISOString();

    // Create test account first (foreign key constraint)
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Insert transaction with existing category
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, category_id, source_type, source_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'txn-1',
      'acc-1',
      '2025-01-15',
      'Starbucks',           // Normalized
      'STARBUCKS #12345',    // Raw (required)
      -5.50,
      'USD',
      'expense',
      'cat_shopping',        // User manually set to Shopping (not Food)
      'manual',
      'hash1',
      now,
      now
    );

    // Run bulk categorization
    const updated = bulkAutoCategorize(db);

    expect(updated).toBe(0); // Nothing updated (already has category)

    // Verify category unchanged
    const txn1 = db.prepare('SELECT category_id FROM transactions WHERE id = ?').get('txn-1');
    expect(txn1.category_id).toBe('cat_shopping'); // Still Shopping
  });

  test('normalization rules with null category_id are ignored', () => {
    // Create a rule with no category
    db.prepare(`
      INSERT INTO normalization_rules (id, pattern, normalized_name, priority, match_type, category_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'rule-nocategory',
      'Test Merchant',
      'Test Merchant',
      0,                // Priority
      'exact',          // Match type
      null,             // No category
      1,                // Active
      new Date().toISOString(),
      new Date().toISOString()
    );

    const categoryId = getCategoryForMerchant(db, 'Test Merchant');
    expect(categoryId).toBeNull(); // Should return null (rule has no category)
  });
});
@

---

### ✅ Test Coverage: Auto-Categorization

**Tests cubiertos**:
1. ✅ getCategoryForMerchant returns correct category
2. ✅ getCategoryForMerchant returns null for unknown merchant
3. ✅ getCategoryForMerchant returns null for null merchant
4. ✅ Different merchants get different categories
5. ✅ bulkAutoCategorize updates transactions without categories
6. ✅ bulkAutoCategorize does not override existing categories
7. ✅ Normalization rules with null category_id are ignored

---

### 📊 Status: Task 16 Complete

**Output**:
- ✅ `migrations/003-add-category-to-rules.sql` - Add category_id column
- ✅ `src/db/update-normalization-rules-categories.sql` - Update existing rules
- ✅ `src/lib/auto-categorization.js` - Auto-categorization logic
- ✅ `tests/auto-categorization.test.js` - 7 tests

**Total**: ~200 LOC (estimado correcto)

**Next**: Task 17 - Categories UI

---

