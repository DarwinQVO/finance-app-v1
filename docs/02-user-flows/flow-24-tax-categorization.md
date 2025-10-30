# Flow 24: Tax Categorization 💼

**Phase**: 3 (Analysis)
**Priority**: Medium
**Complexity**: Medium
**Related Flows**: flow-7 (categories), flow-10 (reports), flow-12 (export)

---

## 1. Funcionalidad

Sistema para marcar y trackear gastos tax-deductible con reporting anual.

**Capacidades**:
1. **Mark as deductible** - Manual o automático por category
2. **Deduction percentage** - 50%, 100%, configurable por transaction
3. **Tax categories** - Business, medical, charitable, home office
4. **Year-end tax report** - Summary con totals por category
5. **Multi-year tracking** - Compare deductions año tras año

**NO incluye**: Export automático para CPA (usuarios exportan manualmente via flow-12)

---

## 2. Implementación

### Schema Extensions

```sql
-- Already exists in transactions table
ALTER TABLE transactions ADD COLUMN is_tax_deductible BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN tax_deduction_percentage INTEGER DEFAULT 100;
-- Values: 0-100 (100 = fully deductible, 50 = 50% deductible)

ALTER TABLE transactions ADD COLUMN tax_category TEXT;
-- Values: 'business_meals', 'home_office', 'travel', 'medical', 'charitable', etc.

ALTER TABLE transactions ADD COLUMN tax_notes TEXT;
-- User notes for this deduction (e.g., "Meeting with client John")

CREATE INDEX idx_transactions_tax ON transactions(is_tax_deductible, tax_category);
```

### Tax Categories Table

```sql
CREATE TABLE tax_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_percentage INTEGER DEFAULT 100,
  schedule_type TEXT,  -- 'schedule_c', 'schedule_a', etc.
  created_at TEXT NOT NULL
);

-- Pre-populate common categories
INSERT INTO tax_categories VALUES
  ('business_meals', 'Business Meals', 'Meals with clients or business associates', 50, 'schedule_c', datetime('now')),
  ('home_office', 'Home Office', 'Home office expenses', 100, 'schedule_c', datetime('now')),
  ('travel', 'Business Travel', 'Travel for business purposes', 100, 'schedule_c', datetime('now')),
  ('vehicle', 'Vehicle Expenses', 'Business use of vehicle', 100, 'schedule_c', datetime('now')),
  ('supplies', 'Office Supplies', 'Business supplies and equipment', 100, 'schedule_c', datetime('now')),
  ('medical', 'Medical Expenses', 'Qualifying medical expenses', 100, 'schedule_a', datetime('now')),
  ('charitable', 'Charitable Donations', 'Donations to qualified organizations', 100, 'schedule_a', datetime('now'));
```

---

## 3. User Story: el usuario marca deductions

### Escena 1: Mark transaction as deductible

**Sep 15**: el usuario tuvo lunch meeting con cliente. Pagó $87 en restaurant.

Transaction en timeline:
```
Sep 15  Ruth's Chris Steakhouse  -$87.00 USD
```

**Usuario hace esto**:
1. Click en transaction → Detail panel abre
2. Ve sección "Tax Info"

```
┌─────────────────────────────────────────────┐
│  Transaction Details                        │
├─────────────────────────────────────────────┤
│  Ruth's Chris Steakhouse                    │
│  Sep 15, 2025                               │
│  -$87.00 USD                                │
│                                             │
│  Category: Food & Dining                    │
│  Account: Chase Sapphire                    │
│                                             │
│  ────────────────────────────────────────   │
│                                             │
│  💼 Tax Info                                │
│  ☐ Tax Deductible                           │
│                                             │
│  [Edit] [Delete] [Close]                    │
└─────────────────────────────────────────────┘
```

3. Usuario marca checkbox "Tax Deductible"

### Escena 2: Configure tax details

Checkbox ahora está marcado → Aparecen más opciones:

```
┌─────────────────────────────────────────────┐
│  💼 Tax Info                                │
│  ☑ Tax Deductible                           │
│                                             │
│  Tax Category:                              │
│  [Business Meals        ▾]                  │
│                                             │
│  Deductible %:                              │
│  [50%] (Business meals are 50% deductible)  │
│                                             │
│  Notes (optional):                          │
│  ┌─────────────────────────────────────┐   │
│  │ Lunch meeting with client John      │   │
│  │ to discuss Q4 project               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Deductible amount: $43.50                  │
│  (50% of $87.00)                            │
└─────────────────────────────────────────────┘
```

4. Usuario selecciona "Business Meals" → Auto-fills 50%
5. Agrega note: "Lunch meeting with client John"
6. Click Save

### Escena 3: Timeline shows tax indicator

Transaction ahora muestra tax indicator:

```
Sep 15  Ruth's Chris  -$87.00 💼 (50% deductible)
```

---

## 4. Auto-Categorization

### Category Rules

```sql
CREATE TABLE category_tax_rules (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  auto_mark_deductible BOOLEAN DEFAULT FALSE,
  default_tax_category TEXT,
  default_percentage INTEGER,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Example: All "Business Expenses" category → auto-mark
INSERT INTO category_tax_rules VALUES
  ('rule_1', 'cat_business_expenses', TRUE, 'business_expenses', 100);
```

### Workflow

```javascript
// When user categorizes transaction
async function categorizeTransaction(txnId, categoryId) {
  await db.run('UPDATE transactions SET category_id = ? WHERE id = ?', [categoryId, txnId]);

  // Check if this category has tax rule
  const rule = await db.get(`
    SELECT * FROM category_tax_rules
    WHERE category_id = ? AND auto_mark_deductible = TRUE
  `, [categoryId]);

  if (rule) {
    // Auto-mark as deductible
    await db.run(`
      UPDATE transactions
      SET is_tax_deductible = TRUE,
          tax_category = ?,
          tax_deduction_percentage = ?
      WHERE id = ?
    `, [rule.default_tax_category, rule.default_percentage, txnId]);
  }
}
```

**Example**: Usuario categoriza transaction como "Business Expenses" → Automáticamente se marca como 100% deductible.

---

## 5. Tax Report (Year-End Summary)

### Escena 1: Generate tax report

**Jan 2026**: el usuario necesita summary de 2025 para taxes.

Usuario va a Reports → "Tax Summary"

```
┌──────────────────────────────────────────────────────┐
│  💼 Tax Summary Report                               │
├──────────────────────────────────────────────────────┤
│  Tax Year: [2025 ▾]                                  │
│  Schedule: [All Schedules ▾]                         │
│                                                      │
│  [Generate Report]                                   │
└──────────────────────────────────────────────────────┘
```

Usuario click "Generate Report".

### Escena 2: Tax summary display

```
┌──────────────────────────────────────────────────────────────┐
│  💼 Tax Summary - 2025                      [Export] [Print] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 Schedule C - Business Expenses                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Business Meals (50% deductible)                    │     │
│  │ 23 transactions • $2,340 total                     │     │
│  │ Deductible amount: $1,170                          │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Business Travel (100% deductible)                  │     │
│  │ 12 transactions • $3,456 total                     │     │
│  │ Deductible amount: $3,456                          │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Home Office (100% deductible)                      │     │
│  │ 12 transactions • $1,200 total                     │     │
│  │ Deductible amount: $1,200                          │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Office Supplies (100% deductible)                  │     │
│  │ 18 transactions • $890 total                       │     │
│  │ Deductible amount: $890                            │     │
│  └────────────────────────────────────────────────────┘     │
│  Schedule C Total: $6,716                                    │
│                                                              │
│  📋 Schedule A - Itemized Deductions                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Medical Expenses (100% deductible)                 │     │
│  │ 8 transactions • $4,567 total                      │     │
│  │ Deductible amount: $4,567                          │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Charitable Donations (100% deductible)             │     │
│  │ 5 transactions • $1,200 total                      │     │
│  │ Deductible amount: $1,200                          │     │
│  └────────────────────────────────────────────────────┘     │
│  Schedule A Total: $5,767                                    │
│                                                              │
│  ════════════════════════════════════════════════════       │
│  Total Deductible (2025): $12,483                            │
│                                                              │
│  Estimated tax savings (at 30% rate): $3,744.90              │
│  ════════════════════════════════════════════════════       │
│                                                              │
│  [View Transactions] [Export to CSV] [Print]                │
└──────────────────────────────────────────────────────────────┘
```

### Escena 3: View detailed transactions

Usuario click "View Transactions" en "Business Meals":

```
┌──────────────────────────────────────────────────────────────┐
│  Business Meals - 2025 (23 transactions)                     │
├──────────────────────────────────────────────────────────────┤
│  Sep 15  Ruth's Chris          $87.00   50%  → $43.50       │
│          Note: Lunch with client John                        │
│                                                              │
│  Sep 22  Olive Garden          $65.00   50%  → $32.50       │
│          Note: Team dinner                                   │
│                                                              │
│  Oct 3   Starbucks             $12.00   50%  → $6.00        │
│          Note: Coffee meeting                                │
│                                                              │
│  Oct 10  Morton's              $156.00  50%  → $78.00       │
│          Note: Client dinner - Project X                     │
│                                                              │
│  ... (19 more)                                               │
│                                                              │
│  Total: $2,340 → $1,170 deductible                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Query Implementation

### Tax Report Query

```javascript
async function generateTaxReport(taxYear) {
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  // Get all deductible transactions
  const deductibles = await db.all(`
    SELECT
      tax_category,
      COUNT(*) as transaction_count,
      SUM(ABS(amount)) as total_amount,
      SUM(ABS(amount) * tax_deduction_percentage / 100) as deductible_amount
    FROM transactions
    WHERE is_tax_deductible = TRUE
    AND date >= ? AND date <= ?
    GROUP BY tax_category
    ORDER BY deductible_amount DESC
  `, [startDate, endDate]);

  // Get tax category details
  const report = [];
  for (const item of deductibles) {
    const category = await db.get(
      'SELECT * FROM tax_categories WHERE id = ?',
      [item.tax_category]
    );

    report.push({
      category: category.name,
      schedule: category.schedule_type,
      transaction_count: item.transaction_count,
      total_amount: item.total_amount,
      deductible_amount: item.deductible_amount,
      percentage: category.default_percentage
    });
  }

  // Group by schedule
  const bySchedule = {};
  for (const item of report) {
    if (!bySchedule[item.schedule]) {
      bySchedule[item.schedule] = [];
    }
    bySchedule[item.schedule].push(item);
  }

  return {
    taxYear,
    bySchedule,
    totalDeductible: deductibles.reduce((sum, d) => sum + d.deductible_amount, 0)
  };
}
```

---

## 7. Bulk Operations

### Mark multiple as deductible

Usuario selecciona 10 transactions → "Mark as Deductible"

```
┌─────────────────────────────────────────────┐
│  Mark 10 Transactions as Deductible        │
├─────────────────────────────────────────────┤
│                                             │
│  Tax Category:                              │
│  [Business Travel   ▾]                      │
│                                             │
│  Deductible %:                              │
│  [100%]                                     │
│                                             │
│  Apply to all selected:                     │
│  [Apply] [Cancel]                           │
└─────────────────────────────────────────────┘
```

### Code

```javascript
async function bulkMarkDeductible(transactionIds, taxCategory, percentage) {
  await db.run(`
    UPDATE transactions
    SET is_tax_deductible = TRUE,
        tax_category = ?,
        tax_deduction_percentage = ?
    WHERE id IN (${transactionIds.map(() => '?').join(',')})
  `, [taxCategory, percentage, ...transactionIds]);

  return { updated: transactionIds.length };
}
```

---

## 8. Multi-Year Comparison

### Report comparison

```
┌──────────────────────────────────────────────────────────────┐
│  💼 Tax Summary - Multi-Year Comparison                      │
├──────────────────────────────────────────────────────────────┤
│  Years: [2023 ☑] [2024 ☑] [2025 ☑]                          │
│                                                              │
│  Schedule C - Business Expenses                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              2023      2024      2025     Trend     │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Business     $1,200    $1,450    $1,170   ↓ 19%    │     │
│  │ Meals                                              │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Travel       $2,100    $3,200    $3,456   ↑ 8%     │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ Home Office  $1,200    $1,200    $1,200   → 0%     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Total:        $5,890    $7,234    $6,716                    │
│  Year-over-year: +23%      -7%                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Settings & Configuration

### Tax Settings

```
Settings → Tax

┌─────────────────────────────────────────────┐
│  💼 Tax Settings                            │
├─────────────────────────────────────────────┤
│                                             │
│  Tax Year:                                  │
│  ○ Calendar Year (Jan-Dec)                  │
│  ○ Fiscal Year: [Start month ▾]            │
│                                             │
│  Tax Rate (for estimates):                  │
│  [30] %                                     │
│                                             │
│  Auto-mark categories:                      │
│  ☑ Business Expenses → 100% deductible      │
│  ☑ Business Meals → 50% deductible          │
│  ☐ Travel → 100% deductible                 │
│                                             │
│  [Save Settings]                            │
└─────────────────────────────────────────────┘
```

---

## 10. Edge Cases

### Edge case 1: Partial business use

**Scenario**: Dinner was 60% business, 40% personal.

**Solution**: Set percentage to 60%.

```
Deductible %: [60%]
Notes: "Dinner with spouse and client - 60% business"
```

### Edge case 2: Change deduction mid-year

**Scenario**: IRS cambió business meal deduction de 50% → 100% en Oct 2025.

**Solution**: Bulk update old transactions or leave as-is (historically accurate).

### Edge case 3: Missing receipts

**User concern**: "Need receipts for audit"

**Solution**: Usuario puede attach receipts via flow-3 (attachments). Tax report doesn't require receipts to display data.

---

## 11. Resumen

### Qué hace
- Mark transactions como tax-deductible
- Configure deduction percentage (0-100%)
- Auto-categorization por category rules
- Year-end tax summary report
- Multi-year comparison
- Bulk operations

### Tax Categories
- Schedule C (Business):
  - Business meals (50%)
  - Travel (100%)
  - Home office (100%)
  - Supplies (100%)
- Schedule A (Itemized):
  - Medical expenses (100%)
  - Charitable donations (100%)

### Reporting
- Total deductible por año
- Breakdown por schedule y category
- Transaction list con notes
- Estimated tax savings
- Multi-year trends

### Benefits
- **Organized** - Todo trackeable durante año
- **Accurate** - No olvidar deductions
- **Simple** - Mark as deductible con 2 clicks
- **Flexible** - Custom percentages y categories

### Phase 3 scope
- ✅ Mark as deductible (manual + auto)
- ✅ Tax categories (Schedule C/A)
- ✅ Year-end tax report
- ✅ Multi-year comparison
- ✅ Bulk operations
- ❌ Export para CPA (usuario usa flow-12 para export manual)
- ❌ Receipt OCR scanning (Phase 5)
- ❌ State tax tracking (Phase 5)

---

**LOC estimate**: ~200 líneas (UI + queries + report generation)

**Note**: Usuarios pueden exportar tax data usando flow-12 (Export Data) seleccionando filtro "Tax Deductible = Yes" y date range 2025.
