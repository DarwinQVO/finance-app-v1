# Flow 11: Custom Report Builder 🔧

**Crea tus propios reports con drag & drop**

## Funcionalidad

Custom report builder que permite crear reports personalizados con configuración visual.

**Capacidades**:
- Data source selection (transactions, budgets, recurring)
- Filters configurables (merchant, date, account, category)
- Grouping (month, category, merchant, account)
- Aggregations (sum, count, avg, min, max)
- Visualizations (table, bar chart, line chart, pie chart)
- Save/edit/delete custom reports
- Re-run automático con latest data

---

## Implementación: Report Builder

el usuario construye su propio report:
1. Selecciona data source (transactions)
2. Selecciona filters (Uber, 2025)
3. Selecciona grouping (by month)
4. Selecciona aggregations (sum, average, count)
5. Selecciona visualización (table, chart)

**Click "Generate" → Report listo en <1 segundo**.

---

## Story: el usuario crea su primer custom report

### Escena 1: Abrir Custom Report Builder

el usuario va a Reports → "Create Custom Report".

**Ve esto**:
```
┌──────────────────────────────────────────────────────────────┐
│  🔧 Custom Report Builder                           [Back]   │
├──────────────────────────────────────────────────────────────┤
│  Step 1: Report Name                                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  [Uber Spending by Month              ]           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Step 2: Data Source                                         │
│  ○ Transactions                                              │
│  ○ Budgets                                                   │
│  ○ Recurring                                                 │
│                                                              │
│  Step 3: Filters                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Merchant: [Uber                    ▾]            │     │
│  │  Date range: [2025                  ▾]            │     │
│  │  Account: [All                      ▾]            │     │
│  │  [+ Add filter]                                   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Step 4: Group by                                            │
│  [Month ▾]                                                   │
│                                                              │
│  Step 5: Show                                                │
│  [☑] Total (sum)                                            │
│  [☑] Count (number of transactions)                         │
│  [ ] Average                                                │
│  [ ] Min/Max                                                │
│                                                              │
│  Step 6: Visualization                                       │
│  ○ Table    ○ Bar Chart    ○ Line Chart    ○ Pie Chart     │
│                                                              │
│  [Preview Report]  [Save & Generate]                         │
└──────────────────────────────────────────────────────────────┘
```

---

### Escena 2: Configurar report

el usuario llena el form:

**Step 1**: Name = "Uber Spending by Month"
**Step 2**: Data Source = Transactions
**Step 3**: Filters:
- Merchant = "Uber"
- Date range = "2025"
- Account = "All"

**Step 4**: Group by = "Month"
**Step 5**: Show:
- ☑ Total (sum)
- ☑ Count

**Step 6**: Visualization = "Bar Chart"

**Click "Preview Report"**.

---

### Escena 3: Preview

**Ve preview** (< 0.5 segundos):
```
┌──────────────────────────────────────────────────────────────┐
│  Preview: Uber Spending by Month                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  🚗 Uber Spending by Month                   │
│                                                              │
│  $200  ┤                              ██                     │
│        │                              ██                     │
│  $150  ┤          ██                  ██                     │
│        │          ██      ██          ██                     │
│  $100  ┤  ██      ██      ██      ██  ██                     │
│        │  ██      ██      ██      ██  ██                     │
│   $50  ┤  ██      ██      ██      ██  ██      ██            │
│        │                                                      │
│    $0  └────┬────┬────┬────┬────┬────┬────┬────┬────┬────   │
│            Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Jan: $89.50  (11 rides)                           │     │
│  │  Feb: $124.30 (15 rides)                           │     │
│  │  Mar: $156.70 (19 rides)                           │     │
│  │  Apr: $98.20  (12 rides)                           │     │
│  │  May: $112.80 (14 rides)                           │     │
│  │  Jun: $187.90 (23 rides)                           │     │
│  │  Jul: $143.40 (17 rides)                           │     │
│  │  Aug: $167.20 (21 rides)                           │     │
│  │  Sep: $79.30  (10 rides)                           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Total: $1,159.30 across 142 rides                           │
│  Average per month: $128.81                                  │
│  Average per ride: $8.16                                     │
│                                                              │
│  [Edit Configuration]  [Save Report]  [Export]               │
└──────────────────────────────────────────────────────────────┘
```

**Perfecto!** el usuario ve exactamente lo que quería.

---

### Escena 4: Guardar report

el usuario hace click en "Save Report".

**Ve confirmación**:
```
┌─────────────────────────────────────────┐
│  ✓ Report Saved                         │
├─────────────────────────────────────────┤
│  "Uber Spending by Month" has been      │
│  saved to your custom reports.          │
│                                         │
│  You can access it anytime from the     │
│  Reports page.                          │
│                                         │
│  [View Reports Page]  [Close]           │
└─────────────────────────────────────────┘
```

---

### Escena 5: Ver saved reports

el usuario va a Reports page.

**Ve esto**:
```
┌──────────────────────────────────────────────────────┐
│  Reports                                    [Export] │
├──────────────────────────────────────────────────────┤
│  📊 Pre-built Reports                                │
│  [Los 6 pre-built reports...]                        │
│                                                      │
│  🔧 Your Custom Reports                              │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  🚗 Uber Spending by Month                  │    │
│  │  Last generated: 2 minutes ago              │    │
│  │  [View] [Edit] [Delete]                     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [+ Create Custom Report]                            │
└──────────────────────────────────────────────────────┘
```

---

### Escena 6: Re-run report

**1 mes después**: Es octubre. el usuario quiere actualizar el report.

**Hace esto**:
1. Click en "View" en "Uber Spending by Month"

**Report se regenera automáticamente** con data de Oct incluida:
```
┌──────────────────────────────────────────────────────────────┐
│  🚗 Uber Spending by Month                          [Back]   │
├──────────────────────────────────────────────────────────────┤
│  ...                                                         │
│  Sep: $79.30  (10 rides)                                     │
│  Oct: $145.60 (18 rides)  ← NEW                              │
│                                                              │
│  Total: $1,304.90 across 160 rides                           │
└──────────────────────────────────────────────────────────────┘
```

**Perfecto**: Report siempre está actualizado con latest data.

---

## Ejemplo 2: Report más complejo

el usuario quiere: "Gastos en restaurantes, solo fines de semana, últimos 6 meses".

**Configuración**:
```
Name: Weekend Restaurant Spending
Data Source: Transactions
Filters:
  - Category: Food & Dining
  - Merchant: (exclude Starbucks, McDonald's, etc - fast food)
  - Date range: Last 6 months
  - Day of week: Saturday, Sunday
Group by: Week
Show: Total, Count, Average
Visualization: Table
```

**Result**:
```
Week of     Total     Count    Avg/meal
Sep 23-29   $234.50   5        $46.90
Sep 16-22   $189.30   4        $47.32
Sep 9-15    $156.70   3        $52.23
...
```

---

## Ejemplo 3: Comparison report

el usuario quiere comparar gastos 2024 vs 2025 por categoría.

**Configuración**:
```
Name: 2024 vs 2025 by Category
Data Source: Transactions
Filters: None (all)
Group by: Category
Show: Total
Split by: Year
Visualization: Bar Chart (side-by-side)
```

**Result**:
```
            2024    2025    Change
Food        $8.5k   $10.2k  +20%
Housing     $21k    $21.6k  +3%
Transport   $4.2k   $5.1k   +21%
...
```

---

## Cómo funciona: Report Engine

### Report configuration object

```javascript
const reportConfig = {
  id: 'custom_report_1',
  name: 'Uber Spending by Month',
  dataSource: 'transactions',

  filters: {
    merchant: 'Uber',
    dateRange: { from: '2025-01-01', to: '2025-12-31' },
    accounts: 'all',
    categories: null,
    type: null
  },

  groupBy: 'month',

  aggregations: [
    { field: 'amount', function: 'sum', label: 'Total' },
    { field: 'id', function: 'count', label: 'Count' }
  ],

  sortBy: 'month',
  sortOrder: 'asc',

  visualization: {
    type: 'bar',
    xAxis: 'month',
    yAxis: 'total'
  }
};
```

---

### Query builder

```javascript
function buildQuery(config) {
  let sql = 'SELECT ';
  const params = [];

  // SELECT clause
  const selectFields = [];

  if (config.groupBy) {
    if (config.groupBy === 'month') {
      selectFields.push(`SUBSTR(date, 1, 7) as month`);
    } else if (config.groupBy === 'category') {
      selectFields.push(`category_id, c.name as category`);
    } else if (config.groupBy === 'merchant') {
      selectFields.push(`merchant`);
    }
  }

  config.aggregations.forEach(agg => {
    const func = agg.function.toUpperCase();
    if (func === 'SUM') {
      selectFields.push(`SUM(ABS(${agg.field})) as ${agg.label.toLowerCase()}`);
    } else if (func === 'COUNT') {
      selectFields.push(`COUNT(${agg.field}) as ${agg.label.toLowerCase()}`);
    } else if (func === 'AVG') {
      selectFields.push(`AVG(ABS(${agg.field})) as ${agg.label.toLowerCase()}`);
    }
  });

  sql += selectFields.join(', ');

  // FROM clause
  sql += ` FROM ${config.dataSource} t`;

  if (config.groupBy === 'category') {
    sql += ` LEFT JOIN categories c ON t.category_id = c.id`;
  }

  // WHERE clause
  const whereClauses = [];

  if (config.filters.merchant) {
    whereClauses.push('t.merchant = ?');
    params.push(config.filters.merchant);
  }

  if (config.filters.dateRange) {
    whereClauses.push('t.date >= ? AND t.date <= ?');
    params.push(config.filters.dateRange.from, config.filters.dateRange.to);
  }

  if (config.filters.categories && config.filters.categories.length > 0) {
    const placeholders = config.filters.categories.map(() => '?').join(',');
    whereClauses.push(`t.category_id IN (${placeholders})`);
    params.push(...config.filters.categories);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  // GROUP BY clause
  if (config.groupBy) {
    if (config.groupBy === 'month') {
      sql += ` GROUP BY month`;
    } else {
      sql += ` GROUP BY ${config.groupBy}`;
    }
  }

  // ORDER BY clause
  if (config.sortBy) {
    sql += ` ORDER BY ${config.sortBy} ${config.sortOrder || 'ASC'}`;
  }

  return { sql, params };
}
```

---

### Execute report

```javascript
async function executeCustomReport(config) {
  const { sql, params } = buildQuery(config);

  const results = await db.all(sql, params);

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
```

---

## Advanced features

### Multi-level grouping

Group by category AND month:

```javascript
groupBy: ['category', 'month']

// Query result:
Food & Dining, Jan, $892.34
Food & Dining, Feb, $945.67
Transportation, Jan, $456.78
...
```

---

### Calculated fields

el usuario quiere "average per ride" automáticamente.

```javascript
aggregations: [
  { field: 'amount', function: 'sum', label: 'Total' },
  { field: 'id', function: 'count', label: 'Count' }
],
calculatedFields: [
  { name: 'avg_per_ride', formula: 'total / count' }
]
```

---

### Comparison mode

Compare two periods side-by-side.

```javascript
comparison: {
  enabled: true,
  period1: { from: '2024-01-01', to: '2024-12-31', label: '2024' },
  period2: { from: '2025-01-01', to: '2025-12-31', label: '2025' }
}
```

---

## UI: Report library

el usuario ve todos sus custom reports:

```
┌──────────────────────────────────────────────────────┐
│  🔧 Your Custom Reports                     [+ New]  │
├──────────────────────────────────────────────────────┤
│  🚗 Uber Spending by Month                           │
│  Bar chart • Last run: 2 mins ago                    │
│  [View] [Edit] [Duplicate] [Delete]                  │
│                                                      │
│  🍽️ Weekend Restaurant Spending                     │
│  Table • Last run: 1 week ago                        │
│  [View] [Edit] [Duplicate] [Delete]                  │
│                                                      │
│  📊 2024 vs 2025 by Category                         │
│  Comparison chart • Last run: 3 days ago             │
│  [View] [Edit] [Duplicate] [Delete]                  │
│                                                      │
│  💳 Credit Card Fees Analysis                        │
│  Table • Last run: 1 month ago                       │
│  [View] [Edit] [Duplicate] [Delete]                  │
└──────────────────────────────────────────────────────┘
```

---

## Edge cases

### Edge case 1: Group by con no aggregation

**Escenario**: el usuario selecciona "Group by: Merchant" pero no selecciona aggregations.

**Comportamiento**: Automáticamente agrega "Count" y "Total" (default aggregations).

---

### Edge case 2: Too many groups

**Escenario**: el usuario selecciona "Group by: Merchant" con 200 merchants.

**Comportamiento**: Mostrar top 50, agregar "Show more" button.

---

### Edge case 3: No results

**Escenario**: Filters muy específicos, no hay data.

**UI**:
```
┌──────────────────────────────────────────────────────┐
│  📭 No data found                                    │
│                                                      │
│  No transactions match your filters.                 │
│  Try adjusting your configuration.                   │
│                                                      │
│  [Edit Configuration]                                │
└──────────────────────────────────────────────────────┘
```

---

## Resumen: Custom Report Builder

### Qué hace
- **Build custom reports** con UI visual
- **Save reports** para re-run después
- **Flexible grouping** (month, category, merchant, etc)
- **Multiple aggregations** (sum, count, avg, min, max)
- **Multiple visualizations** (table, bar, line, pie)
- **Always updated** con latest data

### How it works
- Report config stored as JSON
- SQL query built dynamically from config
- Executed on-demand when el usuario opens report
- Results cached for 5 minutes

### Benefits
- **Flexible**: el usuario puede responder cualquier pregunta
- **Reusable**: Save report, run múltiples veces
- **Fast**: Query execution <1 segundo
- **Visual**: Charts ayudan a ver patterns

### Phase 3 scope
- ✅ Custom report builder UI
- ✅ Save/edit/delete reports
- ✅ Grouping (single level)
- ✅ Aggregations (sum, count, avg)
- ✅ Filters (merchant, date, category, account)
- ✅ Visualizations (table, bar, line, pie)
- ❌ Multi-level grouping (Phase 4)
- ❌ Calculated fields (Phase 4)
- ❌ Scheduled reports (Phase 4)

---

**Próximo flow**: Lee [flow-12-export-data.md](flow-12-export-data.md) para ver cómo el usuario exporta data a CSV/PDF/JSON.
