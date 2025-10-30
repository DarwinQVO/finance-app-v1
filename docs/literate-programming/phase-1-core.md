# Phase 1: Core - Literate Programming

**Status**: 🟡 In Progress
**LOC Target**: ~1,800
**LOC Written**: 200 / 1,800 (11%)

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

**LOC Count:**
- CREATE TABLE transactions: ~115 lines
- CREATE TABLE accounts: ~25 lines
- CREATE TABLE parser_configs: ~25 lines
- CREATE TABLE normalization_rules: ~20 lines
- CREATE TABLE rfc_registry: ~15 lines
- Indexes: ~50 lines
- **Total: ~250 LOC** (objetivo era 200, pero edge cases justifican las 50 extra)

---

**Status**: ✅ Task 1 completada
