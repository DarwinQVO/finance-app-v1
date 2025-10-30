# Finance App - Literate Programming Implementation Guide

**Created**: October 29, 2025
**Purpose**: Complete guide for writing Finance App code using Literate Programming paradigm
**Status**: 🟡 Phase 1 - In Progress (0% code written)

---

## 🎯 OBJETIVO PRINCIPAL

Escribir **TODO el código** de Finance App (~4,100 LOC) usando **Literate Programming**:

> Prosa entrelazada con código. El programa se explica en lenguaje natural con fragmentos de código intercalados. El código está totalmente expuesto desde el principio - imposible ocultar ideas deficientes detrás de complejidad.

**NO es**: Documentación después del código
**ES**: Código Y documentación como una sola cosa, inseparable

---

## 📚 FORMATO LITERATE PROGRAMMING

### Estructura de cada sección:

```markdown
## N. [Título del Componente]

[EXPLICACIÓN EN PROSA]
Qué hace este componente, por qué existe, cómo funciona conceptualmente.
Usa lenguaje natural, directo, sin jerga innecesaria.

[CÓDIGO COMPLETO]
El código real, funcional, completo. No pseudocódigo.
Con comentarios inline solo cuando agregan claridad crítica.

[RELACIONES]
Cómo se conecta con otros componentes del sistema.
Qué inputs recibe, qué outputs produce.

[EDGE CASES]
Qué puede fallar y cómo se maneja.
```

### Ejemplo Real:

```markdown
## 1. Database Schema

La base de datos es el contrato del sistema. Define exactamente qué
información guardamos y cómo se relaciona. SQLite local para privacidad
total - ningún dato sale del dispositivo del usuario.

La tabla principal es `transactions`. Cada fila = una transacción bancaria:

```sql
-- db/schema.sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,              -- ISO: 2025-10-28
  merchant TEXT NOT NULL,           -- Normalizado: "Starbucks"
  amount REAL NOT NULL,             -- -5.67 (negativo = gasto)
  currency TEXT NOT NULL,           -- USD | MXN | EUR
  type TEXT NOT NULL,               -- expense | income | transfer

  source_type TEXT NOT NULL,        -- pdf | csv | manual
  source_file TEXT,
  source_hash TEXT,                 -- SHA256 para dedup

  category_id TEXT,
  tags TEXT,                        -- JSON array

  is_edited BOOLEAN DEFAULT FALSE,
  notes TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

Este schema soporta:
- Múltiples bancos (account_id)
- Deduplicación (source_hash)
- Categorización (category_id)
- User edits (is_edited, notes)

Cada campo tiene propósito claro. No hay campos "por si acaso".
```

---

## 🗺️ PLAN COMPLETO - 4 PHASES

### Phase 1: Core (Tasks 1️⃣-1️⃣5️⃣, ~1,800 LOC)
**Objetivo**: App básica pero usable - subir PDFs y ver timeline

**Componentes a escribir:**
1. Database Schema (200 LOC)
   - transactions, accounts, parser_configs, normalization_rules

2. Parser Engine (400 LOC)
   - Base parser class
   - Text extraction
   - Config-driven parsing

3. Parser Configs (100 LOC YAML/JSON)
   - Bank of America
   - Apple Card
   - Wise
   - Scotiabank

4. Normalization Engine (300 LOC)
   - Rule matching
   - Merchant cleanup

5. Upload Flow (250 LOC)
   - File handling
   - Hash generation
   - Deduplication

6. Transaction Timeline UI (200 LOC)
   - List view
   - Infinite scroll
   - Date grouping

7. Filters & Search (150 LOC)
   - Date range
   - Amount range
   - Merchant search
   - Category filter

8. Detail View (100 LOC)
   - Transaction drawer
   - Full metadata

9. Edit Transaction (150 LOC)
   - Edit form
   - Validation
   - Audit trail

10. Transfer Linking (200 LOC)
    - Heuristic matching
    - Cross-currency support

11. Clustering (100 LOC)
    - Similar transaction grouping

12. Manual Entry (150 LOC)
    - Quick add form
    - Auto-complete

**Referencias**:
- [ROADMAP.md](docs/01-foundation/ROADMAP.md) - Tasks 1-15
- [flow-1](docs/02-user-flows/flow-1-timeline-continuo.md) - Timeline
- [flow-2](docs/02-user-flows/flow-2-upload-pdf.md) - Upload
- [flow-4](docs/02-user-flows/flow-4-merchant-normalization.md) - Normalization
- [flow-5](docs/02-user-flows/flow-5-transfer-linking.md) - Transfer linking
- [flow-6](docs/02-user-flows/flow-6-edit-transaction.md) - Edit
- [flow-15](docs/02-user-flows/flow-15-manual-entry.md) - Manual entry

---

### Phase 2: Organization (Tasks 1️⃣6️⃣-2️⃣2️⃣, ~1,000 LOC)
**Objetivo**: Categorías, budgets, recurring, tags

**Componentes:**
1. Categories System (250 LOC)
2. Auto-Categorization (150 LOC)
3. Budgets & Alerts (200 LOC)
4. Recurring Detection (200 LOC)
5. Tags Management (150 LOC)
6. CSV Import (200 LOC)

**Referencias**:
- [flow-7](docs/02-user-flows/flow-7-manage-categories.md)
- [flow-8](docs/02-user-flows/flow-8-setup-budget.md)
- [flow-9](docs/02-user-flows/flow-9-recurring-transactions.md)
- [flow-16](docs/02-user-flows/flow-16-csv-import.md)
- [flow-18](docs/02-user-flows/flow-18-tag-management.md)

---

### Phase 3: Analysis (Tasks 2️⃣3️⃣-3️⃣0️⃣, ~800 LOC)
**Objetivo**: Reports, charts, export, system health, tax

**Componentes:**
1. Pre-built Reports (250 LOC)
2. Custom Report Builder (200 LOC)
3. Export (CSV/PDF/JSON) (150 LOC)
4. Charts (Recharts) (100 LOC)
5. System Health Dashboard (200 LOC)
6. Tax Categorization (150 LOC)

**Referencias**:
- [flow-10](docs/02-user-flows/flow-10-view-reports.md)
- [flow-11](docs/02-user-flows/flow-11-custom-report.md)
- [flow-12](docs/02-user-flows/flow-12-export-data.md)
- [flow-21](docs/02-user-flows/flow-21-system-health.md)
- [flow-24](docs/02-user-flows/flow-24-tax-categorization.md)

---

### Phase 4: Scale (Tasks 3️⃣1️⃣-3️⃣6️⃣, ~500 LOC)
**Objetivo**: Multi-user, auth, REST API, responsive web

**Componentes:**
1. Authentication (bcrypt + JWT) (150 LOC)
2. REST API (Express) (200 LOC)
3. Multi-user Data Isolation (100 LOC)
4. Permissions System (100 LOC)
5. Responsive Web CSS (100 LOC)

**Referencias**:
- [flow-13](docs/02-user-flows/flow-13-multi-user.md)
- [ROADMAP.md](docs/01-foundation/ROADMAP.md) - Tasks 31-36

---

## 📝 DÓNDE ESCRIBIR EL CÓDIGO

### Opción A: Un solo documento (recomendado para empezar)
```
docs/literate-programming/
└── phase-1-core.md           # ~1,800 LOC + prosa
```

### Opción B: Por componente
```
docs/literate-programming/
├── 01-database-schema.md
├── 02-parser-engine.md
├── 03-parser-configs.md
├── 04-normalization.md
└── ... (uno por cada componente)
```

**Decisión**: Empezar con Opción A para Phase 1, ver qué funciona mejor.

---

## 🎨 PRINCIPIOS DEL CÓDIGO

### 1. Claridad sobre cleverness
```javascript
// ❌ NO - Demasiado clever
const d = txns.reduce((a,t) => ({...a, [t.d.split('T')[0]]: [...(a[t.d.split('T')[0]]||[]),t]}), {})

// ✅ SÍ - Claro y obvio
function groupTransactionsByDate(transactions) {
  const groups = {};

  for (const txn of transactions) {
    const date = txn.date.split('T')[0];  // Extract YYYY-MM-DD

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(txn);
  }

  return groups;
}
```

### 2. Nombres descriptivos
```javascript
// ❌ NO
function proc(d) { ... }

// ✅ SÍ
function parseTransactionsFromPDF(pdfPath) { ... }
```

### 3. Funciones pequeñas con un propósito
```javascript
// Una función = Una cosa
// Si necesitas "y" en el nombre, probablemente son 2 funciones

// ✅ Bien
function extractTextFromPDF(path) { ... }
function parseTransactions(text, config) { ... }
function saveTransactions(transactions) { ... }

// ❌ Mal
function extractAndParseAndSave(path) { ... }
```

### 4. Comentarios solo cuando agregan valor
```javascript
// ❌ NO - Comentario obvio
// Increment counter
counter++;

// ✅ SÍ - Comentario que explica "por qué"
// SHA256 porque necesitamos dedup stable across devices
const hash = crypto.createHash('sha256').update(content).digest('hex');
```

### 5. Handle errors explícitamente
```javascript
// ✅ Always handle what can fail
async function uploadPDF(file) {
  try {
    const text = await extractText(file);
    return parseTransactions(text);
  } catch (error) {
    if (error.code === 'INVALID_PDF') {
      throw new Error('File is not a valid PDF');
    }
    if (error.code === 'ENCRYPTED_PDF') {
      throw new Error('PDF is password protected');
    }
    throw error;  // Unknown error, rethrow
  }
}
```

---

## 🔗 ARQUITECTURA BASE

### Tech Stack
- **Desktop**: Electron + React + TailwindCSS
- **Database**: SQLite (better-sqlite3)
- **PDF**: pdf-parse
- **Charts**: Recharts
- **Build**: Vite

### Folder Structure
```
finance-app/
├── src/
│   ├── db/
│   │   └── schema.sql
│   ├── lib/
│   │   ├── parser-engine.js
│   │   ├── normalization.js
│   │   ├── dedup.js
│   │   └── ...
│   ├── configs/
│   │   ├── parser-bofa.js
│   │   ├── parser-apple-card.js
│   │   └── ...
│   ├── components/
│   │   ├── Timeline.tsx
│   │   ├── TransactionCard.tsx
│   │   └── ...
│   └── main.js
├── docs/
│   ├── literate-programming/
│   │   └── phase-1-core.md    # ← AQUÍ ESCRIBIMOS
│   ├── 01-foundation/
│   ├── 02-user-flows/
│   └── ...
└── package.json
```

---

## ✅ CHECKLIST DE PROGRESO

### Phase 1 - Core (~1,800 LOC)

- [ ] **Task 1**: Database Schema (200 LOC)
  - [ ] transactions table
  - [ ] accounts table
  - [ ] parser_configs table
  - [ ] normalization_rules table
  - [ ] indexes

- [ ] **Task 2**: Parser Engine Base (400 LOC)
  - [ ] ParserEngine class
  - [ ] extractText()
  - [ ] applyRules()
  - [ ] Config loader

- [ ] **Task 3**: Parser Configs (100 LOC)
  - [ ] BofA parser config
  - [ ] Apple Card parser config
  - [ ] Wise parser config
  - [ ] Scotiabank parser config

- [ ] **Task 4**: Normalization Engine (300 LOC)
  - [ ] Rule matching
  - [ ] Merchant cleanup
  - [ ] Rules loader

- [ ] **Task 5**: Seed Normalization Rules (50 LOC)
  - [ ] 30+ common rules

- [ ] **Task 6**: Upload Flow (250 LOC)
  - [ ] File picker
  - [ ] Hash generation
  - [ ] Dedup check
  - [ ] Save to DB

- [ ] **Task 7**: Clustering (100 LOC)
  - [ ] Similar transaction detection

- [ ] **Task 8**: Timeline UI (200 LOC)
  - [ ] Transaction list
  - [ ] Date grouping
  - [ ] Infinite scroll

- [ ] **Task 9**: Filters (150 LOC)
  - [ ] Date range
  - [ ] Amount range
  - [ ] Search
  - [ ] Category

- [ ] **Task 10**: Detail View (100 LOC)
  - [ ] Transaction drawer
  - [ ] Full metadata display

- [ ] **Task 11**: Edit Transaction (150 LOC)
  - [ ] Edit form
  - [ ] Validation
  - [ ] Save with audit trail

- [ ] **Task 12**: Transfer Linking (200 LOC)
  - [ ] Heuristic matching
  - [ ] Cross-currency
  - [ ] UI for linking

- [ ] **Task 13**: Manual Entry (150 LOC)
  - [ ] Quick add form
  - [ ] Auto-complete
  - [ ] Duplicate detection

- [ ] **Task 14**: Refunds & Pending (150 LOC)
  - [ ] Refund detection
  - [ ] Pending → posted matching

- [ ] **Task 15**: Backup (150 LOC)
  - [ ] Export JSON
  - [ ] Restore

### Phase 2 - Organization (~1,000 LOC)
- [ ] Categories
- [ ] Budgets
- [ ] Recurring
- [ ] Tags
- [ ] CSV Import

### Phase 3 - Analysis (~800 LOC)
- [ ] Reports
- [ ] Charts
- [ ] Export
- [ ] System Health
- [ ] Tax

### Phase 4 - Scale (~500 LOC)
- [ ] Auth
- [ ] REST API
- [ ] Multi-user
- [ ] Responsive Web

---

## 🎯 ESTADO ACTUAL

**Fecha**: October 29, 2025

**Completado:**
- ✅ 23 flows documentados (~14,900 lines)
- ✅ Arquitectura completa definida
- ✅ Schema base diseñado
- ✅ ROADMAP con 36 tasks secuenciales
- ✅ Sin inconsistencias en documentación

**En progreso:**
- 🟡 Phase 1 - Task 0: Escribir código literate programming

**LOC escritas**: 0 / 4,100 (0%)

---

## 📖 REFERENCIAS CRÍTICAS

### Documentación Base
- [ARCHITECTURE-COMPLETE.md](docs/01-foundation/ARCHITECTURE-COMPLETE.md) - Schema completo
- [ROADMAP.md](docs/01-foundation/ROADMAP.md) - 36 tasks con dependencies
- [SYSTEM-OVERVIEW.md](docs/01-foundation/SYSTEM-OVERVIEW.md) - Visión general

### User Flows (23 flows)
- [docs/02-user-flows/](docs/02-user-flows/) - Todos los flows documentados

### Parsers
- [docs/03-parsers/](docs/03-parsers/) - 5 parser configs documentados

### Technical Pipeline
- [docs/04-technical-pipeline/](docs/04-technical-pipeline/) - 5 stages documentados

### GitHub
- https://github.com/DarwinQVO/finance-app-v1

---

## 🚀 CÓMO CONTINUAR EN PRÓXIMA SESIÓN

1. **Leer este documento completo**
2. **Verificar estado actual** en checklist arriba
3. **Continuar donde quedamos** (último task completado)
4. **Seguir formato literate programming** exactamente
5. **Escribir en**: `docs/literate-programming/phase-1-core.md`
6. **Actualizar checklist** después de cada task

---

## ⚠️ RECORDATORIOS CRÍTICOS

1. **NO escribir código sin prosa** - No es un código dump, es literate programming
2. **NO saltar tasks** - Seguir orden del ROADMAP (dependencies)
3. **NO pseudocódigo** - Código real, funcional, completo
4. **NO ocultar complejidad** - Todo expuesto, todo explicado
5. **SÍ actualizar este documento** - Marcar progress después de cada task
6. **SÍ hacer commits** - Después de cada componente completo
7. **SÍ probar conceptualmente** - ¿El código tiene sentido? ¿Es claro?

---

**Próximo paso**: Escribir Task 1 (Database Schema) en formato literate programming.

**Archivo**: `docs/literate-programming/phase-1-core.md`

**Formato**: Ver ejemplo en sección "FORMATO LITERATE PROGRAMMING" arriba.
