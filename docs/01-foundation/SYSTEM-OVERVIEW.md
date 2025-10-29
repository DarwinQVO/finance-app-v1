# Finance App - Complete System Overview

**La descripción completa de qué ES y qué HACE la aplicación**

---

## 🎯 ¿Qué es Finance App?

Finance App es un **sistema completo de finanzas personales** que te permite manejar todas tus cuentas bancarias, tarjetas de crédito, y transacciones en un solo lugar.

**No es**: Un gestor de presupuestos simple, ni un tracker de gastos básico.

**Es**: Un sistema completo que va desde raw PDFs bancarios hasta analytics avanzados, budgets inteligentes, y sincronización multi-dispositivo.

---

## 💡 Filosofía del Sistema

### Local-First
- Toda tu data vive en SQLite local
- No hay servidor necesario para funcionalidad básica
- Privacy total - tu data nunca sale de tu máquina (a menos que quieras sync)

### Config-Driven
- Agregar un banco nuevo = agregar config YAML, NO escribir código
- Reglas de normalización = data en DB, NO hardcoded
- Todo es parametrizable

### Single Source of Truth
- UNA tabla core (`transactions`) con TODOS los campos
- Tablas auxiliares solo cuando necesario
- No duplicación de data

### Multi-Currency Native
- Maneja USD, MXN, EUR, GBP, etc. simultáneamente
- Exchange rates automáticos
- Reportes pueden combinar todas las monedas

---

## 📊 Capacidades Completas del Sistema

### 1. 🏦 Multi-Account Management

**Qué hace**:
- Soporta múltiples bancos, tarjetas, y tipos de cuenta
- Timeline unificado: VE todas tus transacciones de TODAS tus cuentas en un solo lugar
- Cada cuenta tiene su propio color, icon, y metadata

**Ejemplo real**:
- Bank of America Checking (USD)
- Apple Card (USD)
- Wise Multi-Currency (USD, EUR, GBP)
- Scotiabank México (MXN)

**Cómo funciona**:
```
User arrastra PDF → Sistema detecta banco automáticamente →
Parsea con config del banco → Inserta en timeline único
```

**Sin fricción**: No hay "modo setup" vs "modo daily". Subes un PDF hoy, mañana, en 6 meses = mismo flujo.

---

### 1.5. 💳 Credit Card Balance Tracking

**Qué hace**:
- Trackea saldo actual de tarjetas de crédito
- Extrae "Statement Balance" y "Due Date" de PDFs
- Alertas de pagos próximos a vencer
- Dashboard muestra cuánto debes en total

**Ejemplo real**:
```
Apple Card Statement - October 2025
Statement Balance: $500.00
Payment Due: November 15, 2025

Dashboard muestra:
┌─────────────────────────────┐
│ Credit Cards                │
├─────────────────────────────┤
│ Apple Card                  │
│ Balance: $500.00            │
│ Due: Nov 15 (5 days)   ⚠️   │
└─────────────────────────────┘
```

**Cómo funciona**:
- Parser extrae balance final del statement
- Guarda en `accounts.balance_current`
- Guarda due date en `accounts.payment_due_date`
- Alertas automáticas 7 días antes del vencimiento

**Tipos de cuenta soportados**:
- `checking` - Cuenta corriente
- `savings` - Cuenta de ahorros
- `credit_card` - Tarjeta de crédito (trackea deuda)
- `investment` - Cuentas de inversión

**Dashboard de deudas**:
```
Liabilities (lo que debes):
  Apple Card:    -$500.00 (due Nov 15)
  Chase:       -$1,234.56 (due Nov 20)
  ────────────────────────────────────
  Total credit: -$1,734.56
```

---

### 2. 📄 Intelligent Document Processing

**Qué hace**:
- Acepta PDFs bancarios de cualquier formato
- Parsea automáticamente (config-driven, no hardcoded)
- Extrae: fecha, merchant, amount, currency, tipo
- Deduplicación automática (no procesa el mismo PDF dos veces)

**Parsers soportados** (extensible vía config):
- Bank of America (formato tabular US)
- Apple Card (formato Apple específico)
- Wise (multi-currency, formatos variados)
- Scotiabank México (español, MXN)
- Cualquier otro banco → Agregar config YAML

**Pipeline invisible**:
```
PDF → Extract text → Parse → Normalize merchant → Deduplicate → Timeline
```

User solo ve: "PDF subido ✅ → Transacciones aparecen"

---

### 2.5. 📋 Invoice & Receivables Processing

**Qué hace**:
- Parsea invoices (facturas que emitiste a clientes)
- Trackea cuentas por cobrar (receivables)
- Linkea automáticamente cuando el cliente paga
- Alertas de cobros vencidos

**Ejemplo real - Invoice emitido**:
```
Invoice-2025-10-01.pdf (Cliente X)
──────────────────────────────────
Invoice #1234
Bill To: Cliente X
Amount Due: $1,200.00
Date: October 1, 2025
Due Date: October 14, 2025
Status: Unpaid

Finance App parsea y guarda como:
- Type: receivable
- Source: invoice
- Status: pending
```

**Ejemplo real - Pago recibido**:
```
BofA Statement - October 15
──────────────────────────────────
Oct 15: Client X deposit  +$1,200.00

Finance App detecta:
✅ Invoice #1234 matched!
✅ Status: pending → paid
✅ Payment date: Oct 15, 2025
```

**Dashboard de receivables**:
```
Receivables (te deben):
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

**Matching automático**:
- Compara amounts exactos
- Compara client name en invoice vs description
- Sugiere match si confidence > 80%
- Usuario confirma o rechaza

**Tipos de invoice soportados**:
- PDF invoices estándar
- Excel/CSV exports de accounting software
- Manual entry (crear invoice desde UI)

**Loan tracking** (caso especial):
```
Transfer manual: BofA → Juan  $400
Tag: "Préstamo a Juan"
Expected return: Nov 1, 2025

Finance App trackea como receivable:
- Type: loan
- Amount: $400
- Due: Nov 1
- Status: pending

Dashboard muestra:
Loans Out (prestaste):
  Juan: $400 (due Nov 1)
```

---

### 3. ⏱️ Unified Timeline

**Qué hace**:
- Muestra TODAS las transacciones de TODAS las cuentas, cronológicamente
- Infinite scroll (carga 100 a la vez, seamless)
- Agrupadas por fecha ("Today", "Yesterday", "Sep 28, 2025")
- Colores por cuenta (visual clarity)

**Vista**:
```
Today
  🍔 Starbucks           -$5.67    [BofA]
  🚗 Uber                -$23.40   [Apple Card]

Yesterday
  📦 Amazon              -$89.99   [Apple Card]
  💰 Salary Deposit    +$3,500.00  [BofA]

Sep 26, 2025
  ↔️  Transfer to Wise  -$1,000.00 [BofA]
  ↔️  From BofA        +$1,000.00  [Wise]
```

**Features**:
- Click transaction → Panel lateral con detalles completos
- Icons automáticos (Starbucks = ☕, Amazon = 📦, Uber = 🚗)
- Amounts coloreados (red = expense, green = income, blue = transfer)

---

### 4. 🔍 Advanced Filtering

**Qué hace**:
- Filtra por: account, date range, type, category, merchant, tags
- Combina múltiples filtros (AND logic)
- Búsqueda full-text en descriptions
- Saved filters (guarda búsquedas frecuentes)

**Ejemplos reales**:
```
"Todos los gastos en Starbucks de BofA en Septiembre"
→ Account: BofA + Type: expense + Merchant: Starbucks + Date: Sep 2025

"Transfers entre BofA y Wise"
→ Type: transfer + Accounts: [BofA, Wise]

"Gastos en Food & Dining > $50"
→ Category: Food & Dining + Amount > 50 + Type: expense
```

---

### 5. 🏷️ Smart Categorization

**Qué hace**:
- Categorías jerárquicas predefinidas (Food → Restaurants, Groceries, Coffee)
- Auto-categorización basada en merchant
- Aprende de tus edits (si cambias Starbucks a "Coffee", se auto-aplica a futuras)
- Custom categories (agrega tus propias)

**Default Categories** (20+ incluidas):
- 🍔 Food & Dining
  - 🍽️ Restaurants
  - 🛒 Groceries
  - ☕ Coffee Shops
- 🚗 Transportation
  - ⛽ Gas & Fuel
  - 🅿️ Parking
  - 🚕 Ride Share
- 🛍️ Shopping
- 🎬 Entertainment
- 💡 Bills & Utilities
- 🏥 Healthcare
- 💰 Income
- ❓ Uncategorized

**Cómo funciona**:
```
Transaction: "STARBUCKS STORE #12345"
→ Normaliza a: "Starbucks"
→ Rule: Si merchant = "Starbucks" → Category: Coffee Shops
→ Auto-categoriza ✅
```

---

### 6. 💰 Budget Management

**Qué hace**:
- Crea budgets por: category, merchant, account, o total spending
- Time periods: monthly, quarterly, yearly, custom
- Real-time tracking con progress bars
- Alertas cuando llegas al 80% o te pasas
- Rollover (si no gastas todo, pasa al siguiente mes)

**Ejemplo real**:
```
Budget: "Food & Dining - Monthly"
Limit: $800/month
Spent: $634.50 (79%)
Remaining: $165.50
Status: ⚠️ Alert (close to limit)
```

**UI**:
- Card con gauge visual
- Color: green (< 70%), yellow (70-100%), red (> 100%)
- Notification cuando te pasas

---

### 7. 🔄 Recurring Transaction Detection

**Qué hace**:
- Detecta automáticamente subscriptions y recurring payments
- Aprende patterns (Netflix cobra cada 15 del mes)
- Agrupa transacciones recurrentes
- Predice próximo cargo
- Alerta si no llega cuando debería

**Ejemplo**:
```
Recurring Group: "Netflix Subscription"
Frequency: Monthly
Expected Amount: $15.99 ± 5%
Last Charge: Oct 15, 2025
Next Expected: Nov 15, 2025
Confidence: 95% (detectado en 12 meses)
```

**Detección automática**:
- Analiza intervalos entre transacciones del mismo merchant
- Si intervalos son consistentes (±10%) → Marca como recurring
- Mínimo 3 transacciones para detectar pattern

---

### 8. 🔗 Transfer Linking

**Qué hace**:
- Detecta automáticamente cuando mueves dinero entre TUS cuentas
- Linkea ambos lados del transfer
- Evita contar dos veces en reports
- Muestra ↔️ icon visual

**Ejemplo**:
```
BofA Checking: "Transfer to Wise" -$1,000.00
Wise: "From Bank of America" +$1,000.00

→ Sistema detecta: mismo monto, fecha similar, keywords ("transfer")
→ Los linkea automáticamente
→ En reports: cuenta como $0 net (no es gasto ni ingreso)
```

**Algoritmo**:
1. Busca transactions con amount opuesto (±1%)
2. Fechas dentro de 3 días
3. Keywords: "transfer", "wire", "ACH", "Zelle"
4. Si match → Link ambos

---

### 9. 📊 Comprehensive Reports

**Qué hace**:
- 6 reports pre-built:
  1. Spending by Category (pie chart)
  2. Spending Trends (line chart - monthly)
  3. Income vs Expenses (bar chart)
  4. Top Merchants (table)
  5. Budget Performance (gauge charts)
  6. Monthly Comparison (bar chart - year over year)

- Custom Report Builder:
  - Elige: data source, filters, grouping, aggregations
  - Genera chart o table automáticamente
  - Guarda y comparte

**Ejemplo: Spending by Category**:
```
[Pie Chart]
Food & Dining: 35% ($1,245)
Transportation: 20% ($712)
Shopping: 15% ($534)
Entertainment: 12% ($427)
Bills: 10% ($356)
Other: 8% ($285)
```

---

### 10. 📤 Export & Sharing

**Qué hace**:
- Export a CSV (todas las transacciones con metadata completa)
- Export a PDF (report bonito, con charts)
- Export a JSON (full data dump para developers)

**Use cases**:
- Tax preparation (export todo el año → accountant)
- Backup (export JSON completo)
- Analysis en Excel (export CSV)

**CSV includes**:
```csv
Date,Merchant,Amount,Currency,Type,Account,Category,Tags,Notes
2025-09-28,Starbucks,-5.67,USD,expense,BofA,Coffee Shops,"work,morning",""
```

---

### 11. 🏃 Performance at Scale

**Qué hace**:
- Maneja 100k+ transactions sin lag
- Timeline carga en <1 segundo
- Infinite scroll fluido
- Indexes optimizados en SQLite

**Optimizaciones**:
- Pagination (carga 100 a la vez)
- Indexes en: date, account_id, merchant, category_id
- Virtual tables para full-text search
- Batch operations para imports

**Benchmark**:
```
12,000 transactions (2 años):
  - Timeline load: <500ms
  - Filter: <200ms
  - Search: <300ms
  - Report generation: <1s
```

---

### 12. 🔐 Data Security

**Qué hace**:
- SQLite database encriptado (opcional)
- No cloud storage por default (local-first)
- Backups automáticos (daily, encrypted)
- GDPR compliant (export/delete user data)

**Privacy**:
- Tu data NUNCA sale de tu máquina (single-user mode)
- Multi-user mode (opcional) usa auth + data isolation
- Mobile sync (opcional) usa encrypted channel

---

### 13. 👥 Multi-User Support (Optional)

**Qué hace**:
- Múltiples users en la misma máquina (o servidor)
- Cada user ve SOLO su data
- Shared accounts (opcional): comparte una cuenta con tu pareja
- Permissions: view, edit, admin

**Use case**:
```
User: Darwin
  Accounts: BofA, Apple Card, Wise

User: Partner
  Accounts: Chase, Amex

Shared Account: Joint Checking
  Permissions: Both can view + edit
```

---

### 14. 📱 Mobile App (Cross-Platform)

**Qué hace**:
- React Native app (iOS + Android)
- Features core:
  - View timeline
  - Quick entry (add expense manually)
  - Photo capture + OCR (toma foto del receipt → auto-extract)
  - Offline mode (funciona sin internet)
  - Push notifications (budget alerts, recurring reminders)
  - Sync con desktop (automatic, background)

**Mobile-First Features**:
- **Photo OCR**: Foto de receipt → Extrae merchant, amount, date
- **Quick Add**: 2 taps para agregar gasto ($5 en Starbucks)
- **Widgets**: Ver budget status en home screen

**Sync**:
- Bidireccional (desktop ↔ mobile)
- Conflict resolution (last write wins)
- Offline queue (guarda changes, syncs cuando hay internet)

---

### 15. 🧮 Tax Calculations (Future)

**Qué hace**:
- Marca transactions como tax-deductible
- Calcula tax owed/refund por category
- Export tax report para CPA
- Links a receipts (attachments)

**Use case**:
```
Business expenses:
  - Meals with clients: $2,340 (50% deductible)
  - Home office: $1,200 (100% deductible)
  - Travel: $3,456 (100% deductible)

Total deductible: $6,126
Estimated tax savings (30%): $1,837.80
```

---

### 16. 🔔 Smart Notifications

**Qué hace**:
- Budget alerts (80%, 100%, exceeded)
- Recurring payment reminders ("Netflix due tomorrow")
- Unusual spending ("You spent 3x your normal on Shopping this week")
- Transfer confirmations
- Monthly summary ("You saved $400 this month!")

**Configurable**:
- Choose which alerts to receive
- Delivery: push notification, email, in-app
- Frequency: real-time, daily digest, weekly summary

---

### 17. 🎨 Customization

**Qué hace**:
- Themes (light, dark, custom colors)
- Account colors/icons (personaliza cada cuenta)
- Custom categories (crea las tuyas)
- Custom normalization rules (define cómo se limpian merchants)
- Saved filters (quick access a búsquedas frecuentes)

**Personalización sin código**:
```
Normalization rule:
  Pattern: "AMZN*"
  Normalize to: "Amazon"
  Category: Shopping

→ Cualquier "AMZN MKTP US", "AMZN.COM", etc → "Amazon"
```

---

### 18. 📈 Analytics & Insights

**Qué hace**:
- Spending trends (subiendo/bajando comparado con mes pasado)
- Category breakdown (dónde gastas más)
- Merchant frequency (cuántas veces vas a Starbucks)
- Savings rate (income - expenses)
- Net worth tracking (balances de todas las cuentas)

**Ejemplo: Monthly Insights**:
```
October 2025 Summary:
  Income: $5,200
  Expenses: $3,840
  Savings: $1,360 (26% savings rate)

  Top Category: Food & Dining ($1,120, +15% vs Sep)
  Top Merchant: Amazon ($234, 8 purchases)

  Insight: ⚠️ You spent 15% more on food this month
```

---

## 🏗️ Arquitectura Técnica

### Database: Single Source of Truth

**1 tabla core: `transactions`**
- Contiene TODOS los campos para TODAS las features
- Campos que no se usan aún = NULL (no hay problema)
- NO hay "observations table" separada (over-engineering)

**Tablas auxiliares**:
- `accounts`: Metadata de cuentas
- `categories`: Categorías jerárquicas
- `budgets`: Budget tracking
- `recurring_groups`: Recurring patterns
- `normalization_rules`: Merchant normalization config
- `parser_configs`: Bank parser configs
- `users`: Multi-user support

**Filosofía**:
- 1 tabla core con campos estratégicos
- Auxiliares solo cuando necesario
- Config-driven (rules en DB, no código)

---

### Tech Stack

**Desktop App**:
- Electron (cross-platform: Windows, Mac, Linux)
- React + TailwindCSS (UI)
- SQLite (database)
- pdf-parse (extract text from PDFs)

**Mobile App**:
- React Native (iOS + Android)
- Redux (state management)
- AsyncStorage (offline cache)
- ML Kit (OCR for receipts)

**Backend (optional, for multi-user)**:
- Node.js + Express (REST API)
- SQLite (can scale to PostgreSQL)

---

### Data Flow

```
┌─────────────┐
│  Upload PDF │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Extract Text    │ (pdf-parse)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Detect Bank     │ (keywords match in parser_configs)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Parse           │ (config-driven parser)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Normalize       │ (normalization_rules)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Deduplicate     │ (source_hash check)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Categorize      │ (auto-categorization)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Link Transfers  │ (transfer detection)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Insert to DB    │ (transactions table)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Show in Timeline│ ✅
└─────────────────┘
```

**Invisible to user**: Solo ve "PDF subido → Transacciones aparecen"

---

## 🎯 User Experience Philosophy

### No Setup Mode
- No hay "step 1: setup accounts, step 2: import history"
- Simplemente: sube un PDF, aparece en timeline
- Hoy, mañana, en 6 meses = mismo flujo

### Intelligent Defaults
- Auto-categorization (pero editable)
- Auto merchant normalization (pero customizable)
- Auto transfer detection (pero verificable)

### Progressive Disclosure
- Starts simple (timeline + upload)
- Descubres categories cuando las necesitas
- Budgets cuando quieres trackear
- Reports cuando quieres analizar

### Zero Friction
- Drag & drop PDFs
- Keyboard shortcuts everywhere
- Quick actions (right-click menus)
- No modals innecesarios

---

## 🔮 Future Extensibility

### Fácil de Extender

**Agregar nuevo banco**:
1. Crea config YAML con regexes
2. Inserta en `parser_configs` table
3. ✅ Done - NO código

**Agregar nueva categoría**:
1. Click "Add Category"
2. Nombre, icon, parent
3. ✅ Done - NO código

**Agregar nuevo report**:
1. Crea query SQL
2. Registra en report registry
3. UI auto-generado
4. ✅ Done - minimal código

---

## 📊 System Capabilities Summary

| Capability | Status |
|------------|--------|
| **Multi-account** | ✅ Unlimited accounts |
| **Multi-bank** | ✅ Config-driven parsers |
| **Multi-currency** | ✅ USD, MXN, EUR, GBP, etc. |
| **Auto-categorization** | ✅ Rule-based + learning |
| **Budgets** | ✅ Category, merchant, account, total |
| **Recurring detection** | ✅ Automatic pattern detection |
| **Transfer linking** | ✅ Automatic detection |
| **Reports** | ✅ 6 pre-built + custom builder |
| **Export** | ✅ CSV, PDF, JSON |
| **Search** | ✅ Full-text + filters |
| **Mobile** | ✅ iOS + Android + OCR |
| **Offline** | ✅ Full functionality offline |
| **Multi-user** | ✅ Auth + data isolation |
| **Performance** | ✅ 100k+ transactions |
| **Security** | ✅ Encrypted + local-first |

---

## 🎓 Who Is This For?

### ✅ Perfect For:
- Personas con múltiples cuentas bancarias (2-10 accounts)
- Multi-currency users (vives/trabajas en diferentes países)
- Budget-conscious people (quieres control total)
- Privacy-conscious (prefieres local data)
- Power users (quieres customization)

### ❌ NOT For:
- Personas que solo quieren "tracker simple" (esto es completo)
- Businesses que necesitan facturación (esto es personal finance)
- Personas que no quieren subir PDFs (requiere imports)

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
- Single-user mode: Data NEVER leaves your machine
- Multi-user mode (optional): Server on your network
- Mobile sync (optional): Encrypted communication

### Encryption
- Database encryption: AES-256 (optional)
- Backups encrypted
- Export files can be password-protected

### GDPR Compliance
- Export all your data (JSON)
- Delete all your data (one click)
- No tracking, no analytics (by default)

---

## 📖 Documentation

**User Guides**:
- Getting Started
- Importing Your First PDF
- Understanding the Timeline
- Creating Budgets
- Generating Reports

**Developer Docs**:
- Architecture Overview
- Database Schema
- Parser Configuration Guide
- API Documentation (for multi-user)
- Extension Guide (custom parsers)

**Operations**:
- Backup & Restore
- Performance Tuning
- Troubleshooting
- Data Migration

---

## ✅ TL;DR - What Is Finance App?

**Finance App es un sistema COMPLETO de finanzas personales que**:

1. ✅ Soporta múltiples bancos y cuentas
2. ✅ Procesa PDFs automáticamente (config-driven parsers)
3. ✅ Muestra todo en un timeline unificado
4. ✅ Categoriza automáticamente (pero editable)
5. ✅ Te ayuda a crear y trackear budgets
6. ✅ Detecta subscriptions recurrentes
7. ✅ Linkea transfers entre cuentas
8. ✅ Genera reports y analytics
9. ✅ Exporta a CSV, PDF, JSON
10. ✅ Funciona offline (local-first)
11. ✅ Sincroniza con mobile (opcional)
12. ✅ Multi-user support (opcional)
13. ✅ Privacy total (encrypted, local)
14. ✅ Extensible sin código (config-driven)
15. ✅ Rápido (100k+ transactions)

**NO es "Phase 1 MVP"** - Es el sistema COMPLETO, descrito como una unidad.

**Construcción incremental** se documenta SEPARADO en [ROADMAP.md](ROADMAP.md).

---

**Próximo doc**: [ROADMAP.md](ROADMAP.md) (cómo construir esto incremental)
