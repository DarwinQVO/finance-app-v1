# Phase 3: Reports System

**Date**: October 31, 2025
**Status**: COMPLETE ✅
**Goal**: Pre-built reports for common financial analysis

---

## 🎯 OBJECTIVE

**Implement pre-built report templates for retroactive financial analysis.**

### The Problem

Users need quick answers to common questions:
- "How much did I spend last month?"
- "What are my top 5 merchants this year?"
- "How much did I spend on dining vs groceries?"
- "Which expenses are recurring?"
- "Am I within budget?"

**Without reports:**
- Manual SQL queries every time
- No standardized format
- Can't compare periods easily
- Time-consuming analysis

### The Solution

**Pre-built Report Templates:**
```javascript
// Monthly spending summary
const report = getMonthlyReport(db, { year: 2024, month: 10 });
// → { month: '2024-10', totalSpent: 3500, byCategory: {...}, topMerchants: [...] }

// Yearly summary
const yearly = getYearlySummary(db, 2024);
// → { year: 2024, totalIncome: 80000, totalExpenses: 25000, netProfit: 55000 }

// Category breakdown
const categories = getCategoryBreakdown(db, { startDate: '2024-01-01', endDate: '2024-12-31' });
// → [{ category: 'Dining', total: 2400, percentage: 15.2 }, ...]
```

**Benefits:**
- ✅ Instant financial insights
- ✅ Standardized report format
- ✅ Easy period comparisons
- ✅ No SQL knowledge required

---

## 📊 REPORT TYPES

| Report | Purpose | Use Case |
|--------|---------|----------|
| **Monthly Report** | Spending by month | Track monthly burn rate |
| **Yearly Summary** | Annual income/expenses | Tax prep, year review |
| **Category Breakdown** | Spending by category | Budget analysis |
| **Merchant Analysis** | Top merchants | Find biggest expenses |
| **Recurring Expenses** | Recurring charges | Subscription audit |
| **Budget vs Actual** | Compare to budgets | Budget tracking |

---

## 🏗️ IMPLEMENTATION

### File: src/lib/reports.js

```javascript
/**
 * Reports System
 *
 * Pre-built report templates for financial analysis.
 * Designed for retroactive analysis workflow.
 *
 * Phase 3: Reports
 */

/**
 * Get monthly spending report
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {Object} options - Report options
 * @param {number} options.year - Year (e.g., 2024)
 * @param {number} options.month - Month (1-12)
 * @returns {Object} - Monthly report
 */
export function getMonthlyReport(db, { year, month }) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

  // Total spent
  const totalSpent = db.prepare(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'expense'
      AND date >= ?
      AND date <= ?
  `).get(startDate, endDate)?.total || 0;

  // Total income
  const totalIncome = db.prepare(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'income'
      AND date >= ?
      AND date <= ?
  `).get(startDate, endDate)?.total || 0;

  // By category
  const byCategory = db.prepare(`
    SELECT
      t.category_id,
      SUM(ABS(t.amount)) as total,
      COUNT(*) as count
    FROM transactions t
    WHERE t.type = 'expense'
      AND t.date >= ?
      AND t.date <= ?
    GROUP BY t.category_id
    ORDER BY total DESC
  `).all(startDate, endDate);

  // Top merchants
  const topMerchants = db.prepare(`
    SELECT
      merchant,
      SUM(ABS(amount)) as total,
      COUNT(*) as count
    FROM transactions
    WHERE type = 'expense'
      AND date >= ?
      AND date <= ?
    GROUP BY merchant
    ORDER BY total DESC
    LIMIT 10
  `).all(startDate, endDate);

  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    startDate,
    endDate,
    totalIncome,
    totalSpent,
    netIncome: totalIncome - totalSpent,
    byCategory,
    topMerchants,
    transactionCount: db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE date >= ? AND date <= ?
    `).get(startDate, endDate)?.count || 0
  };
}

/**
 * Get yearly summary report
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {number} year - Year (e.g., 2024)
 * @returns {Object} - Yearly summary
 */
export function getYearlySummary(db, year) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Total income
  const totalIncome = db.prepare(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'income'
      AND date >= ?
      AND date <= ?
  `).get(startDate, endDate)?.total || 0;

  // Total expenses
  const totalExpenses = db.prepare(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'expense'
      AND date >= ?
      AND date <= ?
  `).get(startDate, endDate)?.total || 0;

  // Net profit
  const netProfit = totalIncome - totalExpenses;

  // By month
  const byMonth = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income' THEN ABS(amount) ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions
    WHERE date >= ? AND date <= ?
    GROUP BY month
    ORDER BY month ASC
  `).all(startDate, endDate);

  // Average monthly spending
  const avgMonthlySpending = totalExpenses / 12;

  return {
    year,
    startDate,
    endDate,
    totalIncome,
    totalExpenses,
    netProfit,
    avgMonthlySpending,
    byMonth
  };
}

/**
 * Get category breakdown report
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {Object} options - Report options
 * @param {string} options.startDate - Start date (ISO)
 * @param {string} options.endDate - End date (ISO)
 * @returns {Array<Object>} - Category breakdown
 */
export function getCategoryBreakdown(db, { startDate, endDate }) {
  const total = db.prepare(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE type = 'expense'
      AND date >= ?
      AND date <= ?
  `).get(startDate, endDate)?.total || 0;

  const categories = db.prepare(`
    SELECT
      t.category_id,
      SUM(ABS(t.amount)) as total,
      COUNT(*) as count
    FROM transactions t
    WHERE t.type = 'expense'
      AND t.date >= ?
      AND t.date <= ?
    GROUP BY t.category_id
    ORDER BY total DESC
  `).all(startDate, endDate);

  return categories.map(cat => ({
    ...cat,
    percentage: total > 0 ? ((cat.total / total) * 100).toFixed(1) : 0
  }));
}

/**
 * Get merchant analysis report
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {Object} options - Report options
 * @param {string} options.startDate - Start date (ISO)
 * @param {string} options.endDate - End date (ISO)
 * @param {number} options.limit - Number of top merchants (default: 10)
 * @returns {Array<Object>} - Top merchants
 */
export function getMerchantAnalysis(db, { startDate, endDate, limit = 10 }) {
  return db.prepare(`
    SELECT
      merchant,
      SUM(ABS(amount)) as totalSpent,
      COUNT(*) as transactionCount,
      AVG(ABS(amount)) as avgTransaction,
      MIN(date) as firstSeen,
      MAX(date) as lastSeen
    FROM transactions
    WHERE type = 'expense'
      AND date >= ?
      AND date <= ?
    GROUP BY merchant
    ORDER BY totalSpent DESC
    LIMIT ?
  `).all(startDate, endDate, limit);
}

/**
 * Get recurring expenses report
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {Array<Object>} - Recurring expenses
 */
export function getRecurringExpenses(db) {
  return db.prepare(`
    SELECT
      t.recurring_group_id,
      t.merchant,
      t.recurring_frequency,
      AVG(ABS(t.amount)) as avgAmount,
      COUNT(*) as occurrences,
      MIN(t.date) as firstDate,
      MAX(t.date) as lastDate
    FROM transactions t
    WHERE t.is_recurring = 1
      AND t.type = 'expense'
    GROUP BY t.recurring_group_id
    ORDER BY avgAmount DESC
  `).all();
}

/**
 * Get budget vs actual report
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {Object} options - Report options
 * @param {string} options.startDate - Start date (ISO)
 * @param {string} options.endDate - End date (ISO)
 * @returns {Array<Object>} - Budget comparison
 */
export function getBudgetVsActual(db, { startDate, endDate }) {
  // Get all budgets that overlap with period
  const budgets = db.prepare(`
    SELECT *
    FROM budgets
    WHERE start_date <= ?
      AND end_date >= ?
      AND is_active = 1
  `).all(endDate, startDate);

  return budgets.map(budget => {
    // Get actual spending for this budget's category
    const actual = db.prepare(`
      SELECT SUM(ABS(amount)) as total
      FROM transactions
      WHERE type = 'expense'
        AND category_id = ?
        AND date >= ?
        AND date <= ?
    `).get(budget.category_id, startDate, endDate)?.total || 0;

    const difference = budget.amount - actual;
    const percentage = budget.amount > 0 ? ((actual / budget.amount) * 100).toFixed(1) : 0;
    const status = actual > budget.amount ? 'over' : actual > budget.amount * 0.9 ? 'warning' : 'ok';

    return {
      budget_id: budget.id,
      category_id: budget.category_id,
      budget_name: budget.name,
      budget_amount: budget.amount,
      actual_amount: actual,
      difference,
      percentage,
      status
    };
  });
}
```

---

## 🧪 TESTS

### File: tests/reports.test.js

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import {
  getMonthlyReport,
  getYearlySummary,
  getCategoryBreakdown,
  getMerchantAnalysis,
  getRecurringExpenses,
  getBudgetVsActual
} from '../src/lib/reports.js';

describe('Reports System (Phase 3)', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    const phase1Schema = readFileSync('src/db/schema.sql', 'utf8');
    db.exec(phase1Schema);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, currency, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', 'USD', 1, now, now);
  });

  afterEach(() => {
    db.close();
  });

  test('getMonthlyReport calculates totals correctly', () => {
    const now = new Date().toISOString();

    // January 2024 transactions
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-01-15', 'AWS', 'AWS', -100, 'USD', 'expense', 'manual', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-2', 'acc-1', '2024-01-20', 'CLIENT', 'Client', 5000, 'USD', 'income', 'manual', now, now);

    const report = getMonthlyReport(db, { year: 2024, month: 1 });

    expect(report.period).toBe('2024-01');
    expect(report.totalSpent).toBe(100);
    expect(report.totalIncome).toBe(5000);
    expect(report.netIncome).toBe(4900);
  });

  test('getYearlySummary aggregates by month', () => {
    const now = new Date().toISOString();

    // Add transactions in different months
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-01-15', 'AWS', 'AWS', -100, 'USD', 'expense', 'manual', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-2', 'acc-1', '2024-02-20', 'LAWYER', 'Lawyer', -200, 'USD', 'expense', 'manual', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-3', 'acc-1', '2024-06-15', 'CLIENT', 'Client', 10000, 'USD', 'income', 'manual', now, now);

    const report = getYearlySummary(db, 2024);

    expect(report.year).toBe(2024);
    expect(report.totalIncome).toBe(10000);
    expect(report.totalExpenses).toBe(300);
    expect(report.netProfit).toBe(9700);
    expect(report.byMonth.length).toBeGreaterThan(0);
  });

  test('getCategoryBreakdown calculates percentages', () => {
    const now = new Date().toISOString();

    // Add transactions with categories
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-01-15', 'AWS', 'AWS', -100, 'USD', 'expense', 'manual', 'cat_tech', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-2', 'acc-1', '2024-01-20', 'RESTAURANT', 'Restaurant', -50, 'USD', 'expense', 'manual', 'cat_dining', now, now);

    const breakdown = getCategoryBreakdown(db, {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    });

    expect(breakdown.length).toBe(2);
    expect(breakdown[0].total).toBe(100);
    expect(breakdown[0].percentage).toBe('66.7'); // 100/150
  });

  test('getMerchantAnalysis returns top merchants', () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-01-15', 'AWS', 'AWS', -500, 'USD', 'expense', 'manual', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-2', 'acc-1', '2024-02-20', 'AWS', 'AWS', -300, 'USD', 'expense', 'manual', now, now);

    const merchants = getMerchantAnalysis(db, {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      limit: 10
    });

    expect(merchants[0].merchant).toBe('AWS');
    expect(merchants[0].totalSpent).toBe(800);
    expect(merchants[0].transactionCount).toBe(2);
  });

  test('getRecurringExpenses filters recurring only', () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, is_recurring, recurring_group_id, recurring_frequency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-01-15', 'NETFLIX', 'Netflix', -15, 'USD', 'expense', 'manual', 1, 'rec-netflix', 'monthly', now, now);

    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, is_recurring, recurring_group_id, recurring_frequency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-2', 'acc-1', '2024-02-15', 'NETFLIX', 'Netflix', -15, 'USD', 'expense', 'manual', 1, 'rec-netflix', 'monthly', now, now);

    const recurring = getRecurringExpenses(db);

    expect(recurring.length).toBe(1);
    expect(recurring[0].merchant).toBe('Netflix');
    expect(recurring[0].occurrences).toBe(2);
  });

  test('getBudgetVsActual compares budget to actual', () => {
    const now = new Date().toISOString();

    // Create budget
    db.prepare(`
      INSERT INTO budgets (id, name, category_id, amount, start_date, end_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('budget-1', 'Tech Budget', 'cat_tech', 500, '2024-01-01', '2024-12-31', 1, now, now);

    // Add spending
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-01-15', 'AWS', 'AWS', -300, 'USD', 'expense', 'manual', 'cat_tech', now, now);

    const comparison = getBudgetVsActual(db, {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    });

    expect(comparison[0].budget_amount).toBe(500);
    expect(comparison[0].actual_amount).toBe(300);
    expect(comparison[0].difference).toBe(200);
    expect(comparison[0].status).toBe('ok');
  });
});
```

---

## ✅ VERIFICATION CHECKLIST

- [x] getMonthlyReport() implemented
- [x] getYearlySummary() implemented
- [x] getCategoryBreakdown() implemented
- [x] getMerchantAnalysis() implemented
- [x] getRecurringExpenses() implemented
- [x] getBudgetVsActual() implemented
- [x] All 6 tests passing (283 total tests)
- [x] No breaking changes

---

## 📊 FINAL STATS

**Files Created:**
- `src/lib/reports.js` - 292 lines
- `tests/reports.test.js` - 191 lines
- Total: 483 lines of code

**Functions:**
- `getMonthlyReport()` - Monthly spending summary with top merchants
- `getYearlySummary()` - Annual income/expenses with monthly breakdown
- `getCategoryBreakdown()` - Spending by category with percentages
- `getMerchantAnalysis()` - Top merchants by total spent
- `getRecurringExpenses()` - All recurring charges grouped by recurring_group_id
- `getBudgetVsActual()` - Budget vs actual spending with status (ok/warning/over)

**Tests:**
- 6 tests created, all passing ✅
- Total project tests: 283 passing

**Quality:**
- ✅ JSDoc type annotations
- ✅ English comments
- ✅ Pure functions (dependency injection)
- ✅ No breaking changes
- ✅ Follows Badge 12 modular architecture

---

## 🚀 NEXT STEPS

After Reports:
- Chart Data Aggregation (for Recharts integration)
- System Health Dashboard

---

**Phase 3: Reports System - COMPLETE** ✅
