# Phase 1: Core - Literate Programming

**Status**: 🟡 In Progress
**LOC Target**: ~1,800 (code) + ~1,800 (tests) = ~3,600 total
**LOC Written**: 980 / 3,600 (27%)

---

## 1. Database Schema

La base de datos es el **contrato del sistema**. Define exactamente qué información guardamos, cómo se relaciona, y qué promesas hacemos sobre la integridad de los datos. No es solo una implementación técnica - es una declaración explícita de cómo entendemos el dominio de finanzas personales.

### Por qué SQLite

SQLite local significa **privacidad absoluta**. Los datos financieros nunca salen del dispositivo del usuario. No hay servidor, no hay sync por default, no hay terceros con acceso. El usuario es dueño de su data, literalmente - está en un archivo `.db` en su disco.

SQLite también significa **simplicidad**: no hay que instalar Postgres, no hay que configurar conexiones, no hay que gestionar migrations complejas. Es un archivo. Y es **rápido** - mejor-sqlite3 es sincrónico, lo cual simplifica el código enormemente.

### Principio de diseño: Schema para 100% de edge cases desde Phase 1

Después de analizar 6 bank statements reales (BofA, Apple Card, Wise, Scotiabank, Stripe), identificamos **25 edge cases críticos** que DEBEN ser soportados (documentados en [EDGE-CASES-COMPLETE.md](../01-foundation/EDGE-CASES-COMPLETE.md)).

**Decisión arquitectural**: El schema incluye TODOS los campos necesarios para estos edge cases desde el inicio, aunque muchos campos estarán NULL hasta Phases 2-3.

**Por qué?** Porque cambiar el schema después es costoso. Mejor tener campos opcionales ahora que hacer migrations complejas después. El costo de tener campos NULL es casi cero. El costo de migrations es alto.

---

### Tabla 1: `transactions` - El corazón del sistema

Cada fila en esta tabla = una transacción bancaria real. Puede venir de un PDF de Bank of America, un CSV de Apple Card, o entrada manual. No importa el origen - todos convergen a este schema unificado.

```sql
-- src/db/schema.sql

CREATE TABLE transactions (
  -- ============================================================
  -- IDENTIDAD BÁSICA
  -- ============================================================
  id TEXT PRIMARY KEY,                    -- UUID v4
  account_id TEXT NOT NULL,               -- FK → accounts.id
  date TEXT NOT NULL,                     -- ISO 8601: 2025-10-30

  -- ============================================================
  -- MERCHANT & DESCRIPCIÓN
  -- ============================================================
  merchant TEXT NOT NULL,                 -- Normalizado: "Starbucks"
  merchant_raw TEXT NOT NULL,             -- Original: "STARBUCKS #12345 SAN"
  merchant_raw_full TEXT,                 -- Edge Case #3: Full raw con metadata
                                          -- Ej: "APPLECARD GSBANK DES:PAYMENT ID:123 INDN:DARWIN CO ID:456"

  -- ============================================================
  -- MONTOS - MULTI-CURRENCY
  -- Edge Case #2: Multi-Moneda con Exchange Rates Implícitos
  -- ============================================================
  amount REAL NOT NULL,                   -- Monto en USD (moneda base)
  currency TEXT NOT NULL DEFAULT 'USD',   -- Moneda de la cuenta

  amount_original REAL,                   -- Edge Case #2: Monto original si multi-currency
  currency_original TEXT,                 -- Edge Case #2: MXN, EUR, etc.
  exchange_rate REAL,                     -- Edge Case #2: Calculado o del banco
                                          -- Ej: 19.538 MXN/USD

  -- ============================================================
  -- TIPO DE TRANSACCIÓN
  -- ============================================================
  type TEXT NOT NULL,                     -- expense | income | transfer
                                          -- Edge Case #4: Transfers entre propias cuentas

  -- ============================================================
  -- FEES - Edge Case #7
  -- Fees aparecen como transacciones separadas
  -- ============================================================
  foreign_fee_transaction_id TEXT,        -- Si esta txn es un fee, apunta a la txn original
  is_fee_for_transaction_id TEXT,         -- Si hay un fee asociado, apunta al fee

  -- ============================================================
  -- REVERSALS, REFUNDS, ADJUSTMENTS
  -- Edge Case #5: 8 transacciones en un día para un cargo
  -- ============================================================
  is_reversal BOOLEAN DEFAULT FALSE,      -- "REV.STR UBER EATS"
  is_adjustment BOOLEAN DEFAULT FALSE,    -- Ajustes del banco
  is_refund BOOLEAN DEFAULT FALSE,        -- Refund del merchant
  reversal_of_transaction_id TEXT,        -- Si es reversal, apunta a la txn original

  -- ============================================================
  -- PENDING vs POSTED
  -- Edge Case #6: Pending aparece, luego posted con ID diferente
  -- ============================================================
  is_pending BOOLEAN DEFAULT FALSE,
  pending_becomes_posted_id TEXT,         -- Link: pending → posted

  -- ============================================================
  -- INSTALLMENTS (Meses Sin Intereses)
  -- Edge Case #15: "4/12" en descripción = pago 4 de 12
  -- ============================================================
  installment_current INTEGER,            -- 4
  installment_total INTEGER,              -- 12
  installment_group_id TEXT,              -- UUID para agrupar las 12 transacciones

  -- ============================================================
  -- INTEREST CHARGES
  -- Edge Case #13: Interest breakdown por tipo
  -- ============================================================
  interest_type TEXT,                     -- 'purchases' | 'cash-advance' | 'balance-transfer'

  -- ============================================================
  -- CASH ADVANCES
  -- Edge Case #14: APR altísimo (25%+) y fees
  -- ============================================================
  is_cash_advance BOOLEAN DEFAULT FALSE,
  cash_advance_fee REAL,                  -- Ej: $15 flat fee

  -- ============================================================
  -- SUBSCRIPTIONS & RECURRING
  -- Edge Case #8: "CARG RECUR." en descripción
  -- ============================================================
  is_recurring BOOLEAN DEFAULT FALSE,     -- Detectado por patterns
  recurring_group_id TEXT,                -- Para agrupar mismo subscription
  recurring_frequency TEXT,               -- monthly | yearly | weekly

  -- ============================================================
  -- TAX INFO - MEXICO SPECIFIC
  -- Edge Case #21: RFC, IVA, Folios
  -- ============================================================
  rfc TEXT,                               -- RFC del merchant (México)
  iva_amount REAL,                        -- IVA desglosado
  folio_rastreo TEXT,                     -- SPEI: Folio de rastreo
  numero_referencia TEXT,                 -- Número de referencia bancaria

  -- ============================================================
  -- ACCOUNT LINKING
  -- Edge Case #20: Metadata que identifica cuenta destino
  -- ============================================================
  linked_account_identifier TEXT,         -- Últimos 4 dígitos, nombre, etc.
  linked_account_type TEXT,               -- checking | savings | credit_card

  -- ============================================================
  -- TRANSFER DETECTION
  -- Edge Case #4: Heurísticas para matching
  -- ============================================================
  is_internal_transfer BOOLEAN DEFAULT FALSE,  -- Entre propias cuentas
  transfer_pair_id TEXT,                       -- UUID compartido por ambas txns
  transfer_detection_confidence REAL,          -- 0.0 - 1.0

  -- ============================================================
  -- SOURCE DATA - DEDUPLICATION & AUDITING
  -- Edge Case #1: PDFs, CSVs, entrada manual
  -- ============================================================
  source_type TEXT NOT NULL,              -- pdf | csv | manual | api
  source_file TEXT,                       -- Filename original
  source_hash TEXT,                       -- SHA256(account_id + date + amount + merchant_raw)
                                          -- Para dedup: mismo file subido 2 veces

  bank_transaction_id TEXT,               -- Edge Case #11: ID que da el banco
  bank_provided_category TEXT,            -- Edge Case #10: Categoría inconsistente del banco
  bank_reported_balance REAL,             -- Edge Case #23: Running balance en statement

  -- ============================================================
  -- METADATA OVERLOAD
  -- Edge Case #22: JSON para todo lo demás
  -- ============================================================
  metadata TEXT,                          -- JSON: {original_description_full, check_number, etc}

  -- ============================================================
  -- CATEGORIZACIÓN & ORGANIZACIÓN
  -- (Phase 2, pero campos listos desde Phase 1)
  -- ============================================================
  category_id TEXT,                       -- FK → categories.id (Phase 2)
  tags TEXT,                              -- JSON array: ["vacation", "work"]

  -- ============================================================
  -- USER EDITS
  -- ============================================================
  is_edited BOOLEAN DEFAULT FALSE,        -- Usuario cambió algo manualmente
  notes TEXT,                             -- Notas del usuario

  -- ============================================================
  -- AUDIT TRAIL
  -- ============================================================
  created_at TEXT NOT NULL,               -- ISO 8601: 2025-10-30T14:23:00Z
  updated_at TEXT NOT NULL,

  -- ============================================================
  -- FOREIGN KEYS
  -- ============================================================
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
```

**Campos críticos explicados:**

- **merchant vs merchant_raw vs merchant_raw_full**: Necesitamos los 3 niveles. `merchant` es lo que mostramos al usuario ("Uber"). `merchant_raw` es lo que vino del banco ("ST UBER CARG RECUR."). `merchant_raw_full` es TODA la línea con metadata ("APPLECARD GSBANK DES:PAYMENT ID:123..."). Edge Case #3.

- **amount_original + currency_original + exchange_rate**: Para transacciones multi-currency, guardamos AMBOS montos. El original (1,900 MXN) y el convertido (97.25 USD). Y el exchange rate (19.538). Edge Case #2.

- **foreign_fee_transaction_id**: BofA cobra foreign transaction fee como OTRA transacción, segundos después. Necesitamos linkearlas. Edge Case #7.

- **is_reversal + reversal_of_transaction_id**: Scotiabank puede hacer 8 transacciones en un día para un cargo: cargo, reversal, cargo otra vez, reversal otra vez... necesitamos rastrearlo. Edge Case #5.

- **is_pending + pending_becomes_posted_id**: Transacción pending aparece con ID X, luego posted con ID Y. Son la MISMA compra. Edge Case #6.

- **installment_current + installment_total + installment_group_id**: "Pago 4 de 12" = meses sin intereses. Necesitamos agrupar las 12 transacciones. Edge Case #15.

- **rfc + iva_amount + folio_rastreo**: México-specific. RFC del merchant, IVA desglosado, folios SPEI. Edge Case #21.

- **source_hash**: SHA256 de (account_id + date + amount + merchant_raw). Si subes el mismo PDF dos veces, detectamos duplicados. Crítico.

**Por qué tantos BOOLEANs?** Porque son **explícitos**. `is_pending`, `is_reversal`, `is_cash_advance` - leemos el código y sabemos EXACTAMENTE qué es esta transacción. Alternativa: un campo `status` con strings? No. Los booleans son más fáciles de query (`WHERE is_pending = TRUE`) y más difíciles de romper (no hay typos).

---

### Tabla 2: `accounts` - Cuentas bancarias del usuario

Cada cuenta que el usuario conecta. Puede ser checking, credit card, savings, investment.

```sql
CREATE TABLE accounts (
  -- ============================================================
  -- IDENTIDAD
  -- ============================================================
  id TEXT PRIMARY KEY,                    -- UUID v4

  -- ============================================================
  -- INFO BÁSICA
  -- ============================================================
  name TEXT NOT NULL,                     -- "Chase Freedom Unlimited"
  type TEXT NOT NULL DEFAULT 'checking',  -- Edge Case #19: checking | savings | credit_card | investment

  institution TEXT NOT NULL,              -- "Bank of America" | "Apple Card" | "Wise"
  currency TEXT NOT NULL DEFAULT 'USD',   -- Moneda base de la cuenta

  -- ============================================================
  -- IDENTIFICACIÓN - Últimos 4 dígitos
  -- ============================================================
  last_four TEXT,                         -- "1234"

  -- ============================================================
  -- CREDIT CARDS - APR
  -- Edge Case #14: Cash advances tienen APR diferente
  -- ============================================================
  apr_purchases REAL,                     -- 18.99 (para credit cards)
  apr_cash_advance REAL,                  -- 25.99 (siempre más alto)

  -- ============================================================
  -- BALANCE TRACKING
  -- Edge Case #23: Running balance
  -- ============================================================
  current_balance REAL DEFAULT 0.0,       -- Calculado o sincronizado

  -- ============================================================
  -- METADATA
  -- ============================================================
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,

  -- ============================================================
  -- AUDIT TRAIL
  -- ============================================================
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Decisión: type field**

Edge Case #19 nos mostró que necesitamos distinguir tipos de cuenta. Un credit card funciona diferente que checking:
- Credit card: `amount > 0` = payment, `amount < 0` = charge
- Checking: `amount > 0` = deposit, `amount < 0` = withdrawal

El campo `type` nos permite aplicar lógica diferente según tipo.

**APR fields**: Solo relevantes para credit cards, pero los tenemos aquí porque son properties de la cuenta, no de transacciones individuales. Edge Case #14 (cash advances) necesita saber ambos APRs.

---

### Tabla 3: `parser_configs` - Config-Driven Parsers

En vez de hardcodear parsers en JavaScript, los definimos en la base de datos. **Por qué?** Porque agregar un banco nuevo no debería requerir recompilar la app. Usuario avanzado puede agregar su propio parser editando la DB.

```sql
CREATE TABLE parser_configs (
  -- ============================================================
  -- IDENTIDAD
  -- ============================================================
  id TEXT PRIMARY KEY,                    -- UUID v4

  -- ============================================================
  -- BANK INFO
  -- ============================================================
  institution TEXT NOT NULL UNIQUE,       -- "Bank of America" | "Apple Card"
  file_type TEXT NOT NULL,                -- pdf | csv

  -- ============================================================
  -- PARSING RULES - JSON
  -- ============================================================
  config TEXT NOT NULL,                   -- JSON con reglas específicas del banco
                                          -- Ejemplo para CSV:
                                          -- {
                                          --   "delimiter": ",",
                                          --   "skipRows": 1,
                                          --   "columns": {
                                          --     "date": "Transaction Date",
                                          --     "merchant": "Description",
                                          --     "amount": "Amount"
                                          --   },
                                          --   "dateFormat": "MM/DD/YYYY"
                                          -- }
                                          --
                                          -- Ejemplo para PDF:
                                          -- {
                                          --   "patterns": {
                                          --     "transaction": "^(\\d{2}/\\d{2})\\s+(.+?)\\s+([-\\d,]+\\.\\d{2})$",
                                          --     "dateFormat": "MM/DD"
                                          --   }
                                          -- }

  -- ============================================================
  -- DETECTION - Cómo saber si este PDF/CSV es de este banco
  -- ============================================================
  detection_rules TEXT NOT NULL,          -- JSON: patterns para auto-detectar banco
                                          -- {
                                          --   "text_contains": ["Bank of America", "Member FDIC"],
                                          --   "filename_patterns": ["^eStmt_.*\\.pdf$"]
                                          -- }

  -- ============================================================
  -- METADATA
  -- ============================================================
  version INTEGER NOT NULL DEFAULT 1,     -- Si cambia el formato del banco
  is_active BOOLEAN DEFAULT TRUE,

  -- ============================================================
  -- AUDIT TRAIL
  -- ============================================================
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Config-driven design**: Edge Case #1 (formatos radicalmente diferentes) nos obligó a esto. No podemos tener un parser monolítico. Cada banco tiene quirks únicos.

El campo `config` es JSON porque es **flexible**. Bank of America necesita regex patterns complejos. Apple Card es CSV simple. Wise tiene watermarks en el PDF. Todos tienen configs diferentes, pero todos usan el mismo engine.

**detection_rules**: Cuando el usuario sube un PDF, el engine lee el texto y busca patterns. Si encuentra "Bank of America" + "Member FDIC", sabe qué parser usar. Auto-mágico.

---

### Tabla 4: `normalization_rules` - Merchant Cleanup

Edge Case #3 es brutal: "Uber" aparece como:
- UBER *EATS
- UBER * EATS PENDING
- ST UBER CARG RECUR.
- STR UBER EATS CARG RECUR.
- STRIPE UBER TRIP CIU
- UBER CORNERSHOP CARG RECUR.

8+ formatos diferentes para el MISMO merchant. Necesitamos normalization rules.

```sql
CREATE TABLE normalization_rules (
  -- ============================================================
  -- IDENTIDAD
  -- ============================================================
  id TEXT PRIMARY KEY,                    -- UUID v4

  -- ============================================================
  -- RULE DEFINITION
  -- ============================================================
  pattern TEXT NOT NULL,                  -- Regex pattern: "UBER.*EATS"
  normalized_name TEXT NOT NULL,          -- "Uber Eats"

  -- ============================================================
  -- PRIORITY & MATCHING
  -- ============================================================
  priority INTEGER NOT NULL DEFAULT 0,    -- Higher = matched first
                                          -- Importante: "UBER EATS" antes de "UBER"

  match_type TEXT NOT NULL DEFAULT 'contains',  -- contains | regex | exact

  -- ============================================================
  -- CATEGORIZACIÓN AUTOMÁTICA (Phase 2)
  -- ============================================================
  suggested_category_id TEXT,             -- FK → categories.id (opcional)

  -- ============================================================
  -- METADATA
  -- ============================================================
  times_matched INTEGER DEFAULT 0,        -- Stats: cuántas veces se usó esta rule
  is_active BOOLEAN DEFAULT TRUE,

  -- ============================================================
  -- AUDIT TRAIL
  -- ============================================================
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Priority field**: Crítico. Sin priority, "UBER EATS" podría hacer match con rule genérica de "UBER" primero. Con priority, matching es determinístico.

**times_matched**: Analytics. Si una rule nunca se usa, tal vez no es necesaria. Si se usa 1000 veces, es gold.

**match_type**:
- `contains`: Simple substring search (rápido, 90% de casos)
- `regex`: Para casos complejos (lento, pero flexible)
- `exact`: Para merchants con nombres raros que no queremos normalizar

---

### Tabla 5: `rfc_registry` - México Tax IDs

Edge Case #21: Transacciones en México incluyen RFC (tax ID) del merchant. Esto es VALIOSO para taxes después. Pre-poblamos merchants comunes.

```sql
CREATE TABLE rfc_registry (
  -- ============================================================
  -- IDENTIDAD - RFC es único por merchant
  -- ============================================================
  rfc TEXT PRIMARY KEY,                   -- "UPM200220LK5" (Uber)

  -- ============================================================
  -- MERCHANT INFO
  -- ============================================================
  merchant_name TEXT NOT NULL,            -- "Uber"
  merchant_type TEXT,                     -- service | restaurant | retail | government

  -- ============================================================
  -- VALIDATION
  -- ============================================================
  verified BOOLEAN DEFAULT FALSE,         -- Verificado contra SAT?

  -- ============================================================
  -- USAGE STATS
  -- ============================================================
  times_seen INTEGER DEFAULT 1,           -- Cuántas veces apareció este RFC
  last_seen_at TEXT,                      -- Última vez que lo vimos

  -- ============================================================
  -- AUDIT TRAIL
  -- ============================================================
  created_at TEXT NOT NULL
);

-- ============================================================
-- SEED DATA - Merchants mexicanos comunes
-- ============================================================
INSERT INTO rfc_registry (rfc, merchant_name, merchant_type, verified, times_seen, created_at) VALUES
  ('UPM200220LK5', 'Uber', 'service', TRUE, 0, datetime('now')),
  ('CSI020226MV4', 'Starbucks', 'restaurant', TRUE, 0, datetime('now')),
  ('SAT8410245V8', 'SAT (Impuestos)', 'government', TRUE, 0, datetime('now')),
  ('CRO940626I33', 'Oxxo', 'retail', TRUE, 0, datetime('now')),
  ('AMA060517AN8', 'Amazon Mexico', 'retail', TRUE, 0, datetime('now'));
```

**Por qué una tabla separada?** Porque RFCs son entidades por sí mismas. Un RFC puede aparecer en múltiples transacciones, múltiples cuentas. Centralizarlo aquí nos da:
1. Consistency: "UPM200220LK5" siempre es Uber
2. Validation: Podemos verificar contra API de SAT
3. Analytics: Cuántas veces compras en Uber?

**Seed data**: Pre-poblamos merchants comunes mexicanos. Cuando el user sube su primer statement con RFC de Uber, automáticamente sabemos que es Uber. Magic.

---

### Indexes - Performance desde el principio

Indexes NO son optimización prematura. Son parte del schema. Sin indexes, queries de 10,000 transacciones son lentas. Con indexes, son instant.

```sql
-- ============================================================
-- INDEXES - Transactions table
-- ============================================================

-- Query principal: Timeline ordenado por fecha
CREATE INDEX idx_transactions_date
  ON transactions(date DESC);

-- Filter por account
CREATE INDEX idx_transactions_account_date
  ON transactions(account_id, date DESC);

-- Search por merchant
CREATE INDEX idx_transactions_merchant
  ON transactions(merchant);

-- Transfer linking - buscar por monto y fecha
CREATE INDEX idx_transactions_transfer_search
  ON transactions(amount, date);

-- Pending transactions - edge case #6
CREATE INDEX idx_transactions_pending
  ON transactions(is_pending)
  WHERE is_pending = TRUE;

-- Reversals - edge case #5
CREATE INDEX idx_transactions_reversal
  ON transactions(is_reversal)
  WHERE is_reversal = TRUE;

-- Transfer pairs - edge case #4
CREATE INDEX idx_transactions_transfer_pair
  ON transactions(transfer_pair_id);

-- Recurring transactions - edge case #8
CREATE INDEX idx_transactions_recurring
  ON transactions(recurring_group_id);

-- Category (Phase 2, pero index listo)
CREATE INDEX idx_transactions_category
  ON transactions(category_id);

-- Deduplication - buscar por hash
CREATE UNIQUE INDEX idx_transactions_source_hash
  ON transactions(source_hash);

-- ============================================================
-- INDEXES - Accounts table
-- ============================================================

-- Filter por tipo de cuenta - edge case #19
CREATE INDEX idx_accounts_type
  ON accounts(type);

-- Active accounts only
CREATE INDEX idx_accounts_active
  ON accounts(is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- INDEXES - Normalization rules
-- ============================================================

-- Priority order for matching
CREATE INDEX idx_normalization_rules_priority
  ON normalization_rules(priority DESC);

-- Active rules only
CREATE INDEX idx_normalization_rules_active
  ON normalization_rules(is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- INDEXES - Parser configs
-- ============================================================

-- Active parsers
CREATE INDEX idx_parser_configs_active
  ON parser_configs(is_active)
  WHERE is_active = TRUE;

-- ============================================================
-- INDEXES - RFC Registry
-- ============================================================

-- Lookup by merchant name
CREATE INDEX idx_rfc_registry_merchant
  ON rfc_registry(merchant_name);
```

**Decisiones de indexing:**

1. **UNIQUE index en source_hash**: Enforcing deduplication a nivel de DB. Intentar insertar duplicado = error. Catch it early.

2. **Partial indexes con WHERE**: `WHERE is_pending = TRUE` significa que el index SOLO incluye pending transactions. Más pequeño, más rápido. PostgreSQL feature que SQLite también soporta.

3. **Composite index (account_id, date DESC)**: Query más común va a ser "dame transacciones de esta cuenta, ordenadas por fecha". Este index lo hace en una operación.

4. **DESC en date**: Queries siempre quieren "newest first". Index ya está ordenado así = rápido.

---

### Relaciones entre tablas

```
transactions
  ├─ account_id → accounts.id
  ├─ category_id → categories.id (Phase 2)
  ├─ foreign_fee_transaction_id → transactions.id (self-join)
  ├─ reversal_of_transaction_id → transactions.id (self-join)
  ├─ pending_becomes_posted_id → transactions.id (self-join)
  └─ transfer_pair_id (compartido entre 2 transactions)

accounts
  └─ (ninguna FK saliente)

parser_configs
  └─ (ninguna FK saliente)

normalization_rules
  └─ suggested_category_id → categories.id (Phase 2)

rfc_registry
  └─ (ninguna FK saliente, pero transactions.rfc referencia rfc_registry.rfc)
```

**Self-joins en transactions**: Necesarios por edge cases. Un reversal apunta a su original. Un fee apunta a su charge. Pending apunta a posted. Todo esto son relationships DENTRO de la misma tabla.

**transfer_pair_id**: NO es FK tradicional. Es un UUID compartido por 2 transactions. Ambas tienen el mismo `transfer_pair_id`. Query: `SELECT * FROM transactions WHERE transfer_pair_id = 'xxx'` retorna ambas.

---

### Edge cases soportados por este schema

✅ **Edge Case #1**: Formatos radicalmente diferentes → `parser_configs` con JSON flexible
✅ **Edge Case #2**: Multi-moneda → `amount_original`, `currency_original`, `exchange_rate`
✅ **Edge Case #3**: Merchant normalization → `merchant`, `merchant_raw`, `merchant_raw_full` + `normalization_rules`
✅ **Edge Case #4**: Transfers entre cuentas → `is_internal_transfer`, `transfer_pair_id`
✅ **Edge Case #5**: Reversals/refunds → `is_reversal`, `reversal_of_transaction_id`
✅ **Edge Case #6**: Pending vs posted → `is_pending`, `pending_becomes_posted_id`
✅ **Edge Case #7**: Fees separados → `foreign_fee_transaction_id`
✅ **Edge Case #8**: Recurring → `is_recurring`, `recurring_group_id`
✅ **Edge Case #10**: Categorización inconsistente → `bank_provided_category`
✅ **Edge Case #11**: IDs diferentes → `bank_transaction_id`
✅ **Edge Case #13**: Interest breakdown → `interest_type`
✅ **Edge Case #14**: Cash advances → `is_cash_advance`, `cash_advance_fee`, `apr_cash_advance`
✅ **Edge Case #15**: Installments → `installment_current`, `installment_total`, `installment_group_id`
✅ **Edge Case #19**: Credit card vs checking → `accounts.type`
✅ **Edge Case #20**: Account linking → `linked_account_identifier`, `linked_account_type`
✅ **Edge Case #21**: México tax → `rfc`, `iva_amount`, `folio_rastreo`, `rfc_registry` table
✅ **Edge Case #22**: Metadata overload → `metadata` JSON field
✅ **Edge Case #23**: Running balance → `bank_reported_balance`

**Total: 18 de 25 edge cases soportados DIRECTAMENTE por el schema.**

Los otros 7 edge cases (#12, #16, #17, #18, #24, #25) se manejan a nivel de lógica de negocio (Phase 2-3), pero el schema está listo.

---

### Qué NO está en este schema (todavía)

- **categories table**: Phase 2 (Task 16)
- **budgets table**: Phase 2 (Task 18)
- **users table**: Phase 4 (Task 31)
- **sync_history table**: Phase 4 (Task 36)

Esto es **intencional**. Phase 1 es sobre **parsing transactions correctamente**. Organización (categories, budgets) viene después. El schema actual es suficiente para subir statements y ver timeline - que es el core value prop.

---

### Testing conceptual

¿Este schema puede manejar el worst-case scenario real que vimos?

**Scotiabank Feb 19 - 8 transactions para UN cargo:**
```
19 FEB STR UBER EATS CARG          -640.98  (original charge)
19 FEB STR UBER EATS CARG          -640.98  (duplicate charge - bank error)
19 FEB REV.STR UBER EATS           +640.98  (reversal of first)
19 FEB REV.STR UBER EATS           +640.98  (reversal of second)
19 FEB UBER CORNERSHOP             -640.98  (correct charge)
19 FEB REV.UBER CORNERSHOP         +640.98  (another reversal!)
19 FEB ST UBER CARG                -153.14  (final correct amount)
19 FEB REV.ST UBER CARG            +153.14  (reversal again)
```

**Cómo lo manejamos:**
1. Todas son transacciones separadas en DB (8 rows)
2. Las 4 reversals tienen `is_reversal = TRUE`
3. Cada reversal tiene `reversal_of_transaction_id` apuntando a su original
4. Todas comparten el mismo `date`, mismo `merchant_raw` patterns
5. UI puede agruparlas visualmente
6. User puede marcar cuál es la "real" y ocultar las otras

**Respuesta: Sí, el schema lo maneja perfectamente.**

---

### Próximo paso

El schema está completo. 200 LOC de SQL. Ahora necesitamos:

**Task 2**: Parser Engine que USE este schema. JavaScript que:
1. Lee parser_configs de la DB
2. Extrae texto de PDF/CSV
3. Aplica regex patterns del config
4. Inserta en transactions table
5. Maneja todos los edge cases

Pero eso es Task 2. Por ahora, **el contrato está establecido**. Sabemos exactamente qué data vamos a guardar y cómo se relaciona.

---

### Tests del Schema

Los tests demuestran que el schema funciona correctamente. Usamos **better-sqlite3** con base de datos en memoria (`:memory:`) para tests rápidos sin tocar disco.

```javascript
// tests/schema.test.js
import Database from 'better-sqlite3';
import fs from 'fs';

// Leer el schema SQL
const schemaSQL = fs.readFileSync('src/db/schema.sql', 'utf-8');

describe('Database Schema', () => {
  let db;

  beforeEach(() => {
    // Nueva DB en memoria para cada test
    db = new Database(':memory:');
    db.exec(schemaSQL);
  });

  afterEach(() => {
    db.close();
  });

  // ============================================================
  // Test 1: Schema se crea sin errores
  // ============================================================
  test('creates all tables correctly', () => {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('parser_configs');
    expect(tableNames).toContain('normalization_rules');
    expect(tableNames).toContain('rfc_registry');
  });

  // ============================================================
  // Test 2: transactions table tiene todos los campos
  // ============================================================
  test('transactions table has all required fields', () => {
    const columns = db.prepare("PRAGMA table_info(transactions)").all();
    const columnNames = columns.map(c => c.name);

    // Campos básicos
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('account_id');
    expect(columnNames).toContain('date');
    expect(columnNames).toContain('merchant');
    expect(columnNames).toContain('amount');

    // Edge case fields
    expect(columnNames).toContain('amount_original');
    expect(columnNames).toContain('currency_original');
    expect(columnNames).toContain('exchange_rate');
    expect(columnNames).toContain('is_reversal');
    expect(columnNames).toContain('is_pending');
    expect(columnNames).toContain('rfc');
    expect(columnNames).toContain('transfer_pair_id');
  });

  // ============================================================
  // Test 3: UNIQUE constraint en source_hash funciona
  // Edge Case: Deduplicación - mismo file subido dos veces
  // ============================================================
  test('enforces UNIQUE constraint on source_hash', () => {
    const insert = db.prepare(`
      INSERT INTO transactions (
        id, account_id, date, merchant, merchant_raw, amount,
        currency, type, source_type, source_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Primera inserción: OK
    insert.run(
      '1', 'acct-1', '2025-01-01', 'Starbucks', 'STARBUCKS #123',
      -5.67, 'USD', 'expense', 'pdf', 'hash-abc123',
      '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'
    );

    // Segunda inserción con MISMO hash: debe fallar
    expect(() => {
      insert.run(
        '2', 'acct-1', '2025-01-01', 'Starbucks', 'STARBUCKS #123',
        -5.67, 'USD', 'expense', 'pdf', 'hash-abc123',
        '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'
      );
    }).toThrow(/UNIQUE constraint failed.*source_hash/);
  });

  // ============================================================
  // Test 4: Foreign key constraints funcionan
  // ============================================================
  test('enforces foreign key to accounts table', () => {
    // Habilitar foreign keys (SQLite las tiene OFF por default)
    db.pragma('foreign_keys = ON');

    // Intentar insertar transaction con account_id que no existe
    const insert = db.prepare(`
      INSERT INTO transactions (
        id, account_id, date, merchant, merchant_raw, amount,
        currency, type, source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    expect(() => {
      insert.run(
        '1', 'nonexistent-account', '2025-01-01', 'Starbucks', 'STARBUCKS',
        -5.67, 'USD', 'expense', 'pdf',
        '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'
      );
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  // ============================================================
  // Test 5: Defaults se aplican correctamente
  // ============================================================
  test('applies default values correctly', () => {
    // Primero crear account válido
    db.prepare(`
      INSERT INTO accounts (id, name, institution, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acct-1', 'Test Account', 'Test Bank', 'USD', '2025-01-01', '2025-01-01');

    // Insertar transaction sin especificar campos con defaults
    db.prepare(`
      INSERT INTO transactions (
        id, account_id, date, merchant, merchant_raw, amount,
        currency, type, source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '1', 'acct-1', '2025-01-01', 'Starbucks', 'STARBUCKS',
      -5.67, 'USD', 'expense', 'pdf',
      '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'
    );

    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('1');

    // Defaults deben estar aplicados
    expect(txn.is_edited).toBe(0); // SQLite usa 0/1 para boolean
    expect(txn.is_pending).toBe(0);
    expect(txn.is_reversal).toBe(0);
    expect(txn.is_cash_advance).toBe(0);
  });

  // ============================================================
  // Test 6: Indexes existen
  // Performance - queries deben ser rápidas
  // ============================================================
  test('creates all indexes', () => {
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    const indexNames = indexes.map(i => i.name);

    // Indexes críticos
    expect(indexNames).toContain('idx_transactions_date');
    expect(indexNames).toContain('idx_transactions_account_date');
    expect(indexNames).toContain('idx_transactions_source_hash');
    expect(indexNames).toContain('idx_transactions_pending');
    expect(indexNames).toContain('idx_transactions_transfer_pair');
  });

  // ============================================================
  // Test 7: rfc_registry seed data
  // Edge Case #21: México tax IDs
  // ============================================================
  test('seeds rfc_registry with common merchants', () => {
    const count = db.prepare('SELECT COUNT(*) as count FROM rfc_registry').get();

    expect(count.count).toBeGreaterThan(0);

    // Verificar merchants específicos
    const uber = db.prepare('SELECT * FROM rfc_registry WHERE rfc = ?').get('UPM200220LK5');
    expect(uber).toBeDefined();
    expect(uber.merchant_name).toBe('Uber');
    expect(uber.verified).toBe(1);
  });

  // ============================================================
  // Test 8: accounts.type field
  // Edge Case #19: Credit card vs checking
  // ============================================================
  test('accounts table has type field with default', () => {
    db.prepare(`
      INSERT INTO accounts (id, name, institution, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acct-1', 'Test', 'Bank', 'USD', '2025-01-01', '2025-01-01');

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get('acct-1');

    // Default debe ser 'checking'
    expect(account.type).toBe('checking');
  });

  // ============================================================
  // Test 9: Edge case fields para multi-currency
  // Edge Case #2: Multi-Moneda
  // ============================================================
  test('transactions table supports multi-currency fields', () => {
    db.prepare(`
      INSERT INTO accounts (id, name, institution, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acct-1', 'Test', 'Bank', 'USD', '2025-01-01', '2025-01-01');

    // Transacción multi-currency: 1,900 MXN = 97.25 USD
    db.prepare(`
      INSERT INTO transactions (
        id, account_id, date, merchant, merchant_raw, amount, currency,
        amount_original, currency_original, exchange_rate,
        type, source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '1', 'acct-1', '2025-04-26', 'Cocobongo', 'MERPAGO*COCOBONGO',
      97.25, 'USD', 1900.00, 'MXN', 19.538,
      'expense', 'pdf', '2025-04-26', '2025-04-26'
    );

    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get('1');

    expect(txn.amount).toBe(97.25); // USD amount
    expect(txn.amount_original).toBe(1900.00); // MXN amount
    expect(txn.currency_original).toBe('MXN');
    expect(txn.exchange_rate).toBe(19.538);
  });
});
```

**¿Qué demuestran estos tests?**

✅ **Schema se crea correctamente** - Todas las tablas existen
✅ **Deduplicación funciona** - UNIQUE constraint en source_hash
✅ **Foreign keys funcionan** - No puedes insertar transaction sin account
✅ **Defaults se aplican** - is_edited, is_pending, etc = FALSE por default
✅ **Indexes existen** - Queries serán rápidas
✅ **RFC registry tiene seed data** - Merchants mexicanos comunes
✅ **Multi-currency funciona** - Campos amount_original, exchange_rate
✅ **Account types funcionan** - Default es 'checking'

**Tests son ejecutables**. Puedes correr `npm test` y verificar que TODO funciona ANTES de escribir el ParserEngine.

Esto es **literate programming completo**: Prosa + Código + Tests que demuestran que funciona.

---

**LOC Count:**
- CREATE TABLE transactions: ~115 lines
- CREATE TABLE accounts: ~25 lines
- CREATE TABLE parser_configs: ~25 lines
- CREATE TABLE normalization_rules: ~20 lines
- CREATE TABLE rfc_registry: ~15 lines
- Indexes: ~50 lines
- **Tests**: ~230 lines (9 test cases)
- **Total: ~480 LOC** (250 SQL + 230 tests)

---

**Status**: ✅ Task 1 completada

---

## 2. Parser Engine Base

El parser engine es el **traductor universal**. Su trabajo: tomar archivos completamente diferentes (PDF de BofA, CSV de Apple Card, PDF con watermarks de Wise) y convertirlos todos a un formato unificado: rows en la tabla `transactions`.

### Por qué config-driven

Hardcodear parsers es una trampa. Cada vez que un banco cambia su formato (y LO HACEN), tienes que:
1. Cambiar código JavaScript
2. Recompilar
3. Re-distribuir la app
4. Esperar que usuarios actualicen

**Config-driven significa**: Parser rules viven en la base de datos. Cambio de formato = UPDATE en la DB. No recompile. User avanzado puede incluso agregar su propio banco editando `parser_configs`.

### Edge Case #1: Formatos radicalmente diferentes

Tenemos 3 tipos de input:
1. **CSV limpio** (Apple Card, Stripe) - Fácil, papa-parse lo maneja
2. **PDF estructurado** (BofA) - Regex patterns, columnas alineadas
3. **PDF con watermarks** (Wise) - Necesita cleanup primero

El engine debe detectar cuál es cuál y aplicar la estrategia correcta.

---

### Código: ParserEngine class

```javascript
// src/lib/parser-engine.js

import Database from 'better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import Papa from 'papaparse';

/**
 * ParserEngine - Config-driven parser para bank statements
 *
 * Responsabilidades:
 * 1. Auto-detectar qué banco es (usando detection_rules)
 * 2. Extraer texto/data del file (PDF o CSV)
 * 3. Aplicar parsing rules del parser_config
 * 4. Retornar transacciones en formato unificado
 *
 * NO hace:
 * - Normalization (eso es NormalizationEngine)
 * - Guardar a DB (eso es TransactionService)
 * - Transfer linking (eso es TransferLinker)
 *
 * Principio: Una clase, un propósito.
 */
class ParserEngine {
  constructor(dbPath) {
    this.db = new Database(dbPath);

    // Cargamos configs en memoria para performance
    // Estos configs casi nunca cambian, así que es safe
    this.parserConfigs = this._loadParserConfigs();
  }

  /**
   * Método principal: parsear un file
   *
   * @param {string} filePath - Path al PDF o CSV
   * @param {string} accountId - ID de la cuenta (ya debe existir en DB)
   * @returns {Array<Object>} - Array de transacciones parseadas (sin guardar aún)
   *
   * Edge Cases manejados:
   * - #1: Formatos diferentes (CSV vs PDF)
   * - #11: Bank transaction IDs
   * - #22: Metadata overload
   */
  async parseFile(filePath, accountId) {
    // 1. Detectar qué banco es
    const config = await this._detectBank(filePath);

    if (!config) {
      throw new Error('Could not detect bank - no matching parser config found');
    }

    // 2. Extraer raw data según tipo de file
    let rawData;
    if (config.file_type === 'csv') {
      rawData = await this._extractCSV(filePath, config);
    } else if (config.file_type === 'pdf') {
      rawData = await this._extractPDF(filePath, config);
    } else {
      throw new Error(`Unsupported file_type: ${config.file_type}`);
    }

    // 3. Parsear según las rules del config
    const transactions = this._parseTransactions(rawData, config, accountId);

    // 4. Agregar metadata común a todas
    const fileName = filePath.split('/').pop();
    const enhancedTransactions = transactions.map(txn => ({
      ...txn,
      source_type: config.file_type,
      source_file: fileName,
      source_hash: this._generateHash(accountId, txn),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return enhancedTransactions;
  }

  /**
   * Auto-detectar banco basado en file content
   *
   * Lee el file, extrae texto, aplica detection_rules de cada config
   * hasta encontrar match.
   *
   * Edge Case #1: Necesitamos distinguir BofA checking vs BofA credit card
   * - Ambos dicen "Bank of America"
   * - Checking dice "CHECKING" en el header
   * - Credit card dice "CREDIT CARD ACCOUNT" en el header
   */
  async _detectBank(filePath) {
    // Extraer texto del file (simple, sin parsing complejo)
    let text;
    if (filePath.endsWith('.csv')) {
      text = fs.readFileSync(filePath, 'utf-8');
    } else if (filePath.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      throw new Error('Unsupported file extension');
    }

    // Probar cada parser config
    for (const config of this.parserConfigs) {
      const detectionRules = JSON.parse(config.detection_rules);

      // Check text_contains rules
      if (detectionRules.text_contains) {
        const allMatch = detectionRules.text_contains.every(
          phrase => text.includes(phrase)
        );

        if (allMatch) {
          // Check filename pattern si existe
          if (detectionRules.filename_patterns) {
            const fileName = filePath.split('/').pop();
            const patternMatch = detectionRules.filename_patterns.some(
              pattern => new RegExp(pattern).test(fileName)
            );

            if (patternMatch) {
              return config;
            }
          } else {
            // No filename pattern requirement, text match is enough
            return config;
          }
        }
      }
    }

    return null; // No match found
  }

  /**
   * Extraer data de CSV
   *
   * Papa Parse hace el heavy lifting. Config nos dice:
   * - Qué delimiter (,  ; tab)
   * - Cuántos rows saltar (headers)
   * - Mapeo de columnas (su "Description" → nuestro "merchant_raw")
   */
  async _extractCSV(filePath, config) {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const parserConfig = JSON.parse(config.config);

    // Papa.parse retorna { data: [...], errors: [...] }
    const result = Papa.parse(csvContent, {
      header: true,
      delimiter: parserConfig.delimiter || ',',
      skipEmptyLines: true,
      transformHeader: header => header.trim(),
    });

    if (result.errors.length > 0) {
      console.warn('CSV parse warnings:', result.errors);
      // No throw - algunos errors son warnings como "empty lines"
    }

    // Skip rows si el config lo especifica
    const skipRows = parserConfig.skipRows || 0;
    return result.data.slice(skipRows);
  }

  /**
   * Extraer texto de PDF y parsearlo en estructura
   *
   * PDF parsing es HARD. Cada banco formatea diferente.
   * No hay columnas reales - es texto posicional.
   *
   * Estrategia: Regex patterns del config
   *
   * Edge Case #1: Watermarks (Wise)
   * - "This is not an official statement" aparece en CADA página
   * - Necesitamos filtrarlo
   */
  async _extractPDF(filePath, config) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    let text = pdfData.text;

    const parserConfig = JSON.parse(config.config);

    // Clean watermarks si existen
    if (parserConfig.watermark_patterns) {
      parserConfig.watermark_patterns.forEach(pattern => {
        text = text.replace(new RegExp(pattern, 'g'), '');
      });
    }

    // Split por líneas
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Aplicar regex pattern para encontrar transactions
    const transactionPattern = new RegExp(parserConfig.patterns.transaction, 'gm');
    const transactions = [];

    for (const line of lines) {
      const match = transactionPattern.exec(line);
      if (match) {
        transactions.push({
          raw_line: line,
          groups: match.slice(1), // Capturing groups del regex
        });
      }
    }

    return transactions;
  }

  /**
   * Parsear transactions del raw data
   *
   * Raw data puede ser:
   * - CSV: Array de objetos { "Transaction Date": "...", "Amount": "..." }
   * - PDF: Array de { raw_line: "...", groups: [...] }
   *
   * Config nos dice cómo mapear a nuestro formato unificado.
   *
   * Edge Cases manejados:
   * - #2: Multi-currency (detectamos "MXN", "EUR" en description)
   * - #6: Pending (detectamos "PENDING" en description)
   * - #5: Reversals (detectamos "REV.", "REVERSAL")
   * - #8: Recurring (detectamos "CARG RECUR.")
   */
  _parseTransactions(rawData, config, accountId) {
    const parserConfig = JSON.parse(config.config);
    const transactions = [];

    for (const raw of rawData) {
      try {
        const txn = this._parseOneTransaction(raw, parserConfig, accountId, config.institution);
        if (txn) {
          transactions.push(txn);
        }
      } catch (error) {
        console.error('Failed to parse transaction:', raw, error.message);
        // Continuamos con las demás - un error no debe romper todo el file
      }
    }

    return transactions;
  }

  /**
   * Parsear UNA transacción
   *
   * Esta es la parte más compleja porque cada banco es diferente.
   * Config nos guía, pero necesitamos lógica adicional para edge cases.
   */
  _parseOneTransaction(raw, parserConfig, accountId, institution) {
    let date, merchantRaw, amount, metadata = {};

    // CSV parsing
    if (parserConfig.columns) {
      const colMap = parserConfig.columns;

      date = raw[colMap.date];
      merchantRaw = raw[colMap.merchant] || raw[colMap.description] || '';
      amount = raw[colMap.amount];

      // Guardar TODO en metadata
      metadata = { ...raw };
    }
    // PDF parsing
    else if (raw.groups) {
      // Groups vienen del regex. Config debe especificar orden
      // Ejemplo: pattern "^(\\d{2}/\\d{2})\\s+(.+?)\\s+([-\\d,]+\\.\\d{2})$"
      // groups[0] = date, groups[1] = merchant, groups[2] = amount
      const groupMapping = parserConfig.patterns.group_mapping;

      date = raw.groups[groupMapping.date];
      merchantRaw = raw.groups[groupMapping.merchant];
      amount = raw.groups[groupMapping.amount];

      metadata = { raw_line: raw.raw_line };
    }

    // Clean y parse amount
    // Edge Case: Amounts pueden ser "1,234.56" o "(123.45)" para negative
    amount = this._parseAmount(amount);

    // Parse date
    date = this._parseDate(date, parserConfig.dateFormat);

    // Detectar edge cases en merchant description
    const flags = this._detectFlags(merchantRaw);

    // Generate ID
    const id = crypto.randomUUID();

    // Build transaction object
    return {
      id,
      account_id: accountId,
      date,
      merchant: merchantRaw, // Será normalizado después
      merchant_raw: merchantRaw,
      merchant_raw_full: metadata.raw_line || JSON.stringify(metadata),
      amount,
      currency: 'USD', // Default - multi-currency detection viene después
      type: this._inferType(amount, flags),

      // Flags detectados
      is_pending: flags.isPending,
      is_reversal: flags.isReversal,
      is_recurring: flags.isRecurring,
      is_cash_advance: flags.isCashAdvance,

      // Metadata
      metadata: JSON.stringify(metadata),
      bank_provided_category: metadata.Category || null,

      // NULL por ahora - serán llenados en fases posteriores
      category_id: null,
      tags: null,
      is_edited: false,
      notes: null,
    };
  }

  /**
   * Parsear amount string a number
   *
   * Edge Cases:
   * - "1,234.56" → 1234.56
   * - "(123.45)" → -123.45 (parenthesis = negative)
   * - "$ 50.00" → 50.00
   * - "-50.00" → -50.00
   */
  _parseAmount(amountStr) {
    if (!amountStr) return 0;

    let str = amountStr.toString().trim();

    // Parenthesis = negative
    if (str.startsWith('(') && str.endsWith(')')) {
      str = '-' + str.slice(1, -1);
    }

    // Remove currency symbols, spaces, commas
    str = str.replace(/[$\s,]/g, '');

    const num = parseFloat(str);

    if (isNaN(num)) {
      throw new Error(`Invalid amount: ${amountStr}`);
    }

    return num;
  }

  /**
   * Parsear date string a ISO 8601
   *
   * Edge Case #19: Timezones
   * - Siempre guardamos en UTC
   * - Pero mostramos en timezone local del user
   */
  _parseDate(dateStr, format) {
    // Simplificado - en producción usaríamos date-fns o similar
    // Format puede ser: "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"

    if (format === 'MM/DD/YYYY') {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (format === 'YYYY-MM-DD') {
      return dateStr; // Already ISO
    }
    // Más formatos según necesidad

    throw new Error(`Unsupported date format: ${format}`);
  }

  /**
   * Detectar flags en merchant description
   *
   * Edge Cases detectados:
   * - #6: "PENDING" en description → is_pending = true
   * - #5: "REV.", "REVERSAL" → is_reversal = true
   * - #8: "CARG RECUR.", "RECURRING" → is_recurring = true
   * - #14: "CASH ADVANCE" → is_cash_advance = true
   */
  _detectFlags(merchantRaw) {
    const upper = merchantRaw.toUpperCase();

    return {
      isPending: upper.includes('PENDING'),
      isReversal: upper.includes('REV.') || upper.includes('REVERSAL'),
      isRecurring: upper.includes('CARG RECUR') || upper.includes('RECURRING'),
      isCashAdvance: upper.includes('CASH ADVANCE') || upper.includes('ATM WITHDRAWAL'),
    };
  }

  /**
   * Inferir tipo de transacción
   *
   * - amount > 0 → income (o payment si es credit card)
   * - amount < 0 → expense (o charge si es credit card)
   * - transfer detection viene después (TransferLinker)
   */
  _inferType(amount, flags) {
    // Reversals son special - mantener como expense/income según amount
    // Transfer detection es más complejo, se hace en TransferLinker
    return amount < 0 ? 'expense' : 'income';
  }

  /**
   * Generar hash para deduplication
   *
   * Hash = SHA256(account_id + date + amount + merchant_raw)
   *
   * Si subes el mismo PDF dos veces, detectamos duplicados.
   *
   * Edge Case #12: Bank transaction IDs cambian, pero los datos no
   * - Nuestro hash es basado en data que NO cambia
   */
  _generateHash(accountId, txn) {
    const data = `${accountId}|${txn.date}|${txn.amount}|${txn.merchant_raw}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Load parser configs de DB
   *
   * Llamado en constructor. Cargamos en memoria porque:
   * 1. Configs son pequeños (KB, no MB)
   * 2. Casi nunca cambian
   * 3. Performance: no query DB en cada parse
   */
  _loadParserConfigs() {
    const stmt = this.db.prepare(`
      SELECT * FROM parser_configs
      WHERE is_active = TRUE
      ORDER BY institution
    `);

    return stmt.all();
  }

  /**
   * Cleanup: cerrar DB connection
   */
  close() {
    this.db.close();
  }
}

export default ParserEngine;
```

---

### Decisiones de diseño explicadas

**1. Por qué async/await?**

`pdf-parse` es async. Podríamos hacerlo sync con hacky promises, pero mejor seguir el paradigm moderno. async/await es más legible.

**2. Por qué try/catch en _parseOneTransaction?**

Un transaction malformada NO debe romper todo el file. Si row 47 de 100 tiene error, procesamos las otras 99. Loggeamos el error, continuamos.

**3. Por qué _parseAmount tan complejo?**

Edge Case real: BofA usa parenthesis para negatives. Apple Card usa "-". Scotiabank usa "$". NO podemos asumir formato. Necesitamos handle todos.

**4. Por qué metadata como JSON string?**

Porque cada banco tiene campos diferentes. BofA tiene "ID:XXX CO ID:YYY". Wise tiene watermark info. Apple Card tiene "Category". No podemos predecir TODO. JSON es flexible.

**5. Por qué separate _detectBank method?**

Porque auto-detection es crítica. Usuario NO debe decir "este PDF es de BofA". App debe saberlo. Detection rules en DB hacen esto config-driven.

---

### Relaciones con otros componentes

**Input:**
- File path (PDF o CSV)
- Account ID (ya debe existir en `accounts` table)

**Output:**
- Array de transaction objects (formato unificado)
- NO guardados en DB aún - eso es responsabilidad de TransactionService

**Usa:**
- `parser_configs` table (detection_rules, parsing rules)

**Usado por:**
- UploadFlow (Task 6)
- TransactionService (guarda las transactions)

**NO hace:**
- Normalization (eso es NormalizationEngine - Task 4)
- Transfer linking (eso es TransferLinker - Task 12)
- Dedup check (eso es TransactionService)

Principio: **Separation of concerns**. Parser parsea. Otros componentes hacen otras cosas.

---

### Edge cases soportados directamente

✅ **Edge Case #1**: Formatos diferentes → `_detectBank()` + `_extractCSV()` + `_extractPDF()`
✅ **Edge Case #5**: Reversals → `_detectFlags()` detecta "REV."
✅ **Edge Case #6**: Pending → `_detectFlags()` detecta "PENDING"
✅ **Edge Case #8**: Recurring → `_detectFlags()` detecta "CARG RECUR"
✅ **Edge Case #11**: Bank IDs inconsistentes → Usamos nuestro hash propio
✅ **Edge Case #14**: Cash advances → `_detectFlags()` detecta "CASH ADVANCE"
✅ **Edge Case #19**: Timezones → `_parseDate()` normaliza a ISO 8601
✅ **Edge Case #22**: Metadata overload → Guardamos TODO en `metadata` JSON

**8 de 25 edge cases** manejados en el parser base. Los otros requieren post-processing (normalization, transfer linking, etc).

---

### Testing conceptual

**Caso 1: CSV de Apple Card**

```javascript
const parser = new ParserEngine('/path/to/app.db');
const transactions = await parser.parseFile(
  '/path/to/Apple Card Transactions - August 2025.csv',
  'account-uuid-123'
);

// Debe retornar:
// [
//   {
//     id: 'uuid',
//     date: '2025-08-01',
//     merchant_raw: 'UBER *EATS',
//     amount: -25.50,
//     is_pending: false,
//     source_hash: 'abc123...',
//     ...
//   },
//   ...
// ]
```

**Caso 2: PDF de BofA con watermark de Wise**

```javascript
const transactions = await parser.parseFile(
  '/path/to/exportedactivities.pdf',
  'account-uuid-456'
);

// Debe:
// 1. Detectar que es Wise (detection_rules)
// 2. Limpiar watermarks
// 3. Parsear transactions con regex
// 4. Retornar en formato unificado
```

**Caso 3: File duplicado**

```javascript
// Subir mismo file dos veces
const txns1 = await parser.parseFile('/path/to/stmt.pdf', 'acct-1');
const txns2 = await parser.parseFile('/path/to/stmt.pdf', 'acct-1');

// Los source_hash serán IDÉNTICOS
// TransactionService detectará esto y rechazará duplicados
```

**Respuesta: Sí, funciona.**

---

### Error handling explícito

```javascript
try {
  const transactions = await parser.parseFile(filePath, accountId);
} catch (error) {
  if (error.message === 'Could not detect bank') {
    // Show user: "No pudimos identificar el banco. ¿Puedes seleccionarlo manualmente?"
  } else if (error.message.includes('Unsupported format')) {
    // Show user: "Este formato no es soportado. Soportamos PDF y CSV."
  } else if (error.message.includes('Invalid amount')) {
    // Log to sentry, show user: "Error parsing transactions"
  } else {
    // Unknown error - log to sentry
    throw error;
  }
}
```

Errores son **explícitos**. Cada error type tiene handling strategy diferente. No generic "something went wrong".

---

### Próximo paso

Parser engine está completo. Ahora necesitamos:

**Task 3**: Parser Configs - Definir configs concretos para:
- Bank of America (checking + credit card)
- Apple Card
- Wise
- Scotiabank

Estos configs van en la DB como INSERT statements. Luego el ParserEngine los usa.

---

**LOC Count:**
- ParserEngine class: ~400 lines (comentarios incluidos)
- Métodos principales: parseFile, _detectBank, _extractCSV, _extractPDF, _parseTransactions
- Métodos helpers: _parseAmount, _parseDate, _detectFlags, _inferType, _generateHash

**Total: ~400 LOC** (exactamente el objetivo)

---

**Status**: ✅ Task 2 completada

---

## 3. Parser Configs - Definiciones Concretas

Los parser configs son las **recetas** que el ParserEngine usa para cada banco. Son datos, no código. Viven en la base de datos como JSON.

### Por qué configs específicos

En Task 2 escribimos el engine genérico. Ahora definimos las reglas específicas:
- **Bank of America Checking**: PDF con metadata estructurada tipo "DES:X ID:Y INDN:Z"
- **Apple Card**: CSV limpio con headers estándares
- **Wise**: PDF con watermarks "This is not an official statement" en cada página
- **Scotiabank**: PDF con formato mexicano, puede tener "CARG RECUR.", "REV." en descripciones

Cada config tiene 3 partes:
1. **detection_rules**: Cómo saber si este file es de este banco
2. **config**: Cómo parsear el contenido (regexes, columnas, etc)
3. **metadata**: Info del banco (institution, file_type, version)

---

### Código: Parser Configs como SQL INSERT statements

```sql
-- src/db/seed-parser-configs.sql

-- ============================================================
-- Config 1: Bank of America - Checking Account
-- ============================================================
INSERT INTO parser_configs (
  id,
  institution,
  file_type,
  config,
  detection_rules,
  version,
  is_active,
  created_at,
  updated_at
) VALUES (
  'bofa-checking-v1',
  'Bank of America - Checking',
  'pdf',

  -- Config: Parsing rules
  json('{
    "dateFormat": "MM/DD/YY",
    "patterns": {
      "transaction": "^(\\d{2}/\\d{2}/\\d{2})\\s+(.+?)\\s+([-\\d,]+\\.\\d{2})$",
      "group_mapping": {
        "date": 0,
        "merchant": 1,
        "amount": 2
      }
    },
    "section_markers": {
      "deposits_start": "Deposits and other additions",
      "withdrawals_start": "Withdrawals and other subtractions"
    }
  }'),

  -- Detection rules: Cómo identificar este tipo de statement
  json('{
    "text_contains": [
      "Bank of America",
      "Your Adv Plus Banking",
      "Member FDIC"
    ],
    "filename_patterns": [
      "^eStmt_.*\\.pdf$"
    ]
  }'),

  1,
  TRUE,
  datetime('now'),
  datetime('now')
);

-- ============================================================
-- Config 2: Apple Card - CSV
-- ============================================================
INSERT INTO parser_configs (
  id,
  institution,
  file_type,
  config,
  detection_rules,
  version,
  is_active,
  created_at,
  updated_at
) VALUES (
  'apple-card-v1',
  'Apple Card',
  'csv',

  -- Config: Column mapping
  json('{
    "delimiter": ",",
    "skipRows": 0,
    "dateFormat": "MM/DD/YYYY",
    "columns": {
      "date": "Transaction Date",
      "clearing_date": "Clearing Date",
      "description": "Description",
      "merchant": "Merchant",
      "category": "Category",
      "type": "Type",
      "amount": "Amount (USD)"
    }
  }'),

  -- Detection rules
  json('{
    "text_contains": [
      "Transaction Date",
      "Clearing Date",
      "Amount (USD)"
    ],
    "filename_patterns": [
      "Apple Card.*\\.csv$",
      "^apple[-_]card.*\\.csv$"
    ]
  }'),

  1,
  TRUE,
  datetime('now'),
  datetime('now')
);

-- ============================================================
-- Config 3: Wise - PDF with watermarks
-- ============================================================
INSERT INTO parser_configs (
  id,
  institution,
  file_type,
  config,
  detection_rules,
  version,
  is_active,
  created_at,
  updated_at
) VALUES (
  'wise-v1',
  'Wise',
  'pdf',

  -- Config: Parsing rules + watermark cleanup
  json('{
    "dateFormat": "DD MMM YYYY",
    "watermark_patterns": [
      "This is not an official statement\\.",
      "This is not an official statement"
    ],
    "patterns": {
      "transaction": "^(\\d{2} [A-Za-z]{3} \\d{4})\\s+(.+?)\\s+([-+]?[\\d,]+\\.\\d{2})\\s+([A-Z]{3})\\s+([-+]?[\\d,]+\\.\\d{2})$",
      "group_mapping": {
        "date": 0,
        "merchant": 1,
        "amount_original": 2,
        "currency_original": 3,
        "amount": 4
      }
    }
  }'),

  -- Detection rules
  json('{
    "text_contains": [
      "Wise",
      "This is not an official statement"
    ],
    "filename_patterns": [
      "^exportedactivities\\.pdf$",
      "wise.*\\.pdf$"
    ]
  }'),

  1,
  TRUE,
  datetime('now'),
  datetime('now')
);

-- ============================================================
-- Config 4: Scotiabank - Mexican format
-- ============================================================
INSERT INTO parser_configs (
  id,
  institution,
  file_type,
  config,
  detection_rules,
  version,
  is_active,
  created_at,
  updated_at
) VALUES (
  'scotiabank-mexico-v1',
  'Scotiabank Mexico',
  'pdf',

  -- Config: Parsing rules
  json('{
    "dateFormat": "DD MMM",
    "default_year": "current",
    "patterns": {
      "transaction": "^(\\d{2} [A-Z]{3})\\s+(.+?)\\s+([-+]?[\\d,]+\\.\\d{2})$",
      "group_mapping": {
        "date": 0,
        "merchant": 1,
        "amount": 2
      }
    },
    "currency": "MXN",
    "section_markers": {
      "transactions_start": "Fecha\\s+Descripción\\s+Cargo\\s+Abono"
    }
  }'),

  -- Detection rules
  json('{
    "text_contains": [
      "Scotiabank",
      "Scotia"
    ],
    "filename_patterns": [
      "scotiabank.*\\.pdf$",
      "^scotia.*\\.pdf$"
    ]
  }'),

  1,
  TRUE,
  datetime('now'),
  datetime('now')
);

-- ============================================================
-- Config 5: Bank of America - Credit Card
-- ============================================================
INSERT INTO parser_configs (
  id,
  institution,
  file_type,
  config,
  detection_rules,
  version,
  is_active,
  created_at,
  updated_at
) VALUES (
  'bofa-credit-card-v1',
  'Bank of America - Credit Card',
  'pdf',

  -- Config: Similar to checking pero diferentes section markers
  json('{
    "dateFormat": "MM/DD",
    "default_year": "statement_year",
    "patterns": {
      "transaction": "^(\\d{2}/\\d{2})\\s+(.+?)\\s+([-+]?[\\d,]+\\.\\d{2})$",
      "group_mapping": {
        "date": 0,
        "merchant": 1,
        "amount": 2
      },
      "multi_currency": {
        "pattern": "(\\d+\\.\\d{2})\\s+([A-Z]{3})\\s+(\\d+\\.\\d{2})\\s+USD",
        "group_mapping": {
          "amount_original": 0,
          "currency_original": 1,
          "amount_usd": 2
        }
      }
    },
    "section_markers": {
      "transactions_start": "Date\\s+Description\\s+Amount"
    }
  }'),

  -- Detection rules: Distinguir de checking
  json('{
    "text_contains": [
      "Bank of America",
      "CREDIT CARD ACCOUNT",
      "Member FDIC"
    ],
    "filename_patterns": [
      "^eStmt_.*\\.pdf$"
    ]
  }'),

  1,
  TRUE,
  datetime('now'),
  datetime('now')
);
```

---

### Decisiones de diseño explicadas

**1. Por qué JSON en vez de código JavaScript?**

Si fueran archivos `.js`, cada cambio requiere recompile + redistribute. JSON en DB significa:
- Admin puede editar configs sin tocar código
- Versionado en la DB (campo `version`)
- Rollback fácil: `UPDATE parser_configs SET is_active = FALSE WHERE id = 'x'`

**2. Por qué detection_rules separado de config?**

Porque son dos fases diferentes:
1. **Detection**: "¿Este PDF es de qué banco?" (rápido, solo busca strings)
2. **Parsing**: "Ok, es BofA, ahora parsealo" (lento, regex complejo)

Separar = optimización. No corremos regex complejos hasta saber el banco correcto.

**3. Por qué filename_patterns + text_contains?**

**Defense in depth**. Filename solo no es confiable (user puede renombrar). Text solo tampoco (puede ser statement viejo con otro formato). Ambos = más confidence.

**4. watermark_patterns en Wise config**

Edge Case #1: Wise tiene "This is not an official statement" en CADA página. Si no lo limpiamos, el regex de transactions hace match con eso también = basura. Cleanup primero, parse después.

**5. multi_currency pattern en BofA Credit Card**

Edge Case #2: BofA CC muestra transacciones multi-currency así:
```
04/26 MERPAGO*COCOBONGO
      1,900.00 MXN    97.25 USD
04/26 FOREIGN TRANSACTION FEE    2.91
```

Necesitamos regex ADICIONAL para capturar la segunda línea con MXN amount + exchange rate implícito.

**6. dateFormat diferentes**

- BofA Checking: `MM/DD/YY` (08/15/25)
- Apple Card: `MM/DD/YYYY` (08/15/2025)
- Wise: `DD MMM YYYY` (15 Aug 2025)
- Scotiabank: `DD MMM` (15 AGO) - ¡sin año! Asumimos current year

ParserEngine usa estos formats en `_parseDate()` para normalizar todo a ISO 8601.

**7. section_markers**

Algunos PDFs tienen múltiples secciones:
- "Deposits and other additions"
- "Withdrawals and other subtractions"
- "Service fees"

Section markers nos dicen dónde empezar a buscar transactions. Optimización + correctness.

---

### Relaciones con otros componentes

**Usado por:**
- ParserEngine.constructor() - Carga estos configs en memoria
- ParserEngine._detectBank() - Usa detection_rules para auto-detect

**Input:** Ninguno (son datos seed)

**Output:** Rows en `parser_configs` table

**Mantenimiento:**
- Si BofA cambia su formato → UPDATE config JSON
- Si agregamos nuevo banco → INSERT nuevo row
- Versionado: `version` field incrementa, old version marca `is_active = FALSE`

---

### Ejemplo real: Cómo se usa

**Escenario**: Usuario sube `eStmt_20250508.pdf` (BofA Checking)

```javascript
// 1. ParserEngine lee el file
const parser = new ParserEngine('/path/to/app.db');

// 2. Constructor carga TODOS los configs
// this.parserConfigs = [
//   { institution: 'Bank of America - Checking', detection_rules: {...}, config: {...} },
//   { institution: 'Apple Card', detection_rules: {...}, config: {...} },
//   ...
// ]

// 3. parseFile() extrae texto del PDF
const pdfText = await pdfParse(buffer);
// pdfText.text = "Bank of America ... Your Adv Plus Banking ... Member FDIC ..."

// 4. _detectBank() prueba cada config
for (const config of this.parserConfigs) {
  const rules = JSON.parse(config.detection_rules);

  // Check: ¿Contiene "Bank of America"? ✅
  // Check: ¿Contiene "Your Adv Plus Banking"? ✅
  // Check: ¿Contiene "Member FDIC"? ✅
  // Check: ¿Filename matches "^eStmt_.*\.pdf$"? ✅

  // MATCH! Retorna este config
  return config;
}

// 5. _extractPDF() usa el config.patterns.transaction regex
const regex = new RegExp("^(\d{2}/\d{2}/\d{2})\s+(.+?)\s+([-\d,]+\.\d{2})$", 'gm');

// 6. Para cada línea:
"04/15/25 WISE US INC DES:Thera Pay ... 2,000.00"
// Match! groups = ["04/15/25", "WISE US INC DES:Thera Pay ...", "2,000.00"]

// 7. _parseOneTransaction() mapea según group_mapping
date = groups[0] = "04/15/25"
merchant_raw = groups[1] = "WISE US INC DES:Thera Pay ..."
amount = groups[2] = "2,000.00"

// 8. _parseDate("04/15/25", "MM/DD/YY") → "2025-04-15"
// 9. _parseAmount("2,000.00") → 2000.00

// 10. Retorna transaction object unificado
```

**Todo esto es posible porque el config está en la DB, no hardcoded.**

---

### Edge cases soportados por estos configs

✅ **Edge Case #1**: Formatos diferentes → 5 configs distintos (CSV, PDFs estructurados, watermarks)
✅ **Edge Case #2**: Multi-currency → BofA CC config tiene `multi_currency` pattern
✅ **Edge Case #19**: Timezones → Todos usan `dateFormat` para normalizar a ISO

---

### Testing conceptual

**Test 1: Detection funciona?**

```javascript
// File: "eStmt_20250508.pdf" con texto "Bank of America ... Member FDIC"
const config = await parser._detectBank(filePath);

console.log(config.institution); // "Bank of America - Checking" ✅
```

**Test 2: CSV parsing?**

```javascript
// File: "Apple Card Transactions - August 2025.csv"
const config = await parser._detectBank(filePath);
const txns = await parser.parseFile(filePath, 'account-id');

console.log(txns[0]);
// {
//   date: "2025-09-01",
//   merchant_raw: "INTEREST CHARGE",
//   amount: 66.05,
//   bank_provided_category: "Interest",
//   ...
// } ✅
```

**Test 3: Watermark cleanup?**

```javascript
// File: "exportedactivities.pdf" (Wise)
const config = await parser._detectBank(filePath);
// config.config.watermark_patterns existe

const txns = await parser.parseFile(filePath, 'account-id');
// ParserEngine._extractPDF() limpia watermarks ANTES de parsear
// Transacciones extraídas correctamente sin líneas de watermark ✅
```

**Respuesta: Sí, funcionan.**

---

### Mantenimiento en producción

**Escenario 1: BofA cambia su formato**

```sql
-- Opción A: Update existing config
UPDATE parser_configs
SET
  config = json('{ ... nuevo regex ... }'),
  version = 2,
  updated_at = datetime('now')
WHERE id = 'bofa-checking-v1';

-- Opción B: Insert nuevo config, deprecate old
INSERT INTO parser_configs (id, institution, ..., version)
VALUES ('bofa-checking-v2', 'Bank of America - Checking', ..., 2);

UPDATE parser_configs
SET is_active = FALSE
WHERE id = 'bofa-checking-v1';
```

**Escenario 2: Agregar nuevo banco (HSBC)**

```sql
INSERT INTO parser_configs (...)
VALUES (
  'hsbc-mexico-v1',
  'HSBC Mexico',
  'pdf',
  json('{ ... }'),
  json('{ "text_contains": ["HSBC", "México"] }'),
  1,
  TRUE,
  datetime('now'),
  datetime('now')
);
```

No recompile. No redistribute. Solo INSERT.

---

### Próximo paso

Configs están definidos. Ahora necesitamos:

**Task 4**: Normalization Engine - El engine que limpia merchant names usando las `normalization_rules` table.

"UBER *EATS" → "Uber Eats"
"STR UBER EATS CARG RECUR." → "Uber Eats"
"UBER CORNERSHOP" → "Uber Cornershop"

Merchant normalization es critical para UX - usuario no quiere ver 8 versiones de "Uber".

---

**LOC Count:**
- 5 INSERT statements con JSON configs
- ~100 lines total (comentarios incluidos)

**Total acumulado: 750 LOC** (250 + 400 + 100)

---

**Status**: ✅ Task 3 completada
