# Finance App - Complete System Overview

**Descripción completa de qué ES y qué HACE la aplicación**

---

## 🎯 ¿Qué es Finance App?

Sistema completo de finanzas personales que automatiza el flujo completo:

```
PDFs bancarios → Parsing automático → Timeline unificado →
Auto-categorización → Budget tracking → Reports/Analytics
```

**Scope**: Sistema completo, no MVP minimalista. Diseñado para manejar desde el primer PDF hasta 100k+ transacciones.

---

## 💡 Principios de Diseño

### Local-First

**Implementación**:
- Data almacenada en SQLite local
- No requiere servidor para funcionalidad básica
- Privacy: data no sale de la máquina del usuario (sync opcional en Phase 4)

**Beneficio**: Control total sobre los datos financieros personales.

### Config-Driven

**Implementación**:
- Agregar banco = INSERT config en DB, no código
- Normalization rules en DB, no hardcoded
- Usuario puede extender sin modificar código

**Beneficio**: Extensibilidad sin depender de developers.

### Single Source of Truth

**Implementación**:
- 1 tabla core (`transactions`) con todos los campos
- Tablas auxiliares solo cuando necesario
- No duplicación de data

**Beneficio**: Simplicidad arquitectónica, queries eficientes, no inconsistencias.

### Multi-Currency Native

**Implementación**:
- Soporte simultáneo para USD, MXN, EUR, GBP, etc.
- Exchange rates automáticos
- Reportes combinan monedas con conversión

**Beneficio**: Funciona para usuarios con cuentas en múltiples países/monedas.

---

## 📊 Capacidades del Sistema

### 1. Multi-Account Management

**Funcionalidad**:
- Soporte para múltiples bancos y cuentas
- Timeline unificado muestra todas las transacciones
- Cada cuenta tiene metadata (color, icon, balance actual)

**Ejemplo**:
```
Timeline Unificado:
  Today
    Starbucks         -$5.67    [BofA]
    Uber              -$23.40   [Apple Card]

  Yesterday
    Salary          +$3,500.00  [BofA]
    Amazon            -$89.99   [Apple Card]
    Transfer        -$1,000.00  [BofA → Wise]
```

**Workflow**:
1. Usuario arrastra PDF
2. Sistema detecta banco automáticamente (keywords)
3. Parsea según config del banco
4. Inserta en timeline unificado

**Característica**: Sin "setup mode" separado. Mismo flujo para primer PDF y PDF #100.

---

### 2. Credit Card Balance Tracking

**Funcionalidad**:
- Trackea saldo actual de tarjetas de crédito
- Extrae Statement Balance y Due Date de PDFs
- Dashboard centralizado de todas las tarjetas
- Alertas configurables (7 días, 3 días, 1 día antes)

**Dashboard Example**:
```
┌─────────────────────────────┐
│ Credit Cards - Total Owed   │
├─────────────────────────────┤
│ Apple Card                  │
│ Balance: $500.00            │
│ Due: Nov 15 (5 days)   ⚠️   │
├─────────────────────────────┤
│ Chase                       │
│ Balance: $1,234.56          │
│ Due: Nov 20 (10 days)  🟡   │
├─────────────────────────────┤
│ TOTAL OWED: $1,734.56       │
└─────────────────────────────┘
```

**Data Source**: Parser extrae del statement PDF → guarda en `accounts.balance_current` y `accounts.payment_due_date`

---

### 3. Intelligent Document Processing

**Funcionalidad**:
- Procesa PDFs bancarios de múltiples formatos
- Parsers config-driven (no hardcoded)
- Extrae: date, merchant, amount, currency, type
- Deduplicación automática (source_hash)

**Parsers Soportados** (extensible vía config):
- Bank of America (formato tabular US)
- Apple Card (formato Apple específico)
- Wise (multi-currency)
- Scotiabank México (español, formato MXN)
- Cualquier otro → agregar config YAML

**Pipeline**:
```
PDF → Extract text → Detect bank → Parse → Normalize → Deduplicate → Timeline
```

**Performance**: 5 PDFs × 40 transacciones = 200 transacciones procesadas en ~30 segundos.

**Extensibilidad**:
```sql
-- Agregar nuevo banco
INSERT INTO parser_configs (id, name, detection_keywords, field_config)
VALUES ('new_bank', 'Nuevo Banco', '["Keyword1", "Keyword2"]', '{...}');
```

Tiempo: ~5 minutos | Código: 0 LOC

---

### 4. Unified Timeline

**Funcionalidad**:
- Vista cronológica de todas las transacciones
- Infinite scroll (carga 100 a la vez)
- Agrupación por fecha (Today, Yesterday, fecha específica)
- Color-coding por cuenta

**Features**:
- Click transaction → Panel lateral con detalles completos
- Icons automáticos por merchant
- Colors por tipo (expense, income, transfer)
- Keyboard shortcuts (j/k navegación, enter abrir)

**Performance**:
- 12,000 transacciones = load en <500ms
- Scroll infinito seamless
- Búsqueda full-text <300ms

**Implementación**: Pagination + indexes en SQLite (date, merchant, category, account)

---

### 5. Advanced Filtering

**Funcionalidad**:
- Filtros múltiples: account, date range, type, category, merchant, tags
- Lógica AND para combinar filtros
- Búsqueda full-text en descriptions
- Saved filters (guarda combinaciones frecuentes)

**Ejemplos**:
```
Filter 1: Account=BofA + Type=expense + Merchant=Starbucks + Date=Sep 2025
Filter 2: Type=transfer + Accounts=[BofA, Wise]
Filter 3: Category="Food & Dining" + Amount>50 + Type=expense
```

---

### 6. Smart Categorization

**Funcionalidad**:
- Categorías jerárquicas (Food → Restaurants, Groceries, Coffee)
- Auto-categorización basada en merchant
- Aprende de edits del usuario
- Custom categories

**Default Categories** (20+ incluidas):
```
🍔 Food & Dining
  ├─ Restaurants
  ├─ Groceries
  └─ Coffee Shops
🚗 Transportation
  ├─ Gas & Fuel
  ├─ Parking
  └─ Ride Share
🛍️ Shopping
🎬 Entertainment
💡 Bills & Utilities
```

**Auto-categorization**:
```
Transaction: "STARBUCKS STORE #12345"
→ Normaliza: "Starbucks"
→ Rule: Si merchant = "Starbucks" → Category: Coffee Shops
→ Auto-categoriza ✅
```

**Learning**: User cambia categoría una vez → aplica automáticamente a futuras transacciones del mismo merchant.

---

### 7. Budget Management

**Funcionalidad**:
- Crea budgets por: category, merchant, account, total spending
- Time periods: monthly, quarterly, yearly, custom
- Real-time tracking con progress bars
- Alertas configurables (ej: 80%, 100%)
- Rollover opcional (fondos no gastados pasan al siguiente período)

**Example**:
```
Budget: "Food & Dining - Monthly"
Limit: $800/month
Spent: $634.50 (79%)
Remaining: $165.50
Status: ⚠️ Alert (close to limit)
```

**UI**: Card con gauge visual, color-coded (green <70%, yellow 70-100%, red >100%)

---

### 8. Recurring Transaction Detection

**Funcionalidad**:
- Detecta automáticamente subscriptions y recurring payments
- Analiza intervalos entre transacciones del mismo merchant
- Agrupa transacciones recurrentes
- Predice próximo cargo
- Alerta si no llega cuando esperado

**Example**:
```
Recurring Group: "Netflix Subscription"
Frequency: Monthly
Expected Amount: $15.99 ± 5%
Last Charge: Oct 15, 2025
Next Expected: Nov 15, 2025
Confidence: 95% (12 meses de historia)
```

**Algoritmo**: Mínimo 3 transacciones con intervalos consistentes (±10%) → marca como recurring.

---

### 9. Transfer Linking

**Funcionalidad**:
- Detecta automáticamente transfers entre cuentas propias
- Linkea ambos lados del transfer
- Evita contar dos veces en reports
- Visual indicator (↔️)

**Example**:
```
BofA: "Transfer to Wise" -$1,000.00
Wise: "From Bank of America" +$1,000.00

→ Sistema detecta: mismo monto, fecha similar, keywords
→ Los linkea
→ En reports: $0 net (no es gasto ni ingreso)
```

**Algoritmo**:
1. Busca transactions con amount opuesto (±1%)
2. Fechas dentro de 3 días
3. Keywords: "transfer", "wire", "ACH", "Zelle"
4. Si match → link ambos (campo `transfer_pair_id`)

---

### 10. Comprehensive Reports

**Pre-built Reports** (6 incluidos):
1. Spending by Category (pie chart)
2. Spending Trends (line chart, monthly)
3. Income vs Expenses (bar chart)
4. Top Merchants (table)
5. Budget Performance (gauge charts)
6. Monthly Comparison (bar chart, year over year)

**Custom Report Builder**:
- Selecciona: data source, filters, grouping, aggregations
- Genera chart o table automáticamente
- Guarda y comparte

**Example Output**:
```
Spending by Category (Sep 2025):
  Food & Dining: 35% ($1,245)
  Transportation: 20% ($712)
  Shopping: 15% ($534)
  Entertainment: 12% ($427)
  Bills: 10% ($356)
  Other: 8% ($285)
```

---

### 11. Export & Sharing

**Funcionalidad**:
- Export a CSV (todas las transacciones + metadata)
- Export a PDF (report con charts)
- Export a JSON (full data dump)

**Use Cases**:
- Tax preparation
- Backup completo
- Analysis en Excel/Google Sheets

**CSV Format**:
```csv
Date,Merchant,Amount,Currency,Type,Account,Category,Tags,Notes
2025-09-28,Starbucks,-5.67,USD,expense,BofA,Coffee Shops,"work,morning",""
```

---

### 12. Performance at Scale

**Capacidad**:
- Maneja 100k+ transactions sin lag
- Timeline load <500ms (12k transactions)
- Infinite scroll fluido
- Search <300ms

**Optimizaciones**:
- Pagination (carga 100 a la vez)
- Indexes: date, account_id, merchant, category_id
- Virtual tables para full-text search
- Batch operations para imports

**Benchmark** (12,000 transactions, 2 años de historia):
- Timeline load: <500ms
- Filter application: <200ms
- Search: <300ms
- Report generation: <1s

---

### 13. Invoice & Receivables Processing

**Funcionalidad**:
- Parsea invoices (facturas emitidas a clientes)
- Trackea cuentas por cobrar
- Matching automático cuando cliente paga
- Alertas de cobros vencidos

**Workflow**:
1. Sube invoice PDF → parser extrae datos → crea receivable (status: pending)
2. Cliente paga → entra en bank statement → matching automático → status: paid
3. Si pasa due_date y sigue pending → status: overdue → alerta

**Dashboard**:
```
Receivables:
┌────────────────────────────────┐
│ Cliente X                      │
│ Invoice #1234                  │
│ $1,200.00                      │
│ Due: Oct 14 (overdue 1 day) 🔴│
├────────────────────────────────┤
│ Cliente Y                      │
│ Invoice #1235                  │
│ $500.00                        │
│ Due: Oct 20 (5 days)      🟡   │
└────────────────────────────────┘

Total por cobrar: $1,700.00
```

**Matching Algorithm**:
- Compara amounts exactos
- Compara client name en invoice vs transaction description
- Sugiere match si confidence > 80%
- Usuario confirma o rechaza

**Loan Tracking** (caso especial):
```
Transfer manual: BofA → Juan $400
Tag: "Préstamo a Juan"
Expected return: Nov 1, 2025

→ Trackea como receivable (type: loan)
→ Dashboard muestra: "Loans Out: Juan $400 (due Nov 1)"
```

---

### 14. Data Security

**Funcionalidad**:
- SQLite database encriptado (opcional, AES-256)
- No cloud storage por default (local-first)
- Backups automáticos (encrypted)
- GDPR compliant (export/delete user data)

**Privacy Modes**:
- Single-user: Data NUNCA sale de la máquina
- Multi-user: Auth + data isolation
- Mobile sync: Encrypted channel (opcional, Phase 4)

---

### 15. Multi-User Support (Phase 4)

**Funcionalidad**:
- Múltiples users en la misma máquina o servidor
- Data isolation (cada user ve solo su data)
- Shared accounts opcional (ej: joint checking con pareja)
- Permissions: view, edit, admin

**Example**:
```
User: el usuario
  Accounts: BofA, Apple Card, Wise

User: Partner
  Accounts: Chase, Amex

Shared Account: Joint Checking
  Permissions: Both can view + edit
```

---

### 16. Responsive Web Interface (Phase 4)

**Platform**: Desktop-first with responsive web access

**Core Features**:
- Access via mobile browser (Chrome, Safari)
- Touch-optimized interface
- All desktop features available
- No installation required (open in browser)
- Push notifications (budget alerts, recurring reminders)
- Sync con desktop (automatic, background)

**Mobile-First Features**:
- Photo OCR: Receipt photo → extrae merchant, amount, date
- Quick Add: 2 taps para agregar gasto
- Widgets: Budget status en home screen

**Sync**:
- Bidireccional (desktop ↔ mobile)
- Conflict resolution (last write wins)
- Offline queue (guarda changes, sync cuando hay internet)

---

### 17. Tax Calculations (Future Extension)

**Funcionalidad** (extensión futura):
- Marca transactions como tax-deductible
- Calcula tax owed/refund por category
- Export tax report para CPA
- Links a receipts (attachments)

**Example**:
```
Business Expenses:
  Meals with clients: $2,340 (50% deductible)
  Home office: $1,200 (100% deductible)
  Travel: $3,456 (100% deductible)

Total deductible: $6,126
Estimated tax savings (30%): $1,837.80
```

---

### 18. Smart Notifications

**Funcionalidad**:
- Budget alerts (80%, 100%, exceeded)
- Recurring payment reminders
- Unusual spending detection
- Transfer confirmations
- Monthly summary

**Configuración**:
- Usuario elige qué alerts recibir
- Delivery: push notification, email, in-app
- Frequency: real-time, daily digest, weekly summary

---

### 19. Customization

**Funcionalidad**:
- Themes (light, dark, custom colors)
- Account colors/icons personalizables
- Custom categories
- Custom normalization rules
- Saved filters

**Example - Normalization Rule**:
```
Rule:
  Pattern: "AMZN*"
  Normalize to: "Amazon"
  Category: Shopping

→ Cualquier "AMZN MKTP US", "AMZN.COM", etc → "Amazon"
```

**Beneficio**: Personalización sin código.

---

### 20. Analytics & Insights

**Funcionalidad**:
- Spending trends (comparado con mes anterior)
- Category breakdown
- Merchant frequency
- Savings rate (income - expenses)
- Net worth tracking (sum de balances)

**Example - Monthly Insights**:
```
October 2025 Summary:
  Income: $5,200
  Expenses: $3,840
  Savings: $1,360 (26% savings rate)

  Top Category: Food & Dining ($1,120, +15% vs Sep)
  Top Merchant: Amazon ($234, 8 purchases)

  Insight: ⚠️ Spending increased 15% in food category
```

---

## 🏗️ Arquitectura Técnica

### Database: Single Source of Truth

**Core table: `transactions`**

Contiene:
- Raw data: `original_description`
- Normalized: `merchant`, `merchant_normalized`
- Enriched: `category_id`, `tags`
- Metadata: `source_file`, `source_hash`, `source_type`
- Auditoria: `is_edited`, `edited_fields`, `created_at`, `updated_at`
- Relationships: `transfer_pair_id`, `recurring_group_id`, `receivable_id`
- Campos futuros: NULL (no problema, flexible schema)

**Auxiliary Tables**:
- `accounts` - Metadata de cuentas
- `categories` - Categorías jerárquicas
- `budgets` - Budget tracking
- `recurring_groups` - Patterns detectados
- `normalization_rules` - Merchant cleanup rules (config)
- `parser_configs` - Bank parser configs (config)
- `users` - Multi-user support (Phase 4)
- `balance_checks` - Validación opcional (Phase 3)
- `receivables` - Invoices & loans tracking

**Filosofía**:
- 1 tabla core con todos los campos necesarios
- Auxiliares solo cuando requerido
- Config-driven (rules en DB, no código)

---

### Tech Stack

**Desktop** (Phase 1-3):
- Electron (Windows, Mac, Linux)
- React + TailwindCSS (UI)
- SQLite (database)
- pdf-parse (text extraction)
- Recharts (charts)

**Web** (Phase 4):
- Responsive CSS (TailwindCSS breakpoints)
- Touch-optimized controls (min 44px buttons)
- REST API for web access
- bcrypt + JWT authentication

**Backend** (opcional, for multi-user):
- Node.js + Express (REST API)
- SQLite (can scale to PostgreSQL)

---

### Data Flow

**High-Level Pipeline**:
```
Upload PDF
    ↓
Extract Text (pdf-parse)
    ↓
Detect Bank (keywords match in parser_configs)
    ↓
Parse (config-driven parser)
    ↓
Normalize (normalization_rules)
    ↓
Deduplicate (source_hash check)
    ↓
Categorize (auto-categorization)
    ↓
Link Transfers (transfer detection)
    ↓
Insert to DB (transactions table)
    ↓
Show in Timeline ✅
```

**Performance**: 42 transacciones procesadas en ~5 segundos.

---

## 🎓 Para Quién Es Finance App

### Casos de Uso Principales

**Caso 1: Multi-Account User**
- Situación: 5+ cuentas bancarias, 2-3 países, múltiples monedas
- Necesidad: Vista unificada de todas las transacciones
- Solución: Timeline unificado + multi-currency support

**Caso 2: Budget-Conscious User**
- Situación: Ingresos buenos, necesita control de gastos
- Necesidad: Budgets tracking + alertas
- Solución: Auto-categorización + budgets + recurring detection

**Caso 3: Privacy-Conscious User**
- Situación: No confía en cloud apps
- Necesidad: Control total sobre data financiera
- Solución: Local-first + SQLite + sync opcional

**Caso 4: Power User**
- Situación: Necesita customización y extensibilidad
- Necesidad: Agregar bancos propios, custom rules
- Solución: Config-driven + custom categories/rules

### Ideal Para:
- Múltiples cuentas bancarias (2-10 accounts)
- Multi-currency users (expat, freelancer internacional)
- Budget-conscious (control de gastos)
- Privacy-conscious (local data)
- Power users (customización, extensibilidad)
- 5k-100k transactions (scale importante)

### No Ideal Para:
- Solo tracker minimalista (este es completo)
- Business accounting (esto es personal finance)
- Solo 1 cuenta bancaria bien trackeada (overkill)

---

## 💻 System Requirements

### Desktop App:
- OS: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- RAM: 4GB minimum, 8GB recommended
- Disk: 500MB app + 100MB per 10k transactions
- Display: 1280x720 minimum

### Mobile App:
- iOS: 14.0+
- Android: 8.0 (API 26)+
- Storage: 100MB app + data

---

## 🔐 Privacy & Security

### Local-First
- Single-user mode: Data NUNCA sale de tu máquina
- Multi-user mode opcional: Server en tu red local
- Mobile sync opcional: Encrypted communication

### Encryption
- Database encryption: AES-256 (opcional)
- Backups encrypted
- Export files password-protected (opcional)

### GDPR Compliance
- Export all data (JSON)
- Delete all data (one click)
- No tracking, no analytics (by default)

---

## ✅ TL;DR - What Is Finance App?

### Descripción Breve

Sistema completo de finanzas personales que automatiza PDF processing, categorización, budgets, y reportes.

### Capacidades Principales

1. Multi-banco: Unlimited cuentas, config-driven parsers
2. Multi-currency: USD, MXN, EUR, GBP simultáneamente
3. Auto-parse PDFs: Drag & drop → 5 seg → Timeline updated
4. Auto-categoriza: Aprende del usuario
5. Budget tracking: Real-time, alertas configurables
6. Transfer linking: Detecta automáticamente
7. Recurring detection: Identifica subscriptions
8. Reports: 6 pre-built + custom builder
9. Local-first: SQLite, privacy total
10. Extensible: Config YAML, no código
11. Scale: 100k+ transacciones, <500ms loads
12. Responsive Web: Mobile browser access (Phase 4)
13. Multi-user: Opcional, data isolation
14. Export: CSV, PDF, JSON
15. Offline: Full funcionalidad sin internet

### Sistema vs Construcción

**Este documento**: Describe sistema COMPLETO (QUÉ hace)

**ROADMAP.md**: Describe construcción INCREMENTAL (CÓMO construir)

La app final tiene TODO. Pero se CONSTRUYE fase por fase (Phase 1 → 2 → 3 → 4).

---

**Próximo doc**: [ROADMAP.md](ROADMAP.md) - CÓMO construir esto en 67 días, paso por paso

**Ready to build?**: Empieza con [Task 1️⃣: Database Schema](ROADMAP.md#1-database-schema)
