# Flow 10: Pre-built Reports 📊

**6 reports visuales listos para usar**

## Funcionalidad

6 reports visuales pre-built que generan insights automáticos desde transacciones.

**Reports disponibles**:
1. Spending by Category (pie chart)
2. Spending Trends (line chart)
3. Income vs Expenses (bar chart)
4. Top Merchants (table)
5. Budget Performance (gauge charts)
6. Monthly Comparison (bar chart)

**Características**:
- Generación en <1 segundo
- Filters consistentes (account, date, category)
- Charts interactivos (Recharts)
- Insights automáticos

---

## Implementación: Report generation

6 reports visuales listos para usar:
1. **Spending by Category** (pie chart)
2. **Spending Trends** (line chart)
3. **Income vs Expenses** (bar chart)
4. **Top Merchants** (table)
5. **Budget Performance** (gauge charts)
6. **Monthly Comparison** (bar chart)

el usuario solo hace click. El report se genera en <1 segundo.

---

## Story: el usuario explora sus finanzas

### Escena 1: Abrir Reports

el usuario quiere ver un resumen visual de sus finanzas.

**Hace esto**:
1. Click en menu → "Reports"

**Ve esto**:
```
┌──────────────────────────────────────────────────────┐
│  Reports                                    [Export] │
├──────────────────────────────────────────────────────┤
│  📊 Pre-built Reports                                │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  🥧 Spending by Category                    │    │
│  │  See where your money goes                  │    │
│  │  [View Report →]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  📈 Spending Trends                         │    │
│  │  Track spending over time                   │    │
│  │  [View Report →]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  💰 Income vs Expenses                      │    │
│  │  Compare earnings and spending              │    │
│  │  [View Report →]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  🏪 Top Merchants                           │    │
│  │  Find your most frequent merchants          │    │
│  │  [View Report →]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  📊 Budget Performance                      │    │
│  │  Track budget progress                      │    │
│  │  [View Report →]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  📅 Monthly Comparison                      │    │
│  │  Compare spending across months             │    │
│  │  [View Report →]                            │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [+ Create Custom Report]                            │
└──────────────────────────────────────────────────────┘
```

---

### Escena 2: Report 1 - Spending by Category

el usuario hace click en "Spending by Category".

**Ve esto** (<1 segundo):
```
┌──────────────────────────────────────────────────────────────┐
│  📊 Spending by Category                            [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [Last 3 months ▾]                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│               🥧 Spending by Category                        │
│                                                              │
│                     ╭─────────────╮                          │
│                    ╱               ╲                         │
│                   │                 │                        │
│          Housing  │                 │  Food                  │
│            65%    │                 │  18%                   │
│                   │                 │                        │
│                    ╲               ╱                         │
│                     ╰─────────────╯                          │
│                  Shopping 12%  Transport 5%                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  🏠 Housing              $4,950 (65%)  127 txns    │     │
│  │  🍔 Food & Dining        $1,350 (18%)   89 txns    │     │
│  │  🛒 Shopping               $900 (12%)   45 txns    │     │
│  │  🚗 Transportation         $375 (5%)    23 txns    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Total spent: $7,575 across 284 transactions                │
└──────────────────────────────────────────────────────────────┘
```

**Insights**:
- el usuario gasta 65% en housing (rent/mortgage)
- 18% en comida (dentro de budget)
- 12% en shopping (puede reducir?)

---

### Escena 3: Cambiar filters

el usuario quiere ver solo Sep 2025.

**Hace esto**:
1. Click en "[Last 3 months ▾]"
2. Selecciona "Sep 2025"

**Report actualiza** (<0.5 segundos):
```
┌──────────────────────────────────────────────────────────────┐
│  📊 Spending by Category                            [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [Sep 2025 ▾]                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🍔 Food & Dining            $892 (32%)   67 txns           │
│  🏠 Housing                $1,800 (65%)    1 txn            │
│  🚗 Transportation           $456 (16%)   23 txns           │
│  🎬 Entertainment            $234 (8%)    12 txns           │
│  🛒 Shopping                 $567 (20%)   18 txns           │
│                                                              │
│  Total spent: $2,751 across 121 transactions                │
└──────────────────────────────────────────────────────────────┘
```

---

### Escena 4: Report 2 - Spending Trends

el usuario regresa y hace click en "Spending Trends".

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  📈 Spending Trends                                 [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [2025 ▾] [Monthly ▾]             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     📈 Spending Over Time                    │
│                                                              │
│  $4k  ┤                                                      │
│       │                                      ●               │
│  $3k  ┤                            ●       ╱                 │
│       │                  ●       ╱       ╱                   │
│  $2k  ┤        ●       ╱       ╱                             │
│       │      ╱       ╱                                       │
│  $1k  ┤    ●                                                 │
│       │                                                      │
│   $0  └────┬────┬────┬────┬────┬────┬────┬────┬────┬────   │
│           Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep       │
│                                                              │
│           ──── Expenses     ──── Income                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Sep 2025    $2,751 spent • $3,500 income          │     │
│  │  Aug 2025    $3,234 spent • $3,500 income          │     │
│  │  Jul 2025    $2,890 spent • $3,500 income          │     │
│  │  ...                                               │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Average monthly spending: $2,891                            │
│  Trend: ↗️ +5% vs last month                                 │
└──────────────────────────────────────────────────────────────┘
```

**Insights**:
- el usuario's spending está aumentando
- Promedio: $2,891/mes
- Sep fue $2,751 (below average ✓)

---

### Escena 5: Report 3 - Income vs Expenses

el usuario hace click en "Income vs Expenses".

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  💰 Income vs Expenses                              [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [2025 ▾]                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  💰 Income vs Expenses                       │
│                                                              │
│  $4k  ┤  ████                                                │
│       │  ████  ████  ████  ████  ████  ████  ████  ████     │
│  $3k  ┤  ████  ████  ████  ████  ████  ████  ████  ████     │
│       │  ████  ████  ████  ████  ████  ████  ████  ████     │
│  $2k  ┤  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓     │
│       │  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓     │
│  $1k  ┤  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓     │
│       │                                                      │
│   $0  └────┬────┬────┬────┬────┬────┬────┬────┬────┬────   │
│           Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep       │
│                                                              │
│           ████ Income     ▓▓▓▓ Expenses    ░░░░ Net         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Sep 2025                                          │     │
│  │  Income:    $3,500  ████████████████████           │     │
│  │  Expenses:  $2,751  ███████████████                │     │
│  │  Net:         $749  ████                           │     │
│  │  Savings rate: 21.4%                               │     │
│  │                                                    │     │
│  │  Aug 2025                                          │     │
│  │  Income:    $3,500  ████████████████████           │     │
│  │  Expenses:  $3,234  ██████████████████             │     │
│  │  Net:         $266  ██                             │     │
│  │  Savings rate: 7.6%                                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Average savings rate: 18.3%                                 │
│  Best month: Jun (25.6% savings)                             │
└──────────────────────────────────────────────────────────────┘
```

**Insights**:
- el usuario ahorra ~18% en promedio (bueno!)
- Sep fue mejor que Aug (21% vs 7%)
- Junio fue su mejor mes (25%)

---

### Escena 6: Report 4 - Top Merchants

el usuario hace click en "Top Merchants".

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  🏪 Top Merchants                                   [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [Last 3 months ▾]                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Merchant          Total Spent    Count    Avg     Category │
│  ─────────────────────────────────────────────────────────  │
│  🏠 Property Mgmt   $4,950        3      $1,650   Housing   │
│  🛒 Costco            $567       12        $47    Shopping  │
│  ⛽ Shell Gas         $345       15        $23    Transport │
│  🏪 Starbucks         $234       42         $5    Food      │
│  📦 Amazon            $223        8        $27    Shopping  │
│  🎬 Netflix            $47        3        $15    Entertain.│
│  🍔 McDonald's         $45       12         $3    Food      │
│  🛒 Target             $189        6        $31   Shopping  │
│  🚗 Uber               $167       23         $7   Transport │
│  🏋️ Gym                $135        3        $45   Healthcare│
│  🎵 Spotify            $29        3         $9    Entertain.│
│  💻 GitHub              $12        3         $4   Business  │
│                                                              │
│  Total: $6,943 across 133 merchants                          │
│                                                              │
│  💡 Insight: You visit Starbucks 42 times (14x/month avg)   │
│     Consider making coffee at home to save ~$200/month      │
└──────────────────────────────────────────────────────────────┘
```

**Insight importante**: el usuario va a Starbucks 14 veces al mes. $234 total. Si hace café en casa, ahorra ~$200/mes = $2,400/año.

---

### Escena 7: Report 5 - Budget Performance

el usuario hace click en "Budget Performance".

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  📊 Budget Performance                              [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Period: October 2025                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  💰 Food Budget                                              │
│  ███████████████░░░░░░░░  68%  $547 / $800                  │
│  $253 remaining • On track ✓                                 │
│                                                              │
│  🚗 Transportation Budget                                    │
│  ██████████████████░░░░░  80%  $320 / $400                  │
│  $80 remaining • Warning ⚠️                                  │
│                                                              │
│  🎬 Entertainment Budget                                     │
│  ██████░░░░░░░░░░░░░░░░  33%  $67 / $200                   │
│  $133 remaining • Well below budget ✓                        │
│                                                              │
│  🛒 Shopping Budget                                          │
│  ████████████████████████  104%  $1,045 / $1,000            │
│  $45 over budget • Exceeded 🔴                               │
│                                                              │
│  ───────────────────────────────────────────────────────    │
│                                                              │
│  Total budgets:    $2,400                                    │
│  Total spent:      $1,979                                    │
│  Overall status:   82% used (on track)                       │
│                                                              │
│  💡 Recommendations:                                         │
│  • Reduce shopping spending by $45 to meet budget            │
│  • Transportation budget almost reached - be cautious        │
│  • Entertainment budget has room - enjoy! 🎉                 │
└──────────────────────────────────────────────────────────────┘
```

---

### Escena 8: Report 6 - Monthly Comparison

el usuario hace click en "Monthly Comparison".

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  📅 Monthly Comparison                              [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Compare: [2025 ▾] vs [2024 ▾]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                📅 Year-over-Year Comparison                  │
│                                                              │
│  $4k  ┤                                                      │
│       │  ██                                      ██          │
│  $3k  ┤  ██  ██  ██  ██  ██  ██  ██  ██  ██    ██          │
│       │  ██  ██  ██  ██  ██  ██  ██  ██  ██    ██          │
│  $2k  ┤  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓    ▓▓          │
│       │  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓    ▓▓          │
│  $1k  ┤  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓    ▓▓          │
│       │                                                      │
│   $0  └────┬────┬────┬────┬────┬────┬────┬────┬────┬────   │
│           Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep       │
│                                                              │
│           ████ 2025     ▓▓▓▓ 2024                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Sep 2025: $2,751  vs  Sep 2024: $2,456           │     │
│  │  Change: +$295 (+12%)                              │     │
│  │                                                    │     │
│  │  Biggest increases:                                │     │
│  │  • Food: +$145 (+19%)                              │     │
│  │  • Shopping: +$89 (+18%)                           │     │
│  │                                                    │     │
│  │  Biggest decreases:                                │     │
│  │  • Entertainment: -$34 (-12%)                      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  2025 YTD: $26,019  vs  2024 YTD: $22,104                    │
│  Change: +$3,915 (+17.7%)                                    │
└──────────────────────────────────────────────────────────────┘
```

**Insights**:
- el usuario gasta 17.7% más en 2025 vs 2024
- Aumentos: Food (+19%), Shopping (+18%)
- Necesita controlar estos gastos

---

## Cómo funciona: Report generation

### Query example - Spending by Category

```javascript
async function getSpendingByCategory({ startDate, endDate, accountId }) {
  let query = `
    SELECT
      c.name as category,
      c.icon,
      c.color,
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

---

### Charts rendering (Recharts)

```javascript
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

function SpendingByCategoryChart({ data }) {
  return (
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
  );
}
```

---

## Filter options

Todos los reports tienen filters consistentes:

```
┌──────────────────────────────────────────────────────┐
│  Filters: [Account ▾] [Date Range ▾] [Category ▾]   │
└──────────────────────────────────────────────────────┘

Account options:
- All accounts
- Bank of America
- Apple Card
- Wise
- Scotiabank

Date Range options:
- This month
- Last month
- Last 3 months
- Last 6 months
- This year
- Last year
- All time
- Custom range

Category options (para reports aplicables):
- All categories
- Food & Dining
- Transportation
- Housing
- etc.
```

---

## Edge cases

### Edge case 1: No data

**Escenario**: el usuario abre report pero no tiene transacciones en ese período.

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  📊 Spending by Category                            [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [Dec 2025 ▾]                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     📭 No Data                               │
│                                                              │
│         No transactions found for this period.               │
│                                                              │
│         Try selecting a different date range.                │
│                                                              │
│  [Change Filters]                                            │
└──────────────────────────────────────────────────────────────┘
```

---

### Edge case 2: Single category

**Escenario**: el usuario filtra solo "Food & Dining", pero report es "Spending by Category".

**Lógica**: Mostrar sub-breakdown si hay suficiente data, sino mostrar merchants.

```
🍔 Food & Dining Breakdown

Fast Food          $234 (26%)
Coffee Shops       $189 (21%)
Groceries          $356 (40%)
Restaurants        $113 (13%)
```

---

## Resumen: Pre-built Reports

### Qué incluye
- **6 reports** visuales listos para usar
- **Charts** con Recharts (pie, line, bar)
- **Filters** consistentes (account, date, category)
- **Insights** automáticos
- **Fast** (<1 segundo de generación)

### Reports disponibles
1. Spending by Category (pie chart)
2. Spending Trends (line chart)
3. Income vs Expenses (bar chart)
4. Top Merchants (table)
5. Budget Performance (gauge charts)
6. Monthly Comparison (bar chart)

### Benefits
- **Visual**: el usuario ve patterns que no vería en tabla
- **Fast**: No necesita Excel ni calculadora
- **Actionable**: Insights sugieren acciones concretas
- **Flexible**: Filters permiten drill-down

### Phase 3 scope
- ✅ 6 pre-built reports
- ✅ Interactive charts (Recharts)
- ✅ Filters (account, date, category)
- ✅ Automatic insights
- ❌ Export report to PDF (flow-12)
- ❌ Schedule reports (Phase 4)
- ❌ Share reports (Phase 4)

---

**Próximo flow**: Lee [flow-11-custom-report.md](flow-11-custom-report.md) para ver cómo el usuario crea reports personalizados.
