# Flow 19: Credit Card Balance Dashboard 💳

**Phase**: 2 (Organization)
**Priority**: Medium
**Complexity**: Medium
**Related Flows**: flow-1, flow-3, flow-10

---

## 1. Funcionalidad

Dashboard consolidado de credit cards con balances, due dates, y utilization tracking.

**Features principales**:
1. **Balance tracking** - Balance actual calculado desde transacciones
2. **Statement cycle tracking** - Current cycle vs previous cycle spending
3. **Payment due dates** - Visual calendar con próximos payments
4. **Credit utilization %** - Por tarjeta y total
5. **Payment history** - Track de payments realizados
6. **Alerts** - Notificaciones 3 días antes de due date

**Caso de uso**: Usuario con 3 tarjetas ve todo en un dashboard sin abrir 3 apps bancarias.

---

## 2. Implementación

**Solución**: **Credit Card Balance Dashboard** - Vista consolidada de todas las tarjetas con balances, due dates, y utilization.

**Características clave**:
1. **Current balance** por cada tarjeta (calculado desde transacciones)
2. **Statement cycle tracking** - Current cycle vs previous cycle spending
3. **Payment due dates** - Visual calendar con próximos payments
4. **Credit utilization %** - Por tarjeta y total
5. **Payment history** - Track de payments realizados
6. **Alerts** - Notificaciones cuando payment due está cerca (3 días antes)

**UX Goal**: Ver estado de todas las credit cards en < 5 segundos, sin abrir apps bancarias.

---

## 3. User Story: el usuario revisa balances antes del cycle close

### Context
Hoy es October 27, 2025. Citi Double Cash cierra mañana (28th). el usuario quiere saber cuánto gastó este mes para planificar su payment.

### Narrative

**5:00 PM - el usuario abre Finance App**

el usuario navega a **Credit Cards** view desde sidebar.

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├───────┬─────────────────────────────────────────┤
│ 📊    │                                         │
│ Views │  💳 Credit Card Balances                │
│       │                                         │
│ 📅 Tm │  Total Balance: $3,847.32               │
│ 💳 CC │  Total Credit Limit: $25,000            │
│ 📈 Rp │  Overall Utilization: 15.4%   ✅ Good   │
│ 💰 Bg │                                         │
│       │  Next Payment Due: Oct 28 (Tomorrow!)  │
│ 🔖    │  Amount: $1,247.82                      │
│ Saved │                                         │
│       │  ┌───────────────────────────────────┐ │
│ ⚙️     │  │ 💳 Chase Freedom                 │ │
│ Settg │  │ Balance: $842.50 / $5,000        │ │
│       │  │ Utilization: 16.9% ✅             │ │
│       │  │                                   │ │
│       │  │ Current Cycle (Oct 15 - Nov 14): │ │
│       │  │ $842.50 (34 transactions)        │ │
│       │  │                                   │ │
│       │  │ Payment Due: Nov 15 (19 days)    │ │
│       │  │ Minimum: $25  Statement: $842.50 │ │
│       │  │                   [Pay Now] [••• ]│ │
│       │  └───────────────────────────────────┘ │
│       │                                         │
│       │  ┌───────────────────────────────────┐ │
│       │  │ 💳 Citi Double Cash              │ │
│       │  │ Balance: $1,247.82 / $10,000     │ │
│       │  │ Utilization: 12.5% ✅             │ │
│       │  │                                   │ │
│       │  │ Current Cycle (Sep 28 - Oct 28): │ │ <- Closes tomorrow!
│       │  │ $1,247.82 (52 transactions)      │ │
│       │  │ ⚠️  Cycle closes tomorrow!         │ │
│       │  │                                   │ │
│       │  │ Payment Due: Nov 20 (24 days)    │ │
│       │  │ Minimum: $25  Statement: TBD     │ │
│       │  │                   [Pay Now] [••• ]│ │
│       │  └───────────────────────────────────┘ │
│       │                                         │
│       │  ┌───────────────────────────────────┐ │
│       │  │ 💳 Amex Blue Cash                │ │
│       │  │ Balance: $1,757.00 / $10,000     │ │
│       │  │ Utilization: 17.6% ✅             │ │
│       │  │                                   │ │
│       │  │ Current Cycle (Oct 1 - Oct 31):  │ │
│       │  │ $1,757.00 (47 transactions)      │ │
│       │  │                                   │ │
│       │  │ Payment Due: Nov 25 (29 days)    │ │
│       │  │ Minimum: $35  Statement: TBD     │ │
│       │  │                   [Pay Now] [••• ]│ │
│       │  └───────────────────────────────────┘ │
└───────┴─────────────────────────────────────────┘
```

**el usuario ve inmediatamente**:
- Citi Double Cash cierra mañana ⚠️
- Current cycle spent: $1,247.82
- Payment due: Nov 20 (24 days away)

**Action**: el usuario click en Citi Double Cash card para ver más detalles.

**Expanded Card View**

```
┌─────────────────────────────────────────────────┐
│  💳 Citi Double Cash                       [×]  │
│  ─────────────────────────────────────────────── │
│                                                 │
│  Current Balance: $1,247.82                     │
│  Credit Limit: $10,000                          │
│  Available Credit: $8,752.18                    │
│  Utilization: 12.5% ✅ Excellent                 │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Statement Cycle (Sep 28 - Oct 28)      │   │
│  │ ⚠️  Closes tomorrow (Oct 28)            │   │
│  │                                         │   │
│  │ Spending this cycle: $1,247.82         │   │
│  │ ┌─────────────────────────────────────┐│   │
│  │ │████████████████░░░░░░░░░ 62%        ││   │ <- vs avg monthly spend
│  │ └─────────────────────────────────────┘│   │
│  │ Avg monthly spend: $2,000              │   │
│  │                                         │   │
│  │ Transactions: 52                       │   │
│  │ Largest: $187.45 (Costco, Oct 15)     │   │
│  │                                         │   │
│  │ [View All Transactions This Cycle]     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Previous Cycle (Aug 28 - Sep 27)       │   │
│  │ Spending: $1,987.45                    │   │
│  │ Payment: $1,987.45 (Paid Oct 18) ✅    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Next Payment                            │   │
│  │ Due: Nov 20, 2025 (24 days)            │   │
│  │ Minimum Payment: $25                    │   │
│  │ Statement Balance: TBD (after Oct 28)  │   │
│  │                                         │   │
│  │ 💡 Tip: Pay full balance to avoid      │   │
│  │    interest ($1,247.82)                │   │
│  │                                         │   │
│  │ [Schedule Payment]  [Mark as Paid]     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Payment History (Last 6 months)        │   │
│  │ Sep: $1,987.45 ✅ • Aug: $2,145.00 ✅  │   │
│  │ Jul: $1,756.20 ✅ • Jun: $2,012.35 ✅  │   │
│  │ May: $1,890.00 ✅ • Apr: $2,234.50 ✅  │   │
│  │ All on-time! Great job! 🎉             │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                                  [Close]        │
└─────────────────────────────────────────────────┘
```

**el usuario observa**:
- Este cycle ($1,247.82) es menos que su average ($2,000) ✅
- Previous cycle ($1,987.45) ya fue pagado on-time ✅
- Next payment due en 24 días, tiene tiempo para planificar

**Result**: el usuario tiene claridad completa sobre sus credit card finances. No necesita abrir 3 banking apps.

---

## 4. UI Mockups

### 4.1 Credit Card Dashboard (Main View)

```
┌─────────────────────────────────────────────────┐
│  💳 Credit Card Balances            [+ Add Card]│
├─────────────────────────────────────────────────┤
│                                                 │
│  Summary                                        │
│  ┌─────────────────────────────────────────────┐│
│  │ Total Balance:        $3,847.32            ││
│  │ Total Credit Limit:   $25,000              ││
│  │ Total Available:      $21,152.68           ││
│  │ Overall Utilization:  15.4%  ✅ Good        ││
│  │                                             ││
│  │ Next Payment: Nov 15 (19 days)             ││
│  │ Amount Due: $842.50                        ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Your Cards (3)                                 │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 💳 Chase Freedom                      [⋮] │ │
│  │                                           │ │
│  │ $842.50 / $5,000                          │ │
│  │ ┌─────────────────────┐                   │ │
│  │ │████████████████░░░░░│ 16.9% ✅          │ │
│  │ └─────────────────────┘                   │ │
│  │                                           │ │
│  │ Current Cycle: Oct 15 - Nov 14           │ │
│  │ 34 transactions • $842.50                │ │
│  │                                           │ │
│  │ Payment Due: Nov 15 (19 days)            │ │
│  │ Minimum: $25 • Statement: $842.50        │ │
│  │                                           │ │
│  │              [Pay Now]  [View Details]   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 💳 Citi Double Cash               ⚠️  [⋮] │ │
│  │                                           │ │
│  │ $1,247.82 / $10,000                       │ │
│  │ ┌─────────────────────┐                   │ │
│  │ │█████████████░░░░░░░░│ 12.5% ✅          │ │
│  │ └─────────────────────┘                   │ │
│  │                                           │ │
│  │ Current Cycle: Sep 28 - Oct 28           │ │
│  │ 52 transactions • $1,247.82              │ │
│  │ ⚠️  Cycle closes tomorrow!                 │ │
│  │                                           │ │
│  │ Payment Due: Nov 20 (24 days)            │ │
│  │ Minimum: $25 • Statement: TBD            │ │
│  │                                           │ │
│  │              [Pay Now]  [View Details]   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 💳 Amex Blue Cash                     [⋮] │ │
│  │                                           │ │
│  │ $1,757.00 / $10,000                       │ │
│  │ ┌─────────────────────┐                   │ │
│  │ │█████████████████░░░░│ 17.6% ✅          │ │
│  │ └─────────────────────┘                   │ │
│  │                                           │ │
│  │ Current Cycle: Oct 1 - Oct 31            │ │
│  │ 47 transactions • $1,757.00              │ │
│  │                                           │ │
│  │ Payment Due: Nov 25 (29 days)            │ │
│  │ Minimum: $35 • Statement: TBD            │ │
│  │                                           │ │
│  │              [Pay Now]  [View Details]   │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.2 Utilization Status Indicators

```
Utilization color coding:
┌─────────────────────────────────────┐
│ 0-30%:   ✅ Excellent (green)        │
│ 31-50%:  ⚠️  Good (yellow)           │
│ 51-75%:  ⚠️  Fair (orange)           │
│ 76-100%: ❌ High (red)               │
│ >100%:   🚨 Over Limit! (red flash) │
└─────────────────────────────────────┘
```

### 4.3 Card Details (Expanded View)

```
┌─────────────────────────────────────────────────┐
│  💳 Citi Double Cash                       [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Account Info                                   │
│  Last 4: ****8742                               │
│  Account opened: Jan 2023                       │
│  Cardholder: el usuario Borges                      │
│                                                 │
│  Current Status                                 │
│  Balance: $1,247.82                             │
│  Credit Limit: $10,000                          │
│  Available: $8,752.18                           │
│  Utilization: 12.5% ✅                           │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Current Cycle (Sep 28 - Oct 28)        │   │
│  │                                         │   │
│  │ Spending Progress:                      │   │
│  │ ┌─────────────────────────────────────┐│   │
│  │ │████████████████░░░░░░░░░ 62%        ││   │
│  │ └─────────────────────────────────────┘│   │
│  │ $1,247.82 / $2,000 avg                 │   │
│  │                                         │   │
│  │ Breakdown:                              │   │
│  │ • Groceries: $487.32 (39%)             │   │
│  │ • Gas: $245.00 (20%)                   │   │
│  │ • Restaurants: $312.50 (25%)           │   │
│  │ • Other: $203.00 (16%)                 │   │
│  │                                         │   │
│  │ Top Merchants:                          │   │
│  │ 1. Costco ($187.45)                    │   │
│  │ 2. Whole Foods ($152.30)               │   │
│  │ 3. Shell Gas ($89.00)                  │   │
│  │                                         │   │
│  │ [View All 52 Transactions]             │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Payment Info                            │   │
│  │                                         │   │
│  │ Due Date: Nov 20, 2025 (24 days)       │   │
│  │ Minimum Payment: $25                    │   │
│  │ Statement Balance: TBD                  │   │
│  │                                         │   │
│  │ 💡 Recommended: Pay $1,247.82 (full)   │   │
│  │    to avoid $24.50 interest             │   │
│  │                                         │   │
│  │ [Schedule Payment]  [Mark as Paid]     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Spending History (6 months)            │   │
│  │                                         │   │
│  │ ┌─────────────────────────────────────┐│   │
│  │ │     $2,234                          ││   │
│  │ │      █                              ││   │
│  │ │ $2,145█    $2,012                   ││   │
│  │ │ █  █ █ █    █   $1,987 $1,756      ││   │
│  │ │ █  █ █ █ $1,890 █  █   █  $1,247   ││   │
│  │ │ █  █ █ █  █  █  █  █   █   █       ││   │
│  │ │ Apr May Jun Jul Aug Sep Oct Nov     ││   │
│  │ └─────────────────────────────────────┘│   │
│  │                                         │   │
│  │ Average: $2,000/month                  │   │
│  │ Trend: ↓ Decreasing (good!)            │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                                   [Close]       │
└─────────────────────────────────────────────────┘
```

### 4.4 Payment Calendar View

```
┌─────────────────────────────────────────────────┐
│  📅 Payment Calendar                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  November 2025                                  │
│                                                 │
│  Sun  Mon  Tue  Wed  Thu  Fri  Sat             │
│                                   1     2       │
│   3    4    5    6    7    8     9             │
│  10   11   12   13   14  [15]   16             │ <- Chase Freedom due
│                           💳                    │
│                        $842.50                  │
│                                                 │
│  17   18   19  [20]   21   22    23            │ <- Citi Double Cash due
│                 💳                              │
│              $1,247.82                          │
│                                                 │
│  24  [25]   26   27   28   29    30            │ <- Amex Blue Cash due
│       💳                                        │
│    $1,757.00                                    │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                 │
│  Upcoming Payments:                             │
│  • Nov 15: Chase Freedom ($842.50)             │
│  • Nov 20: Citi Double Cash ($1,247.82)        │
│  • Nov 25: Amex Blue Cash ($1,757.00)          │
│                                                 │
│  Total Due: $3,847.32                           │
│                                                 │
│              [Schedule All Payments]            │
└─────────────────────────────────────────────────┘
```

---

## 5. Technical Implementation

### 5.1 Data Model

Credit cards are tracked in `accounts` table with special type:

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('checking', 'savings', 'credit_card', 'cash', 'investment')),

  -- Credit card specific fields
  credit_limit REAL, -- NULL for non-credit cards
  billing_cycle_day INTEGER, -- Day of month cycle closes (1-31)
  payment_due_day_offset INTEGER, -- Days after cycle close when payment due (e.g., 25)

  -- APR (for interest calculation)
  apr REAL, -- Annual Percentage Rate (e.g., 18.99)

  -- Metadata
  last_4_digits TEXT,
  opened_date TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

-- Payment tracking table
CREATE TABLE credit_card_payments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  cycle_start_date TEXT, -- Which cycle this payment covers
  cycle_end_date TEXT,
  status TEXT CHECK(status IN ('scheduled', 'paid', 'failed')),

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

### 5.2 Calculate Current Balance

```javascript
// lib/creditCardBalance.js
const db = require('../database');

async function getCurrentBalance(accountId) {
  // Sum all transactions for this credit card
  const result = await db.get(`
    SELECT SUM(
      CASE
        WHEN type = 'expense' THEN amount
        WHEN type = 'income' THEN -amount  -- Payments/refunds reduce balance
        ELSE 0
      END
    ) as balance
    FROM transactions
    WHERE account_id = ?
  `, [accountId]);

  return result?.balance || 0;
}

async function getCreditCardSummary(accountId) {
  const account = await db.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
  const balance = await getCurrentBalance(accountId);

  const availableCredit = (account.credit_limit || 0) - balance;
  const utilization = account.credit_limit ? (balance / account.credit_limit) * 100 : 0;

  return {
    accountId,
    name: account.name,
    balance,
    creditLimit: account.credit_limit,
    availableCredit,
    utilization,
    status: getUtilizationStatus(utilization)
  };
}

function getUtilizationStatus(utilization) {
  if (utilization > 100) return { level: 'critical', label: '🚨 Over Limit!' };
  if (utilization > 75) return { level: 'high', label: '❌ High' };
  if (utilization > 50) return { level: 'fair', label: '⚠️  Fair' };
  if (utilization > 30) return { level: 'good', label: '⚠️  Good' };
  return { level: 'excellent', label: '✅ Excellent' };
}

module.exports = { getCurrentBalance, getCreditCardSummary };
```

### 5.3 Calculate Statement Cycle Spending

```javascript
// lib/statementCycle.js
function getCurrentCycle(account) {
  const today = new Date();
  const cycleDay = account.billing_cycle_day;

  let cycleStart, cycleEnd;

  if (today.getDate() >= cycleDay) {
    // We're in current month's cycle
    cycleStart = new Date(today.getFullYear(), today.getMonth(), cycleDay);
    cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, cycleDay - 1);
  } else {
    // We're in previous month's cycle
    cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, cycleDay);
    cycleEnd = new Date(today.getFullYear(), today.getMonth(), cycleDay - 1);
  }

  return {
    startDate: cycleStart.toISOString().split('T')[0],
    endDate: cycleEnd.toISOString().split('T')[0]
  };
}

async function getCycleSpending(accountId, cycleStart, cycleEnd) {
  const result = await db.get(`
    SELECT
      COUNT(*) as txn_count,
      SUM(amount) as total_spent
    FROM transactions
    WHERE account_id = ?
    AND type = 'expense'
    AND date >= ? AND date <= ?
  `, [accountId, cycleStart, cycleEnd]);

  return {
    transactionCount: result.txn_count,
    totalSpent: result.total_spent || 0
  };
}

async function getCurrentCycleSummary(accountId) {
  const account = await db.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
  const { startDate, endDate } = getCurrentCycle(account);
  const { transactionCount, totalSpent } = await getCycleSpending(accountId, startDate, endDate);

  // Get average monthly spend (last 6 months)
  const avgMonthly = await getAverageMonthlySpend(accountId);

  return {
    cycleStart: startDate,
    cycleEnd: endDate,
    transactionCount,
    totalSpent,
    avgMonthly,
    percentOfAvg: avgMonthly > 0 ? (totalSpent / avgMonthly) * 100 : 0,
    daysUntilClose: daysBetween(new Date(), new Date(endDate))
  };
}

async function getAverageMonthlySpend(accountId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const result = await db.get(`
    SELECT AVG(monthly_spend) as avg
    FROM (
      SELECT strftime('%Y-%m', date) as month, SUM(amount) as monthly_spend
      FROM transactions
      WHERE account_id = ?
      AND type = 'expense'
      AND date >= ?
      GROUP BY month
    )
  `, [accountId, sixMonthsAgo.toISOString().split('T')[0]]);

  return result?.avg || 0;
}

module.exports = { getCurrentCycle, getCurrentCycleSummary };
```

### 5.4 Calculate Payment Due Date

```javascript
// lib/paymentDue.js
function getNextPaymentDueDate(account) {
  const { endDate } = getCurrentCycle(account);
  const cycleEndDate = new Date(endDate);

  // Payment due = cycle end + offset (e.g., 25 days)
  const dueDate = new Date(cycleEndDate);
  dueDate.setDate(dueDate.getDate() + (account.payment_due_day_offset || 25));

  return dueDate.toISOString().split('T')[0];
}

async function getPaymentInfo(accountId) {
  const account = await db.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
  const balance = await getCurrentBalance(accountId);
  const dueDate = getNextPaymentDueDate(account);
  const daysUntilDue = daysBetween(new Date(), new Date(dueDate));

  // Minimum payment (typically 1% of balance or $25, whichever is greater)
  const minimumPayment = Math.max(balance * 0.01, 25);

  // Calculate interest if only minimum is paid
  const monthlyInterestRate = (account.apr || 0) / 12 / 100;
  const interestIfMinimum = (balance - minimumPayment) * monthlyInterestRate;

  return {
    dueDate,
    daysUntilDue,
    minimumPayment,
    statementBalance: balance, // Simplified: current balance
    recommendedPayment: balance, // Pay in full to avoid interest
    interestIfMinimum,
    status: getPaymentStatus(daysUntilDue)
  };
}

function getPaymentStatus(daysUntilDue) {
  if (daysUntilDue < 0) return { level: 'overdue', label: '🚨 Overdue!' };
  if (daysUntilDue <= 3) return { level: 'urgent', label: '⚠️  Due Soon!' };
  if (daysUntilDue <= 7) return { level: 'upcoming', label: '⏰ Coming Up' };
  return { level: 'ok', label: '✅ On Track' };
}

module.exports = { getNextPaymentDueDate, getPaymentInfo };
```

### 5.5 Credit Card Dashboard Component

```javascript
// components/CreditCardDashboard.jsx
import React, { useEffect, useState } from 'react';

function CreditCardDashboard() {
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadCreditCards();
  }, []);

  const loadCreditCards = async () => {
    const creditCardAccounts = await window.api.getCreditCardAccounts();

    const cardsWithData = await Promise.all(
      creditCardAccounts.map(async (account) => {
        const balance = await window.api.getCurrentBalance(account.id);
        const cycle = await window.api.getCurrentCycleSummary(account.id);
        const payment = await window.api.getPaymentInfo(account.id);

        return {
          ...account,
          balance,
          cycle,
          payment
        };
      })
    );

    setCards(cardsWithData);

    // Calculate total summary
    const totalBalance = cardsWithData.reduce((sum, c) => sum + c.balance.balance, 0);
    const totalLimit = cardsWithData.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
    const overallUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

    setSummary({
      totalBalance,
      totalLimit,
      totalAvailable: totalLimit - totalBalance,
      overallUtilization
    });
  };

  return (
    <Container>
      <Header>
        <Title>💳 Credit Card Balances</Title>
        <Button onClick={() => showAddCardDialog()}>+ Add Card</Button>
      </Header>

      {summary && (
        <SummaryCard>
          <SummaryRow>
            <Label>Total Balance:</Label>
            <Value>${summary.totalBalance.toFixed(2)}</Value>
          </SummaryRow>
          <SummaryRow>
            <Label>Total Credit Limit:</Label>
            <Value>${summary.totalLimit.toFixed(2)}</Value>
          </SummaryRow>
          <SummaryRow>
            <Label>Overall Utilization:</Label>
            <Value>
              {summary.overallUtilization.toFixed(1)}% {getUtilizationEmoji(summary.overallUtilization)}
            </Value>
          </SummaryRow>
        </SummaryCard>
      )}

      <CardsGrid>
        {cards.map(card => (
          <CreditCardCard key={card.id} card={card} onRefresh={loadCreditCards} />
        ))}
      </CardsGrid>
    </Container>
  );
}

function CreditCardCard({ card, onRefresh }) {
  return (
    <Card>
      <CardHeader>
        <CardIcon>💳</CardIcon>
        <CardName>{card.name}</CardName>
        <CardMenu />
      </CardHeader>

      <BalanceSection>
        <Balance>${card.balance.balance.toFixed(2)} / ${card.creditLimit.toFixed(2)}</Balance>
        <ProgressBar value={card.balance.utilization} status={card.balance.status.level} />
        <Utilization>
          {card.balance.utilization.toFixed(1)}% {card.balance.status.label}
        </Utilization>
      </BalanceSection>

      <CycleSection>
        <CycleLabel>
          Current Cycle: {formatDate(card.cycle.cycleStart)} - {formatDate(card.cycle.cycleEnd)}
        </CycleLabel>
        <CycleSpending>
          {card.cycle.transactionCount} transactions • ${card.cycle.totalSpent.toFixed(2)}
        </CycleSpending>
        {card.cycle.daysUntilClose <= 1 && (
          <Alert severity="warning">⚠️  Cycle closes {card.cycle.daysUntilClose === 0 ? 'today' : 'tomorrow'}!</Alert>
        )}
      </CycleSection>

      <PaymentSection>
        <PaymentLabel>Payment Due: {formatDate(card.payment.dueDate)} ({card.payment.daysUntilDue} days)</PaymentLabel>
        <PaymentAmount>
          Minimum: ${card.payment.minimumPayment.toFixed(2)} • Statement: ${card.payment.statementBalance.toFixed(2)}
        </PaymentAmount>
      </PaymentSection>

      <Actions>
        <Button variant="primary">Pay Now</Button>
        <Button variant="secondary">View Details</Button>
      </Actions>
    </Card>
  );
}

export default CreditCardDashboard;
```

---

## 6. Edge Cases & Solutions

### 6.1 Payments Reduce Balance

**Case**: el usuario pays $1,000 on credit card, balance should decrease

**Solution**:
- Record payment as `type='income'` transaction on credit card account
- getCurrentBalance() subtracts income (payments) from expenses
- Result: Balance decreases correctly

**Code**:
```javascript
// When user marks payment as paid
async function recordPayment(accountId, amount, date) {
  await db.run(`
    INSERT INTO transactions (id, date, merchant, amount, type, account_id, source)
    VALUES (?, ?, 'Credit Card Payment', ?, 'income', ?, 'manual')
  `, [nanoid(), date, amount, accountId]);

  // Also record in payments table
  await db.run(`
    INSERT INTO credit_card_payments (id, account_id, payment_date, amount, status)
    VALUES (?, ?, ?, ?, 'paid')
  `, [nanoid(), accountId, date, amount]);
}
```

---

### 6.2 Refunds and Credits

**Case**: el usuario gets a $50 refund on Amex, balance should decrease

**Solution**:
- Refunds are `type='income'` transactions
- Automatically reduce balance (same logic as payments)

---

### 6.3 Multiple Statement Cycles Per Month

**Case**: Some cards have mid-month cycles (e.g., 15th)

**Solution**:
- Store `billing_cycle_day` in account settings
- getCurrentCycle() calculates cycle dynamically based on cycle day
- Works for any cycle day (1-31)

---

### 6.4 Payment Grace Period

**Case**: Payment due Nov 15, but bank allows until Nov 17 without late fee

**Solution** (future):
- Add `grace_period_days` field to accounts
- Adjust due date warning threshold
- Show: "Payment due Nov 15 (grace period until Nov 17)"

---

### 6.5 Multiple Cards Same Bank

**Case**: el usuario has 2 Chase cards (Freedom + Sapphire)

**Solution**:
- Each card is separate account in DB
- Calculate balances independently
- Dashboard shows both cards separately

---

## 7. Summary

### What This Flow Covers

✅ **Current balance** per credit card
✅ **Statement cycle tracking** (current + previous)
✅ **Payment due dates** with days remaining
✅ **Credit utilization** per card + overall
✅ **Spending trends** (6-month history)
✅ **Payment history** tracking
✅ **Alerts** for upcoming due dates and cycle closes

### Scope Boundaries

**In Scope**:
- Balance calculation from transactions
- Cycle tracking based on billing cycle day
- Payment due date calculation
- Utilization monitoring

**Out of Scope** (future):
- Automatic payment scheduling (integration with banks)
- Interest calculation (shown conceptually, not enforced)
- Rewards tracking (points, cash back)
- Credit score impact simulation

### Impact on Other Flows

- **flow-1** (Timeline): Credit card transactions contribute to balance
- **flow-3** (Transaction Detail): Shows which card transaction is on
- **flow-10** (Reports): Can report on credit card spending trends

### Why This Flow is Important

Without credit card dashboard:
- el usuario has to check 3 banking apps separately
- Risk of missing payment due dates
- No visibility into utilization (credit score impact)
- No spending pattern analysis

With credit card dashboard:
- Single view of all credit cards
- Never miss a payment (alerts + calendar)
- Optimize credit utilization
- Understand spending patterns

**Result**: Better credit management → higher credit score + avoid late fees + optimize rewards.

---

**Lines of Code**: ~650 (balance calc + cycle tracking + payment logic + dashboard UI)
**Testing Priority**: High (financial accuracy is critical)
**Dependencies**: flow-1 (transactions), flow-3 (transaction details)
**Phase**: 2 (valuable for users with credit cards)
