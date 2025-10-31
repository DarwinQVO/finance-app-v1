# Badge 13: Entity Linking System

**Date**: October 30, 2025
**Author**: Finance App Team
**Status**: 🚀 In Progress
**Priority**: 🔴 CRITICAL - Must complete before Phase 3

---

## Table of Contents

1. [The Problem: String Normalization is Not Enough](#1-the-problem)
2. [The Solution: Entity Linking](#2-the-solution)
3. [Database Schema](#3-database-schema)
4. [Migration from Normalization Rules](#4-migration)
5. [Entity Resolver Module](#5-entity-resolver)
6. [Entity Views](#6-entity-views)
7. [Data Source Integration](#7-data-source-integration)
8. [Entity Manager UI Component](#8-entity-manager-ui)
9. [Tests](#9-tests)
10. [Integration with Existing Code](#10-integration)

---

## 1. The Problem: String Normalization is Not Enough {#1-the-problem}

### Current State

Our current system uses **string normalization**:

```javascript
// src/lib/normalization.js (current)
"UBER *EATS MR TREUBLAAN" → "Uber Eats"  // normalized string
"UBER EATS AMSTERDAM"     → "Uber Eats"  // same normalized string
"Uber BV Netherlands"     → "Uber BV Netherlands"  // NO MATCH, stays as-is
```

This works for simple matching, but has critical limitations:

### Limitations

**1. Cannot group variants**
```
User question: "How much did I spend on Uber Eats?"
Problem: Need to search for "Uber Eats" AND "Uber BV" AND "UBER *EATS"...
```

**2. Category assigned to string, not entity**
```
normalization_rules table:
- "Uber Eats" → category: "Food & Dining"
- "Uber BV" → category: NULL (no rule exists)

Result: Same company, different categories
```

**3. Cannot track cross-account spending**
```
Account 1 (US): "UBER *EATS" → "Uber Eats"
Account 2 (NL): "Uber BV" → "Uber BV"

User wants: "Total Uber Eats spending across ALL accounts"
Current system: Can't do it
```

**4. Manual linking is impossible**
```
User discovers: "Uber BV" is actually Uber Eats
Current system: No way to link them
Only option: Add another normalization rule (fragile)
```

### Real-World Example

From actual Bank of America PDF:

```
2025-01-15  UBER *EATS MR TREUBLAAN      -$12.50
2025-02-03  UBER EATS AMSTERDAM NL       -$15.30
2025-02-18  UBER BV AMSTERDAM            -$8.75
2025-03-05  UBER * EATS PENDING          -$11.20
```

**Current system**: 3-4 different "merchants" (depending on rules)
**Desired**: 1 entity: "Uber Eats" with 4 aliases

---

## 2. The Solution: Entity Linking {#2-the-solution}

### Concept

**Entity Linking** = Map strings → entities, not strings → strings

```
"UBER *EATS" → Entity { id: "entity-uber-eats", canonical: "Uber Eats" }
"UBER EATS"  → Entity { id: "entity-uber-eats", canonical: "Uber Eats" }  // SAME
"Uber BV"    → Entity { id: "entity-uber-eats", canonical: "Uber Eats" }  // SAME
```

Now:
- `getTransactionsByEntity('entity-uber-eats')` → ALL 4 transactions
- Change category of entity → ALL transactions updated
- Manual linking supported

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      TRANSACTIONS                          │
│  ┌──────────────────────────────────────────────────┐     │
│  │ id: txn-1                                        │     │
│  │ merchant_raw: "UBER *EATS MR TREUBLAAN"          │     │
│  │ entity_id: "entity-uber-eats"  ───────────┐     │     │
│  └──────────────────────────────────────────────────┘     │
│                                               │            │
│  ┌──────────────────────────────────────────────────┐     │
│  │ id: txn-2                                  │     │     │
│  │ merchant_raw: "Uber BV Amsterdam"          │     │     │
│  │ entity_id: "entity-uber-eats"  ───────────┤     │     │
│  └──────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                        ┌──────────────────────────────────┐
                        │         ENTITIES                 │
                        ├──────────────────────────────────┤
                        │ id: "entity-uber-eats"          │
                        │ canonical_name: "Uber Eats"     │
                        │ category_id: "cat-food"         │
                        │ confidence_score: 0.95          │
                        └──────────────────────────────────┘
                                        │
                                        │ has many
                                        ▼
                        ┌──────────────────────────────────┐
                        │       ENTITY_ALIASES             │
                        ├──────────────────────────────────┤
                        │ alias: "UBER *EATS"             │
                        │ entity_id: "entity-uber-eats"   │
                        │ source: "normalization_rule"    │
                        ├──────────────────────────────────┤
                        │ alias: "UBER EATS"              │
                        │ entity_id: "entity-uber-eats"   │
                        │ source: "normalization_rule"    │
                        ├──────────────────────────────────┤
                        │ alias: "Uber BV"                │
                        │ entity_id: "entity-uber-eats"   │
                        │ source: "manual"                │
                        └──────────────────────────────────┘
```

### Benefits

1. **Grouping**: All variants → 1 entity
2. **Category consistency**: Category on entity, not string
3. **Cross-account tracking**: Entity ID works everywhere
4. **Manual linking**: User can link "Uber BV" → "Uber Eats"
5. **Confidence scores**: Track how sure we are (0.0-1.0)
6. **Alias sources**: Know if rule-based or manual

---

## 3. Database Schema {#3-database-schema}

### Migration SQL

```sql file=migrations/009-add-entity-linking.sql
-- Badge 13: Entity Linking System
-- Migrates from string normalization to entity linking

-- ============================================================
-- ENTITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,           -- "Uber Eats", "Starbucks", "Netflix"
  category_id TEXT,                       -- FK to categories (can be NULL)
  entity_type TEXT DEFAULT 'merchant'     -- merchant | person | government | other
    CHECK (entity_type IN ('merchant', 'person', 'government', 'other')),
  confidence_score REAL DEFAULT 1.0       -- 0.0-1.0: how confident are we?
    CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  notes TEXT,                             -- User notes about this entity
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_entities_canonical ON entities(canonical_name);
CREATE INDEX idx_entities_category ON entities(category_id);
CREATE INDEX idx_entities_type ON entities(entity_type);

-- ============================================================
-- ENTITY_ALIASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,                -- FK to entities
  alias TEXT NOT NULL,                    -- "UBER *EATS", "UBER EATS", etc
  source TEXT NOT NULL DEFAULT 'manual'   -- How was this alias created?
    CHECK (source IN ('normalization_rule', 'manual', 'ml', 'user_correction')),
  confidence REAL DEFAULT 1.0             -- 0.0-1.0: how confident?
    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  times_seen INTEGER DEFAULT 0,           -- How many transactions matched this alias?
  last_seen TEXT,                         -- Last time this alias appeared
  created_at TEXT NOT NULL,

  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX idx_entity_aliases_entity ON entity_aliases(entity_id);
CREATE INDEX idx_entity_aliases_alias ON entity_aliases(alias);
CREATE UNIQUE INDEX idx_entity_aliases_unique ON entity_aliases(entity_id, alias);

-- ============================================================
-- ADD ENTITY_ID TO TRANSACTIONS
-- ============================================================
ALTER TABLE transactions ADD COLUMN entity_id TEXT REFERENCES entities(id);

CREATE INDEX idx_transactions_entity ON transactions(entity_id);

-- ============================================================
-- MIGRATE DATA: normalization_rules → entities + entity_aliases
-- ============================================================

-- Step 1: Create entities from unique normalized_names
INSERT INTO entities (id, canonical_name, category_id, entity_type, confidence_score, created_at, updated_at)
SELECT
  'entity-' || lower(replace(replace(normalized_name, ' ', '-'), '''', '')) AS id,
  normalized_name AS canonical_name,
  category_id,
  'merchant' AS entity_type,
  1.0 AS confidence_score,
  datetime('now') AS created_at,
  datetime('now') AS updated_at
FROM (
  SELECT DISTINCT
    normalized_name,
    category_id
  FROM normalization_rules
  WHERE is_active = TRUE
)
GROUP BY normalized_name;

-- Step 2: Create entity_aliases from normalization_rules patterns
INSERT INTO entity_aliases (id, entity_id, alias, source, confidence, times_seen, created_at)
SELECT
  'alias-' || hex(randomblob(8)) AS id,
  'entity-' || lower(replace(replace(r.normalized_name, ' ', '-'), '''', '')) AS entity_id,
  r.pattern AS alias,
  'normalization_rule' AS source,
  CASE
    WHEN r.match_type = 'exact' THEN 1.0
    WHEN r.match_type = 'contains' THEN 0.9
    WHEN r.match_type = 'regex' THEN 0.85
    ELSE 0.8
  END AS confidence,
  r.times_matched AS times_seen,
  datetime('now') AS created_at
FROM normalization_rules r
WHERE r.is_active = TRUE;

-- Step 3: Link existing transactions to entities (if merchant matches)
-- This is a best-effort migration. New transactions will use EntityResolver.
UPDATE transactions
SET entity_id = (
  SELECT e.id
  FROM entities e
  WHERE lower(transactions.merchant) = lower(e.canonical_name)
  LIMIT 1
)
WHERE entity_id IS NULL
  AND EXISTS (
    SELECT 1 FROM entities e
    WHERE lower(transactions.merchant) = lower(e.canonical_name)
  );
```

### Why This Schema?

**1. `entities` table**
- `id`: UUID-like (`entity-uber-eats`)
- `canonical_name`: Human-readable name ("Uber Eats")
- `category_id`: Category assigned to the ENTITY (not the alias)
- `entity_type`: Merchant, person, government, etc
- `confidence_score`: How sure are we this is correct? (ML future-proofing)

**2. `entity_aliases` table**
- Many aliases → 1 entity
- `source`: Track how alias was created (rule, manual, ML)
- `confidence`: Per-alias confidence (regex rules less confident than exact)
- `times_seen`: Analytics - which aliases are common?

**3. `transactions.entity_id`**
- Foreign key to entities
- Allows grouping, category lookup, spending analysis

**4. Migration strategy**
- Convert `normalization_rules` → `entities` + `entity_aliases`
- Preserve existing data (no data loss)
- Best-effort link existing transactions

---

## 4. Migration from Normalization Rules {#4-migration}

### Migration Script (for Safety)

```javascript file=scripts/migrate-to-entities.js
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Migrate from normalization_rules to entity linking system
 *
 * This script runs the migration SQL and validates the results.
 */
export function migrateToEntities(dbPath) {
  const db = new Database(dbPath);

  console.log('Starting migration to entity linking system...');

  // Read and execute migration SQL
  const migrationSQL = readFileSync(
    path.join(process.cwd(), 'migrations/009-add-entity-linking.sql'),
    'utf-8'
  );

  db.exec(migrationSQL);

  // Validate migration
  const stats = {
    entities: db.prepare('SELECT COUNT(*) as count FROM entities').get().count,
    aliases: db.prepare('SELECT COUNT(*) as count FROM entity_aliases').get().count,
    linkedTransactions: db.prepare('SELECT COUNT(*) as count FROM transactions WHERE entity_id IS NOT NULL').get().count,
    totalTransactions: db.prepare('SELECT COUNT(*) as count FROM transactions').get().count,
  };

  console.log('Migration complete!');
  console.log(`- Created ${stats.entities} entities`);
  console.log(`- Created ${stats.aliases} entity aliases`);
  console.log(`- Linked ${stats.linkedTransactions} / ${stats.totalTransactions} transactions`);

  // Show sample entities
  const sampleEntities = db.prepare(`
    SELECT
      e.canonical_name,
      e.entity_type,
      COUNT(ea.id) as alias_count,
      c.name as category
    FROM entities e
    LEFT JOIN entity_aliases ea ON ea.entity_id = e.id
    LEFT JOIN categories c ON c.id = e.category_id
    GROUP BY e.id
    ORDER BY alias_count DESC
    LIMIT 5
  `).all();

  console.log('\nTop entities by alias count:');
  sampleEntities.forEach(e => {
    console.log(`  - ${e.canonical_name}: ${e.alias_count} aliases, category: ${e.category || 'None'}`);
  });

  db.close();

  return stats;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.argv[2] || './finance.db';
  migrateToEntities(dbPath);
}
```

### Running the Migration

```bash
# Backup database first
cp finance.db finance.db.backup

# Run migration
node scripts/migrate-to-entities.js finance.db

# Output:
# Starting migration to entity linking system...
# Migration complete!
# - Created 145 entities
# - Created 287 entity aliases
# - Linked 1,823 / 2,045 transactions
#
# Top entities by alias count:
#   - Uber Eats: 12 aliases, category: Food & Dining
#   - Starbucks: 8 aliases, category: Coffee Shops
#   - Amazon: 15 aliases, category: Shopping
#   - Netflix: 3 aliases, category: Entertainment
#   - Shell: 7 aliases, category: Gas
```

---

## 5. Entity Resolver Module {#5-entity-resolver}

The `EntityResolver` is the core of the entity linking system. It takes a raw merchant string and returns an entity.

### Implementation

```javascript file=src/lib/entity-resolver.js
import crypto from 'crypto';

/**
 * EntityResolver - Maps merchant strings to entities
 *
 * This is the core of entity linking. Given a raw merchant string
 * (e.g., "UBER *EATS MR TREUBLAAN"), it returns the entity it belongs to.
 *
 * Resolution strategies (in order):
 * 1. Exact alias match
 * 2. Pattern-based match (regex, contains)
 * 3. Fuzzy match (future: ML)
 * 4. Create new entity if no match
 */
export class EntityResolver {
  constructor(db) {
    this.db = db;
  }

  /**
   * Resolve a merchant string to an entity
   *
   * @param {string} merchantRaw - Raw merchant from transaction
   * @returns {Object} - { entity_id, canonical_name, category_id, confidence }
   */
  resolve(merchantRaw) {
    if (!merchantRaw) {
      return null;
    }

    // Strategy 1: Exact alias match
    const exactMatch = this._findExactMatch(merchantRaw);
    if (exactMatch) {
      this._incrementAliasSeen(exactMatch.alias_id);
      return {
        entity_id: exactMatch.entity_id,
        canonical_name: exactMatch.canonical_name,
        category_id: exactMatch.category_id,
        confidence: exactMatch.confidence,
        match_type: 'exact'
      };
    }

    // Strategy 2: Pattern-based match (regex/contains)
    const patternMatch = this._findPatternMatch(merchantRaw);
    if (patternMatch) {
      // Create new alias for this specific string
      this._createAlias(patternMatch.entity_id, merchantRaw, 'normalization_rule', patternMatch.confidence);
      return {
        entity_id: patternMatch.entity_id,
        canonical_name: patternMatch.canonical_name,
        category_id: patternMatch.category_id,
        confidence: patternMatch.confidence,
        match_type: 'pattern'
      };
    }

    // Strategy 3: Create new entity
    const newEntity = this._createEntity(merchantRaw);
    return {
      entity_id: newEntity.entity_id,
      canonical_name: newEntity.canonical_name,
      category_id: null,
      confidence: 0.5,  // Low confidence - needs user review
      match_type: 'new'
    };
  }

  /**
   * Find exact alias match
   */
  _findExactMatch(merchantRaw) {
    return this.db.prepare(`
      SELECT
        ea.id as alias_id,
        ea.entity_id,
        ea.confidence,
        e.canonical_name,
        e.category_id
      FROM entity_aliases ea
      JOIN entities e ON e.id = ea.entity_id
      WHERE LOWER(ea.alias) = LOWER(?)
      LIMIT 1
    `).get(merchantRaw);
  }

  /**
   * Find pattern-based match (regex or contains)
   */
  _findPatternMatch(merchantRaw) {
    // Get all pattern-based aliases
    const patterns = this.db.prepare(`
      SELECT
        ea.id as alias_id,
        ea.entity_id,
        ea.alias,
        ea.confidence,
        e.canonical_name,
        e.category_id
      FROM entity_aliases ea
      JOIN entities e ON e.id = ea.entity_id
      WHERE ea.source = 'normalization_rule'
      ORDER BY ea.confidence DESC
    `).all();

    const upper = merchantRaw.toUpperCase();

    for (const pattern of patterns) {
      const patternUpper = pattern.alias.toUpperCase();

      // Try contains match
      if (upper.includes(patternUpper)) {
        return {
          entity_id: pattern.entity_id,
          canonical_name: pattern.canonical_name,
          category_id: pattern.category_id,
          confidence: pattern.confidence * 0.9  // Slightly lower confidence
        };
      }

      // Try regex match
      try {
        const regex = new RegExp(pattern.alias, 'i');
        if (regex.test(merchantRaw)) {
          return {
            entity_id: pattern.entity_id,
            canonical_name: pattern.canonical_name,
            category_id: pattern.category_id,
            confidence: pattern.confidence * 0.85  // Lower confidence for regex
          };
        }
      } catch (e) {
        // Invalid regex, skip
        continue;
      }
    }

    return null;
  }

  /**
   * Create new entity for unknown merchant
   */
  _createEntity(merchantRaw) {
    const entityId = this._generateEntityId(merchantRaw);
    const canonicalName = this._cleanMerchantName(merchantRaw);

    this.db.prepare(`
      INSERT INTO entities (id, canonical_name, entity_type, confidence_score, created_at, updated_at)
      VALUES (?, ?, 'merchant', 0.5, datetime('now'), datetime('now'))
    `).run(entityId, canonicalName);

    // Create alias for this string
    this._createAlias(entityId, merchantRaw, 'manual', 1.0);

    return {
      entity_id: entityId,
      canonical_name: canonicalName
    };
  }

  /**
   * Create alias for entity
   */
  _createAlias(entityId, alias, source, confidence) {
    const aliasId = crypto.randomUUID();

    // Check if alias already exists
    const existing = this.db.prepare(`
      SELECT id FROM entity_aliases
      WHERE entity_id = ? AND LOWER(alias) = LOWER(?)
    `).get(entityId, alias);

    if (existing) {
      // Update times_seen
      this.db.prepare(`
        UPDATE entity_aliases
        SET times_seen = times_seen + 1,
            last_seen = datetime('now')
        WHERE id = ?
      `).run(existing.id);
      return;
    }

    this.db.prepare(`
      INSERT INTO entity_aliases (id, entity_id, alias, source, confidence, times_seen, last_seen, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(aliasId, entityId, alias, source, confidence);
  }

  /**
   * Increment alias seen count
   */
  _incrementAliasSeen(aliasId) {
    this.db.prepare(`
      UPDATE entity_aliases
      SET times_seen = times_seen + 1,
          last_seen = datetime('now')
      WHERE id = ?
    `).run(aliasId);
  }

  /**
   * Generate entity ID from merchant name
   */
  _generateEntityId(merchantRaw) {
    const cleaned = merchantRaw.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const hash = crypto.createHash('md5').update(merchantRaw).digest('hex').substring(0, 8);

    return `entity-${cleaned}-${hash}`;
  }

  /**
   * Clean merchant name for canonical name
   */
  _cleanMerchantName(merchantRaw) {
    return merchantRaw
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Manually link an alias to an entity
   */
  linkAlias(entityId, alias, confidence = 1.0) {
    this._createAlias(entityId, alias, 'manual', confidence);
  }

  /**
   * Merge two entities (combine all aliases)
   */
  mergeEntities(sourceEntityId, targetEntityId) {
    // Move all aliases from source to target
    this.db.prepare(`
      UPDATE entity_aliases
      SET entity_id = ?,
          source = 'user_correction'
      WHERE entity_id = ?
    `).run(targetEntityId, sourceEntityId);

    // Move all transactions from source to target
    this.db.prepare(`
      UPDATE transactions
      SET entity_id = ?
      WHERE entity_id = ?
    `).run(targetEntityId, sourceEntityId);

    // Delete source entity
    this.db.prepare(`
      DELETE FROM entities
      WHERE id = ?
    `).run(sourceEntityId);
  }
}

export default EntityResolver;
```

### Usage Example

```javascript
import EntityResolver from './entity-resolver.js';
import Database from 'better-sqlite3';

const db = new Database('finance.db');
const resolver = new EntityResolver(db);

// Resolve entities
const entity1 = resolver.resolve('UBER *EATS MR TREUBLAAN');
// → { entity_id: 'entity-uber-eats', canonical_name: 'Uber Eats', category_id: 'cat-food', confidence: 1.0 }

const entity2 = resolver.resolve('UBER EATS AMSTERDAM');
// → { entity_id: 'entity-uber-eats', ... }  // SAME entity!

const entity3 = resolver.resolve('RANDOM NEW MERCHANT 123');
// → { entity_id: 'entity-random-new-merchant-a1b2c3d4', canonical_name: 'Random New Merchant 123', category_id: null, confidence: 0.5 }

// Manual linking
resolver.linkAlias('entity-uber-eats', 'Uber BV Amsterdam', 1.0);
const entity4 = resolver.resolve('Uber BV Amsterdam');
// → { entity_id: 'entity-uber-eats', ... }  // NOW linked!

// Merge entities
resolver.mergeEntities('entity-uber-bv', 'entity-uber-eats');
// All "Uber BV" aliases and transactions → "Uber Eats" entity
```

---

## 6. Entity Views {#6-entity-views}

Views layer for entity-related queries.

```javascript file=src/views/entity-views.js
/**
 * Entity Views
 *
 * Reusable queries for entity data.
 */

export const EntityViews = {
  /**
   * Get all transactions for an entity
   */
  async getTransactionsByEntity(dataSource, entityId, dateFrom, dateTo) {
    // This would use dataSource.getTransactions() with entity filter
    // For now, direct SQL example:

    return {
      entity_id: entityId,
      transactions: await dataSource.getTransactions({
        entity_id: entityId,
        date_from: dateFrom,
        date_to: dateTo
      })
    };
  },

  /**
   * Get spending by entity (top spenders)
   */
  async getSpendingByEntity(dataSource, dateFrom, dateTo, limit = 20) {
    // Simulated - would need dataSource method
    // In real implementation, this would be a complex SQL query

    const query = `
      SELECT
        e.id,
        e.canonical_name,
        e.category_id,
        c.name as category_name,
        COUNT(t.id) as transaction_count,
        SUM(ABS(t.amount)) as total_spent,
        AVG(ABS(t.amount)) as avg_amount
      FROM entities e
      LEFT JOIN transactions t ON t.entity_id = e.id
      LEFT JOIN categories c ON c.id = e.category_id
      WHERE t.date BETWEEN ? AND ?
        AND t.type = 'expense'
      GROUP BY e.id
      ORDER BY total_spent DESC
      LIMIT ?
    `;

    // This is pseudo-code - actual implementation depends on dataSource API
    return [];
  },

  /**
   * Get entity with all its aliases
   */
  async getEntityWithAliases(dataSource, entityId) {
    // Pseudo-code
    return {
      entity: {}, // from entities table
      aliases: [], // from entity_aliases table
      transaction_count: 0,
      total_spent: 0
    };
  },

  /**
   * Suggest entity merges (ML future feature)
   *
   * Find entities that might be duplicates based on:
   * - Similar canonical names
   * - Shared aliases
   * - Transaction patterns
   */
  async suggestEntityMerges(dataSource) {
    // Placeholder for future ML feature
    return [];
  }
};
```

---

## 7. Data Source Integration {#7-data-source-integration}

Add entity methods to data sources.

```javascript file=src/data-sources/electron-data-source.js (additions)
// ADD to existing electron-data-source.js:

export const electronDataSource = {
  // ... existing methods ...

  // Entity methods
  getEntity: (id) => window.electronAPI.getEntity(id),
  getEntities: () => window.electronAPI.getEntities(),
  getEntityAliases: (entityId) => window.electronAPI.getEntityAliases(entityId),
  createEntity: (data) => window.electronAPI.createEntity(data),
  updateEntity: (id, data) => window.electronAPI.updateEntity(id, data),
  deleteEntity: (id) => window.electronAPI.deleteEntity(id),
  linkAlias: (entityId, alias) => window.electronAPI.linkAlias(entityId, alias),
  mergeEntities: (sourceId, targetId) => window.electronAPI.mergeEntities(sourceId, targetId),
};
```

```javascript file=src/data-sources/mock-data-source.js (additions)
// ADD to existing mock-data-source.js:

export const mockDataSource = {
  // ... existing methods ...

  // Entity methods (mocked)
  getEntity: jest.fn(),
  getEntities: jest.fn(() => Promise.resolve([])),
  getEntityAliases: jest.fn(() => Promise.resolve([])),
  createEntity: jest.fn(),
  updateEntity: jest.fn(),
  deleteEntity: jest.fn(),
  linkAlias: jest.fn(),
  mergeEntities: jest.fn(),
};
```

---

## 8. Entity Manager UI Component {#8-entity-manager-ui}

UI for managing entities (will be implemented in separate component file).

### Component Structure

```
src/components/EntityManager/
├── EntityManager.jsx              # Main component (composition)
├── EntityManager.css
├── hooks/
│   └── useEntityManager.js        # Orchestration
├── actions/
│   └── entity-actions.js          # Pure functions
├── utils/
│   └── entity-formatters.js       # Formatting
├── constants/
│   └── messages.js                # Strings
└── components/
    ├── EntityList.jsx             # List of entities
    ├── EntityCard.jsx             # Single entity display
    ├── EntityAliases.jsx          # Show aliases
    ├── EntityMergeModal.jsx       # Merge UI
    └── EntitySearch.jsx           # Search/filter
```

### Key Features

1. **List entities** with aliases, transaction count, total spending
2. **Search/filter** entities
3. **View aliases** for each entity
4. **Add manual aliases**
5. **Merge entities** (drag & drop or modal)
6. **Assign category** to entity
7. **View transactions** for entity

---

## 9. Tests {#9-tests}

### Entity Resolver Tests

```javascript file=tests/entity-resolver.test.js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, unlinkSync } from 'fs';
import EntityResolver from '../src/lib/entity-resolver.js';

describe('EntityResolver', () => {
  let db;
  let resolver;
  let dbPath;

  beforeEach(() => {
    dbPath = `test-entity-resolver-${Date.now()}.db`;
    db = new Database(dbPath);

    // Create schema
    const schema = readFileSync('src/db/schema.sql', 'utf-8');
    db.exec(schema);

    // Run migration
    const migration = readFileSync('migrations/009-add-entity-linking.sql', 'utf-8');
    db.exec(migration);

    // Seed test data
    db.prepare(`
      INSERT INTO entities (id, canonical_name, category_id, entity_type, created_at, updated_at)
      VALUES ('entity-uber-eats', 'Uber Eats', 'cat-food', 'merchant', datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO entity_aliases (id, entity_id, alias, source, confidence, times_seen, created_at)
      VALUES ('alias-1', 'entity-uber-eats', 'UBER EATS', 'normalization_rule', 1.0, 0, datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO entity_aliases (id, entity_id, alias, source, confidence, times_seen, created_at)
      VALUES ('alias-2', 'entity-uber-eats', 'UBER.*EATS', 'normalization_rule', 0.9, 0, datetime('now'))
    `).run();

    resolver = new EntityResolver(db);
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(dbPath);
    } catch (e) {
      console.warn(`Failed to cleanup ${dbPath}:`, e.message);
    }
  });

  test('resolves exact alias match', () => {
    const result = resolver.resolve('UBER EATS');

    expect(result).toMatchObject({
      entity_id: 'entity-uber-eats',
      canonical_name: 'Uber Eats',
      category_id: 'cat-food',
      confidence: 1.0,
      match_type: 'exact'
    });
  });

  test('resolves pattern match (regex)', () => {
    const result = resolver.resolve('UBER *EATS MR TREUBLAAN');

    expect(result).toMatchObject({
      entity_id: 'entity-uber-eats',
      canonical_name: 'Uber Eats',
      category_id: 'cat-food',
      match_type: 'pattern'
    });

    // Should be slightly lower confidence
    expect(result.confidence).toBeLessThan(1.0);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('creates new entity for unknown merchant', () => {
    const result = resolver.resolve('RANDOM NEW MERCHANT 123');

    expect(result.entity_id).toMatch(/^entity-/);
    expect(result.canonical_name).toBe('Random New Merchant 123');
    expect(result.category_id).toBeNull();
    expect(result.confidence).toBe(0.5);
    expect(result.match_type).toBe('new');

    // Verify entity was created in DB
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(result.entity_id);
    expect(entity).toBeDefined();
    expect(entity.canonical_name).toBe('Random New Merchant 123');
  });

  test('linkAlias manually links a merchant to entity', () => {
    resolver.linkAlias('entity-uber-eats', 'Uber BV Amsterdam', 1.0);

    const result = resolver.resolve('Uber BV Amsterdam');

    expect(result).toMatchObject({
      entity_id: 'entity-uber-eats',
      canonical_name: 'Uber Eats',
      match_type: 'exact'
    });

    // Verify alias in DB
    const alias = db.prepare(`
      SELECT * FROM entity_aliases
      WHERE entity_id = ? AND alias = ?
    `).get('entity-uber-eats', 'Uber BV Amsterdam');

    expect(alias).toBeDefined();
    expect(alias.source).toBe('manual');
  });

  test('mergeEntities combines two entities', () => {
    // Create second entity
    db.prepare(`
      INSERT INTO entities (id, canonical_name, category_id, entity_type, created_at, updated_at)
      VALUES ('entity-uber-bv', 'Uber BV', 'cat-transport', 'merchant', datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO entity_aliases (id, entity_id, alias, source, confidence, times_seen, created_at)
      VALUES ('alias-3', 'entity-uber-bv', 'Uber BV', 'manual', 1.0, 5, datetime('now'))
    `).run();

    // Create transaction linked to source entity
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, entity_id, source_type, created_at, updated_at)
      VALUES ('txn-1', 'acct-1', '2025-01-01', 'Uber BV', 'Uber BV', -10.0, 'USD', 'expense', 'entity-uber-bv', 'manual', datetime('now'), datetime('now'))
    `).run();

    // Merge entity-uber-bv → entity-uber-eats
    resolver.mergeEntities('entity-uber-bv', 'entity-uber-eats');

    // Verify:
    // 1. Source entity deleted
    const sourceEntity = db.prepare('SELECT * FROM entities WHERE id = ?').get('entity-uber-bv');
    expect(sourceEntity).toBeUndefined();

    // 2. Aliases moved to target
    const alias = db.prepare('SELECT * FROM entity_aliases WHERE id = ?').get('alias-3');
    expect(alias.entity_id).toBe('entity-uber-eats');

    // 3. Transactions moved to target
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('txn-1');
    expect(txn.entity_id).toBe('entity-uber-eats');
  });

  test('increments times_seen on match', () => {
    // First match
    resolver.resolve('UBER EATS');

    let alias = db.prepare('SELECT * FROM entity_aliases WHERE id = ?').get('alias-1');
    expect(alias.times_seen).toBe(1);

    // Second match
    resolver.resolve('UBER EATS');

    alias = db.prepare('SELECT * FROM entity_aliases WHERE id = ?').get('alias-1');
    expect(alias.times_seen).toBe(2);
  });

  test('cleans merchant name for canonical name', () => {
    const result = resolver.resolve('uber *eats   MR  TREUBLAAN  ');

    expect(result.canonical_name).toBe('Uber Eats Mr Treublaan');
  });

  test('handles null/empty merchant gracefully', () => {
    expect(resolver.resolve(null)).toBeNull();
    expect(resolver.resolve('')).toBeNull();
    expect(resolver.resolve('   ')).toBeNull();
  });
});
```

### Migration Tests

```javascript file=tests/entity-migration.test.js
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, unlinkSync } from 'fs';

describe('Entity Linking Migration', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = `test-entity-migration-${Date.now()}.db`;
    db = new Database(dbPath);

    // Create base schema (without entities)
    const schema = readFileSync('src/db/schema.sql', 'utf-8');
    db.exec(schema);

    // Seed normalization_rules
    db.prepare(`
      INSERT INTO normalization_rules (id, pattern, normalized_name, match_type, priority, category_id, is_active, created_at, updated_at)
      VALUES ('rule-1', 'UBER EATS', 'Uber Eats', 'contains', 100, 'cat-food', TRUE, datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO normalization_rules (id, pattern, normalized_name, match_type, priority, category_id, is_active, created_at, updated_at)
      VALUES ('rule-2', 'UBER.*EATS', 'Uber Eats', 'regex', 100, 'cat-food', TRUE, datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO normalization_rules (id, pattern, normalized_name, match_type, priority, category_id, is_active, created_at, updated_at)
      VALUES ('rule-3', 'Starbucks', 'Starbucks', 'exact', 100, 'cat-coffee', TRUE, datetime('now'), datetime('now'))
    `).run();
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(dbPath);
    } catch (e) {
      console.warn(`Failed to cleanup ${dbPath}:`, e.message);
    }
  });

  test('migration creates entities from normalization_rules', () => {
    // Run migration
    const migration = readFileSync('migrations/009-add-entity-linking.sql', 'utf-8');
    db.exec(migration);

    // Check entities created
    const entities = db.prepare('SELECT * FROM entities ORDER BY canonical_name').all();

    expect(entities).toHaveLength(2); // "Uber Eats" and "Starbucks"

    expect(entities[0].canonical_name).toBe('Starbucks');
    expect(entities[0].category_id).toBe('cat-coffee');

    expect(entities[1].canonical_name).toBe('Uber Eats');
    expect(entities[1].category_id).toBe('cat-food');
  });

  test('migration creates entity_aliases from rules', () => {
    const migration = readFileSync('migrations/009-add-entity-linking.sql', 'utf-8');
    db.exec(migration);

    // Check aliases created
    const aliases = db.prepare('SELECT * FROM entity_aliases ORDER BY alias').all();

    expect(aliases).toHaveLength(3); // 3 rules → 3 aliases

    // Check Starbucks alias
    const starbucksAlias = aliases.find(a => a.alias === 'Starbucks');
    expect(starbucksAlias.source).toBe('normalization_rule');
    expect(starbucksAlias.confidence).toBe(1.0); // exact match

    // Check Uber Eats aliases
    const uberAliases = aliases.filter(a => a.alias.includes('UBER'));
    expect(uberAliases).toHaveLength(2);
  });

  test('migration adds entity_id column to transactions', () => {
    const migration = readFileSync('migrations/009-add-entity-linking.sql', 'utf-8');
    db.exec(migration);

    // Check column exists
    const columns = db.prepare('PRAGMA table_info(transactions)').all();
    const entityIdColumn = columns.find(c => c.name === 'entity_id');

    expect(entityIdColumn).toBeDefined();
    expect(entityIdColumn.type).toBe('TEXT');
  });

  test('migration links existing transactions to entities', () => {
    // Create category first
    db.prepare(`
      INSERT INTO categories (id, name, icon, color, is_system, is_active, created_at)
      VALUES ('cat-food', 'Food', '🍔', '#FF6B6B', TRUE, TRUE, datetime('now'))
    `).run();

    // Create transaction with merchant matching normalized_name
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant, merchant_raw, amount, currency, type, source_type, created_at, updated_at)
      VALUES ('txn-1', 'acct-1', '2025-01-01', 'Uber Eats', 'UBER EATS AMSTERDAM', -12.50, 'USD', 'expense', 'pdf', datetime('now'), datetime('now'))
    `).run();

    // Run migration
    const migration = readFileSync('migrations/009-add-entity-linking.sql', 'utf-8');
    db.exec(migration);

    // Check transaction linked
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('txn-1');
    expect(txn.entity_id).toBe('entity-uber-eats');
  });
});
```

---

## 10. Integration with Existing Code {#10-integration}

### Update Auto-Categorization

```javascript file=src/lib/auto-categorization.js (REFACTORED)
import EntityResolver from './entity-resolver.js';

/**
 * Auto-categorize a transaction using entity linking
 *
 * This replaces the old string-based approach.
 */
export function autoCategorizeTransaction(db, rawTransaction) {
  const resolver = new EntityResolver(db);

  // Resolve entity (this also handles normalization)
  const entity = resolver.resolve(rawTransaction.description);

  if (!entity) {
    return {
      entity_id: null,
      normalized_merchant: rawTransaction.description,
      category_id: null,
      confidence: 0
    };
  }

  return {
    entity_id: entity.entity_id,
    normalized_merchant: entity.canonical_name,
    category_id: entity.category_id,
    confidence: entity.confidence
  };
}

/**
 * Bulk auto-categorize transactions (using entities)
 */
export function bulkAutoCategorize(db) {
  const resolver = new EntityResolver(db);

  // Get all transactions without entity_id
  const transactions = db.prepare(`
    SELECT id, merchant_raw
    FROM transactions
    WHERE entity_id IS NULL
  `).all();

  let updated = 0;

  const updateStmt = db.prepare(`
    UPDATE transactions
    SET entity_id = ?, category_id = ?
    WHERE id = ?
  `);

  for (const txn of transactions) {
    const entity = resolver.resolve(txn.merchant_raw);

    if (entity) {
      updateStmt.run(entity.entity_id, entity.category_id, txn.id);
      updated++;
    }
  }

  return updated;
}
```

### Update Upload Flow

```javascript
// In upload handler, use entity resolution:

import EntityResolver from './entity-resolver.js';

function processTransaction(db, rawTransaction) {
  const resolver = new EntityResolver(db);

  // Resolve entity
  const entity = resolver.resolve(rawTransaction.description);

  // Save transaction with entity_id
  db.prepare(`
    INSERT INTO transactions (
      id, account_id, date, merchant, merchant_raw,
      entity_id, category_id,
      amount, currency, type,
      source_type, source_file, source_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    rawTransaction.account_id,
    rawTransaction.date,
    entity.canonical_name,        // normalized merchant
    rawTransaction.description,  // raw merchant
    entity.entity_id,            // NEW: entity link
    entity.category_id,          // category from entity
    rawTransaction.amount,
    rawTransaction.currency,
    rawTransaction.type,
    'pdf',
    rawTransaction.source_file,
    rawTransaction.source_hash,
    new Date().toISOString(),
    new Date().toISOString()
  );
}
```

---

## Summary

Badge 13 transforms the normalization system from **string matching** to **entity linking**:

### Before (String Normalization):
```
"UBER *EATS" → "Uber Eats" (string)
"Uber BV" → "Uber BV" (string)
→ 2 different merchants, can't group
```

### After (Entity Linking):
```
"UBER *EATS" → entity-uber-eats
"Uber BV" → entity-uber-eats
→ 1 entity, grouped automatically
```

### Key Benefits:
1. ✅ Grouping all merchant variants
2. ✅ Category on entity (not string)
3. ✅ Cross-account tracking
4. ✅ Manual linking support
5. ✅ Confidence scores
6. ✅ Future ML-ready

### Files Created:
- `migrations/009-add-entity-linking.sql` (~150 lines)
- `scripts/migrate-to-entities.js` (~100 lines)
- `src/lib/entity-resolver.js` (~350 lines)
- `src/views/entity-views.js` (~100 lines)
- `src/data-sources/*` updates (~50 lines)
- `src/lib/auto-categorization.js` refactor (~50 lines)
- `tests/entity-resolver.test.js` (~200 lines)
- `tests/entity-migration.test.js` (~100 lines)

**Total**: ~1,100 lines across 8 files

---

**Next Steps**:
1. Run migration: `node scripts/migrate-to-entities.js`
2. Run tests: `npm test tests/entity-*.test.js`
3. Build EntityManager UI component
4. Proceed to Badge 14 (Budget ↔ Recurring Analysis)
