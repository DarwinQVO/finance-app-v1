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

## Task 17: Categories UI Component 🎨

**Goal**: Create a UI component for managing categories (view, create, edit, delete).

**Scope**:
- View all system and custom categories
- Create new custom categories (name, icon, color, optional parent)
- Edit existing custom categories
- Delete categories (with warning if in use)
- Toggle active/inactive status

**LOC estimate**: ~250 LOC (component ~120, styles ~50, tests ~80)

---

### Component: CategoryManager.jsx

React component for managing categories. Displays list of categories with create/edit/delete functionality.

```javascript
<<src/components/CategoryManager.jsx>>=
import React, { useState, useEffect } from 'react';
import './CategoryManager.css';

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '🏷️',
    color: '#999999'
  });

  const availableIcons = ['🍔', '🚗', '🏠', '🎬', '🛒', '💼', '💰', '⚕️', '✈️', '🎓', '📱', '🔧', '🏷️', '🎸', '🧘', '💆', '🏥', '❤️'];
  const availableColors = ['#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#51CF66', '#A8DADC', '#457B9D', '#F1FAEE', '#E63946', '#999999'];

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const result = await window.electronAPI.getCategories();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    setEditingCategory(null);
    setFormData({ name: '', icon: '🏷️', color: '#999999' });
    setShowForm(true);
  }

  function handleEdit(category) {
    if (category.is_system) {
      alert('System categories cannot be edited');
      return;
    }
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || '🏷️',
      color: category.color || '#999999'
    });
    setShowForm(true);
  }

  async function handleDelete(category) {
    if (category.is_system) {
      alert('System categories cannot be deleted');
      return;
    }

    // Check if category is in use
    const usageCount = await window.electronAPI.getCategoryUsageCount(category.id);

    if (usageCount > 0) {
      const confirmed = window.confirm(
        `⚠️ Warning: ${usageCount} transactions are currently using this category.\n\n` +
        `Deleting this category will set those transactions to "Uncategorized".\n\n` +
        `Continue?`
      );
      if (!confirmed) return;
    }

    try {
      await window.electronAPI.deleteCategory(category.id);
      loadCategories();
    } catch (error) {
      alert('Failed to delete category: ' + error.message);
    }
  }

  async function handleToggleActive(category) {
    try {
      await window.electronAPI.updateCategory(category.id, {
        is_active: !category.is_active
      });
      loadCategories();
    } catch (error) {
      alert('Failed to update category: ' + error.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    try {
      if (editingCategory) {
        await window.electronAPI.updateCategory(editingCategory.id, formData);
      } else {
        await window.electronAPI.createCategory(formData);
      }
      setShowForm(false);
      loadCategories();
    } catch (error) {
      alert('Failed to save category: ' + error.message);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({ name: '', icon: '🏷️', color: '#999999' });
  }

  if (loading) {
    return <div className="category-manager loading">Loading categories...</div>;
  }

  const systemCategories = categories.filter(c => c.is_system);
  const customCategories = categories.filter(c => !c.is_system);

  return (
    <div className="category-manager">
      <div className="category-manager-header">
        <h2>Categories</h2>
        <button onClick={handleCreateNew} className="btn-primary">
          + New Category
        </button>
      </div>

      {showForm && (
        <div className="category-form-overlay">
          <div className="category-form">
            <h3>{editingCategory ? 'Edit Category' : 'Create Category'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Therapy"
                  required
                />
              </div>

              <div className="form-group">
                <label>Icon</label>
                <div className="icon-picker">
                  {availableIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-option ${formData.icon === icon ? 'selected' : ''}`}
                      onClick={() => setFormData({ ...formData, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${formData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCategory ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="category-list">
        <div className="category-section">
          <h3>System Categories</h3>
          {systemCategories.map((cat) => (
            <div key={cat.id} className="category-item">
              <span className="category-icon" style={{ color: cat.color }}>
                {cat.icon}
              </span>
              <span className="category-name">{cat.name}</span>
              <span className="category-status">
                {cat.is_active ? '(active)' : '(inactive)'}
              </span>
              <button
                onClick={() => handleToggleActive(cat)}
                className="btn-small"
              >
                {cat.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>

        {customCategories.length > 0 && (
          <div className="category-section">
            <h3>Custom Categories</h3>
            {customCategories.map((cat) => (
              <div key={cat.id} className="category-item">
                <span className="category-icon" style={{ color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="category-name">{cat.name}</span>
                <span className="category-status">
                  {cat.is_active ? '(active)' : '(inactive)'}
                </span>
                <div className="category-actions">
                  <button onClick={() => handleEdit(cat)} className="btn-small">
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(cat)}
                    className="btn-small"
                  >
                    {cat.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
@
```

---

### Styles: CategoryManager.css

```css
<<src/components/CategoryManager.css>>=
.category-manager {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.category-manager.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.category-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.category-manager-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.category-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.category-form {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.category-form h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.icon-picker,
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-option {
  width: 40px;
  height: 40px;
  border: 2px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-option:hover {
  border-color: #999;
  transform: scale(1.1);
}

.icon-option.selected {
  border-color: #4CAF50;
  background: #f0f8f0;
}

.color-option {
  width: 40px;
  height: 40px;
  border: 2px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: #333;
  box-shadow: 0 0 0 2px white, 0 0 0 4px #4CAF50;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.category-section h3 {
  font-size: 16px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 15px;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 6px;
  margin-bottom: 10px;
}

.category-icon {
  font-size: 24px;
  margin-right: 12px;
}

.category-name {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.category-status {
  font-size: 12px;
  color: #999;
  margin-right: 15px;
}

.category-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-small {
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-small:hover {
  background: #e0e0e0;
}

.btn-danger {
  color: #d32f2f;
  border-color: #d32f2f;
}

.btn-danger:hover {
  background: #ffebee;
}
@
```

---

### Tests: CategoryManager.test.jsx

```javascript
<<tests/CategoryManager.test.jsx>>=
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoryManager from '../src/components/CategoryManager.jsx';
import { vi } from 'vitest';

describe('CategoryManager Component', () => {
  const mockCategories = [
    { id: 'cat_food', name: 'Food & Dining', icon: '🍔', color: '#FF6B6B', is_system: true, is_active: true },
    { id: 'cat_transport', name: 'Transportation', icon: '🚗', color: '#4ECDC4', is_system: true, is_active: true },
    { id: 'cat_therapy', name: 'Therapy', icon: '🧘', color: '#AA96DA', is_system: false, is_active: true }
  ];

  beforeEach(() => {
    window.electronAPI = {
      getCategories: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      getCategoryUsageCount: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading state initially', () => {
    window.electronAPI.getCategories.mockImplementation(() => new Promise(() => {}));
    render(<CategoryManager />);
    expect(screen.getByText(/Loading categories/i)).toBeInTheDocument();
  });

  test('renders categories after loading', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(screen.getByText('Therapy')).toBeInTheDocument();
    });
  });

  test('separates system and custom categories', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('System Categories')).toBeInTheDocument();
      expect(screen.getByText('Custom Categories')).toBeInTheDocument();
    });
  });

  test('opens create form when clicking New Category button', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    });

    const newButton = screen.getByText('+ New Category');
    fireEvent.click(newButton);

    expect(screen.getByText('Create Category')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
  });

  test('creates new category successfully', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.electronAPI.createCategory.mockResolvedValue({ success: true });

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('+ New Category'));

    // Fill form
    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'New Category' } });

    // Submit
    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(window.electronAPI.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Category',
          icon: expect.any(String),
          color: expect.any(String)
        })
      );
    });
  });

  test('prevents editing system categories', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.alert = vi.fn();

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    });

    // Try to edit system category (Food & Dining)
    const systemCategory = screen.getByText('Food & Dining').closest('.category-item');
    const editButton = systemCategory.querySelector('button');

    // System categories only have toggle button, not edit
    // We check that system categories don't have "Edit" button
    expect(systemCategory.textContent).not.toContain('Edit');
  });

  test('allows editing custom categories', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Therapy')).toBeInTheDocument();
    });

    // Find custom category and click Edit
    const therapyCategory = screen.getByText('Therapy').closest('.category-item');
    const editButton = therapyCategory.querySelector('button');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Category')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Therapy')).toBeInTheDocument();
    });
  });

  test('warns when deleting category with transactions', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.electronAPI.getCategoryUsageCount.mockResolvedValue(15);
    window.confirm = vi.fn(() => false); // User cancels

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Therapy')).toBeInTheDocument();
    });

    // Find custom category and click Delete
    const therapyCategory = screen.getByText('Therapy').closest('.category-item');
    const deleteButton = Array.from(therapyCategory.querySelectorAll('button')).find(
      btn => btn.textContent === 'Delete'
    );
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(window.electronAPI.getCategoryUsageCount).toHaveBeenCalledWith('cat_therapy');
      expect(window.confirm).toHaveBeenCalled();
    });

    // Should not delete because user cancelled
    expect(window.electronAPI.deleteCategory).not.toHaveBeenCalled();
  });

  test('toggles category active status', async () => {
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.electronAPI.updateCategory.mockResolvedValue({ success: true });

    render(<CategoryManager />);

    await waitFor(() => {
      expect(screen.getByText('Therapy')).toBeInTheDocument();
    });

    // Find custom category and click Deactivate
    const therapyCategory = screen.getByText('Therapy').closest('.category-item');
    const deactivateButton = Array.from(therapyCategory.querySelectorAll('button')).find(
      btn => btn.textContent === 'Deactivate'
    );
    fireEvent.click(deactivateButton);

    await waitFor(() => {
      expect(window.electronAPI.updateCategory).toHaveBeenCalledWith('cat_therapy', {
        is_active: false
      });
    });
  });
});
@
```

---

### ✅ Test Coverage: CategoryManager

**Tests cubiertos**:
1. ✅ Renders loading state initially
2. ✅ Renders categories after loading
3. ✅ Separates system and custom categories
4. ✅ Opens create form when clicking New Category button
5. ✅ Creates new category successfully
6. ✅ Prevents editing system categories
7. ✅ Allows editing custom categories
8. ✅ Warns when deleting category with transactions
9. ✅ Toggles category active status

---

### 📊 Status: Task 17 Complete

**Output**:
- ✅ `src/components/CategoryManager.jsx` - Category management UI
- ✅ `src/components/CategoryManager.css` - Component styles
- ✅ `tests/CategoryManager.test.jsx` - 9 tests

**Total**: ~280 LOC (slightly over estimate due to detailed UI)

**Next**: Task 18 - Budgets Table

---

## Task 18: Budgets Table 💰

**Goal**: Create database schema for budgets with tracking capabilities.

**Scope**:
- Budgets table with name, amount, period, alert threshold
- Budget-categories junction table (many-to-many)
- Support for monthly, weekly, yearly periods
- Active/inactive status tracking
- Tests for schema and basic operations

**LOC estimate**: ~100 LOC (migration ~40, tests ~60)

---

### Migration: Add Budgets Tables

```sql
<<migrations/004-add-budgets.sql>>=
-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'weekly', 'yearly')),
  alert_threshold REAL DEFAULT 0.8 CHECK (alert_threshold >= 0 AND alert_threshold <= 1),
  start_date TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Junction table: budgets <-> categories (many-to-many)
CREATE TABLE IF NOT EXISTS budget_categories (
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (budget_id, category_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget ON budget_categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_category ON budget_categories(category_id);
@
```

---

### Tests: Budgets Schema

```javascript
<<tests/budgets.test.js>>=
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Budgets Table Schema', () => {
  let db;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Run migrations in order
    const schema = fs.readFileSync(path.join(ROOT_DIR, 'src/db/schema.sql'), 'utf-8');
    db.exec(schema);

    const categoriesMigration = fs.readFileSync(
      path.join(ROOT_DIR, 'migrations/002-add-categories.sql'),
      'utf-8'
    );
    db.exec(categoriesMigration);

    const budgetsMigration = fs.readFileSync(
      path.join(ROOT_DIR, 'migrations/004-add-budgets.sql'),
      'utf-8'
    );
    db.exec(budgetsMigration);
  });

  afterEach(() => {
    db.close();
  });

  test('budgets table exists with correct columns', () => {
    const tableInfo = db.pragma('table_info(budgets)');
    const columnNames = tableInfo.map(col => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('amount');
    expect(columnNames).toContain('period');
    expect(columnNames).toContain('alert_threshold');
    expect(columnNames).toContain('start_date');
    expect(columnNames).toContain('is_active');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  test('budget_categories junction table exists', () => {
    const tableInfo = db.pragma('table_info(budget_categories)');
    const columnNames = tableInfo.map(col => col.name);

    expect(columnNames).toContain('budget_id');
    expect(columnNames).toContain('category_id');
  });

  test('can insert a budget with valid data', () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'budget-1',
      'Food Budget',
      800.00,
      'monthly',
      0.8,
      '2025-01-01',
      1,
      now,
      now
    );

    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get('budget-1');

    expect(budget).toBeDefined();
    expect(budget.name).toBe('Food Budget');
    expect(budget.amount).toBe(800.00);
    expect(budget.period).toBe('monthly');
    expect(budget.alert_threshold).toBe(0.8);
  });

  test('enforces amount > 0 constraint', () => {
    const now = new Date().toISOString();

    expect(() => {
      db.prepare(`
        INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('budget-1', 'Invalid Budget', -100, 'monthly', '2025-01-01', now, now);
    }).toThrow();
  });

  test('enforces valid period values', () => {
    const now = new Date().toISOString();

    expect(() => {
      db.prepare(`
        INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('budget-1', 'Invalid Period', 800, 'invalid', '2025-01-01', now, now);
    }).toThrow();
  });

  test('enforces alert_threshold range (0-1)', () => {
    const now = new Date().toISOString();

    // Test > 1
    expect(() => {
      db.prepare(`
        INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('budget-1', 'Invalid Alert', 800, 'monthly', 1.5, '2025-01-01', now, now);
    }).toThrow();

    // Test < 0
    expect(() => {
      db.prepare(`
        INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('budget-2', 'Invalid Alert', 800, 'monthly', -0.1, '2025-01-01', now, now);
    }).toThrow();
  });

  test('can link budget to categories', () => {
    const now = new Date().toISOString();

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Food Budget', 800, 'monthly', '2025-01-01', now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Link them
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    const link = db.prepare(`
      SELECT * FROM budget_categories
      WHERE budget_id = ? AND category_id = ?
    `).get('budget-1', 'cat_food');

    expect(link).toBeDefined();
    expect(link.budget_id).toBe('budget-1');
    expect(link.category_id).toBe('cat_food');
  });

  test('CASCADE delete: deleting budget removes category links', () => {
    const now = new Date().toISOString();

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Food Budget', 800, 'monthly', '2025-01-01', now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Link them
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    // Delete budget
    db.prepare('DELETE FROM budgets WHERE id = ?').run('budget-1');

    // Check that link was also deleted
    const links = db.prepare('SELECT * FROM budget_categories WHERE budget_id = ?')
      .all('budget-1');

    expect(links.length).toBe(0);
  });

  test('supports multiple periods (monthly, weekly, yearly)', () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Monthly Budget', 800, 'monthly', '2025-01-01', now, now);

    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('budget-2', 'Weekly Budget', 200, 'weekly', '2025-01-01', now, now);

    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('budget-3', 'Yearly Budget', 10000, 'yearly', '2025-01-01', now, now);

    const budgets = db.prepare('SELECT period FROM budgets ORDER BY id').all();

    expect(budgets[0].period).toBe('monthly');
    expect(budgets[1].period).toBe('weekly');
    expect(budgets[2].period).toBe('yearly');
  });

  test('budget can be linked to multiple categories', () => {
    const now = new Date().toISOString();

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Multi Budget', 1500, 'monthly', '2025-01-01', now, now);

    // Create categories
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_transport', 'Transportation', now);

    // Link budget to both categories
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_transport');

    const links = db.prepare('SELECT * FROM budget_categories WHERE budget_id = ?')
      .all('budget-1');

    expect(links.length).toBe(2);
  });
});
@
```

---

### ✅ Test Coverage: Budgets

**Tests cubiertos**:
1. ✅ Budgets table exists with correct columns
2. ✅ Budget_categories junction table exists
3. ✅ Can insert a budget with valid data
4. ✅ Enforces amount > 0 constraint
5. ✅ Enforces valid period values (monthly/weekly/yearly)
6. ✅ Enforces alert_threshold range (0-1)
7. ✅ Can link budget to categories
8. ✅ CASCADE delete removes category links
9. ✅ Supports multiple periods
10. ✅ Budget can be linked to multiple categories

---

### 📊 Status: Task 18 Complete

**Output**:
- ✅ `migrations/004-add-budgets.sql` - Budgets schema with constraints
- ✅ `tests/budgets.test.js` - 10 tests

**Total**: ~150 LOC (slightly over estimate due to comprehensive tests)

**Next**: Task 19 - Budget Tracking Engine

---

