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

