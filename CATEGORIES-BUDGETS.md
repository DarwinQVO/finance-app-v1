# Phase 2: Categories & Budgets

**Organización y control financiero**

---

## 🎯 Overview

Phase 2 agrega la capacidad de:
- Categorizar transactions (manual + auto)
- Crear y trackear budgets
- Detectar recurring transactions
- Agregar tags flexibles

**LOC estimate**: ~1,000 LOC

---

## 📊 Categories System

### Database

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,                     -- Multi-user support

  name TEXT NOT NULL,               -- "Food & Dining"
  parent_id TEXT,                   -- Hierarchical (subcategory)

  color TEXT,                       -- UI color
  icon TEXT,                        -- Emoji icon

  is_system BOOLEAN DEFAULT FALSE,  -- System vs user-created
  is_active BOOLEAN DEFAULT TRUE,

  created_at TEXT NOT NULL,

  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

### Default Categories (Pre-populated)

```javascript
const DEFAULT_CATEGORIES = [
  // Food & Dining
  { id: 'cat_food', name: 'Food & Dining', icon: '🍔', color: '#FF6B6B', parent: null },
  { id: 'cat_food_restaurants', name: 'Restaurants', icon: '🍽️', color: '#FF6B6B', parent: 'cat_food' },
  { id: 'cat_food_groceries', name: 'Groceries', icon: '🛒', color: '#FF6B6B', parent: 'cat_food' },
  { id: 'cat_food_coffee', name: 'Coffee Shops', icon: '☕', color: '#FF6B6B', parent: 'cat_food' },

  // Transportation
  { id: 'cat_transport', name: 'Transportation', icon: '🚗', color: '#4ECDC4', parent: null },
  { id: 'cat_transport_gas', name: 'Gas & Fuel', icon: '⛽', color: '#4ECDC4', parent: 'cat_transport' },
  { id: 'cat_transport_parking', name: 'Parking', icon: '🅿️', color: '#4ECDC4', parent: 'cat_transport' },
  { id: 'cat_transport_uber', name: 'Ride Share', icon: '🚕', color: '#4ECDC4', parent: 'cat_transport' },

  // Shopping
  { id: 'cat_shopping', name: 'Shopping', icon: '🛍️', color: '#95E1D3', parent: null },
  { id: 'cat_shopping_clothing', name: 'Clothing', icon: '👔', color: '#95E1D3', parent: 'cat_shopping' },
  { id: 'cat_shopping_electronics', name: 'Electronics', icon: '📱', color: '#95E1D3', parent: 'cat_shopping' },

  // Entertainment
  { id: 'cat_entertainment', name: 'Entertainment', icon: '🎬', color: '#F38181', parent: null },
  { id: 'cat_entertainment_streaming', name: 'Streaming', icon: '📺', color: '#F38181', parent: 'cat_entertainment' },
  { id: 'cat_entertainment_movies', name: 'Movies', icon: '🎥', color: '#F38181', parent: 'cat_entertainment' },

  // Bills & Utilities
  { id: 'cat_bills', name: 'Bills & Utilities', icon: '💡', color: '#AA96DA', parent: null },
  { id: 'cat_bills_electric', name: 'Electric', icon: '⚡', color: '#AA96DA', parent: 'cat_bills' },
  { id: 'cat_bills_internet', name: 'Internet', icon: '🌐', color: '#AA96DA', parent: 'cat_bills' },
  { id: 'cat_bills_phone', name: 'Phone', icon: '📞', color: '#AA96DA', parent: 'cat_bills' },

  // Healthcare
  { id: 'cat_health', name: 'Healthcare', icon: '🏥', color: '#FCBAD3', parent: null },
  { id: 'cat_health_pharmacy', name: 'Pharmacy', icon: '💊', color: '#FCBAD3', parent: 'cat_health' },
  { id: 'cat_health_doctor', name: 'Doctor', icon: '👨‍⚕️', color: '#FCBAD3', parent: 'cat_health' },

  // Income
  { id: 'cat_income', name: 'Income', icon: '💰', color: '#A8E6CF', parent: null },
  { id: 'cat_income_salary', name: 'Salary', icon: '💵', color: '#A8E6CF', parent: 'cat_income' },
  { id: 'cat_income_freelance', name: 'Freelance', icon: '💼', color: '#A8E6CF', parent: 'cat_income' },

  // Uncategorized
  { id: 'cat_uncategorized', name: 'Uncategorized', icon: '❓', color: '#CCCCCC', parent: null }
];
```

---

## 🤖 Auto-Categorization

### Link normalization_rules → categories

```sql
-- Update normalization_rules table
ALTER TABLE normalization_rules
ADD COLUMN suggested_category_id TEXT REFERENCES categories(id);

-- Example rules with auto-categorization
INSERT INTO normalization_rules VALUES
  ('rule_starbucks', 'regex', 'STARBUCKS.*#\d+', 'Starbucks',
   'cat_food_coffee', 1, TRUE, 0, NULL, '2025-01-01'),

  ('rule_shell', 'regex', 'SHELL OIL', 'Shell',
   'cat_transport_gas', 1, TRUE, 0, NULL, '2025-01-01'),

  ('rule_netflix', 'contains', 'NETFLIX', 'Netflix',
   'cat_entertainment_streaming', 1, TRUE, 0, NULL, '2025-01-01');
```

### Auto-categorization logic

```javascript
// main/categorization.js

async function autoCategorize(transactionId) {
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);

  // Check if normalization rule has suggested category
  if (txn.normalization_rule_id) {
    const rule = await db.get(
      'SELECT suggested_category_id FROM normalization_rules WHERE id = ?',
      txn.normalization_rule_id
    );

    if (rule.suggested_category_id) {
      await db.run(
        'UPDATE transactions SET category_id = ? WHERE id = ?',
        rule.suggested_category_id,
        transactionId
      );

      return rule.suggested_category_id;
    }
  }

  // Fallback: Check if merchant matches any rule
  const rule = await db.get(
    `SELECT suggested_category_id
     FROM normalization_rules
     WHERE suggested_category_id IS NOT NULL
     AND normalized_merchant = ?
     LIMIT 1`,
    txn.merchant
  );

  if (rule) {
    await db.run(
      'UPDATE transactions SET category_id = ? WHERE id = ?',
      rule.suggested_category_id,
      transactionId
    );

    return rule.suggested_category_id;
  }

  return null;
}
```

---

## 💰 Budgets

### Database

```sql
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  name TEXT NOT NULL,               -- "Monthly Food Budget"

  -- Scope
  budget_type TEXT NOT NULL,        -- category | merchant | account | total
  category_id TEXT,                 -- Si type=category
  merchant TEXT,                    -- Si type=merchant
  account_id TEXT,                  -- Si type=account

  -- Amount
  amount REAL NOT NULL,             -- Límite
  currency TEXT NOT NULL,

  -- Time period
  period_type TEXT NOT NULL,        -- monthly | quarterly | yearly | custom
  period_start TEXT,                -- ISO date
  period_end TEXT,                  -- ISO date

  -- Rollover
  allow_rollover BOOLEAN DEFAULT FALSE,
  rollover_amount REAL DEFAULT 0,

  -- Alerts
  alert_threshold REAL DEFAULT 0.8, -- Alert al 80%
  alert_enabled BOOLEAN DEFAULT TRUE,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,

  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

### Budget Tracking

```javascript
// main/budgets.js

async function getBudgetStatus(budgetId) {
  const budget = await db.get('SELECT * FROM budgets WHERE id = ?', budgetId);

  // Calculate date range
  const { startDate, endDate } = calculateBudgetPeriod(budget);

  // Query transactions that apply to this budget
  let query = `
    SELECT SUM(ABS(amount)) as spent
    FROM transactions
    WHERE type = 'expense'
    AND date >= ? AND date <= ?
  `;

  const params = [startDate, endDate];

  // Apply budget scope filters
  if (budget.budget_type === 'category') {
    query += ' AND category_id = ?';
    params.push(budget.category_id);
  } else if (budget.budget_type === 'merchant') {
    query += ' AND merchant = ?';
    params.push(budget.merchant);
  } else if (budget.budget_type === 'account') {
    query += ' AND account_id = ?';
    params.push(budget.account_id);
  }

  const result = await db.get(query, params);
  const spent = result.spent || 0;

  // Calculate with rollover
  const effectiveLimit = budget.amount + (budget.allow_rollover ? budget.rollover_amount : 0);

  const percentage = (spent / effectiveLimit) * 100;
  const remaining = effectiveLimit - spent;

  return {
    budget,
    spent,
    limit: effectiveLimit,
    remaining,
    percentage,
    isOverBudget: spent > effectiveLimit,
    shouldAlert: percentage >= (budget.alert_threshold * 100)
  };
}

function calculateBudgetPeriod(budget) {
  const now = new Date();

  switch (budget.period_type) {
    case 'monthly':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      };

    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3);
      return {
        startDate: new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0]
      };

    case 'yearly':
      return {
        startDate: `${now.getFullYear()}-01-01`,
        endDate: `${now.getFullYear()}-12-31`
      };

    case 'custom':
      return {
        startDate: budget.period_start,
        endDate: budget.period_end
      };
  }
}
```

### Budget Alerts

```javascript
async function checkBudgetAlerts(transactionId) {
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);

  // Get all active budgets that apply
  const budgets = await db.all(`
    SELECT * FROM budgets
    WHERE is_active = TRUE
    AND alert_enabled = TRUE
    AND (
      (budget_type = 'category' AND category_id = ?)
      OR (budget_type = 'merchant' AND merchant = ?)
      OR (budget_type = 'account' AND account_id = ?)
      OR budget_type = 'total'
    )
  `, txn.category_id, txn.merchant, txn.account_id);

  const alerts = [];

  for (const budget of budgets) {
    const status = await getBudgetStatus(budget.id);

    if (status.shouldAlert && !status.isOverBudget) {
      alerts.push({
        type: 'warning',
        budget: budget.name,
        message: `You've spent ${status.percentage.toFixed(0)}% of your ${budget.name} budget`,
        spent: status.spent,
        limit: status.limit
      });
    } else if (status.isOverBudget) {
      alerts.push({
        type: 'error',
        budget: budget.name,
        message: `You've exceeded your ${budget.name} budget by $${Math.abs(status.remaining).toFixed(2)}`,
        spent: status.spent,
        limit: status.limit
      });
    }
  }

  return alerts;
}
```

---

## 🔄 Recurring Transactions

### Database

```sql
CREATE TABLE recurring_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  name TEXT NOT NULL,               -- "Netflix Subscription"
  merchant TEXT NOT NULL,

  -- Pattern
  frequency TEXT NOT NULL,          -- weekly | monthly | quarterly | yearly
  expected_amount REAL,
  amount_tolerance REAL DEFAULT 0.05, -- ±5%

  -- Next expected
  last_transaction_date TEXT,
  next_expected_date TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  confidence REAL,                  -- Qué tan seguro está el pattern

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Recurring Detection

```javascript
// main/recurring.js

async function detectRecurring(merchant) {
  // Get all transactions for this merchant, sorted by date
  const txns = await db.all(
    `SELECT * FROM transactions
     WHERE merchant = ?
     AND type = 'expense'
     ORDER BY date ASC`,
    merchant
  );

  if (txns.length < 3) {
    return null; // Need at least 3 transactions to detect pattern
  }

  // Calculate intervals between transactions (in days)
  const intervals = [];
  for (let i = 1; i < txns.length; i++) {
    const days = daysBetween(txns[i-1].date, txns[i].date);
    intervals.push(days);
  }

  // Check if intervals are consistent
  const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.pow(interval - avgInterval, 2);
  }, 0) / intervals.length;

  const stdDev = Math.sqrt(variance);

  // Confidence based on consistency
  const confidence = Math.max(0, 1 - (stdDev / avgInterval));

  if (confidence < 0.7) {
    return null; // Not confident enough
  }

  // Determine frequency
  const frequency = determineFrequency(avgInterval);

  // Calculate expected amount
  const amounts = txns.map(t => Math.abs(t.amount));
  const avgAmount = amounts.reduce((a, b) => a + b) / amounts.length;
  const amountVariance = Math.max(...amounts) - Math.min(...amounts);
  const amountTolerance = amountVariance / avgAmount;

  return {
    merchant,
    frequency,
    expectedAmount: avgAmount,
    amountTolerance: Math.max(0.05, amountTolerance),
    confidence,
    lastDate: txns[txns.length - 1].date,
    nextExpectedDate: addDays(txns[txns.length - 1].date, avgInterval)
  };
}

function determineFrequency(days) {
  if (days >= 335 && days <= 395) return 'yearly';
  if (days >= 80 && days <= 100) return 'quarterly';
  if (days >= 25 && days <= 35) return 'monthly';
  if (days >= 12 && days <= 16) return 'bi-weekly';
  if (days >= 5 && days <= 9) return 'weekly';
  return 'custom';
}

async function linkTransactionToRecurring(transactionId) {
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);

  // Check if merchant has recurring group
  const group = await db.get(
    'SELECT * FROM recurring_groups WHERE merchant = ? AND is_active = TRUE',
    txn.merchant
  );

  if (!group) {
    // Try to detect if this starts a new recurring pattern
    const pattern = await detectRecurring(txn.merchant);
    if (pattern) {
      // Create new recurring group
      const groupId = generateId();
      await db.run(
        `INSERT INTO recurring_groups
         (id, name, merchant, frequency, expected_amount, amount_tolerance,
          last_transaction_date, next_expected_date, confidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        groupId,
        `${pattern.merchant} Subscription`,
        pattern.merchant,
        pattern.frequency,
        pattern.expectedAmount,
        pattern.amountTolerance,
        pattern.lastDate,
        pattern.nextExpectedDate,
        pattern.confidence,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Link all transactions to this group
      await db.run(
        'UPDATE transactions SET recurring_group_id = ? WHERE merchant = ?',
        groupId,
        pattern.merchant
      );

      return groupId;
    }

    return null;
  }

  // Check if amount matches
  const amountDiff = Math.abs(Math.abs(txn.amount) - group.expected_amount) / group.expected_amount;

  if (amountDiff <= group.amount_tolerance) {
    // Link to group
    await db.run(
      'UPDATE transactions SET recurring_group_id = ? WHERE id = ?',
      group.id,
      transactionId
    );

    // Update group
    await db.run(
      `UPDATE recurring_groups
       SET last_transaction_date = ?,
           next_expected_date = ?,
           updated_at = ?
       WHERE id = ?`,
      txn.date,
      calculateNextDate(txn.date, group.frequency),
      new Date().toISOString(),
      group.id
    );

    return group.id;
  }

  return null;
}
```

---

## 🏷️ Tags System

### Simple JSON array in transactions table

```javascript
// Tags are stored as JSON in transactions.tags field

async function addTag(transactionId, tag) {
  const txn = await db.get('SELECT tags FROM transactions WHERE id = ?', transactionId);
  const tags = txn.tags ? JSON.parse(txn.tags) : [];

  if (!tags.includes(tag)) {
    tags.push(tag);
    await db.run(
      'UPDATE transactions SET tags = ? WHERE id = ?',
      JSON.stringify(tags),
      transactionId
    );
  }
}

async function removeTag(transactionId, tag) {
  const txn = await db.get('SELECT tags FROM transactions WHERE id = ?', transactionId);
  const tags = txn.tags ? JSON.parse(txn.tags) : [];

  const newTags = tags.filter(t => t !== tag);
  await db.run(
    'UPDATE transactions SET tags = ? WHERE id = ?',
    JSON.stringify(newTags),
    transactionId
  );
}

async function getPopularTags(limit = 20) {
  const txns = await db.all('SELECT tags FROM transactions WHERE tags IS NOT NULL');

  const tagCounts = {};
  txns.forEach(txn => {
    const tags = JSON.parse(txn.tags);
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}
```

---

## 📊 LOC Estimate

| Component | LOC |
|-----------|-----|
| Categories (DB + pre-populate) | ~100 |
| Auto-categorization | ~80 |
| Budgets (DB + tracking + alerts) | ~200 |
| Recurring detection | ~150 |
| Tags system | ~50 |
| UI Components | ~420 |
| **Total** | **~1,000** |

---

**Próximo doc**: Lee [REPORTS-EXPORT.md](REPORTS-EXPORT.md)
