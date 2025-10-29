# Phase 3: Reports & Export

**Análisis y exportación de datos**

---

## 🎯 Overview

Phase 3 agrega:
- Reports pre-built (6 reports visuales)
- Custom report builder
- Export a CSV, PDF, JSON
- Charts con Recharts

**LOC estimate**: ~800 LOC

---

## 📊 Pre-built Reports

### 1. Spending by Category (Pie Chart)

```javascript
// main/reports.js

async function getSpendingByCategory({ startDate, endDate, accountId }) {
  let query = `
    SELECT
      c.name as category,
      c.color,
      c.icon,
      SUM(ABS(t.amount)) as total,
      COUNT(t.id) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.type = 'expense'
    AND t.date >= ? AND t.date <= ?
  `;

  const params = [startDate, endDate];

  if (accountId && accountId !== 'all') {
    query += ' AND t.account_id = ?';
    params.push(accountId);
  }

  query += ' GROUP BY t.category_id ORDER BY total DESC';

  const results = await db.all(query, params);

  // Calculate percentages
  const totalSpent = results.reduce((sum, r) => sum + r.total, 0);

  return results.map(r => ({
    ...r,
    percentage: (r.total / totalSpent) * 100
  }));
}
```

**UI Component**:
```javascript
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

function SpendingByCategoryReport({ data }) {
  return (
    <div className="report">
      <h2>Spending by Category</h2>
      <PieChart width={600} height={400}>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label={({ category, percentage }) =>
            `${category}: ${percentage.toFixed(1)}%`
          }
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
        <Legend />
      </PieChart>

      <div className="category-list">
        {data.map(cat => (
          <div key={cat.category} className="category-row">
            <span className="icon">{cat.icon}</span>
            <span className="name">{cat.category}</span>
            <span className="amount">${cat.total.toFixed(2)}</span>
            <span className="count">({cat.count} transactions)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 2. Spending Trends (Line Chart)

```javascript
async function getSpendingTrends({ startDate, endDate, groupBy = 'month' }) {
  const query = `
    SELECT
      date,
      SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
    FROM transactions
    WHERE date >= ? AND date <= ?
    GROUP BY date
    ORDER BY date ASC
  `;

  const results = await db.all(query, [startDate, endDate]);

  // Group by month or week
  if (groupBy === 'month') {
    return groupByMonth(results);
  } else if (groupBy === 'week') {
    return groupByWeek(results);
  }

  return results;
}

function groupByMonth(data) {
  const grouped = {};

  data.forEach(row => {
    const month = row.date.substring(0, 7); // YYYY-MM
    if (!grouped[month]) {
      grouped[month] = { month, expenses: 0, income: 0 };
    }
    grouped[month].expenses += row.expenses;
    grouped[month].income += row.income;
  });

  return Object.values(grouped);
}
```

**UI Component**:
```javascript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function SpendingTrendsReport({ data }) {
  return (
    <div className="report">
      <h2>Spending Trends</h2>
      <LineChart width={800} height={400} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
        <Legend />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#FF6B6B"
          strokeWidth={2}
          name="Expenses"
        />
        <Line
          type="monotone"
          dataKey="income"
          stroke="#51CF66"
          strokeWidth={2}
          name="Income"
        />
      </LineChart>
    </div>
  );
}
```

---

### 3. Income vs Expenses (Bar Chart)

```javascript
async function getIncomeVsExpenses({ startDate, endDate }) {
  const query = `
    SELECT
      SUBSTR(date, 1, 7) as month,
      SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
    FROM transactions
    WHERE date >= ? AND date <= ?
    GROUP BY month
    ORDER BY month ASC
  `;

  const results = await db.all(query, [startDate, endDate]);

  return results.map(r => ({
    ...r,
    net: r.income - r.expenses,
    savingsRate: r.income > 0 ? ((r.income - r.expenses) / r.income) * 100 : 0
  }));
}
```

**UI Component**:
```javascript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function IncomeVsExpensesReport({ data }) {
  return (
    <div className="report">
      <h2>Income vs Expenses</h2>
      <BarChart width={800} height={400} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
        <Legend />
        <Bar dataKey="income" fill="#51CF66" name="Income" />
        <Bar dataKey="expenses" fill="#FF6B6B" name="Expenses" />
        <Bar dataKey="net" fill="#4ECDC4" name="Net" />
      </BarChart>

      <div className="summary-stats">
        {data.map(month => (
          <div key={month.month} className="month-summary">
            <div className="month">{month.month}</div>
            <div className="savings-rate">
              Savings Rate: {month.savingsRate.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Top Merchants (Table)

```javascript
async function getTopMerchants({ startDate, endDate, limit = 20 }) {
  const query = `
    SELECT
      merchant,
      COUNT(*) as count,
      SUM(ABS(amount)) as total,
      AVG(ABS(amount)) as avg,
      MIN(ABS(amount)) as min,
      MAX(ABS(amount)) as max,
      MIN(date) as first_date,
      MAX(date) as last_date
    FROM transactions
    WHERE type = 'expense'
    AND date >= ? AND date <= ?
    GROUP BY merchant
    ORDER BY total DESC
    LIMIT ?
  `;

  return await db.all(query, [startDate, endDate, limit]);
}
```

**UI Component**:
```javascript
function TopMerchantsReport({ data }) {
  return (
    <div className="report">
      <h2>Top Merchants</h2>
      <table className="merchants-table">
        <thead>
          <tr>
            <th>Merchant</th>
            <th>Total Spent</th>
            <th>Transactions</th>
            <th>Avg per Transaction</th>
            <th>First Purchase</th>
            <th>Last Purchase</th>
          </tr>
        </thead>
        <tbody>
          {data.map(merchant => (
            <tr key={merchant.merchant}>
              <td className="font-semibold">{merchant.merchant}</td>
              <td className="text-red-600">${merchant.total.toFixed(2)}</td>
              <td>{merchant.count}</td>
              <td>${merchant.avg.toFixed(2)}</td>
              <td>{formatDate(merchant.first_date)}</td>
              <td>{formatDate(merchant.last_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### 5. Budget Performance (Gauge Charts)

```javascript
async function getBudgetPerformance() {
  const budgets = await db.all('SELECT * FROM budgets WHERE is_active = TRUE');

  const results = [];

  for (const budget of budgets) {
    const status = await getBudgetStatus(budget.id); // From Phase 2
    results.push({
      name: budget.name,
      spent: status.spent,
      limit: status.limit,
      percentage: status.percentage,
      status: status.isOverBudget ? 'over' : status.shouldAlert ? 'warning' : 'good'
    });
  }

  return results;
}
```

**UI Component**:
```javascript
function BudgetPerformanceReport({ data }) {
  return (
    <div className="report">
      <h2>Budget Performance</h2>
      <div className="budget-grid">
        {data.map(budget => (
          <div key={budget.name} className="budget-card">
            <h3>{budget.name}</h3>
            <div className="gauge">
              <div
                className="gauge-fill"
                style={{
                  width: `${Math.min(100, budget.percentage)}%`,
                  backgroundColor: getGaugeColor(budget.status)
                }}
              />
            </div>
            <div className="budget-stats">
              <div className="spent">${budget.spent.toFixed(2)} spent</div>
              <div className="limit">of ${budget.limit.toFixed(2)}</div>
              <div className="percentage">{budget.percentage.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getGaugeColor(status) {
  switch (status) {
    case 'good': return '#51CF66';
    case 'warning': return '#FFD43B';
    case 'over': return '#FF6B6B';
  }
}
```

---

### 6. Monthly Comparison (Bar Chart)

```javascript
async function getMonthlyComparison({ year }) {
  const query = `
    SELECT
      CAST(SUBSTR(date, 6, 2) AS INTEGER) as month,
      SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions
    WHERE SUBSTR(date, 1, 4) = ?
    GROUP BY month
    ORDER BY month
  `;

  const currentYear = await db.all(query, [year]);

  // Compare with previous year
  const previousYear = await db.all(query, [year - 1]);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  return months.map((name, index) => {
    const current = currentYear.find(r => r.month === index + 1);
    const previous = previousYear.find(r => r.month === index + 1);

    return {
      month: name,
      currentYear: current ? current.expenses : 0,
      previousYear: previous ? previous.expenses : 0
    };
  });
}
```

---

## 🛠️ Custom Report Builder

### Report Configuration

```javascript
// Define report config structure
const reportConfig = {
  id: 'custom_report_1',
  name: 'My Custom Report',
  type: 'table', // table | chart
  chartType: 'bar', // bar | line | pie (if type=chart)

  // Data source
  dataSource: 'transactions',

  // Filters
  filters: {
    dateRange: { from: '2025-01-01', to: '2025-12-31' },
    accounts: ['bofa', 'apple-card'],
    categories: ['cat_food', 'cat_transport'],
    type: 'expense'
  },

  // Grouping
  groupBy: 'category', // category | merchant | account | month | week | day

  // Aggregations
  aggregations: [
    { field: 'amount', function: 'sum', label: 'Total' },
    { field: 'amount', function: 'avg', label: 'Average' },
    { field: 'id', function: 'count', label: 'Count' }
  ],

  // Sorting
  sortBy: 'total',
  sortOrder: 'desc',

  // Visualization
  xAxis: 'category',
  yAxis: 'total',
  colors: 'auto'
};
```

### Report Engine

```javascript
// main/report-engine.js

async function executeCustomReport(config) {
  let query = buildQuery(config);
  const results = await db.all(query.sql, query.params);

  // Post-process results
  const processed = processResults(results, config);

  return {
    config,
    data: processed,
    metadata: {
      generatedAt: new Date().toISOString(),
      rowCount: processed.length
    }
  };
}

function buildQuery(config) {
  let sql = 'SELECT ';
  const params = [];

  // Build SELECT clause with aggregations
  const selectFields = [];

  if (config.groupBy) {
    selectFields.push(`${config.groupBy}`);
  }

  config.aggregations.forEach(agg => {
    const func = agg.function.toUpperCase();
    selectFields.push(`${func}(${agg.field}) as ${agg.label.toLowerCase()}`);
  });

  sql += selectFields.join(', ');

  // FROM clause
  sql += ` FROM ${config.dataSource}`;

  // WHERE clause
  const whereClauses = [];

  if (config.filters.dateRange) {
    whereClauses.push('date >= ? AND date <= ?');
    params.push(config.filters.dateRange.from, config.filters.dateRange.to);
  }

  if (config.filters.accounts && config.filters.accounts.length > 0) {
    const placeholders = config.filters.accounts.map(() => '?').join(',');
    whereClauses.push(`account_id IN (${placeholders})`);
    params.push(...config.filters.accounts);
  }

  if (config.filters.categories && config.filters.categories.length > 0) {
    const placeholders = config.filters.categories.map(() => '?').join(',');
    whereClauses.push(`category_id IN (${placeholders})`);
    params.push(...config.filters.categories);
  }

  if (config.filters.type) {
    whereClauses.push('type = ?');
    params.push(config.filters.type);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  // GROUP BY clause
  if (config.groupBy) {
    sql += ` GROUP BY ${config.groupBy}`;
  }

  // ORDER BY clause
  if (config.sortBy) {
    sql += ` ORDER BY ${config.sortBy} ${config.sortOrder || 'DESC'}`;
  }

  return { sql, params };
}
```

---

## 📤 Export System

### CSV Export

```javascript
// main/export.js

async function exportToCSV(transactions, filename) {
  const headers = [
    'Date',
    'Merchant',
    'Amount',
    'Currency',
    'Type',
    'Account',
    'Category',
    'Tags',
    'Notes'
  ];

  const rows = transactions.map(txn => [
    txn.date,
    txn.merchant,
    txn.amount,
    txn.currency,
    txn.type,
    txn.account,
    txn.category || '',
    txn.tags ? JSON.parse(txn.tags).join(', ') : '',
    txn.notes || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Write to file
  const fs = require('fs');
  const path = require('path');
  const filepath = path.join(app.getPath('downloads'), filename);

  fs.writeFileSync(filepath, csv, 'utf-8');

  return filepath;
}
```

### PDF Export

```javascript
const PDFDocument = require('pdfkit');

async function exportToPDF(reportData, filename) {
  const doc = new PDFDocument();
  const filepath = path.join(app.getPath('downloads'), filename);

  doc.pipe(fs.createWriteStream(filepath));

  // Header
  doc.fontSize(20).text('Finance App Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);

  // Report name
  doc.fontSize(16).text(reportData.config.name);
  doc.moveDown();

  // Table
  const tableTop = doc.y;
  const colWidths = [150, 100, 100, 100];
  let y = tableTop;

  // Headers
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Category', 50, y, { width: colWidths[0] });
  doc.text('Total', 200, y, { width: colWidths[1] });
  doc.text('Count', 300, y, { width: colWidths[2] });
  doc.text('Average', 400, y, { width: colWidths[3] });

  y += 20;

  // Data rows
  doc.font('Helvetica');
  reportData.data.forEach(row => {
    doc.text(row.category || 'N/A', 50, y, { width: colWidths[0] });
    doc.text(`$${row.total.toFixed(2)}`, 200, y, { width: colWidths[1] });
    doc.text(row.count.toString(), 300, y, { width: colWidths[2] });
    doc.text(`$${row.average.toFixed(2)}`, 400, y, { width: colWidths[3] });

    y += 20;
  });

  doc.end();

  return filepath;
}
```

### JSON Export

```javascript
async function exportToJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const filepath = path.join(app.getPath('downloads'), filename);

  fs.writeFileSync(filepath, json, 'utf-8');

  return filepath;
}
```

---

## 📊 LOC Estimate

| Component | LOC |
|-----------|-----|
| 6 pre-built reports (queries) | ~200 |
| Report UI components | ~300 |
| Custom report builder | ~150 |
| Report engine | ~100 |
| Export (CSV, PDF, JSON) | ~150 |
| **Total** | **~900** |

*(Slightly over 800, but within acceptable range)*

---

**Próximo doc**: Lee [MULTI-USER.md](MULTI-USER.md)
