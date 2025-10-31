# Badge 14: Budget ↔ Recurring Analysis

**Status**: ⏳ In Progress
**Date**: October 30, 2025
**Dependencies**: Badge 13 (Entity Linking)

---

## 📋 TABLE OF CONTENTS

1. [The Problem](#the-problem)
2. [Why Current System Doesn't Work](#why-current-system-doesnt-work)
3. [The Solution: Retroactive Analysis](#the-solution)
4. [Architecture Design](#architecture-design)
5. [Implementation](#implementation)
6. [Tests](#tests)
7. [Integration](#integration)

---

## 🎯 THE PROBLEM

### Context: This is a RETROACTIVE app

Your finance app processes **historical data** from PDFs and CSVs. It's NOT a real-time banking app. This fundamental difference changes how budgets work:

**Real-time app** (Mint, YNAB):
```
User sets budget: $500/month for Food
→ Tracks spending in real-time
→ Sends alert: "⚠️ You're at $450, approaching limit!"
→ User adjusts behavior before month ends
```

**Retroactive app** (YOUR app):
```
User uploads October bank statement (November 5th)
→ Sees: "You spent $650 on Food in October"
→ Budget was $500
→ You were $150 over (30% over budget)
→ NO alerts possible (October is over!)
```

### What Users Actually Need

1. **Historical Analysis** (not real-time alerts)
   - "How did I do last month compared to my plan?"
   - "Which months was I over/under budget?"
   - "Am I trending up or down?"

2. **Recurring vs Discretionary Breakdown**
   - Fixed costs: Netflix ($15), Rent ($2000), Insurance ($120)
   - Variable costs: Restaurants, shopping, entertainment
   - Question: "My food budget was $500, but $200 was Uber Eats subscriptions (recurring) and $450 was restaurants (discretionary)"

3. **Upload Reminder** (the ONLY real-time alert that makes sense)
   - "It's November 10th, remember to upload your October statements"
   - This is Badge 17 (later)

---

## ❌ WHY CURRENT SYSTEM DOESN'T WORK

### Problem 1: Real-time orientation

**Current code** ([src/lib/budget-tracking.js](../../src/lib/budget-tracking.js:4-13)):
```javascript
export function getCurrentPeriod(period, startDate) {
  const now = new Date(); // ❌ Always uses "now"

  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: ..., endDate: ... };
  }
  // ...
}
```

**Problem**: Can't analyze historical periods like "October 2024" because it always uses "now".

**What we need**:
```javascript
export function getPeriodDates(period, referenceDate) {
  const ref = new Date(referenceDate); // Use ANY date

  if (period === 'monthly') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { startDate: ..., endDate: ... };
  }
  // ...
}

// Usage:
getPeriodDates('monthly', '2024-10-15') // October 2024
getPeriodDates('monthly', '2024-11-15') // November 2024
getPeriodDates('monthly', '2025-01-15') // January 2025
```

### Problem 2: No recurring vs discretionary breakdown

**Current code** calculates total spending:
```javascript
export function getBudgetStatus(db, budgetId) {
  // ...
  const result = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE category_id IN (${placeholders})
      AND date >= ? AND date <= ?
      AND type = 'expense'
  `).get(...categoryIds, startDate, endDate);

  const totalSpent = result.total; // Just one number
  // ...
}
```

**Problem**: Doesn't break down spending into:
- Recurring (fixed): Subscriptions, rent, insurance
- Discretionary (variable): Restaurants, shopping, entertainment

**What we need**:
```javascript
{
  budgetId: 'budget-food-oct',
  limit: 500,
  spent: 650,
  remaining: -150,
  breakdown: {
    recurring: {
      amount: 200,
      percentage: 30.8,  // 200/650
      entities: [
        { name: 'Uber Eats Pass', amount: 15, frequency: 'monthly' },
        { name: 'DoorDash Premium', amount: 10, frequency: 'monthly' },
        { name: 'Meal Prep Service', amount: 175, frequency: 'weekly' }
      ]
    },
    discretionary: {
      amount: 450,
      percentage: 69.2,  // 450/650
      topCategories: [
        { name: 'Restaurants', amount: 280 },
        { name: 'Coffee Shops', amount: 95 },
        { name: 'Groceries', amount: 75 }
      ]
    }
  }
}
```

### Problem 3: Merchant-based recurring detection (not entity-based)

**Current code** ([src/lib/recurring-detection.js](../../src/lib/recurring-detection.js:52)):
```javascript
export function detectRecurringForMerchant(db, merchant) {
  const transactions = db.prepare(`
    SELECT id, date, amount, currency
    FROM transactions
    WHERE merchant = ?  // ❌ Uses merchant STRING
      AND type = 'expense'
    ORDER BY date ASC
  `).all(merchant);
  // ...
}
```

**Problem**: Won't detect recurring patterns across merchant variants:
- "NETFLIX.COM/123" (August)
- "NETFLIX COM" (September)
- "NETFLIX *STREAMING" (October)

These are all Netflix, but treated as 3 different merchants!

**What we need** (using Entity Linking from Badge 13):
```javascript
export function detectRecurringForEntity(db, entityId) {
  const transactions = db.prepare(`
    SELECT id, date, amount, currency
    FROM transactions
    WHERE entity_id = ?  // ✅ Uses entity ID
      AND type = 'expense'
    ORDER BY date ASC
  `).all(entityId);
  // ...
}
```

Now all Netflix variants are grouped under one entity, so pattern detection works correctly!

---

## ✅ THE SOLUTION: RETROACTIVE ANALYSIS

### Core Principles

1. **Date Range Based** (not "now" based)
   - Every function takes a date range parameter
   - Can analyze ANY historical period
   - Can compare across periods

2. **Recurring vs Discretionary**
   - Identify fixed recurring costs
   - Separate from variable spending
   - Show percentage breakdown

3. **Entity-Based** (not merchant string based)
   - Use entity linking from Badge 13
   - Accurate recurring detection
   - Cross-account tracking

4. **Comparative Analysis** (not just status)
   - Month-over-month trends
   - Budget adherence over time
   - Recurring cost trends

### What Users Can Do

**Scenario 1: Monthly Budget Review**
```
User uploads October statement on Nov 5th
→ App shows: "October Budget Performance"

Food & Dining: $650 / $500 (30% over)
├── Recurring: $200 (31%)
│   ├── Uber Eats Pass: $15/mo
│   ├── DoorDash Premium: $10/mo
│   └── Meal Prep Service: $175/mo
└── Discretionary: $450 (69%)
    ├── Restaurants: $280
    ├── Coffee: $95
    └── Groceries: $75

💡 Insight: Your recurring food costs ($200) are fine, but
discretionary spending ($450) was $150 over budget.
Consider reducing restaurant visits next month.
```

**Scenario 2: Quarterly Analysis**
```
User analyzes Q3 2024 (July-September)

Budget: $1,500 total ($500/month)
Actual: $1,850 total (+23%)

Month-by-month:
July:      $580 / $500 (+16%)
August:    $620 / $500 (+24%)
September: $650 / $500 (+30%)

Trend: ⬆️ Spending increasing each month

Recurring vs Discretionary:
Recurring:      $600 (32%) - consistent
Discretionary: $1,250 (68%) - increasing ⚠️

💡 Insight: Your fixed costs are stable, but discretionary
spending grew 40% from July to September.
```

**Scenario 3: Year-over-Year Comparison**
```
Compare October 2024 vs October 2023

Food Budget: $500 (same)
Actual 2023: $520 (+4%)
Actual 2024: $650 (+30%)

Change: +$130 (+25%)

Recurring costs:
2023: $180 (Netflix, DoorDash)
2024: $200 (Netflix, DoorDash, Uber Eats Pass)
Change: +$20 (+11%)

Discretionary:
2023: $340
2024: $450
Change: +$110 (+32%) ⚠️

💡 Insight: Added Uber Eats Pass subscription, but
discretionary spending also increased significantly.
```

---

## 🏗️ ARCHITECTURE DESIGN

### Modules Overview

```
Badge 14: Budget ↔ Recurring Analysis
│
├── 1. BudgetAnalyzer (Core)
│   ├── getPeriodDates(period, referenceDate)
│   ├── getBudgetPerformance(db, budgetId, dateRange)
│   ├── compareBudgetPeriods(db, budgetId, period1, period2)
│   └── getBudgetTrends(db, budgetId, periods[])
│
├── 2. RecurringBreakdown
│   ├── detectRecurringForEntity(db, entityId)
│   ├── getRecurringSpending(db, categoryId, dateRange)
│   ├── getDiscretionarySpending(db, categoryId, dateRange)
│   └── getSpendingBreakdown(db, categoryId, dateRange)
│
├── 3. Budget Analysis Views
│   ├── getBudgetPerformanceView(dataSource, budgetId, dateRange)
│   ├── getBudgetTrendsView(dataSource, budgetId, periods)
│   ├── getRecurringVsDiscretionaryView(dataSource, categoryId, dateRange)
│   └── getBudgetComparison(dataSource, budgetId, period1, period2)
│
└── 4. Integration Tests
    ├── Full budget analysis flow
    ├── Entity-based recurring detection
    └── Historical period analysis
```

### Data Flow

```
User Request: "Show October 2024 budget performance"
│
├─→ 1. BudgetAnalyzer.getPeriodDates('monthly', '2024-10-15')
│   └─→ Returns: { startDate: '2024-10-01', endDate: '2024-10-31' }
│
├─→ 2. BudgetAnalyzer.getBudgetPerformance(db, 'budget-food', dateRange)
│   │
│   ├─→ Get budget details and categories
│   │
│   ├─→ Calculate total spent in period
│   │
│   └─→ 3. RecurringBreakdown.getSpendingBreakdown(db, categoryId, dateRange)
│       │
│       ├─→ Get all transactions in period with entity_id
│       │
│       ├─→ For each unique entity_id:
│       │   └─→ RecurringBreakdown.detectRecurringForEntity(db, entityId)
│       │       └─→ Analyze transaction pattern (frequency, consistency)
│       │
│       ├─→ Sum recurring transactions
│       │
│       └─→ Sum discretionary transactions (non-recurring)
│
└─→ 4. Return complete analysis
    {
      budgetId, limit, spent, remaining, percentage,
      period: { startDate, endDate },
      breakdown: {
        recurring: { amount, percentage, entities: [...] },
        discretionary: { amount, percentage, topMerchants: [...] }
      }
    }
```

### Integration with Badge 13 (Entity Linking)

```javascript
// OLD way (merchant strings):
detectRecurringForMerchant(db, 'NETFLIX.COM')
→ Only finds exact matches
→ Misses: "NETFLIX COM", "NETFLIX *STREAMING"

// NEW way (entities):
detectRecurringForEntity(db, 'entity-netflix-abc123')
→ Finds ALL variants (aliases)
→ Accurate pattern detection
→ Cross-account tracking
```

---

## 💻 IMPLEMENTATION

### Module 1: BudgetAnalyzer

```javascript
// FILE: src/lib/budget-analyzer.js

/**
 * Get period dates for any reference date (not just "now")
 *
 * @param {string} period - 'weekly' | 'monthly' | 'yearly'
 * @param {string} referenceDate - ISO date string (e.g., '2024-10-15')
 * @returns {{startDate: string, endDate: string}}
 */
export function getPeriodDates(period, referenceDate) {
  const ref = new Date(referenceDate);

  if (period === 'monthly') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  if (period === 'weekly') {
    const start = new Date(ref);
    start.setDate(ref.getDate() - ref.getDay()); // Start of week (Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  if (period === 'yearly') {
    const start = new Date(ref.getFullYear(), 0, 1);
    const end = new Date(ref.getFullYear(), 11, 31);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  throw new Error(`Invalid period: ${period}`);
}

/**
 * Get budget performance for a specific period
 *
 * Includes recurring vs discretionary breakdown
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} budgetId - Budget ID
 * @param {{startDate: string, endDate: string}} dateRange - Date range
 * @returns {Object} - Budget performance with breakdown
 */
export function getBudgetPerformance(db, budgetId, dateRange) {
  // Get budget details
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);

  if (!budget) {
    throw new Error(`Budget not found: ${budgetId}`);
  }

  // Get categories for this budget
  const categoryIds = db
    .prepare('SELECT category_id FROM budget_categories WHERE budget_id = ?')
    .all(budgetId)
    .map((row) => row.category_id);

  if (categoryIds.length === 0) {
    return {
      budgetId: budget.id,
      name: budget.name,
      limit: budget.amount,
      spent: 0,
      remaining: budget.amount,
      percentage: 0,
      period: dateRange,
      isOverBudget: false,
      breakdown: {
        recurring: { amount: 0, percentage: 0, entities: [] },
        discretionary: { amount: 0, percentage: 0, topMerchants: [] },
      },
    };
  }

  // Calculate total spent
  const placeholders = categoryIds.map(() => '?').join(',');
  const result = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE category_id IN (${placeholders})
      AND date >= ?
      AND date <= ?
      AND type = 'expense'
  `).get(...categoryIds, dateRange.startDate, dateRange.endDate);

  const totalSpent = result.total;
  const percentage = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
  const remaining = budget.amount - totalSpent;

  // Get spending breakdown (recurring vs discretionary)
  const breakdown = getSpendingBreakdownForCategories(db, categoryIds, dateRange);

  return {
    budgetId: budget.id,
    name: budget.name,
    limit: budget.amount,
    spent: totalSpent,
    remaining,
    percentage,
    period: dateRange,
    isOverBudget: totalSpent > budget.amount,
    breakdown,
  };
}

/**
 * Compare budget performance across two periods
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} budgetId - Budget ID
 * @param {{startDate: string, endDate: string}} period1
 * @param {{startDate: string, endDate: string}} period2
 * @returns {Object} - Comparison with deltas
 */
export function compareBudgetPeriods(db, budgetId, period1, period2) {
  const perf1 = getBudgetPerformance(db, budgetId, period1);
  const perf2 = getBudgetPerformance(db, budgetId, period2);

  return {
    budget: { id: budgetId, name: perf1.name, limit: perf1.limit },
    period1: {
      ...perf1,
      label: `${period1.startDate} to ${period1.endDate}`,
    },
    period2: {
      ...perf2,
      label: `${period2.startDate} to ${period2.endDate}`,
    },
    delta: {
      spent: perf2.spent - perf1.spent,
      spentPercent: perf1.spent > 0 ? ((perf2.spent - perf1.spent) / perf1.spent) * 100 : 0,
      recurring: perf2.breakdown.recurring.amount - perf1.breakdown.recurring.amount,
      discretionary: perf2.breakdown.discretionary.amount - perf1.breakdown.discretionary.amount,
    },
  };
}

/**
 * Get budget trends across multiple periods
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} budgetId - Budget ID
 * @param {Array<{startDate: string, endDate: string, label: string}>} periods
 * @returns {Object} - Trend analysis
 */
export function getBudgetTrends(db, budgetId, periods) {
  const performances = periods.map((period) => ({
    ...getBudgetPerformance(db, budgetId, period),
    label: period.label,
  }));

  // Calculate trends
  const spentValues = performances.map((p) => p.spent);
  const recurringValues = performances.map((p) => p.breakdown.recurring.amount);
  const discretionaryValues = performances.map((p) => p.breakdown.discretionary.amount);

  return {
    budgetId,
    name: performances[0].name,
    limit: performances[0].limit,
    periods: performances,
    trends: {
      spending: calculateTrend(spentValues),
      recurring: calculateTrend(recurringValues),
      discretionary: calculateTrend(discretionaryValues),
    },
  };
}

/**
 * Calculate trend direction
 * @param {number[]} values
 * @returns {'increasing' | 'decreasing' | 'stable'}
 */
function calculateTrend(values) {
  if (values.length < 2) return 'stable';

  let increases = 0;
  let decreases = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) increases++;
    else if (values[i] < values[i - 1]) decreases++;
  }

  if (increases > decreases) return 'increasing';
  if (decreases > increases) return 'decreasing';
  return 'stable';
}

/**
 * Helper: Get spending breakdown for multiple categories
 * (Calls RecurringBreakdown module)
 */
function getSpendingBreakdownForCategories(db, categoryIds, dateRange) {
  // Import from recurring-breakdown module
  const { getSpendingBreakdown } = require('./recurring-breakdown.js');

  // Aggregate across all categories
  let totalRecurring = 0;
  let totalDiscretionary = 0;
  let allRecurringEntities = [];
  let allDiscretionaryMerchants = [];

  for (const categoryId of categoryIds) {
    const breakdown = getSpendingBreakdown(db, categoryId, dateRange);
    totalRecurring += breakdown.recurring.amount;
    totalDiscretionary += breakdown.discretionary.amount;
    allRecurringEntities.push(...breakdown.recurring.entities);
    allDiscretionaryMerchants.push(...breakdown.discretionary.topMerchants);
  }

  const totalSpent = totalRecurring + totalDiscretionary;

  return {
    recurring: {
      amount: totalRecurring,
      percentage: totalSpent > 0 ? (totalRecurring / totalSpent) * 100 : 0,
      entities: allRecurringEntities.sort((a, b) => b.amount - a.amount).slice(0, 10),
    },
    discretionary: {
      amount: totalDiscretionary,
      percentage: totalSpent > 0 ? (totalDiscretionary / totalSpent) * 100 : 0,
      topMerchants: allDiscretionaryMerchants.sort((a, b) => b.amount - a.amount).slice(0, 10),
    },
  };
}
```

---

### Module 2: RecurringBreakdown

```javascript
// FILE: src/lib/recurring-breakdown.js

/**
 * Detect recurring pattern for a specific ENTITY (not merchant string)
 *
 * Uses Entity Linking from Badge 13 for accurate detection
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} entityId - Entity ID
 * @param {{startDate: string, endDate: string}} dateRange - Optional date range
 * @returns {Object|null} - Recurring pattern or null
 */
export function detectRecurringForEntity(db, entityId, dateRange = null) {
  // Get all transactions for this entity
  let query = `
    SELECT id, date, amount, currency
    FROM transactions
    WHERE entity_id = ?
      AND type = 'expense'
  `;

  const params = [entityId];

  if (dateRange) {
    query += ' AND date >= ? AND date <= ?';
    params.push(dateRange.startDate, dateRange.endDate);
  }

  query += ' ORDER BY date ASC';

  const transactions = db.prepare(query).all(...params);

  // Need at least 3 transactions to detect pattern
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
  let confidence = 1.0 - stdDev / avgInterval;
  confidence = Math.max(0, Math.min(1, confidence));

  // Low confidence patterns are not useful
  if (confidence < 0.6) {
    return null;
  }

  // Calculate expected amount (average)
  const amounts = transactions.map((t) => Math.abs(t.amount));
  const expectedAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  return {
    entityId,
    frequency,
    expectedAmount,
    currency: transactions[0].currency,
    confidence,
    transactionCount: transactions.length,
  };
}

/**
 * Get recurring spending for a category in a period
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} categoryId - Category ID
 * @param {{startDate: string, endDate: string}} dateRange
 * @returns {{amount: number, entities: Array}}
 */
export function getRecurringSpending(db, categoryId, dateRange) {
  // Get all transactions for this category in period
  const transactions = db.prepare(`
    SELECT
      t.id,
      t.entity_id,
      t.amount,
      t.date,
      e.canonical_name
    FROM transactions t
    LEFT JOIN entities e ON t.entity_id = e.id
    WHERE t.category_id = ?
      AND t.date >= ?
      AND t.date <= ?
      AND t.type = 'expense'
    ORDER BY t.date ASC
  `).all(categoryId, dateRange.startDate, dateRange.endDate);

  // Group by entity
  const entitiesMap = new Map();

  for (const txn of transactions) {
    if (!txn.entity_id) continue;

    if (!entitiesMap.has(txn.entity_id)) {
      entitiesMap.set(txn.entity_id, {
        entityId: txn.entity_id,
        name: txn.canonical_name || 'Unknown',
        transactions: [],
        total: 0,
      });
    }

    const entity = entitiesMap.get(txn.entity_id);
    entity.transactions.push(txn);
    entity.total += Math.abs(txn.amount);
  }

  // Detect recurring patterns for each entity
  const recurringEntities = [];
  let totalRecurring = 0;

  for (const [entityId, entity] of entitiesMap) {
    const pattern = detectRecurringForEntity(db, entityId, dateRange);

    if (pattern) {
      recurringEntities.push({
        entityId,
        name: entity.name,
        amount: entity.total,
        frequency: pattern.frequency,
        confidence: pattern.confidence,
        transactionCount: entity.transactions.length,
      });
      totalRecurring += entity.total;
    }
  }

  return {
    amount: totalRecurring,
    entities: recurringEntities.sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Get discretionary (non-recurring) spending
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} categoryId - Category ID
 * @param {{startDate: string, endDate: string}} dateRange
 * @returns {{amount: number, topMerchants: Array}}
 */
export function getDiscretionarySpending(db, categoryId, dateRange) {
  // Get recurring entity IDs
  const recurring = getRecurringSpending(db, categoryId, dateRange);
  const recurringEntityIds = recurring.entities.map((e) => e.entityId);

  // Get all non-recurring transactions
  let query = `
    SELECT
      t.entity_id,
      e.canonical_name as name,
      SUM(ABS(t.amount)) as total,
      COUNT(*) as count
    FROM transactions t
    LEFT JOIN entities e ON t.entity_id = e.id
    WHERE t.category_id = ?
      AND t.date >= ?
      AND t.date <= ?
      AND t.type = 'expense'
  `;

  const params = [categoryId, dateRange.startDate, dateRange.endDate];

  if (recurringEntityIds.length > 0) {
    const placeholders = recurringEntityIds.map(() => '?').join(',');
    query += ` AND t.entity_id NOT IN (${placeholders})`;
    params.push(...recurringEntityIds);
  }

  query += ' GROUP BY t.entity_id ORDER BY total DESC';

  const merchants = db.prepare(query).all(...params);

  const totalDiscretionary = merchants.reduce((sum, m) => sum + m.total, 0);

  return {
    amount: totalDiscretionary,
    topMerchants: merchants.slice(0, 10).map((m) => ({
      entityId: m.entity_id,
      name: m.name || 'Unknown',
      amount: m.total,
      transactionCount: m.count,
    })),
  };
}

/**
 * Get complete spending breakdown
 *
 * @param {Database} db - Better-sqlite3 database
 * @param {string} categoryId - Category ID
 * @param {{startDate: string, endDate: string}} dateRange
 * @returns {{recurring: Object, discretionary: Object}}
 */
export function getSpendingBreakdown(db, categoryId, dateRange) {
  const recurring = getRecurringSpending(db, categoryId, dateRange);
  const discretionary = getDiscretionarySpending(db, categoryId, dateRange);

  const total = recurring.amount + discretionary.amount;

  return {
    recurring: {
      ...recurring,
      percentage: total > 0 ? (recurring.amount / total) * 100 : 0,
    },
    discretionary: {
      ...discretionary,
      percentage: total > 0 ? (discretionary.amount / total) * 100 : 0,
    },
  };
}

// Helper functions (from recurring-detection.js)

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

function determineFrequency(avgInterval) {
  if (avgInterval >= 6 && avgInterval <= 8) return 'weekly';
  if (avgInterval >= 28 && avgInterval <= 33) return 'monthly';
  if (avgInterval >= 360 && avgInterval <= 370) return 'yearly';
  return null;
}
```

---

## ✅ TO BE CONTINUED...

**Next sections to add**:
- Module 3: Budget Analysis Views (data source integration)
- Module 4: Tests
- Integration examples
- UI components (optional - depends on Badge structure)

**Status**: Core architecture designed, implementation in progress.
