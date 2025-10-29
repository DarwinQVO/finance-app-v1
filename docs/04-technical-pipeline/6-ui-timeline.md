# UI: Timeline

**La vista principal de Finance App**

## Overview

El timeline es una lista cronológica de transacciones. Simple, limpio, rápido.

```
┌──────────────────────────────────────────────────┐
│  Finance App              [Upload] [Filter] [⚙️]  │
├──────────────────────────────────────────────────┤
│  Filters: [All accounts] [Last 3 months]         │
├──────────────────────────────────────────────────┤
│                                                  │
│  Sep 28, 2025                                    │
│    🏪 Starbucks              -$5.67  USD  [BofA] │
│    🛒 Target                 -$42.30 USD  [BofA] │
│                                                  │
│  Sep 27, 2025                                    │
│    📦 Amazon                 -$89.99 USD  [Apple]│
│    💰 Salary                +$3,500.00 USD [BofA]│
│                                                  │
│  Sep 26, 2025                                    │
│    ↔️ Transfer: BofA → Wise  -$1,000.00 USD [BofA]│
│                             +$1,000.00 USD [Wise]│
│                                                  │
│  127 transactions • $2,456.78 spent              │
└──────────────────────────────────────────────────┘
```

---

## Component structure

```
Timeline
├── TimelineHeader (Upload + Filters + Settings)
├── TimelineFilters (Account + Date + Type)
├── TimelineList (Grouped by date)
│   ├── DateGroup (Sep 28, 2025)
│   │   ├── TransactionRow
│   │   ├── TransactionRow
│   │   └── TransactionRow
│   ├── DateGroup (Sep 27, 2025)
│   └── ...
└── TimelineSummary (Count + totals)
```

---

## Code: Timeline component

```javascript
// renderer/components/Timeline.jsx

import React, { useState, useEffect } from 'react';
import TransactionRow from './TransactionRow';
import TimelineFilters from './TimelineFilters';

function Timeline() {
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({
    account: 'all',
    dateRange: 'last-3-months',
    type: 'all'
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const fetchTransactions = async () => {
    const txns = await window.electron.getTransactions(filters);
    setTransactions(txns);
  };

  // Group by date
  const grouped = groupByDate(transactions);

  return (
    <div className="timeline">
      <TimelineHeader />
      <TimelineFilters filters={filters} onChange={setFilters} />

      <div className="timeline-list">
        {Object.entries(grouped).map(([date, txns]) => (
          <DateGroup key={date} date={date} transactions={txns} />
        ))}
      </div>

      <TimelineSummary transactions={transactions} />
    </div>
  );
}

function groupByDate(transactions) {
  return transactions.reduce((acc, txn) => {
    const date = txn.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(txn);
    return acc;
  }, {});
}

function DateGroup({ date, transactions }) {
  return (
    <div className="date-group">
      <div className="date-header">{formatDate(date)}</div>
      {transactions.map(txn => (
        <TransactionRow key={txn.id} transaction={txn} />
      ))}
    </div>
  );
}

export default Timeline;
```

---

## TransactionRow

```javascript
// renderer/components/TransactionRow.jsx

function TransactionRow({ transaction }) {
  const { merchant, amount, currency, account, type, transfer_pair_id } = transaction;

  const icon = getIcon(merchant, type);
  const color = amount < 0 ? 'text-red-600' : 'text-green-600';

  const handleClick = () => {
    // Abrir panel de detalles
    window.electron.openTransactionDetail(transaction.id);
  };

  return (
    <div
      className="transaction-row cursor-pointer hover:bg-gray-50"
      onClick={handleClick}
    >
      <span className="icon">{icon}</span>
      <span className="merchant">{merchant}</span>
      <span className={`amount ${color}`}>
        {formatAmount(amount, currency)}
      </span>
      <span className="account-badge">[{account}]</span>
      {transfer_pair_id && <span className="link-icon">⛓️</span>}
    </div>
  );
}

function getIcon(merchant, type) {
  if (type === 'transfer') return '↔️';

  // Map common merchants to icons
  const iconMap = {
    'Starbucks': '☕',
    'Amazon': '📦',
    'Netflix': '🎬',
    'Uber': '🚗',
    'Target': '🛒',
    'Costco': '🛒',
    'Shell': '⛽',
    // ... más
  };

  return iconMap[merchant] || '💳';
}

function formatAmount(amount, currency) {
  const symbols = { USD: '$', MXN: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;

  const formatted = Math.abs(amount).toFixed(2);
  const sign = amount < 0 ? '-' : '+';

  return `${sign}${symbol}${formatted}`;
}
```

---

## Infinite scroll

Para 12k transactions, no podemos cargar todas a la vez.

```javascript
// renderer/components/Timeline.jsx

function Timeline() {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = async () => {
    const limit = 100; // 100 transacciones por página
    const offset = (page - 1) * limit;

    const txns = await window.electron.getTransactions({
      ...filters,
      limit,
      offset
    });

    if (txns.length < limit) {
      setHasMore(false);
    }

    setTransactions(prev => [...prev, ...txns]);
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    if (bottom && hasMore) {
      setPage(p => p + 1);
    }
  };

  return (
    <div className="timeline" onScroll={handleScroll}>
      {/* ... */}
    </div>
  );
}
```

**Resultado**: Carga inicial rápida (~100 txns), scroll para cargar más.

---

## TimelineSummary

```javascript
function TimelineSummary({ transactions }) {
  const count = transactions.length;
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="timeline-summary">
      <span>{count} transactions</span>
      <span>•</span>
      <span className="text-red-600">${expenses.toFixed(2)} spent</span>
      <span>•</span>
      <span className="text-green-600">${income.toFixed(2)} income</span>
    </div>
  );
}
```

---

## Styling con Tailwind

```css
/* renderer/styles/timeline.css */

.timeline {
  @apply flex flex-col h-screen bg-gray-50;
}

.timeline-list {
  @apply flex-1 overflow-y-auto px-4 py-2;
}

.date-group {
  @apply mb-4;
}

.date-header {
  @apply text-sm font-semibold text-gray-600 mb-2;
}

.transaction-row {
  @apply flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm mb-2;
  @apply transition-all duration-200;
}

.transaction-row:hover {
  @apply bg-gray-50 shadow-md;
}

.icon {
  @apply text-2xl;
}

.merchant {
  @apply flex-1 font-medium text-gray-800;
}

.amount {
  @apply font-mono font-semibold;
}

.account-badge {
  @apply text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded;
}

.link-icon {
  @apply text-blue-500;
}

.timeline-summary {
  @apply flex items-center justify-center gap-2 p-4 bg-white border-t;
  @apply text-sm text-gray-600;
}
```

---

## Query backend

```javascript
// main/queries.js

function getTransactions({ account, dateRange, type, limit, offset }) {
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];

  // Filter by account
  if (account && account !== 'all') {
    query += ' AND account = ?';
    params.push(account);
  }

  // Filter by date range
  if (dateRange) {
    const { from, to } = parseDateRange(dateRange);
    query += ' AND date >= ? AND date <= ?';
    params.push(from, to);
  }

  // Filter by type
  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }

  // Sort by date descending
  query += ' ORDER BY date DESC, created_at DESC';

  // Pagination
  if (limit) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset || 0);
  }

  return db.query(query, params);
}

function parseDateRange(range) {
  const now = new Date();

  switch (range) {
    case 'last-7-days':
      return {
        from: formatDate(addDays(now, -7)),
        to: formatDate(now)
      };
    case 'last-30-days':
      return {
        from: formatDate(addDays(now, -30)),
        to: formatDate(now)
      };
    case 'last-3-months':
      return {
        from: formatDate(addMonths(now, -3)),
        to: formatDate(now)
      };
    case 'this-year':
      return {
        from: `${now.getFullYear()}-01-01`,
        to: formatDate(now)
      };
    default:
      return { from: '1970-01-01', to: '2099-12-31' };
  }
}
```

---

## Multi-Currency Display

### Scenario: Mixed USD/MXN transactions

Darwin tiene cuentas en USA (USD) y México (MXN). El timeline muestra ambas:

```
┌──────────────────────────────────────────────────┐
│  Sep 28, 2025                                    │
│    🏪 Starbucks              -$5.67  USD  [BofA] │
│    🛒 Oxxo                   -$120   MXN  [Scotia]│
│                                                  │
│  Sep 27, 2025                                    │
│    📦 Amazon                 -$89.99 USD  [BofA] │
│    🍔 Tacos El Güero         -$250   MXN  [Scotia]│
│    💰 Salary                +$3,500  USD  [BofA] │
│                                                  │
│  127 transactions                                │
│  USD: $2,456.78 spent • $3,500 income            │
│  MXN: $4,500 spent • $0 income                   │
└──────────────────────────────────────────────────┘
```

**Key Points**:
- Each transaction shows its currency
- Totals are **separated by currency** (no auto-conversion)
- Visual clarity: amount + currency always together

---

### Currency Formatting

```javascript
// renderer/utils/formatCurrency.js

function formatCurrency(amount, currency) {
  const absAmount = Math.abs(amount);

  const formats = {
    'USD': { symbol: '$', decimals: 2 },
    'MXN': { symbol: '$', decimals: 2 },
    'EUR': { symbol: '€', decimals: 2 },
    'GBP': { symbol: '£', decimals: 2 },
    'CAD': { symbol: 'CA$', decimals: 2 }
  };

  const format = formats[currency] || { symbol: currency, decimals: 2 };

  // Format number
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals
  });

  // Add sign
  const sign = amount < 0 ? '-' : '+';

  return `${sign}${format.symbol}${formatted}`;
}

// Examples:
formatCurrency(-5.67, 'USD')  // "-$5.67"
formatCurrency(-120, 'MXN')   // "-$120.00"
formatCurrency(3500, 'USD')   // "+$3,500.00"
```

**Always append currency code** to avoid confusion:
```javascript
// Good
<span>{formatCurrency(amount, currency)} {currency}</span>
// Result: "-$120.00 MXN"

// Bad
<span>{formatCurrency(amount, currency)}</span>
// Result: "-$120.00" (ambiguous - USD or MXN?)
```

---

### Totals: Separated by Currency

```javascript
// renderer/components/TimelineSummary.jsx

function TimelineSummary({ transactions }) {
  // Group by currency
  const byCurrency = transactions.reduce((acc, txn) => {
    if (!acc[txn.currency]) {
      acc[txn.currency] = { spent: 0, income: 0, count: 0 };
    }

    if (txn.amount < 0) {
      acc[txn.currency].spent += Math.abs(txn.amount);
    } else {
      acc[txn.currency].income += txn.amount;
    }

    acc[txn.currency].count++;
    return acc;
  }, {});

  return (
    <div className="timeline-summary">
      <div className="total-transactions">
        {transactions.length} transactions
      </div>

      {Object.entries(byCurrency).map(([currency, totals]) => (
        <div key={currency} className="currency-total">
          <strong>{currency}:</strong>
          {formatCurrency(-totals.spent, currency)} {currency} spent •
          {formatCurrency(totals.income, currency)} {currency} income
        </div>
      ))}
    </div>
  );
}
```

**Output**:
```
127 transactions
USD: -$2,456.78 USD spent • +$3,500.00 USD income
MXN: -$4,500.00 MXN spent • +$0.00 MXN income
```

---

### Transfer Between Different Currencies

**Scenario**: Darwin transfiere USD → MXN (e.g., Wise)

```
┌──────────────────────────────────────────────────┐
│  Sep 26, 2025                                    │
│    ↔️ Transfer: Wise → Scotia                    │
│       -$1,000.00 USD [Wise]                      │
│       +$18,500.00 MXN [Scotia]                   │
│       (Rate: 18.5 MXN/USD)                       │
└──────────────────────────────────────────────────┘
```

**Transfer Linking**: Detecta transfer incluso con different currencies usando:
- Same date (±3 days)
- Exchange rate within 5% of market rate
- Transfer keywords in description

```javascript
// main/pipeline/transfer-linking.js

async function linkCrossCurrencyTransfers(transactions) {
  const transfers = transactions.filter(t => t.type === 'transfer');

  for (const debit of transfers.filter(t => t.amount < 0)) {
    for (const credit of transfers.filter(t => t.amount > 0)) {
      // Skip if same currency (already handled)
      if (debit.currency === credit.currency) continue;

      // Check date window
      const daysDiff = Math.abs(daysBetween(debit.date, credit.date));
      if (daysDiff > 3) continue;

      // Calculate implied exchange rate
      const impliedRate = Math.abs(credit.amount / debit.amount);

      // Get market rate (from API or config)
      const marketRate = await getExchangeRate(debit.currency, credit.currency, debit.date);

      // Check if within 5% tolerance
      const tolerance = 0.05;
      const diff = Math.abs(impliedRate - marketRate) / marketRate;

      if (diff <= tolerance) {
        // Link transfer pair
        await linkTransferPair(debit.id, credit.id, {
          exchange_rate: impliedRate,
          market_rate: marketRate
        });
      }
    }
  }
}
```

**Database**: Store exchange rate in transfer pair

```sql
UPDATE transactions
SET
  transfer_pair_id = ?,
  transfer_exchange_rate = ?  -- New field
WHERE id IN (?, ?);
```

---

### Exchange Rate Source

**Phase 1**: Manual config (no API)

```javascript
// config/exchange-rates.json
{
  "2025-09-26": {
    "USD_MXN": 18.50,
    "USD_EUR": 0.92,
    "USD_GBP": 0.79
  }
}
```

**Phase 2+**: Use API (exchangerate-api.com, fixer.io, etc)

```javascript
async function getExchangeRate(from, to, date) {
  // Try API first
  try {
    const response = await fetch(`https://api.exchangerate.com/v4/${date}?base=${from}`);
    const data = await response.json();
    return data.rates[to];
  } catch (err) {
    // Fallback to config
    return getConfiguredRate(from, to, date);
  }
}
```

---

### Filter by Currency

Add currency filter to timeline:

```javascript
// renderer/components/TimelineFilters.jsx

<select
  value={filters.currency}
  onChange={(e) => onChange({ ...filters, currency: e.target.value })}
>
  <option value="all">All currencies</option>
  <option value="USD">USD only</option>
  <option value="MXN">MXN only</option>
  <option value="EUR">EUR only</option>
</select>
```

**SQL**:
```sql
SELECT * FROM transactions
WHERE currency = 'USD'  -- If filtered
ORDER BY date DESC;
```

---

### Currency Conversion (Phase 2)

**Feature**: Show converted amounts in user's preferred currency

```
┌──────────────────────────────────────────────────┐
│  Sep 28, 2025                                    │
│    🏪 Starbucks              -$5.67  USD         │
│    🛒 Oxxo                   -$120   MXN         │
│                               (≈ $6.49 USD)      │  ← Converted
│                                                  │
│  Totals (USD equivalent):                        │
│  $2,456.78 spent • $3,500 income                │
└──────────────────────────────────────────────────┘
```

**Not Phase 1** - Too complex for MVP.

---

## LOC estimate

- `Timeline.jsx`: ~80 LOC
- `TransactionRow.jsx`: ~50 LOC
- `TimelineSummary.jsx`: ~30 LOC
- `queries.js`: ~60 LOC
- CSS: ~50 LOC

**Total**: ~270 LOC

---

**Próximo doc**: Lee [7-ui-filters.md](7-ui-filters.md)
