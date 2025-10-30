# Finance App - Roadmap de Construcción

**Plan de desarrollo por fases - Build incremental, documentación completa**

---

## 🎯 Filosofía del Roadmap

✅ **Documentado TODO** - Todas las features están especificadas
✅ **Build incremental** - Construir en orden lógico
✅ **No rehacerse** - Arquitectura correcta desde Phase 1
✅ **Usable en cada phase** - Cada phase entrega valor

---

## 📊 PHASE 1: CORE (MVP Funcional)

**Objetivo**: App básica pero usable. el usuario puede subir PDFs y ver su timeline.

**Duración estimada**: 3-4 semanas

---

## 🏗️ BUILD ORDER - Phase 1 (Secuencia Exacta)

### Week 1: Foundation + Parser Engine

#### 1️⃣ Database Schema (Day 1-2, ~200 LOC)
**Refs**: [ARCHITECTURE-COMPLETE.md](ARCHITECTURE-COMPLETE.md)

**Crear**:
```sql
- transactions table (con TODOS los campos)
- accounts table
- parser_configs table
- normalization_rules table
- Todos los índices
```

**Dependencies**: Ninguna
**Output**: Schema completo en SQLite
**Test**: `sqlite3 app.db ".schema"` muestra todas las tablas

---

#### 2️⃣ Parser Engine (Day 2-4, ~400 LOC)
**Refs**: [flow-2](../02-user-flows/flow-2-upload-pdf.md), [parsers/](../03-parsers/)

**Implementar**:
```javascript
// lib/parser-engine.js
- parseDocument(file, parserConfig) → transactions[]
- extractText(file) → string
- applyParsingRules(text, rules) → transactions[]
```

**Dependencies**: ✅ Database schema
**Output**: Parser engine que lee `parser_configs` y parsea PDFs dinámicamente
**Test**: Parsea 1 PDF de BofA, extrae transactions correctamente

---

#### 3️⃣ Seed Parser Configs (Day 4, ~100 LOC YAML)
**Refs**: [parsers/parser-bofa.md](../03-parsers/parser-bofa.md), etc.

**Crear configs**:
```yaml
- Bank of America (parser-bofa.md)
- Apple Card (parser-apple-card.md)
- Wise (parser-wise.md)
- Scotiabank (parser-scotia.md)
```

**Dependencies**: ✅ Parser engine, ✅ Database schema
**Output**: 4 configs en `parser_configs` table
**Test**: Cada config parsea su PDF correctamente

---

#### 4️⃣ Normalization Engine (Day 5, ~300 LOC)
**Refs**: [flow-4](../02-user-flows/flow-4-merchant-normalization.md)

**Implementar**:
```javascript
// lib/normalization.js
- normalizeMerchant(rawMerchant, rules) → normalizedName
- loadNormalizationRules() → rules[]
```

**Dependencies**: ✅ Database schema
**Output**: Engine que lee `normalization_rules` y normaliza merchants
**Test**: "STARBUCKS STORE #12345" → "Starbucks"

---

#### 5️⃣ Seed Normalization Rules (Day 5, ~50 LOC YAML)
**Refs**: [flow-4](../02-user-flows/flow-4-merchant-normalization.md)

**Crear ~30 reglas**:
```yaml
- Starbucks, Amazon, Uber, Netflix, etc.
```

**Dependencies**: ✅ Normalization engine
**Output**: 30 rules en `normalization_rules` table
**Test**: Rules aplicadas a sample transactions

---

### Week 2: Upload Flow + Timeline

#### 6️⃣ Upload Flow Backend (Day 6-7, ~300 LOC)
**Refs**: [flow-2](../02-user-flows/flow-2-upload-pdf.md)

**Implementar**:
```javascript
// main/handlers/upload.js
- handleUpload(file) → { imported, errors }
- calculateHash(file) → sha256
- checkDuplicate(hash) → boolean
- insertTransactions(transactions[])
```

**Dependencies**: ✅ Parser engine, ✅ Normalization engine
**Output**: Upload endpoint con dedup automático
**Test**: Upload 1 PDF, verifica transactions en DB

---

#### 7️⃣ Timeline UI (Day 8-10, ~400 LOC)
**Refs**: [flow-1](../02-user-flows/flow-1-timeline-continuo.md)

**Implementar**:
```javascript
// components/Timeline.jsx
- Infinite scroll
- Group by date
- Display: date, merchant, amount, currency
- Click → open detail panel
```

**Dependencies**: ✅ Database schema, ✅ Upload flow (para tener data)
**Output**: Timeline que muestra transactions
**Test**: Muestra 100+ transactions sin lag (<3 seg)

---

#### 8️⃣ Upload Zone UI (Day 10-11, ~200 LOC)
**Refs**: [flow-2](../02-user-flows/flow-2-upload-pdf.md)

**Implementar**:
```javascript
// components/UploadZone.jsx
- Drag & drop zone
- Batch upload (multiple files)
- Progress indicator
- Success/error feedback
```

**Dependencies**: ✅ Upload backend, ✅ Timeline UI
**Output**: UI completa para upload
**Test**: Upload 5 PDFs simultáneos, todos procesan correctamente

---

### Week 3: Filters + Details + Manual Entry

#### 9️⃣ Filters UI (Day 12-13, ~200 LOC)
**Refs**: [flow-1](../02-user-flows/flow-1-timeline-continuo.md), [7-ui-filters](../04-technical-pipeline/7-ui-filters.md)

**Implementar**:
```javascript
// components/Filters.jsx
- Account filter (dropdown)
- Date range (datepicker)
- Type filter (expense/income/transfer)
- Search merchant
```

**Dependencies**: ✅ Timeline UI
**Output**: Filters que actualizan timeline
**Test**: Cada filtro funciona correctamente

---

#### 🔟 Transaction Detail View (Day 14, ~150 LOC)
**Refs**: [flow-3](../02-user-flows/flow-3-view-transaction.md)

**Implementar**:
```javascript
// components/TransactionDetail.jsx
- Side panel con todos los campos
- Muestra metadata (source, confidence)
- Edit button
```

**Dependencies**: ✅ Timeline UI
**Output**: Detail panel lateral
**Test**: Click transaction → muestra detalles completos

---

#### 1️⃣1️⃣ Manual Entry (Day 15-16, ~250 LOC)
**Refs**: [flow-15](../02-user-flows/flow-15-manual-entry.md)

**Implementar**:
```javascript
// components/QuickAdd.jsx
- Quick Add form
- Auto-complete (merchants, categories, accounts)
- Smart defaults (last used account/category)
- Duplicate detection
```

**Dependencies**: ✅ Database schema (mismo INSERT que parser)
**Output**: Quick Add dialog funcional
**Test**: Agregar transaction en <10 segundos

---

### Week 4: Edit + Transfer Linking + Polish

#### 1️⃣2️⃣ Edit Transaction (Day 17-18, ~200 LOC)
**Refs**: [flow-6](../02-user-flows/flow-6-edit-transaction.md)

**Implementar**:
```javascript
// components/EditTransaction.jsx
- Edit: merchant, amount, date, category, notes
- Track changes: is_edited, edited_fields
- Read-only: source_* fields
```

**Dependencies**: ✅ Detail view
**Output**: Edit dialog con audit trail
**Test**: Edit preserva source metadata, track changes

---

#### 1️⃣3️⃣ Transfer Linking (Day 19-20, ~300 LOC)
**Refs**: [flow-5](../02-user-flows/flow-5-transfer-linking.md)

**Implementar**:
```javascript
// lib/transfer-linking.js
- detectTransfers(transactions[]) → pairs[]
- matchTransfers: same amount, opposite sign, close dates
- linkTransfers(pair) → update transfer_pair_id
```

**Dependencies**: ✅ Database con transactions
**Output**: Transfer detection funcional
**Test**: Detecta 80%+ transfers correctos en sample data

---

#### 1️⃣4️⃣ Settings + Polish (Day 21, ~100 LOC)

**Implementar**:
```javascript
// components/Settings.jsx
- Theme (light/dark)
- Default currency
- Language (en/es)
```

**Dependencies**: Ninguna
**Output**: Settings básico
**Test**: Settings persisten entre sesiones

---

### ✅ Phase 1 Complete

**Total LOC**: ~1,800

**Features Working**:
- ✅ Upload PDFs (4 bancos)
- ✅ Ver timeline limpio con normalized merchants
- ✅ Filtrar por cuenta/fecha/tipo
- ✅ Ver detalles con metadata completa
- ✅ Detectar transfers (80%+)
- ✅ Editar transactions con audit trail
- ✅ Manual entry (<10 segundos)
- ✅ Deduplication automática

**Success Criteria**:
- ✅ Upload 96 PDFs sin crashes
- ✅ Timeline muestra 12k transactions en <3 seg
- ✅ Merchants normalizados correctamente (>90%)
- ✅ Transfers detectados (>80%)

---

### 📊 Dependency Graph Phase 1

```
Database Schema (1)
       ↓
    ┌──┴──┬──────────┬────────┐
    ↓     ↓          ↓        ↓
Parser  Norm    Upload    Manual
Engine  Engine  Backend   Entry
  (2)    (4)      (6)      (11)
    ↓     ↓         ↓
  Seed   Seed    Timeline
 Configs Rules      UI
   (3)    (5)      (7)
                    ↓
                ┌───┴───┬──────┐
                ↓       ↓      ↓
             Upload  Filters  Detail
             Zone UI   UI     View
               (8)     (9)    (10)
                               ↓
                             Edit
                             Dialog
                              (12)

Transfer Linking (13) ← puede ir al final
Settings (14) ← independiente
```

---

## 📊 PHASE 2: ORGANIZATION (Categories & Budgets)

**Objetivo**: el usuario puede categorizar gastos y trackear budgets.

**Duración estimada**: 2-3 semanas

---

## 🏗️ BUILD ORDER - Phase 2 (Secuencia Exacta)

### Week 5: Categories + Auto-Categorization

#### 1️⃣5️⃣ Categories Table + Seed (Day 22-23, ~150 LOC)
**Refs**: [flow-7](../02-user-flows/flow-7-manage-categories.md), [CATEGORIES-BUDGETS.md](../05-phase-features/CATEGORIES-BUDGETS.md)

**Crear**:
```sql
- categories table (hierarchical)
- Seed ~30 default categories: Food, Transport, Entertainment, etc.
```

**Dependencies**: ✅ Phase 1 complete
**Output**: Categories table poblada con defaults
**Test**: Query categories, verifica jerarquía

---

#### 1️⃣6️⃣ Auto-Categorization Engine (Day 23-24, ~200 LOC)
**Refs**: [flow-7](../02-user-flows/flow-7-manage-categories.md)

**Implementar**:
```javascript
// lib/auto-categorization.js
- autoCategorizTransaction(txn, rules) → categoryId
- addCategoryRule(merchant, categoryId)
- applyCategoryRules(transactions[])
```

**Dependencies**: ✅ Categories table, ✅ Normalization rules
**Output**: Engine que auto-categoriza basado en merchant/keywords
**Test**: "Starbucks" → category="Food & Dining"

---

#### 1️⃣7️⃣ Categories UI (Day 25-26, ~250 LOC)
**Refs**: [flow-7](../02-user-flows/flow-7-manage-categories.md)

**Implementar**:
```javascript
// components/Categories.jsx
- Categories tree view
- Quick categorize (from timeline)
- Bulk categorize
- Create custom category
- Add category rule
```

**Dependencies**: ✅ Auto-categorization engine, ✅ Timeline UI
**Output**: UI completa para categories
**Test**: Categorizar 10 transactions manualmente

---

### Week 6: Budgets + Recurring

#### 1️⃣8️⃣ Budgets Table (Day 27, ~100 LOC)
**Refs**: [flow-8](../02-user-flows/flow-8-setup-budget.md)

**Crear**:
```sql
- budgets table
- Support: by category, merchant, account
- Alert thresholds
```

**Dependencies**: ✅ Categories table
**Output**: Budgets table creada
**Test**: Insert sample budget, query correctamente

---

#### 1️⃣9️⃣ Budget Tracking Engine (Day 28, ~150 LOC)
**Refs**: [flow-8](../02-user-flows/flow-8-setup-budget.md)

**Implementar**:
```javascript
// lib/budget-tracking.js
- calculateBudgetSpent(budgetId) → amount
- checkBudgetAlert(budgetId) → boolean
- getBudgetProgress(budgetId) → { spent, limit, percentage }
```

**Dependencies**: ✅ Budgets table, ✅ Categories
**Output**: Budget tracking funcional
**Test**: Create budget, verifica cálculo correcto

---

#### 2️⃣0️⃣ Budgets UI (Day 29-30, ~200 LOC)
**Refs**: [flow-8](../02-user-flows/flow-8-setup-budget.md)

**Implementar**:
```javascript
// components/Budgets.jsx
- Budgets dashboard (progress bars)
- Create budget wizard
- Edit/delete budget
- Alert notifications
```

**Dependencies**: ✅ Budget tracking engine
**Output**: Budgets UI completa
**Test**: Create budget, verifica progress en real-time

---

#### 2️⃣1️⃣ Recurring Detection Engine (Day 31-32, ~200 LOC)
**Refs**: [flow-9](../02-user-flows/flow-9-recurring-transactions.md)

**Implementar**:
```javascript
// lib/recurring-detection.js
- detectRecurring(transactions[]) → groups[]
- groupByPattern(merchant, amount, frequency)
- Confidence threshold: 70%+
```

**Dependencies**: ✅ Transactions con history (Phase 1 data)
**Output**: Recurring detection funcional
**Test**: Detecta Netflix, Spotify como recurring

---

#### 2️⃣2️⃣ Recurring UI (Day 33, ~150 LOC)
**Refs**: [flow-9](../02-user-flows/flow-9-recurring-transactions.md)

**Implementar**:
```javascript
// components/Recurring.jsx
- List recurring groups
- Show frequency, next expected date
- Mark as not recurring
- Alert on missed payment
```

**Dependencies**: ✅ Recurring detection engine
**Output**: Recurring UI completa
**Test**: Muestra recurring groups correctamente

---

### Week 7: Import/Export + Advanced Organization

#### 2️⃣3️⃣ CSV Import (Day 34-35, ~300 LOC)
**Refs**: [flow-16](../02-user-flows/flow-16-csv-import.md)

**Implementar**:
```javascript
// lib/csv-import.js
- parseCSV(file) → rows[]
- mapColumns(rows, mapping) → transactions[]
- Auto-detect format (Mint, YNAB, etc)
- Column mapping wizard UI
```

**Dependencies**: ✅ Parser engine (similar logic), ✅ Upload flow
**Output**: CSV import funcional
**Test**: Import sample CSV from Mint, verifica transactions

---

#### 2️⃣4️⃣ Saved Filters (Day 36, ~150 LOC)
**Refs**: [flow-17](../02-user-flows/flow-17-saved-filters.md)

**Implementar**:
```javascript
// components/SavedFilters.jsx
- Save current filter combination
- Pin to sidebar
- Set as default
- Quick apply (1-click)
```

**Dependencies**: ✅ Filters UI (Phase 1)
**Output**: Saved filters funcional
**Test**: Save filter, apply en 1 click

---

#### 2️⃣5️⃣ Tag Management (Day 37, ~150 LOC)
**Refs**: [flow-18](../02-user-flows/flow-18-tag-management.md)

**Implementar**:
```javascript
// components/TagManagement.jsx
- Rename tag (updates all transactions)
- Merge tags
- Delete tag
- Smart suggestions
```

**Dependencies**: ✅ Tags siendo usados (Phase 1)
**Output**: Tag management completo
**Test**: Rename tag, verifica update en todas las transactions

---

#### 2️⃣6️⃣ Credit Card Balance Dashboard (Day 38-39, ~250 LOC)
**Refs**: [flow-19](../02-user-flows/flow-19-credit-card-balances.md)

**Implementar**:
```javascript
// components/CreditCardDashboard.jsx
- Current balance calculation
- Statement cycle tracking
- Payment due dates
- Utilization % (balance / credit_limit)
- Payment calendar
```

**Dependencies**: ✅ Transactions, ✅ Accounts table
**Output**: Credit card dashboard completo
**Test**: Muestra balance correcto, payment due dates

---

### ✅ Phase 2 Complete

**Total LOC**: +1,000 (Acumulado: ~2,800)

**Features Working**:
- ✅ Categorizar transactions (manual + auto)
- ✅ Crear budgets por categoría/merchant
- ✅ Ver progreso de budgets en real-time
- ✅ Detectar recurring transactions (>90% confidence)
- ✅ Tags en transactions
- ✅ Filtrar por category/tag
- ✅ Import desde CSV/Excel
- ✅ Saved filters (quick access)
- ✅ Tag management (rename/merge/delete)
- ✅ Credit card balance tracking

**Success Criteria**:
- ✅ Auto-categoriza 80% de transactions
- ✅ Budgets alertan correctamente al 80% del límite
- ✅ Recurring detecta Netflix, Spotify, etc (>90%)
- ✅ CSV import procesa 1000+ transactions sin errores

---

### 📊 Dependency Graph Phase 2

```
Phase 1 Complete
       ↓
   Categories
   Table + Seed
      (15)
       ↓
   ┌───┴────┐
   ↓        ↓
Auto-Cat   Budgets
Engine     Table
  (16)      (18)
   ↓         ↓
Categories  Budget
   UI      Tracking
  (17)      (19)
            ↓
          Budgets
            UI
           (20)

Recurring Detection (21) ← necesita transactions history
     ↓
Recurring UI (22)

CSV Import (23) ← usa parser engine (Phase 1)
Saved Filters (24) ← usa filters UI (Phase 1)
Tag Management (25) ← necesita tags (Phase 1)
Credit Card Dashboard (26) ← necesita transactions + accounts
```

---

## 📊 PHASE 3: ANALYSIS (Reports & Export)

**Objetivo**: el usuario puede analizar sus gastos y exportar data.

**Duración estimada**: 2 semanas

---

## 🏗️ BUILD ORDER - Phase 3 (Secuencia Exacta)

### Week 8: Report Engine + Pre-built Reports

#### 2️⃣7️⃣ Report Engine (Day 40-41, ~200 LOC)
**Refs**: [flow-10](../02-user-flows/flow-10-view-reports.md), [REPORTS-EXPORT.md](../05-phase-features/REPORTS-EXPORT.md)

**Implementar**:
```javascript
// lib/report-engine.js
- aggregateByCategory(dateRange) → { category, amount }[]
- aggregateByMerchant(dateRange) → { merchant, amount }[]
- getTrends(dateRange, groupBy) → timeseries[]
- compareMonths(month1, month2) → comparison[]
```

**Dependencies**: ✅ Transactions, ✅ Categories (Phase 2)
**Output**: Report engine con aggregations
**Test**: Aggregate sample data, verifica sumas correctas

---

#### 2️⃣8️⃣ Pre-built Reports UI (Day 42-44, ~300 LOC)
**Refs**: [flow-10](../02-user-flows/flow-10-view-reports.md)

**Implementar 6 reports**:
```javascript
// components/Reports.jsx
1. Spending by Category (pie chart - Recharts)
2. Spending Trends (line chart - timeseries)
3. Income vs Expenses (bar chart - monthly comparison)
4. Top Merchants (table - sortable)
5. Budget Performance (gauge charts)
6. Monthly Comparison (bar chart - current vs previous)
```

**Dependencies**: ✅ Report engine, ✅ Recharts library
**Output**: 6 pre-built reports funcionales
**Test**: Cada report muestra data correctamente

---

### Week 9: Custom Reports + Export

#### 2️⃣9️⃣ Custom Report Builder (Day 45-46, ~250 LOC)
**Refs**: [flow-11](../02-user-flows/flow-11-custom-report.md)

**Implementar**:
```javascript
// components/CustomReportBuilder.jsx
- Drag & drop query builder
- Select: fields, filters, group by, date range
- Save report config
- Multiple visualization types (chart/table)
- Share report (export config JSON)
```

**Dependencies**: ✅ Report engine
**Output**: Custom report builder funcional
**Test**: Create custom report, save, re-run

---

#### 3️⃣0️⃣ Export Engine (Day 47-48, ~250 LOC)
**Refs**: [flow-12](../02-user-flows/flow-12-export-data.md)

**Implementar**:
```javascript
// lib/export-engine.js
- exportToCSV(transactions[], fields[]) → csv file
- exportToPDF(report) → pdf file (pdfkit)
- exportToJSON(transactions[]) → json file
- Excel-compatible CSV (UTF-8 BOM)
```

**Dependencies**: ✅ Transactions, ✅ Reports
**Output**: Export engine con 3 formatos
**Test**: Export 1000+ transactions, verifica formato correcto

---

#### 3️⃣1️⃣ Export UI (Day 49, ~150 LOC)
**Refs**: [flow-12](../02-user-flows/flow-12-export-data.md)

**Implementar**:
```javascript
// components/ExportModal.jsx
- Select format (CSV/PDF/JSON)
- Select date range
- Select fields (columns)
- Apply filters
- Download button
```

**Dependencies**: ✅ Export engine
**Output**: Export modal completo
**Test**: Export to all 3 formats, verifica correctness

---

### ✅ Phase 3 Complete

**Total LOC**: +800 (Acumulado: ~3,600)

**Features Working**:
- ✅ Ver 6 reports pre-built con charts interactivos
- ✅ Crear custom reports con query builder
- ✅ Exportar a CSV/PDF/JSON
- ✅ Filters en reports
- ✅ Save/load report configs
- ✅ Professional PDF reports

**Success Criteria**:
- ✅ Reports se generan en <2 seg (12k transactions)
- ✅ Export CSV funciona con 12k transactions
- ✅ PDF reports se ven profesionales
- ✅ Custom reports funcionan con cualquier combinación de filters

---

### 📊 Dependency Graph Phase 3

```
Phase 2 Complete
       ↓
   Report
   Engine
    (27)
       ↓
   ┌───┴────┐
   ↓        ↓
Pre-built  Custom
Reports    Report
  UI      Builder
 (28)      (29)

Export Engine (30) ← usa transactions + reports
      ↓
  Export UI (31)
```

---

## 📊 PHASE 4: SCALE (Multi-user & Mobile)

**Objetivo**: Múltiples usuarios y app móvil.

**Duración estimada**: 3-4 semanas

---

## 🏗️ BUILD ORDER - Phase 4 (Secuencia Exacta)

### Week 10-11: Multi-User System

#### 3️⃣2️⃣ Users Table + Auth Backend (Day 50-51, ~200 LOC)
**Refs**: [flow-13](../02-user-flows/flow-13-multi-user.md), [MULTI-USER.md](../05-phase-features/MULTI-USER.md)

**Implementar**:
```sql
-- Database
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT CHECK(role IN ('admin', 'user')),
  created_at TEXT
);
```

```javascript
// lib/auth.js
- register(email, password) → userId
- login(email, password) → session
- logout(sessionId)
- hashPassword(password) → bcrypt hash
```

**Dependencies**: ✅ Phase 3 complete
**Output**: Auth system funcional con bcrypt
**Test**: Register user, login, logout

---

#### 3️⃣3️⃣ Data Isolation (Day 52-53, ~150 LOC)
**Refs**: [flow-13](../02-user-flows/flow-13-multi-user.md)

**Implementar**:
```javascript
// lib/data-isolation.js
- Agregar user_id filter a TODAS las queries:
  - getTransactions(userId)
  - getAccounts(userId)
  - getCategories(userId)
  - getBudgets(userId)
- Migration: agregar user_id a data existente
```

**Dependencies**: ✅ Users table
**Output**: Queries aisladas por user
**Test**: 2 users, no ven data del otro

---

#### 3️⃣4️⃣ Multi-User UI (Day 54-55, ~200 LOC)
**Refs**: [flow-13](../02-user-flows/flow-13-multi-user.md)

**Implementar**:
```javascript
// components/Auth.jsx
- Login screen
- Register screen
- User switcher (dropdown)
- Logout button

// components/UserManagement.jsx
- User list (admin only)
- Create/edit/delete users
- Permissions management
```

**Dependencies**: ✅ Auth backend, ✅ Data isolation
**Output**: Multi-user UI completa
**Test**: Login con 2 users diferentes

---

### Week 12: REST API + Sync

#### 3️⃣5️⃣ REST API (Day 56-58, ~300 LOC)
**Refs**: [MOBILE-APP.md](../05-phase-features/MOBILE-APP.md)

**Implementar**:
```javascript
// server/api.js (Express)
POST   /api/auth/login
POST   /api/auth/register
GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id
GET    /api/accounts
GET    /api/categories
GET    /api/budgets
POST   /api/sync
```

**Dependencies**: ✅ Auth backend
**Output**: REST API funcional con JWT auth
**Test**: Call endpoints con Postman, verifica responses

---

#### 3️⃣6️⃣ Responsive Web Interface (Day 59-60, ~200 LOC)
**Refs**: [flow-13](../02-user-flows/flow-13-multi-user.md)

**Implementar**:
```javascript
// web/responsive.css
- Mobile-optimized timeline view
- Touch-friendly buttons (min 44px)
- Responsive breakpoints (768px, 1024px)
- Mobile navigation menu

// web/service-worker.js (optional)
- Offline caching of static assets
- Progressive Web App (PWA) support
```

**Dependencies**: ✅ REST API
**Output**: Responsive web interface accessible on mobile browsers
**Test**: Open app on mobile browser, verify usability

**Note**: No native mobile app (iOS/Android) - desktop-first with responsive web access

---

### ✅ Phase 4 Complete

**Total LOC**: +500 (Acumulado: ~4,100)

**Features Working**:
- ✅ Multiple users en mismo dispositivo
- ✅ User profiles y settings
- ✅ Data isolation completo
- ✅ Shared accounts con permissions granulares (view/edit/admin)
- ✅ REST API para web access
- ✅ Responsive web interface (mobile browser access)

**Success Criteria**:
- ✅ 2+ users sin conflictos
- ✅ Data isolation completa por user_id
- ✅ Shared accounts funcionan correctamente
- ✅ Permissions se respetan (view/edit/admin)
- ✅ Web interface responsive en mobile browsers

---

### 📊 Dependency Graph Phase 4

```
Phase 3 Complete
       ↓
    Users
   Table +
    Auth
    (32)
       ↓
    Data
  Isolation
    (33)
       ↓
  Multi-User
     UI
    (34)
       ↓
    REST
     API
    (35)
       ↓
    Sync
   Engine
    (36)
       ↓
   ┌────┴────┐
   ↓         ↓
Mobile     Mobile
Core     Advanced
 (37)      (38)
```

---

## 🚀 Optional Enhancements (Post-Phase 4)

### Advanced Features
- ✅ **Plaid integration** - Conectar bancos directamente
- ✅ **Investment tracking** - Stocks, crypto
- ✅ **Receipt OCR advanced** - Itemized receipts
- ✅ **ML categorization** - Mejorar auto-categorization
- ✅ **Forecasting** - Predecir gastos futuros
- ✅ **Multi-currency advanced** - Exchange rates automáticos
- ✅ **Webhooks** - Para integraciones
- ✅ **Zapier/IFTTT** - Conectar con otros apps

---

## 📅 Timeline Total

| Phase | Duración | LOC | Features |
|-------|----------|-----|----------|
| Phase 1 (Core) | 3-4 weeks | ~1,800 | Upload, Timeline, Filters, Transfers |
| Phase 2 (Organization) | 2-3 weeks | +1,000 | Categories, Budgets, Recurring, Tags |
| Phase 3 (Analysis) | 2 weeks | +800 | Reports, Export, Charts |
| Phase 4 (Scale) | 2-3 weeks | +500 | Multi-user, REST API, Responsive Web |
| **Total** | **9-12 weeks** | **~4,100** | **Sistema completo** |

---

## 🎯 Milestones

### Milestone 1: Phase 1 Done (Week 4)
**el usuario puede usar la app diariamente**
- ✅ Sube PDFs
- ✅ Ve timeline limpio
- ✅ Filtra y busca
- ✅ Edita transactions

### Milestone 2: Phase 2 Done (Week 7)
**el usuario tiene control financiero**
- ✅ Todo de Phase 1
- ✅ Categoriza gastos
- ✅ Trackea budgets
- ✅ Ve recurring

### Milestone 3: Phase 3 Done (Week 9)
**el usuario analiza sus finanzas**
- ✅ Todo de Phase 1-2
- ✅ Reports visuales
- ✅ Exporta a Excel/PDF
- ✅ Insights históricos

### Milestone 4: Phase 4 Done (Week 12)
**Sistema completo y escalable**
- ✅ Todo de Phase 1-3
- ✅ Multi-user con data isolation
- ✅ Shared accounts
- ✅ Responsive web interface
- ✅ Listo para otros usuarios

---

## 🔧 Tech Stack por Phase

### Phase 1-3 (Desktop)
- **Frontend**: Electron + React + TailwindCSS
- **Backend**: Node.js
- **Database**: SQLite (better-sqlite3)
- **Parsing**: pdf-parse
- **Charts**: Recharts (Phase 3)

### Phase 4 (Multi-user & Web)
- **Auth**: bcrypt + JWT
- **API**: REST (Express)
- **Sessions**: In-memory (Map)
- **Responsive**: TailwindCSS breakpoints
- **Note**: No native mobile app - desktop-first with responsive web

---

## 📝 Por qué este orden

### Phase 1 primero porque:
- ✅ MVP usable
- ✅ Valida la arquitectura core
- ✅ el usuario lo puede usar YA

### Phase 2 después porque:
- ✅ Necesita Phase 1 funcionando
- ✅ Categories dependen de transactions limpias
- ✅ Budgets dependen de categories

### Phase 3 después porque:
- ✅ Reports necesitan categories
- ✅ Analysis es útil después de 1-2 meses de data

### Phase 4 al final porque:
- ✅ Multi-user es scaling, no core
- ✅ Collaboration features son útiles después de tener data
- ✅ Responsive web es incremental improvement, no blocker

---

## ✅ Cómo usar este roadmap

### El Build Plan está IMPLÍCITO en la estructura

**Este documento ES el build plan completo**:

✅ **Numeración secuencial**: Cada task tiene número (1️⃣-3️⃣8️⃣) = orden de construcción
✅ **Dependencies explícitas**: Cada task lista sus dependencies
✅ **Tests definidos**: Cada task tiene test para validation
✅ **LOC estimados**: Cada task tiene estimación de código
✅ **Refs a flows**: Cada task apunta a documentación técnica
✅ **Dependency graphs**: Visualización de qué depende de qué

**Para construir**:
1. Leer Phase 1 Build Order
2. Hacer task 1️⃣ → test → siguiente
3. Hacer task 2️⃣ → test → siguiente
4. Continuar secuencialmente hasta 3️⃣6️⃣

**No necesitas**:
- ❌ Build plan separado
- ❌ Tickets de Jira
- ❌ Gantt charts
- ❌ Story mapping adicional

**Todo está aquí** en orden ejecutable.

---

### Durante desarrollo:
1. **Seguir numeración** - Task 1️⃣ antes de 2️⃣, 2️⃣ antes de 3️⃣
2. **Test cada task** - No avanzar sin test passing
3. **Consultar flows** - Cada task tiene Refs a documentación detallada
4. **Verificar dependencies** - No empezar task sin dependencies completadas

### Después de cada phase:
1. **Release** - Publicar versión usable
2. **Dog-fooding** - el usuario lo usa por 1-2 semanas
3. **Feedback** - Ajustar según uso real
4. **Next phase** - Empezar siguiente con aprendizajes

---

## 🎯 Success Metrics

### Phase 1 Success:
- el usuario sube 96 PDFs sin crashes
- Timeline muestra 12k transactions en <3 seg
- Merchants normalizados correctamente (>90%)
- Transfers detectados (>80%)

### Phase 2 Success:
- el usuario categoriza 80% de transactions
- Budgets alertan correctamente
- Recurring detecta Netflix, Spotify, etc (>90%)

### Phase 3 Success:
- Reports se generan en <2 seg
- Export CSV funciona con 12k transactions
- PDF reports se ven bonitos

### Phase 4 Success:
- 2+ users pueden usar sin conflictos
- Data isolation funciona correctamente
- Shared accounts respetan permissions
- Responsive web funciona en mobile browsers

---

**Próximos docs**: Documentación detallada de cada feature
- `CATEGORIES-BUDGETS.md`
- `REPORTS-EXPORT.md`
- `MULTI-USER.md`
- `RESPONSIVE-WEB.md`
