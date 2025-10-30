# Phase 1: Core - Literate Programming

**Status**: 🟡 In Progress
**LOC Target**: ~1,800 (code) + ~1,800 (tests) = ~3,600 total
**LOC Written**: 980 / 3,600 (27%)

---

## 1. Database Schema

La base de datos es el **contrato del sistema**. Define exactamente qué información guardamos, cómo se relaciona, y qué promesas hacemos sobre la integridad de los datos. No es solo una implementación técnica - es una declaración explícita de cómo entendemos el dominio de finanzas personales.

### Por qué SQLite

SQLite local significa **privacidad absoluta**. Los datos financieros nunca salen del dispositivo del usuario. No hay servidor, no hay sync por default, no hay terceros con acceso. El usuario es dueño de su data, literalmente - está en un archivo `.db` en su disco.

SQLite también significa **simplicidad**: no hay que instalar Postgres, no hay que configurar conexiones, no hay que gestionar migrations complejas. Es un archivo. Y es **rápido** - better-sqlite3 es sincrónico, lo cual simplifica el código enormemente.

### Principio de diseño: Schema para 100% de edge cases desde Phase 1

Después de analizar 6 bank statements reales (BofA, Apple Card, Wise, Scotiabank, Stripe), identificamos **25 edge cases críticos** que DEBEN ser soportados (documentados en [EDGE-CASES-COMPLETE.md](../01-foundation/EDGE-CASES-COMPLETE.md)).

**Decisión arquitectural**: El schema incluye TODOS los campos necesarios para estos edge cases desde el inicio, aunque muchos campos estarán NULL hasta Phases 2-3.

**Por qué?** Porque cambiar el schema después es costoso. Mejor tener campos opcionales ahora que hacer migrations complejas después. El costo de tener campos NULL es casi cero. El costo de migrations es alto.

---

### Tabla 1: `transactions` - El corazón del sistema

Cada fila en esta tabla = una transacción bancaria real. Puede venir de un PDF de Bank of America, un CSV de Apple Card, o entrada manual. No importa el origen - todos convergen a este schema unificado.

<<src/db/schema.sql>>=
-- ============================================================
-- Finance App - Database Schema
-- Version 2.0 - Supports all 25 edge cases
-- ============================================================

-- ============================================================
-- TRANSACTIONS TABLE - Core of the system
-- ============================================================
CREATE TABLE transactions (
  -- IDENTIDAD BÁSICA
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,                     -- ISO 8601: 2025-10-30

  -- MERCHANT & DESCRIPCIÓN
  merchant TEXT NOT NULL,                 -- Normalizado: "Starbucks"
  merchant_raw TEXT NOT NULL,             -- Original: "STARBUCKS #12345 SAN"
  merchant_raw_full TEXT,                 -- Edge Case #3: Full raw con metadata

  <<transactions-amounts>>
  <<transactions-fees>>
  <<transactions-reversals>>
  <<transactions-pending>>
  <<transactions-installments>>
  <<transactions-interest>>
  <<transactions-cash-advance>>
  <<transactions-recurring>>
  <<transactions-tax-mexico>>
  <<transactions-account-linking>>
  <<transactions-source-data>>
  <<transactions-categorization>>
  <<transactions-user-edits>>
  <<transactions-audit>>

  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

<<transactions-indexes>>

-- ============================================================
-- ACCOUNTS TABLE
-- ============================================================
<<accounts-table>>
<<accounts-indexes>>

-- ============================================================
-- PARSER CONFIGS TABLE
-- ============================================================
<<parser-configs-table>>
<<parser-configs-indexes>>

-- ============================================================
-- NORMALIZATION RULES TABLE
-- ============================================================
<<normalization-rules-table>>
<<normalization-rules-indexes>>

-- ============================================================
-- RFC REGISTRY TABLE (Mexico Tax IDs)
-- ============================================================
<<rfc-registry-table>>
<<rfc-registry-seed-data>>
<<rfc-registry-indexes>>
@

<<transactions-amounts>>=
-- MONTOS - MULTI-CURRENCY
-- Edge Case #2: Multi-Moneda con Exchange Rates Implícitos
amount REAL NOT NULL,                   -- Monto en USD (moneda base)
currency TEXT NOT NULL DEFAULT 'USD',   -- Moneda de la cuenta
amount_original REAL,                   -- Monto original si multi-currency
currency_original TEXT,                 -- MXN, EUR, etc.
exchange_rate REAL,                     -- Calculado o del banco (ej: 19.538 MXN/USD)
type TEXT NOT NULL,                     -- expense | income | transfer
@

<<transactions-fees>>=
-- FEES - Edge Case #7
-- Fees aparecen como transacciones separadas
foreign_fee_transaction_id TEXT,        -- Si esta txn es un fee, apunta a la txn original
is_fee_for_transaction_id TEXT,         -- Si hay un fee asociado, apunta al fee
@

<<transactions-reversals>>=
-- REVERSALS, REFUNDS, ADJUSTMENTS
-- Edge Case #5: 8 transacciones en un día para un cargo
is_reversal BOOLEAN DEFAULT FALSE,      -- "REV.STR UBER EATS"
is_adjustment BOOLEAN DEFAULT FALSE,    -- Ajustes del banco
is_refund BOOLEAN DEFAULT FALSE,        -- Refund del merchant
reversal_of_transaction_id TEXT,        -- Si es reversal, apunta a la txn original
@

<<transactions-pending>>=
-- PENDING vs POSTED
-- Edge Case #6: Pending aparece, luego posted con ID diferente
is_pending BOOLEAN DEFAULT FALSE,
pending_becomes_posted_id TEXT,         -- Link: pending → posted
@

<<transactions-installments>>=
-- INSTALLMENTS (Meses Sin Intereses)
-- Edge Case #15: "4/12" en descripción = pago 4 de 12
installment_current INTEGER,            -- 4
installment_total INTEGER,              -- 12
installment_group_id TEXT,              -- UUID para agrupar las 12 transacciones
@

<<transactions-interest>>=
-- INTEREST CHARGES
-- Edge Case #13: Interest breakdown por tipo
interest_type TEXT,                     -- 'purchases' | 'cash-advance' | 'balance-transfer'
@

<<transactions-cash-advance>>=
-- CASH ADVANCES
-- Edge Case #14: APR altísimo (25%+) y fees
is_cash_advance BOOLEAN DEFAULT FALSE,
cash_advance_fee REAL,                  -- Ej: $15 flat fee
@

<<transactions-recurring>>=
-- SUBSCRIPTIONS & RECURRING
-- Edge Case #8: "CARG RECUR." en descripción
is_recurring BOOLEAN DEFAULT FALSE,     -- Detectado por patterns
recurring_group_id TEXT,                -- Para agrupar mismo subscription
recurring_frequency TEXT,               -- monthly | yearly | weekly
@

<<transactions-tax-mexico>>=
-- TAX INFO - MEXICO SPECIFIC
-- Edge Case #21: RFC, IVA, Folios
rfc TEXT,                               -- RFC del merchant (México)
iva_amount REAL,                        -- IVA desglosado
folio_rastreo TEXT,                     -- SPEI: Folio de rastreo
numero_referencia TEXT,                 -- Número de referencia bancaria
@

<<transactions-account-linking>>=
-- ACCOUNT LINKING & TRANSFER DETECTION
-- Edge Case #4: Transferencias entre propias cuentas
-- Edge Case #20: Metadata que identifica cuenta destino
is_internal_transfer BOOLEAN DEFAULT FALSE,  -- Entre propias cuentas
transfer_pair_id TEXT,                       -- UUID compartido por ambas txns
transfer_detection_confidence REAL,          -- 0.0 - 1.0
linked_account_identifier TEXT,              -- Últimos 4 dígitos, nombre, etc.
linked_account_type TEXT,                    -- checking | savings | credit_card
@

<<transactions-source-data>>=
-- SOURCE DATA - DEDUPLICATION & AUDITING
-- Edge Case #1: PDFs, CSVs, entrada manual
source_type TEXT NOT NULL,              -- pdf | csv | manual | api
source_file TEXT,                       -- Filename original
source_hash TEXT,                       -- SHA256(account_id + date + amount + merchant_raw)
bank_transaction_id TEXT,               -- Edge Case #11: ID que da el banco
bank_provided_category TEXT,            -- Edge Case #10: Categoría inconsistente del banco
bank_reported_balance REAL,             -- Edge Case #23: Running balance en statement
metadata TEXT,                          -- Edge Case #22: JSON para todo lo demás
@

<<transactions-categorization>>=
-- CATEGORIZACIÓN & ORGANIZACIÓN (Phase 2)
category_id TEXT,                       -- FK → categories.id (Phase 2)
tags TEXT,                              -- JSON array: ["vacation", "work"]
@

<<transactions-user-edits>>=
-- USER EDITS
is_edited BOOLEAN DEFAULT FALSE,        -- Usuario cambió algo manualmente
notes TEXT,                             -- Notas del usuario
@

<<transactions-audit>>=
-- AUDIT TRAIL
created_at TEXT NOT NULL,               -- ISO 8601: 2025-10-30T14:23:00Z
updated_at TEXT NOT NULL,
@

<<transactions-indexes>>=
-- INDEXES - Transactions table
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_transfer_search ON transactions(amount, date);
CREATE INDEX idx_transactions_pending ON transactions(is_pending) WHERE is_pending = TRUE;
CREATE INDEX idx_transactions_reversal ON transactions(is_reversal) WHERE is_reversal = TRUE;
CREATE INDEX idx_transactions_transfer_pair ON transactions(transfer_pair_id);
CREATE INDEX idx_transactions_recurring ON transactions(recurring_group_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE UNIQUE INDEX idx_transactions_source_hash ON transactions(source_hash);
@

<<accounts-table>>=
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'checking',  -- Edge Case #19: checking | savings | credit_card | investment
  institution TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  last_four TEXT,
  apr_purchases REAL,                     -- Edge Case #14: Para credit cards
  apr_cash_advance REAL,                  -- Siempre más alto
  current_balance REAL DEFAULT 0.0,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
@

<<accounts-indexes>>=
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_active ON accounts(is_active) WHERE is_active = TRUE;
@

<<parser-configs-table>>=
CREATE TABLE parser_configs (
  id TEXT PRIMARY KEY,
  institution TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL,                -- pdf | csv
  config TEXT NOT NULL,                   -- JSON con reglas
  detection_rules TEXT NOT NULL,          -- JSON con patterns de detección
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
@

<<parser-configs-indexes>>=
CREATE INDEX idx_parser_configs_active ON parser_configs(is_active) WHERE is_active = TRUE;
@

<<normalization-rules-table>>=
CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,                  -- Regex pattern: "UBER.*EATS"
  normalized_name TEXT NOT NULL,          -- "Uber Eats"
  priority INTEGER NOT NULL DEFAULT 0,    -- Higher = matched first
  match_type TEXT NOT NULL DEFAULT 'contains',  -- contains | regex | exact
  suggested_category_id TEXT,             -- FK → categories.id (opcional)
  times_matched INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
@

<<normalization-rules-indexes>>=
CREATE INDEX idx_normalization_rules_priority ON normalization_rules(priority DESC);
CREATE INDEX idx_normalization_rules_active ON normalization_rules(is_active) WHERE is_active = TRUE;
@

<<rfc-registry-table>>=
CREATE TABLE rfc_registry (
  rfc TEXT PRIMARY KEY,                   -- "UPM200220LK5" (Uber)
  merchant_name TEXT NOT NULL,            -- "Uber"
  merchant_type TEXT,                     -- service | restaurant | retail | government
  verified BOOLEAN DEFAULT FALSE,         -- Verificado contra SAT?
  times_seen INTEGER DEFAULT 1,
  last_seen_at TEXT,
  created_at TEXT NOT NULL
);
@

<<rfc-registry-seed-data>>=
-- Seed data: Merchants mexicanos comunes
INSERT INTO rfc_registry (rfc, merchant_name, merchant_type, verified, times_seen, created_at) VALUES
  ('UPM200220LK5', 'Uber', 'service', TRUE, 0, datetime('now')),
  ('CSI020226MV4', 'Starbucks', 'restaurant', TRUE, 0, datetime('now')),
  ('SAT8410245V8', 'SAT (Impuestos)', 'government', TRUE, 0, datetime('now')),
  ('CRO940626I33', 'Oxxo', 'retail', TRUE, 0, datetime('now')),
  ('AMA060517AN8', 'Amazon Mexico', 'retail', TRUE, 0, datetime('now'));
@

<<rfc-registry-indexes>>=
CREATE INDEX idx_rfc_registry_merchant ON rfc_registry(merchant_name);
@

---

### Tests del Schema

Los tests demuestran que el schema funciona correctamente. Usamos **better-sqlite3** con base de datos en memoria (`:memory:`) para tests rápidos sin tocar disco.

<<tests/schema.test.js>>=
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const schemaSQL = readFileSync('src/db/schema.sql', 'utf-8');

describe('Database Schema', () => {
  <<schema-test-setup>>
  <<schema-test-creates-tables>>
  <<schema-test-required-fields>>
  <<schema-test-unique-constraint>>
  <<schema-test-foreign-keys>>
  <<schema-test-defaults>>
  <<schema-test-indexes>>
  <<schema-test-rfc-seed-data>>
  <<schema-test-account-type>>
  <<schema-test-multi-currency>>
});
@

<<schema-test-setup>>=
let db;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(schemaSQL);
});

afterEach(() => {
  db.close();
});
@

<<schema-test-creates-tables>>=
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
@

<<schema-test-required-fields>>=
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
@

<<schema-test-unique-constraint>>=
test('enforces UNIQUE constraint on source_hash', () => {
  // Primero crear account válido
  db.prepare(`
    INSERT INTO accounts (id, name, institution, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('acct-1', 'Test Account', 'Test Bank', 'USD', '2025-01-01', '2025-01-01');

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
@

<<schema-test-foreign-keys>>=
test('enforces foreign key to accounts table', () => {
  db.pragma('foreign_keys = ON');

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
@

<<schema-test-defaults>>=
test('applies default values correctly', () => {
  db.prepare(`
    INSERT INTO accounts (id, name, institution, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('acct-1', 'Test Account', 'Test Bank', 'USD', '2025-01-01', '2025-01-01');

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

  expect(txn.is_edited).toBe(0);
  expect(txn.is_pending).toBe(0);
  expect(txn.is_reversal).toBe(0);
  expect(txn.is_cash_advance).toBe(0);
});
@

<<schema-test-indexes>>=
test('creates all indexes', () => {
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  const indexNames = indexes.map(i => i.name);

  expect(indexNames).toContain('idx_transactions_date');
  expect(indexNames).toContain('idx_transactions_account_date');
  expect(indexNames).toContain('idx_transactions_source_hash');
  expect(indexNames).toContain('idx_transactions_pending');
  expect(indexNames).toContain('idx_transactions_transfer_pair');
});
@

<<schema-test-rfc-seed-data>>=
test('seeds rfc_registry with common merchants', () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM rfc_registry').get();
  expect(count.count).toBeGreaterThan(0);

  const uber = db.prepare('SELECT * FROM rfc_registry WHERE rfc = ?').get('UPM200220LK5');
  expect(uber).toBeDefined();
  expect(uber.merchant_name).toBe('Uber');
  expect(uber.verified).toBe(1);
});
@

<<schema-test-account-type>>=
test('accounts table has type field with default', () => {
  db.prepare(`
    INSERT INTO accounts (id, name, institution, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('acct-1', 'Test', 'Bank', 'USD', '2025-01-01', '2025-01-01');

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get('acct-1');
  expect(account.type).toBe('checking');
});
@

<<schema-test-multi-currency>>=
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

  expect(txn.amount).toBe(97.25);
  expect(txn.amount_original).toBe(1900.00);
  expect(txn.currency_original).toBe('MXN');
  expect(txn.exchange_rate).toBe(19.538);
});
@

---

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

**Status**: ✅ Task 1 completada con tests ejecutables
