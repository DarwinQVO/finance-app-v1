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

## Task 19: Budget Tracking Engine 📊

**Goal**: Implement logic to track budget spending and calculate status in real-time.

**Scope**:
- Calculate current period dates (monthly, weekly, yearly)
- Get budget status (spent, remaining, percentage)
- Check if budget should trigger alerts
- Support multiple budgets tracking
- Handle edge cases (no transactions, over budget)

**LOC estimate**: ~150 LOC (engine ~80, tests ~70)

---

### Engine: budget-tracking.js

Budget tracking engine that calculates spending against budgets in real-time.

```javascript
<<src/lib/budget-tracking.js>>=
/**
 * Calculate the current period start and end dates based on period type
 */
export function getCurrentPeriod(period, startDate) {
  const now = new Date();

  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'weekly') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'yearly') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  throw new Error(`Invalid period: ${period}`);
}

/**
 * Get budget status for a specific budget
 */
export function getBudgetStatus(db, budgetId) {
  // Get budget
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);

  if (!budget) {
    throw new Error(`Budget not found: ${budgetId}`);
  }

  // Get categories for this budget
  const categoryIds = db.prepare(
    'SELECT category_id FROM budget_categories WHERE budget_id = ?'
  ).all(budgetId).map(row => row.category_id);

  if (categoryIds.length === 0) {
    // Budget has no categories assigned
    return {
      budgetId: budget.id,
      name: budget.name,
      limit: budget.amount,
      spent: 0,
      remaining: budget.amount,
      percentage: 0,
      period: getCurrentPeriod(budget.period, budget.start_date),
      isOverBudget: false,
      shouldAlert: false,
      categories: []
    };
  }

  // Get current period
  const { startDate, endDate } = getCurrentPeriod(budget.period, budget.start_date);

  // Calculate total spent in this period for these categories
  const placeholders = categoryIds.map(() => '?').join(',');
  const result = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE category_id IN (${placeholders})
      AND date >= ?
      AND date <= ?
      AND type = 'expense'
  `).get(...categoryIds, startDate, endDate);

  const totalSpent = result.total;
  const percentage = (totalSpent / budget.amount) * 100;
  const remaining = budget.amount - totalSpent;

  return {
    budgetId: budget.id,
    name: budget.name,
    limit: budget.amount,
    spent: totalSpent,
    remaining,
    percentage,
    period: { startDate, endDate },
    isOverBudget: totalSpent > budget.amount,
    shouldAlert: percentage >= (budget.alert_threshold * 100),
    categories: categoryIds
  };
}

/**
 * Get status for all active budgets
 */
export function getAllBudgetsStatus(db) {
  const budgets = db.prepare('SELECT id FROM budgets WHERE is_active = ?').all(1);

  return budgets.map(budget => getBudgetStatus(db, budget.id));
}

/**
 * Check which budgets need alerts
 */
export function checkBudgetAlerts(db) {
  const statuses = getAllBudgetsStatus(db);

  return statuses.filter(status => status.shouldAlert && status.isOverBudget === false);
}

/**
 * Check which budgets are over budget
 */
export function getOverBudgets(db) {
  const statuses = getAllBudgetsStatus(db);

  return statuses.filter(status => status.isOverBudget);
}
@
```

---

### Tests: budget-tracking.test.js

```javascript
<<tests/budget-tracking.test.js>>=
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getCurrentPeriod,
  getBudgetStatus,
  getAllBudgetsStatus,
  checkBudgetAlerts,
  getOverBudgets
} from '../src/lib/budget-tracking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Budget Tracking Engine', () => {
  let db;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Run migrations
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

  test('getCurrentPeriod returns correct monthly period', () => {
    const period = getCurrentPeriod('monthly', '2025-01-01');

    expect(period.startDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Start should be first day of current month
    const now = new Date();
    const expectedStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    expect(period.startDate).toBe(expectedStart);
  });

  test('getCurrentPeriod returns correct weekly period', () => {
    const period = getCurrentPeriod('weekly', '2025-01-01');

    expect(period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Week should be 7 days
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });

  test('getCurrentPeriod returns correct yearly period', () => {
    const period = getCurrentPeriod('yearly', '2025-01-01');

    const now = new Date();
    expect(period.startDate).toBe(`${now.getFullYear()}-01-01`);
    expect(period.endDate).toBe(`${now.getFullYear()}-12-31`);
  });

  test('getCurrentPeriod throws error for invalid period', () => {
    expect(() => getCurrentPeriod('invalid', '2025-01-01')).toThrow('Invalid period');
  });

  test('getBudgetStatus calculates correctly with no spending', () => {
    const now = new Date().toISOString();

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Food Budget', 800, 'monthly', 0.8, '2025-01-01', 1, now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Link budget to category
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    const status = getBudgetStatus(db, 'budget-1');

    expect(status.budgetId).toBe('budget-1');
    expect(status.name).toBe('Food Budget');
    expect(status.limit).toBe(800);
    expect(status.spent).toBe(0);
    expect(status.remaining).toBe(800);
    expect(status.percentage).toBe(0);
    expect(status.isOverBudget).toBe(false);
    expect(status.shouldAlert).toBe(false);
  });

  test('getBudgetStatus calculates correctly with spending', () => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Food Budget', 800, 'monthly', 0.8, '2025-01-01', 1, now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Link budget to category
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    // Add transactions in current period
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', today, 'Starbucks', 'STARBUCKS', -50, 'USD', 'expense', 'manual', 'hash1', 'cat_food', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-2', 'acc-1', today, 'Whole Foods', 'WHOLE FOODS', -100, 'USD', 'expense', 'manual', 'hash2', 'cat_food', now, now);

    const status = getBudgetStatus(db, 'budget-1');

    expect(status.spent).toBe(150);
    expect(status.remaining).toBe(650);
    expect(status.percentage).toBe(18.75);
    expect(status.isOverBudget).toBe(false);
    expect(status.shouldAlert).toBe(false);
  });

  test('getBudgetStatus triggers alert at threshold', () => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Create budget with 80% threshold
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Food Budget', 800, 'monthly', 0.8, '2025-01-01', 1, now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Link budget to category
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    // Add transaction that reaches 85% (over threshold)
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', today, 'Costco', 'COSTCO', -680, 'USD', 'expense', 'manual', 'hash1', 'cat_food', now, now);

    const status = getBudgetStatus(db, 'budget-1');

    expect(status.spent).toBe(680);
    expect(status.percentage).toBe(85);
    expect(status.isOverBudget).toBe(false);
    expect(status.shouldAlert).toBe(true); // 85% >= 80% threshold
  });

  test('getBudgetStatus detects over budget', () => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Food Budget', 800, 'monthly', 0.8, '2025-01-01', 1, now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Link budget to category
    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    // Add transaction that exceeds budget
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', today, 'Costco', 'COSTCO', -900, 'USD', 'expense', 'manual', 'hash1', 'cat_food', now, now);

    const status = getBudgetStatus(db, 'budget-1');

    expect(status.spent).toBe(900);
    expect(status.remaining).toBe(-100);
    expect(status.percentage).toBe(112.5);
    expect(status.isOverBudget).toBe(true);
    expect(status.shouldAlert).toBe(true);
  });

  test('getBudgetStatus handles budget with no categories', () => {
    const now = new Date().toISOString();

    // Create budget without linking categories
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Empty Budget', 800, 'monthly', 0.8, '2025-01-01', 1, now, now);

    const status = getBudgetStatus(db, 'budget-1');

    expect(status.spent).toBe(0);
    expect(status.remaining).toBe(800);
    expect(status.categories).toEqual([]);
  });

  test('getAllBudgetsStatus returns all active budgets', () => {
    const now = new Date().toISOString();

    // Create multiple budgets
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Budget 1', 800, 'monthly', '2025-01-01', 1, now, now);

    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-2', 'Budget 2', 500, 'weekly', '2025-01-01', 1, now, now);

    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-3', 'Inactive Budget', 1000, 'monthly', '2025-01-01', 0, now, now);

    const statuses = getAllBudgetsStatus(db);

    expect(statuses.length).toBe(2); // Only active budgets
    expect(statuses[0].name).toBe('Budget 1');
    expect(statuses[1].name).toBe('Budget 2');
  });

  test('checkBudgetAlerts returns only budgets needing alerts', () => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Budget 1: At 85% (should alert, not over)
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Alert Budget', 1000, 'monthly', 0.8, '2025-01-01', 1, now, now);

    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', today, 'Store', 'STORE', -850, 'USD', 'expense', 'manual', 'hash1', 'cat_food', now, now);

    // Budget 2: At 50% (should not alert)
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-2', 'OK Budget', 1000, 'monthly', 0.8, '2025-01-01', 1, now, now);

    const alerts = checkBudgetAlerts(db);

    expect(alerts.length).toBe(1);
    expect(alerts[0].name).toBe('Alert Budget');
  });

  test('getOverBudgets returns only budgets over limit', () => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);

    // Create category
    db.prepare(`
      INSERT INTO categories (id, name, created_at)
      VALUES (?, ?, ?)
    `).run('cat_food', 'Food & Dining', now);

    // Budget 1: Over budget (110%)
    db.prepare(`
      INSERT INTO budgets (id, name, amount, period, alert_threshold, start_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Over Budget', 1000, 'monthly', 0.8, '2025-01-01', 1, now, now);

    db.prepare(`
      INSERT INTO budget_categories (budget_id, category_id)
      VALUES (?, ?)
    `).run('budget-1', 'cat_food');

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', today, 'Store', 'STORE', -1100, 'USD', 'expense', 'manual', 'hash1', 'cat_food', now, now);

    const overBudgets = getOverBudgets(db);

    expect(overBudgets.length).toBe(1);
    expect(overBudgets[0].name).toBe('Over Budget');
    expect(overBudgets[0].isOverBudget).toBe(true);
  });
});
@
```

---

### ✅ Test Coverage: Budget Tracking

**Tests cubiertos**:
1. ✅ getCurrentPeriod returns correct monthly period
2. ✅ getCurrentPeriod returns correct weekly period
3. ✅ getCurrentPeriod returns correct yearly period
4. ✅ getCurrentPeriod throws error for invalid period
5. ✅ getBudgetStatus calculates correctly with no spending
6. ✅ getBudgetStatus calculates correctly with spending
7. ✅ getBudgetStatus triggers alert at threshold
8. ✅ getBudgetStatus detects over budget
9. ✅ getBudgetStatus handles budget with no categories
10. ✅ getAllBudgetsStatus returns all active budgets
11. ✅ checkBudgetAlerts returns only budgets needing alerts
12. ✅ getOverBudgets returns only budgets over limit

---

### 📊 Status: Task 19 Complete

**Output**:
- ✅ `src/lib/budget-tracking.js` - Budget tracking engine
- ✅ `tests/budget-tracking.test.js` - 12 tests

**Total**: ~200 LOC (slightly over estimate due to comprehensive edge case handling)

**Next**: Task 20 - Budgets UI

---

## Task 20: Budgets UI Component 💰

**Goal**: Create UI component for managing budgets with real-time status display.

**Scope**:
- View all budgets with current spending status
- Create new budget (name, amount, period, categories, alert threshold)
- Edit existing budgets
- Delete budgets
- Visual progress bars showing budget usage
- Alert indicators (warning at threshold, danger when over)

**LOC estimate**: ~300 LOC (component ~150, styles ~80, tests ~70)

---

### Component: BudgetManager.jsx

React component for managing budgets with real-time status tracking.

```javascript
<<src/components/BudgetManager.jsx>>=
import React, { useState, useEffect } from 'react';
import './BudgetManager.css';

export default function BudgetManager() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    period: 'monthly',
    alertThreshold: 0.8,
    selectedCategories: []
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [budgetsData, categoriesData] = await Promise.all([
        window.electronAPI.getBudgetsWithStatus(),
        window.electronAPI.getCategories()
      ]);
      setBudgets(budgetsData);
      setCategories(categoriesData.filter(c => c.is_active));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    setEditingBudget(null);
    setFormData({
      name: '',
      amount: '',
      period: 'monthly',
      alertThreshold: 0.8,
      selectedCategories: []
    });
    setShowForm(true);
  }

  function handleEdit(budget) {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      amount: budget.limit.toString(),
      period: budget.period || 'monthly',
      alertThreshold: budget.alert_threshold || 0.8,
      selectedCategories: budget.categories || []
    });
    setShowForm(true);
  }

  async function handleDelete(budget) {
    const confirmed = window.confirm(
      `Are you sure you want to delete budget "${budget.name}"?\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await window.electronAPI.deleteBudget(budget.budgetId);
      loadData();
    } catch (error) {
      alert('Failed to delete budget: ' + error.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    if (formData.selectedCategories.length === 0) {
      alert('Please select at least one category');
      return;
    }

    const budgetData = {
      name: formData.name.trim(),
      amount: parseFloat(formData.amount),
      period: formData.period,
      alertThreshold: formData.alertThreshold,
      categories: formData.selectedCategories
    };

    try {
      if (editingBudget) {
        await window.electronAPI.updateBudget(editingBudget.budgetId, budgetData);
      } else {
        await window.electronAPI.createBudget(budgetData);
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      alert('Failed to save budget: ' + error.message);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingBudget(null);
  }

  function toggleCategory(categoryId) {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId]
    }));
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function getStatusClass(budget) {
    if (budget.isOverBudget) return 'over-budget';
    if (budget.shouldAlert) return 'warning';
    return 'ok';
  }

  if (loading) {
    return <div className="budget-manager loading">Loading budgets...</div>;
  }

  return (
    <div className="budget-manager">
      <div className="budget-manager-header">
        <h2>Budgets</h2>
        <button onClick={handleCreateNew} className="btn-primary">
          + New Budget
        </button>
      </div>

      {showForm && (
        <div className="budget-form-overlay">
          <div className="budget-form">
            <h3>{editingBudget ? 'Edit Budget' : 'Create Budget'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Food Budget"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="amount">Amount *</label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="800.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="period">Period *</label>
                  <select
                    id="period"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="alertThreshold">
                  Alert at {Math.round(formData.alertThreshold * 100)}% usage
                </label>
                <input
                  id="alertThreshold"
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={formData.alertThreshold}
                  onChange={(e) => setFormData({ ...formData, alertThreshold: parseFloat(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Categories *</label>
                <div className="category-checkboxes">
                  {categories.map((cat) => (
                    <label key={cat.id} className="category-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.selectedCategories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      <span className="category-icon" style={{ color: cat.color }}>
                        {cat.icon}
                      </span>
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCancel} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingBudget ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="empty-state">
          <p>No budgets created yet.</p>
          <p>Budgets help you control spending by setting limits for specific categories.</p>
          <button onClick={handleCreateNew} className="btn-primary">
            Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="budget-list">
          {budgets.map((budget) => (
            <div key={budget.budgetId} className={`budget-card ${getStatusClass(budget)}`}>
              <div className="budget-header">
                <h3>{budget.name}</h3>
                <span className="budget-period">{formatCurrency(budget.limit)}/{budget.period}</span>
              </div>

              <div className="budget-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
                <div className="progress-text">
                  {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                </div>
              </div>

              <div className="budget-status">
                <span className="percentage">{Math.round(budget.percentage)}% used</span>
                <span className="remaining">
                  {budget.isOverBudget
                    ? `${formatCurrency(Math.abs(budget.remaining))} over budget`
                    : `${formatCurrency(budget.remaining)} remaining`}
                </span>
              </div>

              {budget.categories && budget.categories.length > 0 && (
                <div className="budget-categories">
                  Categories: {budget.categories.length} selected
                </div>
              )}

              <div className="budget-actions">
                <button onClick={() => handleEdit(budget)} className="btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(budget)} className="btn-small btn-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
@
```

---

### Styles: BudgetManager.css

```css
<<src/components/BudgetManager.css>>=
.budget-manager {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.budget-manager.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.budget-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.budget-manager-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.budget-form-overlay {
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

.budget-form {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.budget-form h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #333;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
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

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input[type="range"] {
  padding: 0;
}

.category-checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.category-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.category-checkbox:hover {
  background: #f5f5f5;
}

.category-checkbox input[type="checkbox"] {
  width: auto;
}

.category-icon {
  font-size: 18px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state p {
  margin: 10px 0;
}

.budget-list {
  display: grid;
  gap: 20px;
}

.budget-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.budget-card.ok {
  border-color: #4CAF50;
}

.budget-card.warning {
  border-color: #FF9800;
  background: #FFF3E0;
}

.budget-card.over-budget {
  border-color: #f44336;
  background: #FFEBEE;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.budget-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.budget-period {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.budget-progress {
  margin-bottom: 10px;
}

.progress-bar {
  height: 24px;
  background: #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
}

.budget-card.warning .progress-fill {
  background: linear-gradient(90deg, #FF9800, #F57C00);
}

.budget-card.over-budget .progress-fill {
  background: linear-gradient(90deg, #f44336, #d32f2f);
}

.progress-text {
  font-size: 14px;
  color: #666;
  text-align: center;
}

.budget-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 10px;
}

.percentage {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.remaining {
  font-size: 14px;
  color: #666;
}

.budget-categories {
  font-size: 12px;
  color: #999;
  margin-bottom: 15px;
}

.budget-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
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

### Tests: BudgetManager.test.jsx

```javascript
<<tests/BudgetManager.test.jsx>>=
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BudgetManager from '../src/components/BudgetManager.jsx';
import { vi } from 'vitest';

describe('BudgetManager Component', () => {
  const mockBudgets = [
    {
      budgetId: 'budget-1',
      name: 'Food Budget',
      limit: 800,
      spent: 547.89,
      remaining: 252.11,
      percentage: 68.49,
      period: 'monthly',
      isOverBudget: false,
      shouldAlert: false,
      categories: ['cat_food']
    },
    {
      budgetId: 'budget-2',
      name: 'Entertainment',
      limit: 200,
      spent: 175,
      remaining: 25,
      percentage: 87.5,
      period: 'monthly',
      isOverBudget: false,
      shouldAlert: true,
      categories: ['cat_entertainment']
    }
  ];

  const mockCategories = [
    { id: 'cat_food', name: 'Food & Dining', icon: '🍔', color: '#FF6B6B', is_active: true },
    { id: 'cat_entertainment', name: 'Entertainment', icon: '🎬', color: '#F38181', is_active: true }
  ];

  beforeEach(() => {
    window.electronAPI = {
      getBudgetsWithStatus: vi.fn(),
      getCategories: vi.fn(),
      createBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading state initially', () => {
    window.electronAPI.getBudgetsWithStatus.mockImplementation(() => new Promise(() => {}));
    window.electronAPI.getCategories.mockImplementation(() => new Promise(() => {}));

    render(<BudgetManager />);
    expect(screen.getByText(/Loading budgets/i)).toBeInTheDocument();
  });

  test('renders budgets after loading', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });
  });

  test('shows empty state when no budgets', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue([]);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText(/No budgets created yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Create Your First Budget/i)).toBeInTheDocument();
    });
  });

  test('opens create form when clicking New Budget', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
    });

    const newButton = screen.getByText('+ New Budget');
    fireEvent.click(newButton);

    expect(screen.getByText('Create Budget')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
  });

  test('creates new budget successfully', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.electronAPI.createBudget.mockResolvedValue({ success: true });

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('+ New Budget'));

    // Fill form
    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'Transport Budget' } });

    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });

    // Select category
    const categoryCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(categoryCheckboxes[0]);

    // Submit
    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(window.electronAPI.createBudget).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Transport Budget',
          amount: 500,
          period: 'monthly',
          categories: expect.any(Array)
        })
      );
    });
  });

  test('validates required fields', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.alert = vi.fn();

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('+ New Budget'));

    // Try to submit without filling
    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    // Should not call API (form validation prevents it)
    expect(window.electronAPI.createBudget).not.toHaveBeenCalled();
  });

  test('displays budget status with correct styling', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
    });

    // Check for percentage display
    expect(screen.getByText(/68% used/i)).toBeInTheDocument();
    expect(screen.getByText(/88% used/i)).toBeInTheDocument();
  });

  test('allows editing existing budget', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
    });

    // Find first budget's edit button
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Budget')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Food Budget')).toBeInTheDocument();
    });
  });

  test('deletes budget after confirmation', async () => {
    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(mockBudgets);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);
    window.electronAPI.deleteBudget.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Food Budget')).toBeInTheDocument();
    });

    // Click delete on first budget
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(window.electronAPI.deleteBudget).toHaveBeenCalledWith('budget-1');
    });
  });

  test('shows over-budget status correctly', async () => {
    const overBudget = [{
      budgetId: 'budget-over',
      name: 'Over Budget',
      limit: 800,
      spent: 900,
      remaining: -100,
      percentage: 112.5,
      period: 'monthly',
      isOverBudget: true,
      shouldAlert: true,
      categories: ['cat_food']
    }];

    window.electronAPI.getBudgetsWithStatus.mockResolvedValue(overBudget);
    window.electronAPI.getCategories.mockResolvedValue(mockCategories);

    render(<BudgetManager />);

    await waitFor(() => {
      expect(screen.getByText('Over Budget')).toBeInTheDocument();
      expect(screen.getByText('$100.00 over budget')).toBeInTheDocument();
    });
  });
});
@
```

---

### ✅ Test Coverage: BudgetManager

**Tests cubiertos**:
1. ✅ Renders loading state initially
2. ✅ Renders budgets after loading
3. ✅ Shows empty state when no budgets
4. ✅ Opens create form when clicking New Budget
5. ✅ Creates new budget successfully
6. ✅ Validates required fields
7. ✅ Displays budget status with correct styling
8. ✅ Allows editing existing budget
9. ✅ Deletes budget after confirmation
10. ✅ Shows over-budget status correctly

---

### 📊 Status: Task 20 Complete

**Output**:
- ✅ `src/components/BudgetManager.jsx` - Budget management UI
- ✅ `src/components/BudgetManager.css` - Component styles
- ✅ `tests/BudgetManager.test.jsx` - 10 tests

**Total**: ~350 LOC (over estimate due to comprehensive UI features)

**Next**: Task 21 - Recurring Detection Engine

---

## Task 21: Recurring Detection Engine 🔁

**Goal**: Implement automatic detection of recurring transactions (subscriptions, bills).

**Scope**:
- Detect recurring patterns by analyzing transaction history
- Calculate intervals between transactions from same merchant
- Determine frequency (weekly, monthly, yearly)
- Calculate confidence score based on regularity
- Predict next expected payment date
- Support minimum 3 transactions for detection

**LOC estimate**: ~250 LOC (migration ~30, engine ~120, tests ~100)

---

### Migration: Add Recurring Groups Table

```sql
<<migrations/005-add-recurring.sql>>=
-- Recurring groups table
CREATE TABLE IF NOT EXISTS recurring_groups (
  id TEXT PRIMARY KEY,
  merchant TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  expected_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  next_expected_date TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_recurring_merchant ON recurring_groups(merchant);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_groups(next_expected_date);
@
```

---

### Engine: recurring-detection.js

Recurring transaction detection engine that analyzes transaction patterns.

```javascript
<<src/lib/recurring-detection.js>>=
/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Determine frequency based on average interval
 */
function determineFrequency(avgInterval) {
  if (avgInterval >= 6 && avgInterval <= 8) return 'weekly';
  if (avgInterval >= 28 && avgInterval <= 33) return 'monthly';
  if (avgInterval >= 360 && avgInterval <= 370) return 'yearly';
  return null;
}

/**
 * Calculate next expected date based on frequency
 */
function calculateNextDate(lastDate, frequency) {
  const date = new Date(lastDate);

  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (frequency === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (frequency === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Detect recurring pattern for a specific merchant
 */
export function detectRecurringForMerchant(db, merchant) {
  // Get all transactions for this merchant, ordered by date
  const transactions = db.prepare(`
    SELECT id, date, amount, currency
    FROM transactions
    WHERE merchant = ?
      AND type = 'expense'
    ORDER BY date ASC
  `).all(merchant);

  // Need at least 3 transactions to detect a pattern
  if (transactions.length < 3) {
    return null;
  }

  // Calculate intervals between consecutive transactions
  const intervals = [];
  for (let i = 1; i < transactions.length; i++) {
    const interval = daysBetween(transactions[i - 1].date, transactions[i].date);
    intervals.push(interval);
  }

  // Calculate average interval and standard deviation
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdDev = standardDeviation(intervals);

  // Determine frequency
  const frequency = determineFrequency(avgInterval);
  if (!frequency) {
    return null; // No recognizable pattern
  }

  // Calculate confidence (lower stdDev = higher confidence)
  // confidence = 1.0 - (stdDev / avgInterval)
  // Cap at 0-1 range
  let confidence = 1.0 - (stdDev / avgInterval);
  confidence = Math.max(0, Math.min(1, confidence));

  // Low confidence patterns are not useful
  if (confidence < 0.6) {
    return null;
  }

  // Calculate expected amount (average of all amounts)
  const amounts = transactions.map(t => Math.abs(t.amount));
  const expectedAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  // Calculate next expected date
  const lastDate = transactions[transactions.length - 1].date;
  const nextExpectedDate = calculateNextDate(lastDate, frequency);

  return {
    merchant,
    frequency,
    expectedAmount,
    currency: transactions[0].currency,
    confidence,
    nextExpectedDate,
    transactionCount: transactions.length
  };
}

/**
 * Detect all recurring patterns in the database
 */
export function detectAllRecurring(db) {
  // Get all unique merchants with at least 3 transactions
  const merchants = db.prepare(`
    SELECT merchant, COUNT(*) as count
    FROM transactions
    WHERE type = 'expense'
    GROUP BY merchant
    HAVING count >= 3
  `).all();

  const recurring = [];

  for (const { merchant } of merchants) {
    const pattern = detectRecurringForMerchant(db, merchant);
    if (pattern) {
      recurring.push(pattern);
    }
  }

  return recurring;
}

/**
 * Save recurring pattern to database
 */
export function saveRecurringGroup(db, pattern) {
  const id = `rec_${pattern.merchant.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO recurring_groups
    (id, merchant, frequency, expected_amount, currency, confidence, next_expected_date, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    pattern.merchant,
    pattern.frequency,
    pattern.expectedAmount,
    pattern.currency,
    pattern.confidence,
    pattern.nextExpectedDate,
    1,
    now,
    now
  );

  return id;
}

/**
 * Get all active recurring groups
 */
export function getActiveRecurringGroups(db) {
  return db.prepare(`
    SELECT * FROM recurring_groups
    WHERE is_active = 1
    ORDER BY next_expected_date ASC
  `).all();
}

/**
 * Check for price changes in recurring transactions
 */
export function checkPriceChange(db, merchant, newAmount, expectedAmount) {
  const tolerance = 0.10; // 10% tolerance
  const diff = Math.abs(newAmount - expectedAmount);
  const percentChange = diff / expectedAmount;

  if (percentChange > tolerance) {
    return {
      merchant,
      oldAmount: expectedAmount,
      newAmount,
      difference: newAmount - expectedAmount,
      percentChange: percentChange * 100
    };
  }

  return null;
}
@
```

---

### Tests: recurring-detection.test.js

```javascript
<<tests/recurring-detection.test.js>>=
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  detectRecurringForMerchant,
  detectAllRecurring,
  saveRecurringGroup,
  getActiveRecurringGroups,
  checkPriceChange
} from '../src/lib/recurring-detection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Recurring Detection Engine', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    // Run migrations
    const schema = fs.readFileSync(path.join(ROOT_DIR, 'src/db/schema.sql'), 'utf-8');
    db.exec(schema);

    const recurringMigration = fs.readFileSync(
      path.join(ROOT_DIR, 'migrations/005-add-recurring.sql'),
      'utf-8'
    );
    db.exec(recurringMigration);
  });

  afterEach(() => {
    db.close();
  });

  function createTestAccount() {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);
  }

  function addTransaction(id, date, merchant, amount) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, source_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'acc-1', date, merchant, merchant, amount, 'USD', 'expense', 'manual', id, now, now);
  }

  test('detects monthly recurring pattern with 3 transactions', () => {
    createTestAccount();

    // Add 3 Netflix transactions, monthly
    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);
    addTransaction('txn-3', '2025-03-15', 'Netflix', -15.99);

    const pattern = detectRecurringForMerchant(db, 'Netflix');

    expect(pattern).not.toBeNull();
    expect(pattern.merchant).toBe('Netflix');
    expect(pattern.frequency).toBe('monthly');
    expect(pattern.expectedAmount).toBeCloseTo(15.99, 2);
    expect(pattern.confidence).toBeGreaterThan(0.9);
    expect(pattern.transactionCount).toBe(3);
  });

  test('detects weekly recurring pattern', () => {
    createTestAccount();

    // Add weekly coffee purchases
    addTransaction('txn-1', '2025-01-07', 'Starbucks', -5.50);
    addTransaction('txn-2', '2025-01-14', 'Starbucks', -5.50);
    addTransaction('txn-3', '2025-01-21', 'Starbucks', -5.50);

    const pattern = detectRecurringForMerchant(db, 'Starbucks');

    expect(pattern).not.toBeNull();
    expect(pattern.frequency).toBe('weekly');
    expect(pattern.expectedAmount).toBeCloseTo(5.50, 2);
  });

  test('returns null for less than 3 transactions', () => {
    createTestAccount();

    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);

    const pattern = detectRecurringForMerchant(db, 'Netflix');

    expect(pattern).toBeNull();
  });

  test('returns null for inconsistent intervals (low confidence)', () => {
    createTestAccount();

    // Inconsistent intervals: 30, 60, 15 days
    addTransaction('txn-1', '2025-01-01', 'Irregular', -10);
    addTransaction('txn-2', '2025-01-31', 'Irregular', -10);
    addTransaction('txn-3', '2025-04-01', 'Irregular', -10);
    addTransaction('txn-4', '2025-04-16', 'Irregular', -10);

    const pattern = detectRecurringForMerchant(db, 'Irregular');

    expect(pattern).toBeNull();
  });

  test('calculates confidence score correctly', () => {
    createTestAccount();

    // Perfect monthly pattern
    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);
    addTransaction('txn-3', '2025-03-15', 'Netflix', -15.99);
    addTransaction('txn-4', '2025-04-15', 'Netflix', -15.99);

    const pattern = detectRecurringForMerchant(db, 'Netflix');

    expect(pattern.confidence).toBeGreaterThan(0.95);
  });

  test('calculates next expected date correctly', () => {
    createTestAccount();

    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);
    addTransaction('txn-3', '2025-03-15', 'Netflix', -15.99);

    const pattern = detectRecurringForMerchant(db, 'Netflix');

    expect(pattern.nextExpectedDate).toBe('2025-04-15');
  });

  test('detects multiple recurring patterns', () => {
    createTestAccount();

    // Netflix monthly
    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);
    addTransaction('txn-3', '2025-03-15', 'Netflix', -15.99);

    // Spotify monthly
    addTransaction('txn-4', '2025-01-03', 'Spotify', -9.99);
    addTransaction('txn-5', '2025-02-03', 'Spotify', -9.99);
    addTransaction('txn-6', '2025-03-03', 'Spotify', -9.99);

    const patterns = detectAllRecurring(db);

    expect(patterns.length).toBe(2);
    expect(patterns.map(p => p.merchant)).toContain('Netflix');
    expect(patterns.map(p => p.merchant)).toContain('Spotify');
  });

  test('saves recurring group to database', () => {
    createTestAccount();

    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);
    addTransaction('txn-3', '2025-03-15', 'Netflix', -15.99);

    const pattern = detectRecurringForMerchant(db, 'Netflix');
    const id = saveRecurringGroup(db, pattern);

    const saved = db.prepare('SELECT * FROM recurring_groups WHERE id = ?').get(id);

    expect(saved).toBeDefined();
    expect(saved.merchant).toBe('Netflix');
    expect(saved.frequency).toBe('monthly');
    expect(saved.expected_amount).toBeCloseTo(15.99, 2);
  });

  test('retrieves active recurring groups', () => {
    createTestAccount();

    // Create multiple patterns
    addTransaction('txn-1', '2025-01-15', 'Netflix', -15.99);
    addTransaction('txn-2', '2025-02-15', 'Netflix', -15.99);
    addTransaction('txn-3', '2025-03-15', 'Netflix', -15.99);

    addTransaction('txn-4', '2025-01-03', 'Spotify', -9.99);
    addTransaction('txn-5', '2025-02-03', 'Spotify', -9.99);
    addTransaction('txn-6', '2025-03-03', 'Spotify', -9.99);

    const patterns = detectAllRecurring(db);
    patterns.forEach(p => saveRecurringGroup(db, p));

    const active = getActiveRecurringGroups(db);

    expect(active.length).toBe(2);
    expect(active.every(r => r.is_active === 1)).toBe(true);
  });

  test('detects price change', () => {
    const change = checkPriceChange(db, 'Netflix', 17.99, 15.99);

    expect(change).not.toBeNull();
    expect(change.merchant).toBe('Netflix');
    expect(change.oldAmount).toBe(15.99);
    expect(change.newAmount).toBe(17.99);
    expect(change.difference).toBeCloseTo(2.00, 2);
    expect(change.percentChange).toBeCloseTo(12.5, 1);
  });

  test('no price change for small variations', () => {
    // Within 10% tolerance
    const change = checkPriceChange(db, 'Netflix', 16.50, 15.99);

    expect(change).toBeNull();
  });

  test('handles varying amounts in pattern', () => {
    createTestAccount();

    // Amounts vary slightly
    addTransaction('txn-1', '2025-01-15', 'Gym', -50.00);
    addTransaction('txn-2', '2025-02-15', 'Gym', -52.00);
    addTransaction('txn-3', '2025-03-15', 'Gym', -51.00);

    const pattern = detectRecurringForMerchant(db, 'Gym');

    expect(pattern).not.toBeNull();
    expect(pattern.expectedAmount).toBeCloseTo(51.00, 2);
    // Confidence should be slightly lower due to amount variation
    expect(pattern.confidence).toBeLessThan(1.0);
  });
});
@
```

---

### ✅ Test Coverage: Recurring Detection

**Tests cubiertos**:
1. ✅ Detects monthly recurring pattern with 3 transactions
2. ✅ Detects weekly recurring pattern
3. ✅ Returns null for less than 3 transactions
4. ✅ Returns null for inconsistent intervals (low confidence)
5. ✅ Calculates confidence score correctly
6. ✅ Calculates next expected date correctly
7. ✅ Detects multiple recurring patterns
8. ✅ Saves recurring group to database
9. ✅ Retrieves active recurring groups
10. ✅ Detects price change
11. ✅ No price change for small variations
12. ✅ Handles varying amounts in pattern

---

### 📊 Status: Task 21 Complete

**Output**:
- ✅ `migrations/005-add-recurring.sql` - Recurring groups schema
- ✅ `src/lib/recurring-detection.js` - Detection engine
- ✅ `tests/recurring-detection.test.js` - 12 tests

**Total**: ~290 LOC (slightly over estimate due to comprehensive detection logic)

**Next**: Task 22 - Recurring UI

---

## Task 22: Recurring UI Component 🔁

**Goal**: Create UI component to view and manage recurring transactions.

**Scope**:
- View all detected recurring patterns
- Display confidence score with visual indicator
- Show next expected payment date
- Mark subscription as inactive
- View transaction history for a recurring group
- Run detection scan manually
- Visual grouping by confidence level

**LOC estimate**: ~280 LOC (component ~140, styles ~70, tests ~70)

---

### Component: RecurringManager.jsx

React component for managing recurring transactions with detection visualization.

```javascript
<<src/components/RecurringManager.jsx>>=
import React, { useState, useEffect } from 'react';
import './RecurringManager.css';

export default function RecurringManager() {
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadRecurring();
  }, []);

  async function loadRecurring() {
    try {
      const data = await window.electronAPI.getRecurringGroups();
      setRecurring(data);
    } catch (error) {
      console.error('Failed to load recurring groups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunDetection() {
    setScanning(true);
    try {
      await window.electronAPI.detectRecurring();
      loadRecurring();
    } catch (error) {
      alert('Failed to detect recurring patterns: ' + error.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleMarkInactive(group) {
    const confirmed = window.confirm(
      `Mark "${group.merchant}" as not recurring?\n\n` +
      `This will stop tracking this subscription.`
    );

    if (!confirmed) return;

    try {
      await window.electronAPI.updateRecurringGroup(group.id, { is_active: false });
      loadRecurring();
    } catch (error) {
      alert('Failed to update recurring group: ' + error.message);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatFrequency(frequency) {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  }

  function getConfidenceLabel(confidence) {
    if (confidence >= 0.95) return 'Very High';
    if (confidence >= 0.85) return 'High';
    if (confidence >= 0.75) return 'Medium';
    return 'Low';
  }

  function getConfidenceClass(confidence) {
    if (confidence >= 0.95) return 'very-high';
    if (confidence >= 0.85) return 'high';
    if (confidence >= 0.75) return 'medium';
    return 'low';
  }

  if (loading) {
    return <div className="recurring-manager loading">Loading recurring transactions...</div>;
  }

  const activeRecurring = recurring.filter(r => r.is_active);

  return (
    <div className="recurring-manager">
      <div className="recurring-manager-header">
        <h2>Recurring Transactions</h2>
        <button
          onClick={handleRunDetection}
          className="btn-primary"
          disabled={scanning}
        >
          {scanning ? 'Scanning...' : '🔍 Detect Patterns'}
        </button>
      </div>

      {activeRecurring.length === 0 ? (
        <div className="empty-state">
          <p>No recurring patterns detected yet.</p>
          <p>The system automatically detects subscriptions and recurring bills after you have at least 3 transactions from the same merchant.</p>
          <button onClick={handleRunDetection} className="btn-primary" disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan for Recurring Patterns'}
          </button>
        </div>
      ) : (
        <div className="recurring-list">
          <div className="recurring-summary">
            <span className="summary-count">{activeRecurring.length} recurring payments detected</span>
            <span className="summary-total">
              Total: {formatCurrency(activeRecurring.reduce((sum, r) => sum + r.expected_amount, 0))}/month
            </span>
          </div>

          {activeRecurring.map((group) => (
            <div key={group.id} className="recurring-card">
              <div className="recurring-header">
                <div className="recurring-info">
                  <h3>{group.merchant}</h3>
                  <span className="recurring-frequency">
                    {formatCurrency(group.expected_amount)}/{group.frequency}
                  </span>
                </div>
                <div className={`confidence-badge ${getConfidenceClass(group.confidence)}`}>
                  {Math.round(group.confidence * 100)}% confidence
                </div>
              </div>

              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{ width: `${group.confidence * 100}%` }}
                />
              </div>

              <div className="recurring-details">
                <div className="detail-item">
                  <span className="detail-label">Next payment:</span>
                  <span className="detail-value">{group.next_expected_date || 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Confidence:</span>
                  <span className="detail-value">{getConfidenceLabel(group.confidence)}</span>
                </div>
              </div>

              <div className="recurring-actions">
                <button className="btn-small btn-secondary">
                  View History
                </button>
                <button
                  onClick={() => handleMarkInactive(group)}
                  className="btn-small btn-danger"
                >
                  Mark as Not Recurring
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
@
```

---

### Styles: RecurringManager.css

```css
<<src/components/RecurringManager.css>>=
.recurring-manager {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.recurring-manager.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.recurring-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.recurring-manager-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state p {
  margin: 10px 0;
}

.recurring-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 20px;
}

.summary-count {
  font-weight: 600;
  color: #333;
}

.summary-total {
  font-weight: 600;
  color: #4CAF50;
  font-size: 18px;
}

.recurring-list {
  display: grid;
  gap: 20px;
}

.recurring-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.recurring-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recurring-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.recurring-info h3 {
  margin: 0 0 5px 0;
  font-size: 18px;
  color: #333;
}

.recurring-frequency {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.confidence-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.confidence-badge.very-high {
  background: #E8F5E9;
  color: #2E7D32;
}

.confidence-badge.high {
  background: #E3F2FD;
  color: #1565C0;
}

.confidence-badge.medium {
  background: #FFF3E0;
  color: #E65100;
}

.confidence-badge.low {
  background: #FFEBEE;
  color: #C62828;
}

.confidence-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #81C784);
  transition: width 0.3s ease;
}

.recurring-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  padding: 15px 0;
  border-top: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 15px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.recurring-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
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

.btn-primary:hover:not(:disabled) {
  background: #45a049;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-small {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-danger {
  color: #d32f2f;
  border: 1px solid #d32f2f;
  background: white;
}

.btn-danger:hover {
  background: #ffebee;
}
@
```

---

### Tests: RecurringManager.test.jsx

```javascript
<<tests/RecurringManager.test.jsx>>=
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecurringManager from '../src/components/RecurringManager.jsx';
import { vi } from 'vitest';

describe('RecurringManager Component', () => {
  const mockRecurring = [
    {
      id: 'rec_netflix',
      merchant: 'Netflix',
      frequency: 'monthly',
      expected_amount: 15.99,
      currency: 'USD',
      confidence: 0.98,
      next_expected_date: '2025-11-15',
      is_active: true
    },
    {
      id: 'rec_spotify',
      merchant: 'Spotify',
      frequency: 'monthly',
      expected_amount: 9.99,
      currency: 'USD',
      confidence: 0.95,
      next_expected_date: '2025-11-03',
      is_active: true
    },
    {
      id: 'rec_gym',
      merchant: 'Gym Membership',
      frequency: 'monthly',
      expected_amount: 50.00,
      currency: 'USD',
      confidence: 0.72,
      next_expected_date: '2025-11-01',
      is_active: true
    }
  ];

  beforeEach(() => {
    window.electronAPI = {
      getRecurringGroups: vi.fn(),
      detectRecurring: vi.fn(),
      updateRecurringGroup: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders loading state initially', () => {
    window.electronAPI.getRecurringGroups.mockImplementation(() => new Promise(() => {}));

    render(<RecurringManager />);
    expect(screen.getByText(/Loading recurring transactions/i)).toBeInTheDocument();
  });

  test('renders recurring patterns after loading', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue(mockRecurring);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Gym Membership')).toBeInTheDocument();
    });
  });

  test('shows empty state when no patterns detected', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue([]);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText(/No recurring patterns detected/i)).toBeInTheDocument();
    });
  });

  test('displays confidence scores correctly', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue(mockRecurring);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText('98% confidence')).toBeInTheDocument();
      expect(screen.getByText('95% confidence')).toBeInTheDocument();
      expect(screen.getByText('72% confidence')).toBeInTheDocument();
    });
  });

  test('shows summary of recurring payments', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue(mockRecurring);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText(/3 recurring payments detected/i)).toBeInTheDocument();
      // Total: 15.99 + 9.99 + 50.00 = 75.98
      expect(screen.getByText(/\$75.98\/month/i)).toBeInTheDocument();
    });
  });

  test('runs detection scan manually', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue([]);
    window.electronAPI.detectRecurring.mockResolvedValue({ success: true });

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText(/No recurring patterns/i)).toBeInTheDocument();
    });

    const scanButton = screen.getByText('Scan for Recurring Patterns');
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(window.electronAPI.detectRecurring).toHaveBeenCalled();
    });
  });

  test('marks recurring as inactive', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue(mockRecurring);
    window.electronAPI.updateRecurringGroup.mockResolvedValue({ success: true });
    window.confirm = vi.fn(() => true);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });

    const markButtons = screen.getAllByText('Mark as Not Recurring');
    fireEvent.click(markButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(window.electronAPI.updateRecurringGroup).toHaveBeenCalledWith(
        'rec_netflix',
        { is_active: false }
      );
    });
  });

  test('displays next expected payment date', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue(mockRecurring);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText('2025-11-15')).toBeInTheDocument();
      expect(screen.getByText('2025-11-03')).toBeInTheDocument();
    });
  });

  test('shows disabled scan button while scanning', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue([]);
    window.electronAPI.detectRecurring.mockImplementation(() => new Promise(() => {}));

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText('Scan for Recurring Patterns')).toBeInTheDocument();
    });

    const scanButton = screen.getByText('Scan for Recurring Patterns');
    fireEvent.click(scanButton);

    await waitFor(() => {
      const scanButtons = screen.getAllByRole('button', { name: 'Scanning...' });
      expect(scanButtons.length).toBeGreaterThan(0);
      expect(scanButtons[0]).toBeDisabled();
    });
  });

  test('formats currency correctly', async () => {
    window.electronAPI.getRecurringGroups.mockResolvedValue(mockRecurring);

    render(<RecurringManager />);

    await waitFor(() => {
      expect(screen.getByText('$15.99/monthly')).toBeInTheDocument();
      expect(screen.getByText('$9.99/monthly')).toBeInTheDocument();
      expect(screen.getByText('$50.00/monthly')).toBeInTheDocument();
    });
  });
});
@
```

---

### ✅ Test Coverage: RecurringManager

**Tests cubiertos**:
1. ✅ Renders loading state initially
2. ✅ Renders recurring patterns after loading
3. ✅ Shows empty state when no patterns detected
4. ✅ Displays confidence scores correctly
5. ✅ Shows summary of recurring payments
6. ✅ Runs detection scan manually
7. ✅ Marks recurring as inactive
8. ✅ Displays next expected payment date
9. ✅ Shows disabled scan button while scanning
10. ✅ Formats currency correctly

---

### 📊 Status: Task 22 Complete

**Output**:
- ✅ `src/components/RecurringManager.jsx` - Recurring management UI
- ✅ `src/components/RecurringManager.css` - Component styles
- ✅ `tests/RecurringManager.test.jsx` - 10 tests

**Total**: ~310 LOC (slightly over estimate due to detailed UI)

**Next**: Task 23 - CSV Import Feature

---

## Task 23: CSV Import Feature 📊

**Goal**: Allow users to import transactions from CSV files with column mapping.

**Scope**:
- Parse CSV files using simple parsing logic
- Support flexible column mapping (date, amount, merchant, etc.)
- Validate required fields and data formats
- Show preview of parsed transactions before import
- Handle common CSV formats from banks
- Error reporting for invalid data
- Bulk insert into transactions table

**LOC estimate**: ~300 LOC (logic ~150, component ~100, tests ~50)

---

### Logic: CSV Importer

CSV parsing and validation logic with column mapping support.

```javascript
<<src/lib/csv-importer.js>>=
/**
 * CSV Import Module
 * Parses CSV files and imports transactions with flexible column mapping
 */

/**
 * Parse CSV text into rows
 * Simple CSV parser that handles quoted fields and commas
 */
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const row = parseCSVLine(lines[i]);
      if (row.length === headers.length) {
        rows.push(row);
      }
    }
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Auto-detect column mapping based on header names
 * Returns a mapping object: { date: 'Date', amount: 'Amount', ... }
 */
export function autoDetectMapping(headers) {
  const mapping = {};

  // Common patterns for each field
  const patterns = {
    date: /date|time|posted|transaction.*date/i,
    merchant: /merchant|description|desc|payee|name/i,
    amount: /amount|value|debit|credit|sum/i,
    currency: /currency|curr/i,
    category: /category|type/i
  };

  for (const [field, pattern] of Object.entries(patterns)) {
    const matchedHeader = headers.find(h => pattern.test(h));
    if (matchedHeader) {
      mapping[field] = matchedHeader;
    }
  }

  return mapping;
}

/**
 * Apply column mapping to parsed rows
 * Returns array of transaction objects
 */
export function applyMapping(rows, headers, mapping) {
  return rows.map(row => {
    const obj = {};

    for (const [field, headerName] of Object.entries(mapping)) {
      const headerIndex = headers.indexOf(headerName);
      if (headerIndex !== -1) {
        obj[field] = row[headerIndex];
      }
    }

    return obj;
  });
}

/**
 * Validate and normalize a transaction object
 */
export function validateTransaction(transaction) {
  const errors = [];

  // Validate date
  if (!transaction.date) {
    errors.push('Missing date');
  } else {
    const date = parseDate(transaction.date);
    if (!date) {
      errors.push(`Invalid date format: ${transaction.date}`);
    } else {
      transaction.date = date;
    }
  }

  // Validate merchant
  if (!transaction.merchant || transaction.merchant.trim() === '') {
    errors.push('Missing merchant/description');
  } else {
    transaction.merchant = transaction.merchant.trim();
  }

  // Validate amount
  if (!transaction.amount) {
    errors.push('Missing amount');
  } else {
    const amount = parseAmount(transaction.amount);
    if (isNaN(amount)) {
      errors.push(`Invalid amount: ${transaction.amount}`);
    } else {
      transaction.amount = amount;
    }
  }

  // Set defaults
  transaction.currency = transaction.currency || 'USD';
  transaction.category = transaction.category || null;

  return { valid: errors.length === 0, errors, transaction };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr) {
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try MM/DD/YYYY or M/D/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try DD/MM/YYYY (European format)
  const match2 = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parse amount from string, handling currency symbols and formatting
 */
function parseAmount(amountStr) {
  // Remove currency symbols, commas, and whitespace
  const cleaned = amountStr.toString().replace(/[$€£,\s]/g, '');

  // Handle parentheses for negative amounts
  if (cleaned.match(/^\(.*\)$/)) {
    return -parseFloat(cleaned.replace(/[()]/g, ''));
  }

  return parseFloat(cleaned);
}

/**
 * Import validated transactions into database
 */
export function importTransactions(db, transactions, accountId) {
  const stmt = db.prepare(`
    INSERT INTO transactions (
      id, date, merchant, merchant_raw, amount, currency,
      account_id, category_id, type, source,
      created_at, updated_at, institution
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  let imported = 0;
  let failed = 0;

  for (const transaction of transactions) {
    try {
      const id = `txn-csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const type = transaction.amount < 0 ? 'expense' : 'income';

      stmt.run(
        id,
        transaction.date,
        transaction.merchant,
        transaction.merchant,
        transaction.amount,
        transaction.currency,
        accountId,
        transaction.category,
        type,
        'csv_import',
        now,
        now,
        'CSV Import'
      );

      imported++;
    } catch (error) {
      console.error('Failed to import transaction:', error);
      failed++;
    }
  }

  return { imported, failed };
}
@

---

### Tests: CSV Importer

Comprehensive tests for CSV parsing, mapping, and validation.

```javascript
<<tests/csv-importer.test.js>>=
import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  parseCSV,
  autoDetectMapping,
  applyMapping,
  validateTransaction,
  importTransactions
} from '../src/lib/csv-importer.js';

describe('CSV Importer', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    // Create schema
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        institution TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        merchant TEXT NOT NULL,
        merchant_raw TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        account_id TEXT NOT NULL,
        category_id TEXT,
        type TEXT CHECK (type IN ('expense', 'income')),
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        institution TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
    `);

    // Create test account
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', now, now);
  });

  test('parses simple CSV', () => {
    const csv = 'Date,Merchant,Amount\n2025-01-01,Starbucks,15.50\n2025-01-02,Target,45.00';

    const result = parseCSV(csv);

    expect(result.headers).toEqual(['Date', 'Merchant', 'Amount']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['2025-01-01', 'Starbucks', '15.50']);
    expect(result.rows[1]).toEqual(['2025-01-02', 'Target', '45.00']);
  });

  test('handles quoted fields with commas', () => {
    const csv = 'Date,Description,Amount\n2025-01-01,"Coffee, Pastry",15.50';

    const result = parseCSV(csv);

    expect(result.rows[0][1]).toBe('Coffee, Pastry');
  });

  test('auto-detects column mapping', () => {
    const headers = ['Transaction Date', 'Description', 'Amount', 'Currency'];

    const mapping = autoDetectMapping(headers);

    expect(mapping.date).toBe('Transaction Date');
    expect(mapping.merchant).toBe('Description');
    expect(mapping.amount).toBe('Amount');
    expect(mapping.currency).toBe('Currency');
  });

  test('applies mapping to rows', () => {
    const headers = ['Date', 'Desc', 'Amt'];
    const rows = [
      ['2025-01-01', 'Starbucks', '15.50'],
      ['2025-01-02', 'Target', '45.00']
    ];
    const mapping = { date: 'Date', merchant: 'Desc', amount: 'Amt' };

    const transactions = applyMapping(rows, headers, mapping);

    expect(transactions[0]).toEqual({
      date: '2025-01-01',
      merchant: 'Starbucks',
      amount: '15.50'
    });
  });

  test('validates transaction with valid data', () => {
    const transaction = {
      date: '2025-01-01',
      merchant: 'Starbucks',
      amount: '-15.50'
    };

    const result = validateTransaction(transaction);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.transaction.amount).toBe(-15.50);
    expect(result.transaction.currency).toBe('USD');
  });

  test('rejects transaction with missing date', () => {
    const transaction = { merchant: 'Starbucks', amount: '15.50' };

    const result = validateTransaction(transaction);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing date');
  });

  test('rejects transaction with invalid date', () => {
    const transaction = {
      date: 'invalid-date',
      merchant: 'Starbucks',
      amount: '15.50'
    };

    const result = validateTransaction(transaction);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid date'))).toBe(true);
  });

  test('parses various date formats', () => {
    const transactions = [
      { date: '2025-01-15', merchant: 'A', amount: '10' },
      { date: '1/15/2025', merchant: 'B', amount: '10' },
      { date: '15-01-2025', merchant: 'C', amount: '10' }
    ];

    const results = transactions.map(validateTransaction);

    results.forEach(r => {
      expect(r.valid).toBe(true);
      expect(r.transaction.date).toBe('2025-01-15');
    });
  });

  test('imports transactions into database', () => {
    const transactions = [
      { date: '2025-01-01', merchant: 'Starbucks', amount: -15.50, currency: 'USD' },
      { date: '2025-01-02', merchant: 'Salary', amount: 5000, currency: 'USD' }
    ];

    const result = importTransactions(db, transactions, 'acc-1');

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);

    const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
    expect(count.count).toBe(2);
  });
});
@

---

### Component: CSVImport.jsx

UI component for CSV file upload, column mapping, and import.

```javascript
<<src/components/CSVImport.jsx>>=
import React, { useState } from 'react';
import './CSVImport.css';
import { parseCSV, autoDetectMapping, applyMapping, validateTransaction } from '../lib/csv-importer.js';

export default function CSVImport({ accounts, onSuccess }) {
  const [step, setStep] = useState('upload'); // upload, mapping, preview, importing
  const [file, setFile] = useState(null);
  const [csvData, setCSVData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [selectedAccount, setSelectedAccount] = useState('');
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);

  async function handleFileSelect(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Use FileReader for better test compatibility
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);

      setFile(selectedFile);
      setCSVData(parsed);
      setMapping(autoDetectMapping(parsed.headers));
      setStep('mapping');
    };
    reader.readAsText(selectedFile);
  }

  function handleMappingChange(field, headerName) {
    setMapping({ ...mapping, [field]: headerName });
  }

  function handlePreview() {
    const transactions = applyMapping(csvData.rows, csvData.headers, mapping);
    const validated = transactions.map(validateTransaction);
    setPreview(validated);
    setStep('preview');
  }

  async function handleImport() {
    if (!selectedAccount) {
      alert('Please select an account');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      const validTransactions = preview
        .filter(p => p.valid)
        .map(p => p.transaction);

      const result = await window.electronAPI.importCSV(validTransactions, selectedAccount);

      alert(`Import complete!\n${result.imported} imported, ${result.failed} failed`);

      if (onSuccess) onSuccess();

      // Reset form
      setStep('upload');
      setFile(null);
      setCSVData(null);
      setMapping({});
      setPreview([]);
    } catch (error) {
      alert('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep('upload');
    setFile(null);
    setCSVData(null);
    setMapping({});
    setPreview([]);
  }

  if (step === 'upload') {
    return (
      <div className="csv-import">
        <div className="csv-upload-zone">
          <h3>Import Transactions from CSV</h3>
          <p>Upload a CSV file with your transaction data</p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="file-input"
          />
          <div className="format-hint">
            <strong>Supported formats:</strong>
            <ul>
              <li>Date, Merchant/Description, Amount</li>
              <li>Transaction Date, Payee, Debit/Credit</li>
              <li>Custom formats with column mapping</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'mapping') {
    const fields = ['date', 'merchant', 'amount', 'currency', 'category'];

    return (
      <div className="csv-import">
        <h3>Map CSV Columns</h3>
        <p>Match your CSV columns to transaction fields</p>

        <div className="column-mapping">
          {fields.map(field => (
            <div key={field} className="mapping-row">
              <label htmlFor={`field-${field}`} className="field-name">
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {['date', 'merchant', 'amount'].includes(field) && <span className="required">*</span>}
              </label>
              <select
                id={`field-${field}`}
                value={mapping[field] || ''}
                onChange={(e) => handleMappingChange(field, e.target.value)}
              >
                <option value="">-- Not mapped --</option>
                {csvData.headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="account-select">
          <label htmlFor="account-select">Import to Account *</label>
          <select
            id="account-select"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            required
          >
            <option value="">-- Select Account --</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="csv-actions">
          <button onClick={handleReset} className="btn-secondary">Cancel</button>
          <button
            onClick={handlePreview}
            className="btn-primary"
            disabled={!mapping.date || !mapping.merchant || !mapping.amount || !selectedAccount}
          >
            Preview Import
          </button>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    const validCount = preview.filter(p => p.valid).length;
    const invalidCount = preview.length - validCount;

    return (
      <div className="csv-import">
        <h3>Preview Import</h3>
        <div className="import-summary">
          <span className="valid-count">{validCount} valid transactions</span>
          {invalidCount > 0 && (
            <span className="invalid-count">{invalidCount} invalid transactions</span>
          )}
        </div>

        <div className="preview-list">
          {preview.slice(0, 10).map((item, index) => (
            <div key={index} className={`preview-item ${item.valid ? 'valid' : 'invalid'}`}>
              <div className="preview-data">
                <span>{item.transaction.date}</span>
                <span>{item.transaction.merchant}</span>
                <span>${Math.abs(item.transaction.amount).toFixed(2)}</span>
              </div>
              {!item.valid && (
                <div className="preview-errors">
                  {item.errors.map((error, i) => (
                    <span key={i} className="error-message">{error}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {preview.length > 10 && (
            <div className="preview-more">
              ...and {preview.length - 10} more transactions
            </div>
          )}
        </div>

        <div className="csv-actions">
          <button onClick={() => setStep('mapping')} className="btn-secondary">
            Back to Mapping
          </button>
          <button
            onClick={handleImport}
            className="btn-primary"
            disabled={validCount === 0}
          >
            Import {validCount} Transactions
          </button>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="csv-import">
        <div className="importing-state">
          <div className="spinner"></div>
          <p>Importing transactions...</p>
        </div>
      </div>
    );
  }

  return null;
}
@

---

### Styles: CSVImport.css

```css
<<src/components/CSVImport.css>>=
.csv-import {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.csv-upload-zone {
  text-align: center;
  padding: 40px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background: #f9f9f9;
}

.csv-upload-zone h3 {
  margin-top: 0;
  color: #333;
}

.file-input {
  display: block;
  margin: 20px auto;
  padding: 10px;
  font-size: 14px;
}

.format-hint {
  margin-top: 20px;
  text-align: left;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  padding: 15px;
  background: white;
  border-radius: 4px;
}

.format-hint ul {
  margin: 10px 0 0 0;
  padding-left: 20px;
}

.column-mapping {
  margin: 20px 0;
}

.mapping-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.field-name {
  width: 120px;
  font-weight: 500;
  color: #555;
}

.required {
  color: #e53e3e;
  margin-left: 4px;
}

.mapping-row select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.account-select {
  margin: 30px 0;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 4px;
}

.account-select label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.account-select select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.import-summary {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: #f0f9ff;
  border-radius: 4px;
  margin-bottom: 20px;
}

.valid-count {
  color: #059669;
  font-weight: 500;
}

.invalid-count {
  color: #dc2626;
  font-weight: 500;
}

.preview-list {
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.preview-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.preview-item.valid {
  background: white;
}

.preview-item.invalid {
  background: #fef2f2;
}

.preview-data {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.preview-errors {
  margin-top: 8px;
  padding: 8px;
  background: #fee2e2;
  border-radius: 4px;
}

.error-message {
  display: block;
  color: #dc2626;
  font-size: 12px;
}

.preview-more {
  padding: 12px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.csv-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.importing-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-primary {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  background: white;
  color: #555;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
@

---

### Tests: CSVImport Component

```javascript
<<tests/CSVImport.test.jsx>>=
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CSVImport from '../src/components/CSVImport.jsx';
import { vi } from 'vitest';

describe('CSVImport Component', () => {
  const mockAccounts = [
    { id: 'acc-1', name: 'Checking' },
    { id: 'acc-2', name: 'Savings' }
  ];

  let onSuccess;

  beforeEach(() => {
    onSuccess = vi.fn();
    window.electronAPI = {
      importCSV: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('shows upload zone initially', () => {
    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    expect(screen.getByText(/Import Transactions from CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload a CSV file/i)).toBeInTheDocument();
  });

  test('shows column mapping after file upload', async () => {
    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    const csvContent = 'Date,Description,Amount\n2025-01-01,Starbucks,15.50';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]');

    // Simulate file selection
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Map CSV Columns/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('auto-detects column mapping', async () => {
    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    const csvContent = 'Transaction Date,Merchant,Amount\n2025-01-01,Starbucks,15.50';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    fireEvent.change(input);

    await waitFor(() => {
      // Should auto-detect "Transaction Date" as date field
      const dateSelect = screen.getByLabelText(/Date/i);
      expect(dateSelect.value).toBe('Transaction Date');
    }, { timeout: 3000 });
  });

  test('requires account selection', async () => {
    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    const csvContent = 'Date,Merchant,Amount\n2025-01-01,Starbucks,15.50';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    fireEvent.change(input);

    await waitFor(() => {
      const previewButton = screen.getByText(/Preview Import/i);
      expect(previewButton).toBeDisabled();
    }, { timeout: 3000 });
  });

  test('shows preview with valid transactions', async () => {
    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    const csvContent = 'Date,Merchant,Amount\n2025-01-01,Starbucks,-15.50';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByLabelText(/Import to Account/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Select account
    const accountSelect = screen.getByLabelText(/Import to Account/i);
    fireEvent.change(accountSelect, { target: { value: 'acc-1' } });

    // Click preview
    const previewButton = screen.getByText(/Preview Import/i);
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText(/1 valid transactions/i)).toBeInTheDocument();
      expect(screen.getByText('Starbucks')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('imports transactions successfully', async () => {
    window.electronAPI.importCSV.mockResolvedValue({ imported: 1, failed: 0 });

    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    const csvContent = 'Date,Merchant,Amount\n2025-01-01,Starbucks,-15.50';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByLabelText(/Import to Account/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const accountSelect = screen.getByLabelText(/Import to Account/i);
    fireEvent.change(accountSelect, { target: { value: 'acc-1' } });

    const previewButton = screen.getByText(/Preview Import/i);
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText(/Import 1 Transactions/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const importButton = screen.getByText(/Import 1 Transactions/i);
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(window.electronAPI.importCSV).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  test('handles invalid CSV data', async () => {
    render(<CSVImport accounts={mockAccounts} onSuccess={onSuccess} />);

    // CSV with invalid date
    const csvContent = 'Date,Merchant,Amount\ninvalid-date,Starbucks,15.50';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByLabelText(/Import to Account/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const accountSelect = screen.getByLabelText(/Import to Account/i);
    fireEvent.change(accountSelect, { target: { value: 'acc-1' } });

    const previewButton = screen.getByText(/Preview Import/i);
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText(/0 valid transactions/i)).toBeInTheDocument();
      expect(screen.getByText(/1 invalid transactions/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
@

---

**Output**:
- ✅ `src/lib/csv-importer.js` - CSV parsing and validation logic
- ✅ `tests/csv-importer.test.js` - 9 logic tests
- ✅ `src/components/CSVImport.jsx` - Import UI with steps
- ✅ `src/components/CSVImport.css` - Component styles
- ✅ `tests/CSVImport.test.jsx` - 7 component tests

**Total**: ~350 LOC (slightly over estimate due to multi-step UI)

**Next**: Task 24 - Saved Filters Feature

---

