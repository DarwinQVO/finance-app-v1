# Extensibility Guide

**Cómo extender el sistema sin cambiar el core**

---

## 🎯 Overview

Este doc cubre TODOS los casos de extensión futura:
- ✅ Agregar nueva cuenta (mismo banco)
- ✅ Agregar nuevo banco/parser
- ✅ Agregar nueva categoría
- ✅ Agregar nuevo tipo de transacción
- ✅ Agregar nueva moneda (currency)
- ✅ Agregar nuevo report
- ✅ Agregar nuevo budget type
- ✅ Agregar nueva regla de normalización

**Filosofía**: Todo es data, no código. Extender = INSERT, no refactoring.

---

## 1️⃣ Agregar Nueva Cuenta (Mismo Banco)

**Escenario**: Tienes BofA Checking. Abres BofA Savings.

### Database: accounts table

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,              -- 'bofa-savings'
  user_id TEXT,                     -- NULL en Phase 1, usado en Phase 4

  institution TEXT NOT NULL,        -- 'Bank of America'
  institution_id TEXT NOT NULL,     -- 'bofa' (links to parser)

  account_name TEXT NOT NULL,       -- 'Savings'
  account_type TEXT NOT NULL,       -- 'checking' | 'savings' | 'credit'
  account_number_last4 TEXT,        -- '5678'

  currency TEXT NOT NULL,           -- 'USD'

  color TEXT,                       -- UI color '#4ECDC4'
  icon TEXT,                        -- Emoji '💰'

  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);
```

### Proceso para agregar:

```javascript
// Step 1: User clicks "Add Account"
async function addAccount(accountData) {
  const accountId = generateId(); // 'bofa-savings'

  await db.run(
    `INSERT INTO accounts
     (id, institution, institution_id, account_name, account_type,
      currency, color, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
    accountId,
    accountData.institution,        // 'Bank of America'
    accountData.institutionId,      // 'bofa'
    accountData.accountName,        // 'Savings'
    accountData.accountType,        // 'savings'
    accountData.currency,           // 'USD'
    accountData.color || '#4ECDC4',
    new Date().toISOString()
  );

  return accountId;
}

// Step 2: Upload PDF para esta cuenta
// El parser usa institution_id='bofa' para saber qué config usar
// Las transactions se insertan con account_id='bofa-savings'
```

**NO cambios en código** - Solo INSERT en `accounts` table.

---

## 2️⃣ Agregar Nuevo Banco/Parser

**Escenario**: Abres cuenta en Chase. Necesitas parser para Chase.

### Database: parser_configs table

```sql
CREATE TABLE parser_configs (
  id TEXT PRIMARY KEY,              -- 'chase'
  name TEXT NOT NULL,               -- 'Chase Bank'
  country TEXT NOT NULL,            -- 'US'

  -- Detection (cómo identificar si PDF es de Chase)
  detection_keywords TEXT NOT NULL, -- JSON: ["Chase", "JPMorgan"]
  detection_patterns TEXT,          -- JSON: [{"field": "header", "regex": "..."}]

  -- Parsing rules
  start_marker TEXT NOT NULL,       -- "Date    Description"
  end_marker TEXT,                  -- "Account Summary"
  date_format TEXT NOT NULL,        -- "MM/DD/YYYY"
  decimal_separator TEXT,           -- "."
  thousands_separator TEXT,         -- ","

  -- Field extraction
  field_config TEXT NOT NULL,       -- JSON con regexes para cada campo

  -- Classification
  transfer_keywords TEXT,           -- JSON: ["TRANSFER", "WIRE"]
  income_keywords TEXT,             -- JSON: ["DEPOSIT", "PAYROLL"]

  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);
```

### Proceso para agregar Chase:

#### Option A: Via UI (No-code)

```javascript
// UI Form para agregar parser
function ParserConfigForm() {
  const [config, setConfig] = useState({
    id: 'chase',
    name: 'Chase Bank',
    country: 'US',
    startMarker: 'Date    Description',
    endMarker: 'Account Summary',
    dateFormat: 'MM/DD/YYYY',
    fieldConfig: {
      date: { regex: '^(\\d{2}/\\d{2}/\\d{4})' },
      description: { regex: '\\d{2}/\\d{2}/\\d{4}\\s+(.+?)\\s+[\\d,]+\\.\\d{2}' },
      amount: { regex: '([\\-\\+]?[\\d,]+\\.\\d{2})$' }
    },
    transferKeywords: ['TRANSFER', 'WIRE', 'ACH'],
    incomeKeywords: ['DEPOSIT', 'PAYROLL', 'REFUND']
  });

  async function saveParser() {
    await db.run(
      `INSERT INTO parser_configs
       (id, name, country, detection_keywords, start_marker, end_marker,
        date_format, field_config, transfer_keywords, income_keywords,
        is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
      config.id,
      config.name,
      config.country,
      JSON.stringify(['Chase', 'JPMorgan']),
      config.startMarker,
      config.endMarker,
      config.dateFormat,
      JSON.stringify(config.fieldConfig),
      JSON.stringify(config.transferKeywords),
      JSON.stringify(config.incomeKeywords),
      new Date().toISOString()
    );
  }

  return <ParserConfigFormUI config={config} onChange={setConfig} onSave={saveParser} />;
}
```

#### Option B: Via YAML File

```yaml
# configs/parsers/chase.yaml
id: chase
name: Chase Bank
country: US

detection:
  keywords:
    - Chase
    - JPMorgan Chase Bank
  patterns:
    - field: header
      regex: "Account Number:.*\\d{4}"

parsing:
  start_marker: "Date    Description"
  end_marker: "Account Summary"
  date_format: "MM/DD/YYYY"
  decimal_separator: "."
  thousands_separator: ","

  fields:
    date:
      regex: "^(\\d{2}/\\d{2}/\\d{4})"
      position: start

    description:
      regex: "\\d{2}/\\d{2}/\\d{4}\\s+(.+?)\\s+[\\d,]+\\.\\d{2}"
      cleanup:
        - remove: "#\\d+"
        - remove: "\\s{2,}"

    amount:
      regex: "([\\-\\+]?[\\d,]+\\.\\d{2})$"
      position: -1

classification:
  transfer_keywords:
    - TRANSFER
    - WIRE
    - ACH
    - ZELLE
  income_keywords:
    - DEPOSIT
    - PAYROLL
    - REFUND
    - CREDIT
```

Luego: `yarn import-parser configs/parsers/chase.yaml`

**NO cambios en código del parser** - Todo es config.

---

## 3️⃣ Agregar Nueva Categoría

**Escenario**: Quieres categoría custom "Gym Memberships".

### Process:

```javascript
async function createCategory(categoryData) {
  const categoryId = generateId(); // 'cat_gym'

  await db.run(
    `INSERT INTO categories
     (id, user_id, name, parent_id, color, icon, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)`,
    categoryId,
    categoryData.userId,
    'Gym Memberships',
    'cat_health',          // Parent category (Health)
    '#FF6B6B',
    '💪',
    new Date().toISOString()
  );

  return categoryId;
}

// Categories son jerárquicas
// "Health" (parent)
//   ├─ "Gym Memberships" (custom)
//   ├─ "Pharmacy" (system)
//   └─ "Doctor" (system)
```

**NO cambios en código** - Solo INSERT en `categories` table.

---

## 4️⃣ Agregar Nuevo Tipo de Transacción

**Escenario**: Quieres tipo "investment" (además de expense/income/transfer).

### Current types:

```sql
-- transactions.type puede ser:
-- 'expense' | 'income' | 'transfer'
```

### Para agregar 'investment':

**Step 1**: Update enum constraint (si usas CHECK)

```sql
-- Option A: No constraint (más flexible)
-- type TEXT NOT NULL  -- Cualquier string

-- Option B: Con constraint (más estricto)
ALTER TABLE transactions DROP CONSTRAINT check_type;
ALTER TABLE transactions ADD CONSTRAINT check_type
  CHECK (type IN ('expense', 'income', 'transfer', 'investment'));
```

**Step 2**: Update UI filters

```javascript
const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expenses', icon: '💸', color: '#FF6B6B' },
  { value: 'income', label: 'Income', icon: '💰', color: '#51CF66' },
  { value: 'transfer', label: 'Transfers', icon: '↔️', color: '#4ECDC4' },
  { value: 'investment', label: 'Investments', icon: '📈', color: '#AA96DA' } // NEW
];
```

**Step 3**: Update classification logic

```javascript
function classifyTransaction(description, config) {
  const desc = description.toUpperCase();

  // Check investment keywords
  if (['ROBINHOOD', 'FIDELITY', 'VANGUARD', 'ETF', 'STOCK'].some(kw => desc.includes(kw))) {
    return 'investment';
  }

  // Existing logic...
  if (config.transfer_keywords.some(kw => desc.includes(kw))) {
    return 'transfer';
  }

  // ...
}
```

**Cambios mínimos** - Agregar a lista y lógica de clasificación.

---

## 5️⃣ Agregar Nueva Moneda (Currency)

**Escenario**: Abres cuenta en GBP (British Pounds).

### Current:

```sql
-- transactions.currency puede ser cualquier string
-- 'USD', 'MXN', 'EUR'
```

### Para agregar GBP:

**Step 1**: Agregar exchange rate

```sql
CREATE TABLE exchange_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  date TEXT NOT NULL,
  source TEXT,                      -- 'manual' | 'api'

  PRIMARY KEY (from_currency, to_currency, date)
);

-- Seed data
INSERT INTO exchange_rates VALUES
  ('GBP', 'USD', 1.27, '2025-10-28', 'manual'),
  ('USD', 'GBP', 0.79, '2025-10-28', 'manual');
```

**Step 2**: Update currency selector

```javascript
const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' } // NEW
];
```

**Step 3**: Agregar cuenta con GBP

```javascript
await addAccount({
  institution: 'HSBC UK',
  institutionId: 'hsbc-uk',
  accountName: 'Current Account',
  accountType: 'checking',
  currency: 'GBP'  // Nueva currency
});
```

**NO cambios en schema** - `currency` es TEXT, acepta cualquier código.

---

## 6️⃣ Agregar Nuevo Report

**Escenario**: Quieres report "Spending by Day of Week".

### Process:

**Step 1**: Crear query function

```javascript
// reports/spending-by-day-of-week.js

async function getSpendingByDayOfWeek({ startDate, endDate }) {
  const query = `
    SELECT
      CASE CAST(strftime('%w', date) AS INTEGER)
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END as day_of_week,
      SUM(ABS(amount)) as total,
      COUNT(*) as count,
      AVG(ABS(amount)) as average
    FROM transactions
    WHERE type = 'expense'
    AND date >= ? AND date <= ?
    GROUP BY strftime('%w', date)
    ORDER BY CAST(strftime('%w', date) AS INTEGER)
  `;

  return await db.all(query, [startDate, endDate]);
}

module.exports = { getSpendingByDayOfWeek };
```

**Step 2**: Registrar en report registry

```javascript
// reports/registry.js

const REPORT_REGISTRY = [
  // Existing reports
  { id: 'spending-by-category', name: 'Spending by Category', ... },
  { id: 'spending-trends', name: 'Spending Trends', ... },

  // NEW report
  {
    id: 'spending-by-day-of-week',
    name: 'Spending by Day of Week',
    description: 'See which days you spend the most',
    phase: 3,
    category: 'spending',
    chartType: 'bar',
    execute: require('./spending-by-day-of-week').getSpendingByDayOfWeek
  }
];
```

**Step 3**: UI component (auto-generado)

```javascript
// El report builder genera automáticamente el UI
function ReportViewer({ reportId }) {
  const config = REPORT_REGISTRY.find(r => r.id === reportId);
  const data = await config.execute({ startDate: '2025-01-01', endDate: '2025-12-31' });

  // Auto-render based on chartType
  if (config.chartType === 'bar') {
    return <BarChart data={data} />;
  }
}
```

**Cambios mínimos** - Crear query + registrar en registry.

---

## 7️⃣ Agregar Nuevo Budget Type

**Escenario**: Quieres budget "by tag" (además de category/merchant/account).

### Current budget_type:

```sql
-- budgets.budget_type puede ser:
-- 'category' | 'merchant' | 'account' | 'total'
```

### Para agregar 'tag':

**Step 1**: Update budget creation

```javascript
async function createBudget(budgetData) {
  const budgetId = generateId();

  await db.run(
    `INSERT INTO budgets
     (id, name, budget_type, amount, currency, period_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    budgetId,
    budgetData.name,
    'tag',                    // NEW type
    budgetData.amount,
    budgetData.currency,
    budgetData.periodType,
    new Date().toISOString()
  );

  // Store tag in new column
  await db.run(
    'UPDATE budgets SET tag = ? WHERE id = ?',
    budgetData.tag,           // e.g., 'vacation'
    budgetId
  );

  return budgetId;
}
```

**Step 2**: Update budget tracking

```javascript
async function getBudgetStatus(budgetId) {
  const budget = await db.get('SELECT * FROM budgets WHERE id = ?', budgetId);

  // ... existing logic ...

  // NEW: Handle tag budget
  if (budget.budget_type === 'tag') {
    query += ' AND tags LIKE ?';
    params.push(`%"${budget.tag}"%`); // JSON array contains tag
  }

  // ...
}
```

**Cambios mínimos** - Agregar column + logic para nuevo type.

---

## 8️⃣ Agregar Nueva Regla de Normalización

**Escenario**: Nuevo merchant "AMAZON PRIME" no está cubierto.

### Database: normalization_rules table

```sql
CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,          -- 'regex' | 'exact' | 'contains' | 'fuzzy'
  pattern TEXT NOT NULL,            -- El pattern a matchear
  normalized_merchant TEXT NOT NULL,-- Output: "Amazon"

  suggested_category_id TEXT,       -- Auto-categorization

  priority INTEGER DEFAULT 1,       -- Higher = más prioritario
  is_active BOOLEAN DEFAULT TRUE,

  usage_count INTEGER DEFAULT 0,    -- Stats

  user_id TEXT,                     -- NULL = regla global
  created_at TEXT NOT NULL
);
```

### Process para agregar:

**Via UI** (No-code):

```javascript
async function addNormalizationRule(ruleData) {
  const ruleId = generateId();

  await db.run(
    `INSERT INTO normalization_rules
     (id, rule_type, pattern, normalized_merchant, suggested_category_id,
      priority, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
    ruleId,
    'contains',                      // Match si description contiene "AMAZON PRIME"
    'AMAZON PRIME',
    'Amazon',                        // Normalize to "Amazon"
    'cat_shopping',                  // Auto-categorize as Shopping
    1,
    new Date().toISOString()
  );

  return ruleId;
}

// La próxima vez que se procese "AMAZON PRIME VIDEO MONTHLY":
// 1. Matchea la regla (contains "AMAZON PRIME")
// 2. Normaliza a "Amazon"
// 3. Auto-categoriza como "Shopping"
```

**Via bulk import** (CSV):

```csv
rule_type,pattern,normalized_merchant,suggested_category_id
contains,AMAZON PRIME,Amazon,cat_shopping
regex,STARBUCKS.*#\d+,Starbucks,cat_food_coffee
exact,NETFLIX.COM,Netflix,cat_entertainment_streaming
```

Luego: `yarn import-rules rules.csv`

**NO cambios en código** - Solo INSERT en table.

---

## 9️⃣ Resumen de Extensibilidad

| Caso | Método | Cambios en Código |
|------|--------|-------------------|
| **Nueva cuenta (mismo banco)** | INSERT en `accounts` | ❌ CERO |
| **Nuevo banco/parser** | INSERT en `parser_configs` o YAML | ❌ CERO |
| **Nueva categoría** | INSERT en `categories` | ❌ CERO |
| **Nuevo tipo transacción** | Update enum + UI | ⚠️ MÍNIMO |
| **Nueva moneda** | INSERT en `exchange_rates` | ❌ CERO |
| **Nuevo report** | Create query + register | ⚠️ MÍNIMO |
| **Nuevo budget type** | Add column + logic | ⚠️ MÍNIMO |
| **Nueva regla normalización** | INSERT en `normalization_rules` | ❌ CERO |

---

## 🔟 Database Schema Completo

```sql
-- CORE TABLE
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  type TEXT NOT NULL,
  category_id TEXT,
  subcategory_id TEXT,
  tags TEXT,
  source_type TEXT NOT NULL,
  source_file TEXT,
  source_hash TEXT,
  original_description TEXT,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_fields TEXT,
  notes TEXT,
  recurring_group_id TEXT,
  transfer_pair_id TEXT,
  applies_to_budget_ids TEXT,
  is_tax_deductible BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- AUXILIARY TABLES
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  institution TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number_last4 TEXT,
  currency TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT,
  icon TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  budget_type TEXT NOT NULL,
  category_id TEXT,
  merchant TEXT,
  account_id TEXT,
  tag TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE recurring_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  merchant TEXT NOT NULL,
  frequency TEXT NOT NULL,
  expected_amount REAL,
  next_expected_date TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  normalized_merchant TEXT NOT NULL,
  suggested_category_id TEXT,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE parser_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  detection_keywords TEXT NOT NULL,
  detection_patterns TEXT,
  start_marker TEXT NOT NULL,
  end_marker TEXT,
  date_format TEXT NOT NULL,
  field_config TEXT NOT NULL,
  transfer_keywords TEXT,
  income_keywords TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE exchange_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  date TEXT NOT NULL,
  source TEXT,
  PRIMARY KEY (from_currency, to_currency, date)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  preferences TEXT,
  role TEXT DEFAULT 'user',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
```

---

## ✅ Conclusión

**TODOS los casos de extensión futura están cubiertos**:

✅ **Nueva cuenta** → INSERT en `accounts`
✅ **Nuevo banco** → INSERT en `parser_configs` o YAML
✅ **Nueva categoría** → INSERT en `categories`
✅ **Nuevo tipo txn** → Update enum (cambio mínimo)
✅ **Nueva moneda** → INSERT en `exchange_rates`
✅ **Nuevo report** → Create query + register (cambio mínimo)
✅ **Nuevo budget type** → Add column + logic (cambio mínimo)
✅ **Nueva regla** → INSERT en `normalization_rules`

**Filosofía**: Extender = agregar data, NO cambiar código.

---

**Próximo**: Lee [SYSTEM-COMPLETE-SCOPE.md](SYSTEM-COMPLETE-SCOPE.md) para ver todas las 168 features.
