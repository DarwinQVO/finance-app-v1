# Finance App - Arquitectura Completa

**Arquitectura simple pero escalable para soportar TODAS las features**

---

## 🎯 Principios de Diseño

1. ✅ **Simple first** - Empezar con lo mínimo necesario
2. ✅ **No over-engineering** - Sin abstracciones innecesarias
3. ✅ **No limitante** - Decisiones de hoy no bloquean mañana
4. ✅ **Config-driven** - Parametrizar, no hardcodear
5. ✅ **Modular** - Features se agregan sin tocar core

---

## 💡 Decisiones Arquitectónicas

### Arquitectura Elegida

**1 tabla core + auxiliares cuando necesario**:
- Tabla `transactions` contiene todos los campos relevantes
- Una transacción = un row
- Queries simples, performance eficiente

**Config-driven parsers**:
- Parsers definidos en tabla `parser_configs`
- Agregar banco = INSERT config, no código
- Extensible por el usuario

**Features modulares**:
- Categories, budgets, multi-user = tablas independientes
- Cada feature se agrega sin modificar core
- Phase 1 funciona standalone

### Beneficios de la Arquitectura

**Simplicidad**:
- Menos abstracciones, menos bugs
- Una fuente de verdad, no inconsistencias
- Código mantenible

**Extensibilidad**:
- Usuario puede agregar bancos sin esperar developers
- Config-driven, no hardcoded
- Customización completa

**Escalabilidad**:
- Phase 1 funciona standalone
- Phases 2-4 agregan features sin refactor
- Modular y testeable

### Database Architecture

**Single-table approach**:

```
Upload PDF
    ↓
┌─────────────────────────────────────────┐
│          transactions                   │
│  ┌─────────────────────────────────┐   │
│  │ • raw (original_description)    │   │
│  │ • normalized (merchant)         │   │
│  │ • enriched (category_id)        │   │
│  │ • reconciled (is_duplicate)     │   │
│  │ • metadata (source_*, edited_*) │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Todo en UN lugar                       │
│  Todo en UN row                         │
│  Todo en UNA query                      │
└─────────────────────────────────────────┘
         ↓ (FKs simples)
┌─────────────┬──────────────┬─────────────┐
│  accounts   │  categories  │   budgets   │
│  (metadata) │  (optional)  │  (optional) │
└─────────────┴──────────────┴─────────────┘

Características:
  - 1 tabla core
  - Simple queries (0-1 JOINs)
  - Fast performance
  - No inconsistencias
```

### Extensibilidad Config-Driven

**Agregar nuevo banco**:

```sql
INSERT INTO parser_configs (
  id, name, detection_keywords, field_config
) VALUES (
  'scotiabank_mx',
  'Scotiabank México',
  '["Scotiabank", "México"]',
  '{"date": {"regex": "..."}, ...}'
);
```

**Resultado**:
- Tiempo: ~5 minutos
- Código: 0 LOC
- Funciona inmediatamente

---

## 📊 Database Schema

### **1 tabla CORE + tablas auxiliares por feature**

### Core Table: `transactions`

**La tabla principal que TODO usa**

```sql
CREATE TABLE transactions (
  -- ==========================================
  -- IDENTITY
  -- ==========================================
  id TEXT PRIMARY KEY,
  user_id TEXT,                     -- NULL en Phase 1, usado en Phase 4

  -- ==========================================
  -- BASIC DATA (siempre presente)
  -- ==========================================
  account_id TEXT NOT NULL,         -- FK a accounts table
  date TEXT NOT NULL,               -- ISO: 2025-10-28
  merchant TEXT NOT NULL,           -- Normalizado: "Starbucks"
  merchant_raw_full TEXT,           -- Raw description completa con metadata (Phase 1)
  amount REAL NOT NULL,             -- -5.67 (negativo = gasto)
  currency TEXT NOT NULL,           -- USD | MXN | EUR
  type TEXT NOT NULL,               -- expense | income | transfer

  -- ==========================================
  -- MULTI-CURRENCY (Phase 1 - Edge Case #2)
  -- ==========================================
  amount_original REAL,             -- Monto en moneda original (e.g., 1900.00 MXN)
  currency_original TEXT,           -- Moneda original (MXN cuando currency=USD)
  exchange_rate REAL,               -- Rate usado (e.g., 19.487 MXN/USD)

  -- ==========================================
  -- CATEGORIZATION (Phase 2)
  -- ==========================================
  category_id TEXT,                 -- FK a categories table
  subcategory_id TEXT,              -- FK a categories table
  tags TEXT,                        -- JSON array: ["coffee", "work"]
  bank_provided_category TEXT,      -- Category del banco (reference only)

  -- ==========================================
  -- SOURCE METADATA (auditoría)
  -- ==========================================
  source_type TEXT NOT NULL,        -- pdf | csv | manual | api | mobile | invoice
  source_file TEXT,                 -- Filename si es pdf/csv
  source_hash TEXT,                 -- SHA256 para dedup
  original_description TEXT,        -- ✅ Raw del source
  original_line_number INTEGER,
  bank_transaction_id TEXT,         -- ID del banco (reference only)

  -- ==========================================
  -- USER CUSTOMIZATION
  -- ==========================================
  is_edited BOOLEAN DEFAULT FALSE,  -- User modificó algo?
  edited_fields TEXT,               -- JSON: ["merchant", "category"]
  edited_at TEXT,
  notes TEXT,                       -- Notas del user
  attachments TEXT,                 -- JSON: [{type: "receipt", url: "..."}]

  -- ==========================================
  -- PIPELINE METADATA
  -- ==========================================
  confidence REAL,                  -- 0.0-1.0
  normalization_rule_id TEXT,       -- Qué regla aplicó
  cluster_id TEXT,                  -- ID del cluster
  metadata TEXT,                    -- JSON para metadata estructurada del banco

  -- ==========================================
  -- RELATIONSHIPS
  -- ==========================================
  transfer_pair_id TEXT,            -- Link a otra transaction (transfer)
  transfer_detection_confidence REAL, -- 0.0-1.0 confidence del transfer detection
  recurring_group_id TEXT,          -- Link a recurring_groups table (optional - Phase 2)
  receivable_id TEXT,               -- Link a receivables table (cuando es pago de invoice)
  split_parent_id TEXT,             -- Si es parte de split transaction
  refund_link_id TEXT,              -- DEPRECATED - usar refund_of_transaction_id
  refund_of_transaction_id TEXT,    -- Link al charge original si esto es refund (Phase 2)
  pending_link_id TEXT,             -- DEPRECATED - usar pending → posted flow

  -- ==========================================
  -- FEES (Phase 1 - Edge Case #7)
  -- ==========================================
  foreign_fee_transaction_id TEXT,  -- Link a fee transaction separada
  is_fee_for_transaction_id TEXT,   -- Este txn es fee de otro txn

  -- ==========================================
  -- REVERSALS & ADJUSTMENTS (Phase 1 - Edge Case #5)
  -- ==========================================
  is_reversal BOOLEAN DEFAULT FALSE,    -- Banco canceló pending charge
  is_adjustment BOOLEAN DEFAULT FALSE,  -- Corrección posterior
  is_refund BOOLEAN DEFAULT FALSE,      -- Merchant devolvió dinero
  reversal_of_transaction_id TEXT,      -- Link al txn original reversed

  -- ==========================================
  -- INSTALLMENTS (Phase 2 - Edge Case #15)
  -- ==========================================
  installment_current INTEGER,      -- e.g., 22
  installment_total INTEGER,        -- e.g., 24
  installment_group_id TEXT,        -- Link installments together

  -- ==========================================
  -- INTEREST (Phase 1 - Edge Case #13)
  -- ==========================================
  interest_type TEXT,               -- 'purchases' | 'cash-advance' | 'balance-transfer' | 'general'

  -- ==========================================
  -- CASH ADVANCES (Phase 1 - Edge Case #14)
  -- ==========================================
  is_cash_advance BOOLEAN DEFAULT FALSE,
  cash_advance_fee REAL,            -- Fee charged for cash advance

  -- ==========================================
  -- TAX INFO - MEXICO (Phase 1 - Edge Case #21)
  -- ==========================================
  rfc TEXT,                         -- RFC del merchant (Mexico tax ID)
  iva_amount REAL,                  -- IVA amount (Mexico VAT)
  folio_rastreo TEXT,               -- SPEI tracking number
  numero_referencia TEXT,           -- Reference number

  -- ==========================================
  -- ACCOUNT LINKING (Phase 1 - Edge Case #20)
  -- ==========================================
  linked_account_identifier TEXT,   -- e.g., "5226" (last 4) or CLABE
  linked_account_type TEXT,         -- 'last-4' | 'clabe' | 'iban' | 'routing-account'

  -- ==========================================
  -- BUDGETS & TAX (Phase 2-3)
  -- ==========================================
  applies_to_budget_ids TEXT,       -- JSON array de budget IDs

  tax_deduction_percentage INTEGER DEFAULT 100,  -- 0-100% deductible (Phase 3)
  tax_category TEXT,                             -- Tax category (Schedule C, A, etc.)
  tax_notes TEXT,                                -- Notes for tax filing

  -- ==========================================
  -- FLAGS & STATUS
  -- ==========================================
  is_duplicate BOOLEAN DEFAULT FALSE,
  is_pending BOOLEAN DEFAULT FALSE,
  is_reconciled BOOLEAN DEFAULT FALSE,
  is_tax_deductible BOOLEAN DEFAULT FALSE,
  is_internal_transfer BOOLEAN DEFAULT FALSE,  -- Wise "Added money" type

  status TEXT DEFAULT 'posted',     -- pending | posted | cancelled (Phase 1)
  status_changed_at TEXT,           -- When status changed from pending → posted

  refund_status TEXT,               -- NULL | 'original' | 'refund' | 'disputed' (Phase 2)
  refund_amount REAL,               -- Amount of refund if partial

  bank_reported_balance REAL,       -- Balance reportado por banco (validation)

  -- ==========================================
  -- TIMESTAMPS
  -- ==========================================
  transaction_date TEXT NOT NULL,   -- Fecha real de la transacción
  posted_date TEXT,                 -- Fecha que el banco la posted (puede diferir)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- ==========================================
  -- FOREIGN KEYS
  -- ==========================================
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (normalization_rule_id) REFERENCES normalization_rules(id),
  FOREIGN KEY (recurring_group_id) REFERENCES recurring_groups(id)
);

-- ==========================================
-- INDEXES (optimizados para queries comunes)
-- ==========================================
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_source_hash ON transactions(source_hash);
CREATE INDEX idx_transactions_recurring ON transactions(recurring_group_id);
CREATE INDEX idx_transactions_pending ON transactions(is_pending) WHERE is_pending = TRUE;
CREATE INDEX idx_transactions_transfer_pair ON transactions(transfer_pair_id);
CREATE INDEX idx_transactions_reversal ON transactions(is_reversal) WHERE is_reversal = TRUE;
```

**Por qué 1 tabla es suficiente:**
- ✅ Tiene el raw (`original_description`)
- ✅ Sabe si fue editado (`is_edited`, `edited_fields`)
- ✅ Auditoría completa (`source_*` fields)
- ✅ Extensible (campos para features futuras)
- ✅ Performante (índices correctos)

---

### Auxiliary Tables

**Solo crear tablas adicionales cuando sea NECESARIO**

#### `accounts` (Phase 1)

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,                     -- Multi-user en Phase 4

  name TEXT NOT NULL,               -- "Bank of America Checking"
  bank TEXT NOT NULL,               -- "bofa" (ID del parser config)
  type TEXT NOT NULL DEFAULT 'checking', -- checking | savings | credit_card | investment (Edge Case #9)

  currency TEXT NOT NULL,           -- Default currency
  color TEXT,                       -- UI color
  icon TEXT,                        -- UI icon

  balance_current REAL,             -- Balance actual (opcional)
  balance_last_updated TEXT,

  -- Credit Card specific fields (Edge Case #14)
  credit_limit REAL,                -- Límite de crédito (solo para credit_card)
  payment_due_date TEXT,            -- Fecha de vencimiento del pago
  apr_purchases REAL,               -- APR for purchases (Edge Case #13)
  apr_cash_advance REAL,            -- APR for cash advances (Edge Case #14)

  is_active BOOLEAN DEFAULT TRUE,
  group_name TEXT,                  -- Para agrupar (e.g., "Personal", "Business")

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for filtering by account type
CREATE INDEX idx_accounts_type ON accounts(type);
```

---

#### `categories` (Phase 2)

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,                     -- Multi-user

  name TEXT NOT NULL,               -- "Food & Dining"
  parent_id TEXT,                   -- Hierarchical (subcategory)

  color TEXT,
  icon TEXT,

  is_system BOOLEAN DEFAULT FALSE,  -- System vs user-created
  is_active BOOLEAN DEFAULT TRUE,

  created_at TEXT NOT NULL,

  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Default categories (pre-populated)
INSERT INTO categories VALUES
  ('cat_food', NULL, 'Food & Dining', NULL, '#FF6B6B', '🍔', TRUE, TRUE, '2025-01-01'),
  ('cat_food_restaurants', NULL, 'Restaurants', 'cat_food', '#FF6B6B', '🍽️', TRUE, TRUE, '2025-01-01'),
  ('cat_food_groceries', NULL, 'Groceries', 'cat_food', '#FF6B6B', '🛒', TRUE, TRUE, '2025-01-01'),
  ('cat_transport', NULL, 'Transportation', NULL, '#4ECDC4', '🚗', TRUE, TRUE, '2025-01-01'),
  -- ... más categories
;
```

---

#### `budgets` (Phase 2)

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

---

#### `recurring_groups` (Phase 2)

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

---

#### `balance_checks` (Phase 3 - Validación)

**Validación opcional de balances**

```sql
CREATE TABLE balance_checks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  check_date TEXT NOT NULL,        -- Fecha del check

  -- Balances
  expected_balance REAL NOT NULL,  -- User ingresa esto
  calculated_balance REAL NOT NULL,-- Sistema calcula
  difference REAL NOT NULL,        -- expected - calculated

  -- Status
  status TEXT CHECK(status IN ('ok', 'warning', 'error')),
  notes TEXT,                      -- User puede agregar notas

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,                -- Cuando se resuelve la discrepancia

  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_balance_checks_account ON balance_checks(account_id);
CREATE INDEX idx_balance_checks_date ON balance_checks(check_date);
```

**Uso**:
- User ingresa balance esperado (del statement bancario)
- Sistema calcula balance sumando transactions
- Muestra diferencia si no cuadra
- Ayuda a detectar transacciones faltantes o errores

---

#### `receivables` (Invoices & Loans)

```sql
CREATE TABLE receivables (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  -- Invoice/Loan info
  invoice_number TEXT UNIQUE,       -- "INV-1234" o "LOAN-abc123"
  client_name TEXT NOT NULL,        -- "Cliente X" o "Juan"
  type TEXT DEFAULT 'invoice',      -- invoice | loan

  -- Amounts
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Dates
  invoice_date TEXT NOT NULL,       -- Fecha de emisión
  due_date TEXT NOT NULL,           -- Fecha de vencimiento
  paid_date TEXT,                   -- Fecha de pago (cuando se cobra)

  -- Status
  status TEXT DEFAULT 'pending',    -- pending | paid | overdue | cancelled

  -- Matching to transactions
  matched_transaction_id TEXT,      -- FK a transactions table (cuando se cobra)
  match_confidence REAL,            -- 0.0-1.0

  -- Source
  source_file TEXT,                 -- PDF filename del invoice
  source_hash TEXT,                 -- SHA256 para dedup
  notes TEXT,                       -- Notas adicionales

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (matched_transaction_id) REFERENCES transactions(id)
);

CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_due_date ON receivables(due_date);
CREATE INDEX idx_receivables_client ON receivables(client_name);
CREATE INDEX idx_receivables_type ON receivables(type);
```

**Uso**:
- **Invoices**: Facturas que emitiste a clientes
- **Loans**: Préstamos personales que hiciste

**Workflow**:
1. Subes invoice PDF → Parser extrae datos → Crea receivable con `status: pending`
2. Cliente paga → Entra en bank statement → Matching automático → `status: paid`
3. Si pasa `due_date` y sigue `pending` → `status: overdue` → Alerta

---

#### `normalization_rules` (Phase 1)

**Config-driven normalization (NO hardcoded)**

```sql
CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,

  rule_type TEXT NOT NULL,          -- regex | exact | contains | starts_with
  pattern TEXT NOT NULL,            -- e.g., "STARBUCKS.*#\d+"
  normalized_merchant TEXT NOT NULL, -- e.g., "Starbucks"

  -- Auto-categorization
  suggested_category_id TEXT,

  priority INTEGER DEFAULT 0,       -- Orden de aplicación
  is_active BOOLEAN DEFAULT TRUE,

  -- Stats
  times_applied INTEGER DEFAULT 0,
  last_applied_at TEXT,

  created_at TEXT NOT NULL,

  FOREIGN KEY (suggested_category_id) REFERENCES categories(id)
);

-- Examples (pre-populated)
INSERT INTO normalization_rules VALUES
  ('rule_1', 'regex', 'STARBUCKS.*#\d+', 'Starbucks', 'cat_food_restaurants', 1, TRUE, 0, NULL, '2025-01-01'),
  ('rule_2', 'regex', 'AMAZON\.COM\*[A-Z0-9]+', 'Amazon', NULL, 1, TRUE, 0, NULL, '2025-01-01'),
  -- ... más rules
;
```

---

#### `rfc_registry` (Phase 1 - Mexico Tax IDs - Edge Case #21)

**Registry de RFCs (Mexico tax IDs) para auto-completar merchant names**

```sql
CREATE TABLE rfc_registry (
  rfc TEXT PRIMARY KEY,             -- RFC del merchant (12-13 chars)
  merchant_name TEXT NOT NULL,      -- Nombre del merchant
  merchant_type TEXT,               -- 'restaurant' | 'retail' | 'utility' | 'service' | etc
  verified BOOLEAN DEFAULT FALSE,   -- User-verified vs auto-detected

  times_seen INTEGER DEFAULT 1,     -- Cuántas veces apareció este RFC
  last_seen_at TEXT,

  created_at TEXT NOT NULL
);

CREATE INDEX idx_rfc_merchant ON rfc_registry(merchant_name);

-- Examples (pre-populated - common Mexican merchants)
INSERT INTO rfc_registry VALUES
  ('UPM200220LK5', 'Uber', 'service', TRUE, 0, NULL, '2025-01-01'),
  ('UPM191014S31', 'Uber Eats', 'service', TRUE, 0, NULL, '2025-01-01'),
  ('CSI020226MV4', 'Starbucks', 'restaurant', TRUE, 0, NULL, '2025-01-01'),
  ('MAX0611157H8', 'GNC', 'retail', TRUE, 0, NULL, '2025-01-01'),
  ('SAT8410245V8', 'SAT (Impuestos)', 'government', TRUE, 0, NULL, '2025-01-01'),
  ('CNM980114PI2', 'CFE (Luz)', 'utility', TRUE, 0, NULL, '2025-01-01')
;
```

**Uso**:
- Scotiabank incluye RFC en cada transacción
- Si RFC ya está en registry → auto-completar merchant
- Si RFC nuevo → agregar a registry + user puede verificar
- Ayuda con normalización automática

---

#### `parser_configs` (Phase 1)

**Config-driven parsers (NO hardcoded 4 banks)**

```sql
CREATE TABLE parser_configs (
  id TEXT PRIMARY KEY,              -- e.g., "bofa", "chase", "amex"

  name TEXT NOT NULL,               -- "Bank of America"
  bank_country TEXT,                -- US | MX | etc

  -- Detection
  detection_keywords TEXT NOT NULL, -- JSON: ["Bank of America", "Member FDIC"]
  detection_patterns TEXT,          -- JSON: [{"field": "header", "regex": "..."}]

  -- Field mapping (JSON config)
  field_config TEXT NOT NULL,       -- JSON: {"date": {"regex": "...", "line": 5}, ...}

  -- Parsing config
  start_marker TEXT,                -- "Date        Description"
  end_marker TEXT,                  -- "Account Summary"
  date_format TEXT,                 -- "MMM DD" | "DD/MM/YYYY"
  decimal_separator TEXT DEFAULT '.',
  thousands_separator TEXT DEFAULT ',',

  -- Classification hints
  transfer_keywords TEXT,           -- JSON: ["TRANSFER", "WIRE"]
  income_keywords TEXT,             -- JSON: ["SALARY", "DEPOSIT"]

  is_active BOOLEAN DEFAULT TRUE,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Ejemplo de field_config JSON**:
```json
{
  "date": {
    "regex": "^([A-Z][a-z]{2}\\s+\\d{1,2})",
    "format": "MMM DD"
  },
  "description": {
    "regex": "^[A-Z][a-z]{2}\\s+\\d{1,2}\\s+(.+?)\\s+[\\-\\+]?[\\d,]+\\.\\d{2}"
  },
  "amount": {
    "regex": "([\\-\\+]?[\\d,]+\\.\\d{2})\\s+[\\d,]+\\.\\d{2}$"
  }
}
```

---

#### `users` (Phase 4 - Multi-user)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,

  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  display_name TEXT,
  avatar_url TEXT,

  -- Preferences
  preferences TEXT,                 -- JSON: {theme, language, currency, etc}

  -- Permissions
  role TEXT DEFAULT 'user',         -- admin | user

  created_at TEXT NOT NULL,
  last_login_at TEXT
);
```

---

#### `audit_log` (Optional - si necesitas auditoría completa)

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,

  user_id TEXT,
  entity_type TEXT NOT NULL,        -- transaction | budget | category
  entity_id TEXT NOT NULL,

  action TEXT NOT NULL,             -- create | update | delete
  changes TEXT,                     -- JSON: {field: {old, new}}

  timestamp TEXT NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🔧 Config-Driven Architecture

### **NO hardcodear. TODO en configs.**

#### Parser configs en JSON/YAML

```yaml
# configs/parsers/bofa.yaml
id: bofa
name: Bank of America
country: US

detection:
  keywords:
    - "Bank of America"
    - "Member FDIC"
  patterns:
    - field: header
      regex: "Statement Date:.*Account Number:"

parsing:
  start_marker: "Date        Description"
  end_marker: "Account Summary"
  date_format: "MMM DD"

  fields:
    date:
      regex: "^([A-Z][a-z]{2}\\s+\\d{1,2})"
      position: start

    description:
      regex: "^[A-Z][a-z]{2}\\s+\\d{1,2}\\s+(.+?)\\s+[\\-\\+]?[\\d,]+\\.\\d{2}"
      cleanup:
        - remove: "#\\d+"
        - remove: "\\s+CA$"

    amount:
      regex: "([\\-\\+]?[\\d,]+\\.\\d{2})"
      position: -2  # Penúltima columna

classification:
  transfer_keywords:
    - TRANSFER
    - WIRE
    - ACH
  income_keywords:
    - SALARY
    - DEPOSIT
    - REFUND
```

---

#### Normalization rules en JSON

```json
// configs/normalization-rules.json
[
  {
    "id": "rule_starbucks",
    "type": "regex",
    "pattern": "STARBUCKS.*#\\d+",
    "normalized": "Starbucks",
    "suggestedCategory": "cat_food_restaurants",
    "priority": 1
  },
  {
    "id": "rule_amazon",
    "type": "regex",
    "pattern": "AMAZON\\.COM\\*[A-Z0-9]+",
    "normalized": "Amazon",
    "priority": 1
  }
]
```

---

## 🏗️ Modular Architecture

### **Features como módulos independientes**

```
/src
  /core              # Phase 1
    /parsers         # Config-driven
    /pipeline        # Normalization, clustering
    /storage         # DB layer

  /features          # Phases 2-4
    /categories      # Phase 2
    /budgets         # Phase 2
    /recurring       # Phase 2
    /reports         # Phase 3
    /export          # Phase 3
    /multi-user      # Phase 4
    /mobile          # Phase 4

  /ui
    /timeline        # Phase 1
    /filters         # Phase 1
    /details         # Phase 1
    /budgets-ui      # Phase 2
    /reports-ui      # Phase 3
```

**Cada feature es independiente**. Puedes:
- Build Phase 1 sin tocar Phase 2 code
- Agregar budgets sin cambiar parsers
- Disable features que no necesitas

---

## 📊 Data Flow

### **Phase 1: Core**

```
PDF/CSV Upload
  ↓
Parser (config-driven)
  ↓
Normalization (rules DB)
  ↓
Clustering (optional)
  ↓
Insert into `transactions` table
  ↓
Transfer detection
  ↓
Timeline UI
```

### **Phase 2: Categories & Budgets**

```
Transaction created
  ↓
Auto-categorize (rules)
  ↓
Update `category_id`
  ↓
Check budgets
  ↓
Alert if over budget
```

### **Phase 3: Reports**

```
User selects date range
  ↓
Query `transactions` + `categories` + `budgets`
  ↓
Aggregate data
  ↓
Generate charts
  ↓
Export to PDF/CSV
```

---

## ✅ Por qué esta arquitectura NO te mete el pie

1. ✅ **1 tabla core con todo** - Simple pero completa
2. ✅ **Tablas auxiliares por feature** - Agregar features sin tocar core
3. ✅ **Config-driven** - Agregar bancos sin código
4. ✅ **Modular** - Features independientes
5. ✅ **Campos estratégicos** - `category_id`, `tags`, `recurring_group_id` listos aunque no los uses aún
6. ✅ **No over-engineering** - Sin abstracciones innecesarias
7. ✅ **Escalable** - Soporta multi-user agregando `user_id`, no rehaciendo

---

## 📈 Total LOC Estimate

| Component | LOC |
|-----------|-----|
| Core (parsers, pipeline, storage) | ~1,000 |
| UI (timeline, filters, details) | ~800 |
| Categories & Budgets | ~600 |
| Reports & Export | ~400 |
| Multi-user | ~300 |
| Mobile | ~1,000 (separate repo) |
| **Total Desktop** | **~3,100** |

**Simple pero completo. Escalable pero no over-engineered.**

---

## 📝 Actualizaciones del Schema (Oct 30, 2025)

**Versión 2.0** - Schema actualizado para soportar **TODOS los edge cases** encontrados en datos reales.

### Campos Agregados

**Tabla `transactions`** - 25+ campos nuevos:

1. **Multi-currency** (Edge Case #2):
   - `amount_original`, `currency_original`, `exchange_rate`
   - Soporta transacciones en moneda extranjera con conversión

2. **Fees** (Edge Case #7):
   - `foreign_fee_transaction_id`, `is_fee_for_transaction_id`
   - Links fees a transacciones principales

3. **Reversals & Adjustments** (Edge Case #5):
   - `is_reversal`, `is_adjustment`, `is_refund`, `reversal_of_transaction_id`
   - Maneja cancelaciones, correcciones y refunds

4. **Installments** (Edge Case #15):
   - `installment_current`, `installment_total`, `installment_group_id`
   - Tracking de pagos en cuotas

5. **Interest & Cash Advances** (Edge Case #13, #14):
   - `interest_type`, `is_cash_advance`, `cash_advance_fee`
   - Diferencia tipos de interest charges

6. **Tax Info - México** (Edge Case #21):
   - `rfc`, `iva_amount`, `folio_rastreo`, `numero_referencia`
   - Soporta SPEI, Cobranzas Domiciliadas, RFC registry

7. **Metadata** (Edge Case #22):
   - `metadata` (JSON), `merchant_raw_full`, `bank_transaction_id`
   - Preserva toda la metadata del banco

8. **Account Linking** (Edge Case #20):
   - `linked_account_identifier`, `linked_account_type`
   - Detecta transferencias entre cuentas propias

9. **Validation** (Edge Case #18):
   - `bank_reported_balance`
   - Valida balance calculado vs banco

10. **Detection Confidence** (Edge Case #4):
    - `transfer_detection_confidence`
    - Confidence score para transfers detectados

**Tabla `accounts`**:
- Agregado `type` field (checking | savings | credit_card | investment)
- Agregado `apr_purchases`, `apr_cash_advance` para credit cards

**Tabla `rfc_registry`** (nueva):
- Registry de RFCs mexicanos
- Auto-completa merchant names
- Ayuda con normalización

### Por Qué Estos Campos Ahora

**Principio**: Schema debe soportar **100% de edge cases desde Phase 1**.

- Algunos campos estarán NULL hasta Phase 2/3
- Pero el schema NO cambia entre phases
- NO migrations complejas
- Código simple: campos existen, solo los poblamos cuando necesario

### Referencia Completa

Ver [EDGE-CASES-COMPLETE.md](./EDGE-CASES-COMPLETE.md) para:
- Ejemplos reales de cada edge case
- Estrategias de parsing
- Código de detección
- Prioridad de implementación

---

**Próximo doc**: `ROADMAP.md` - Plan de construcción por fases
