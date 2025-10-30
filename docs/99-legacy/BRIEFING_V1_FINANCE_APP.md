# ⚠️ ORIGINAL BRIEFING (Historical Reference)

> **⚠️ LEGACY DOCUMENT**: Este es el briefing ORIGINAL del proyecto (Oct 2025). Contiene referencias a "V1" porque fue creado cuando el proyecto apenas comenzaba.
>
> **Estado actual**: El sistema evolucionó a documentar la aplicación COMPLETA desde el inicio. Ver [SYSTEM-OVERVIEW.md](../01-foundation/SYSTEM-OVERVIEW.md) para la descripción actual.
>
> **Razón de existencia**: Referencia histórica del approach original y contexto del proyecto.

---

# Briefing: Finance App - Simple pero Completa
**Date**: 2025-10-28
**Purpose**: Documentación completa para implementar el finance app
**Approach**: Example-first, Abstract-later
**Target**: Nueva carpeta, nueva sesión, desde cero

---

## 🎯 Executive Summary

**Tu Misión:**
Crear documentación completa (specs, batches, flows, storytelling) para **Finance App V1**:
- ✅ **Simple**: Hardcoded OK, ~1800 LOC, SQLite
- ✅ **Completa**: Todas las features que el usuario necesita día a día + pipeline completo
- ✅ **Timeline Continuo**: Cargar 2 años históricos + continuar con nuevos statements (UN SOLO FLUJO)
- ✅ **Truth Construction**: Pipeline automático (Upload → Parse → Observe → Cluster → Normalize → Canonical)

**NO vas a escribir código.** Solo documentación detallada para que alguien pueda implementarlo.

**Entregables:**
- 10 batch documents (foundation → pipeline → UI)
- 5 user flows (timeline continuo)
- 4 parser specs (BofA, Apple, Wise, Scotia)
- 1 storytelling completo (el usuario usando el app)
- Technical specs (pipeline, clustering, normalization, transfers, currency)

---

## 📖 Context: De Dónde Venimos

### **Trabajo Anterior (NO usar directamente)**
Existe carpeta `/Users/darwinborges/Description/` con:
- 23 verticals (diseñados con abstracciones predefinidas)
- 57 OL primitives (maquinaria universal pre-diseñada)
- 3 systems (truth-construction, audit, api-auth)
- Comprehensive storytelling (2,376 líneas)

**Problema:**
Ese approach era **"diseñar abstracciones primero, luego app"**.

**Nuevo approach:**
**"Construir app simple primero, luego extraer abstracciones"**.

### **Qué Puedes Usar del Trabajo Anterior**
✅ **User journeys** - Qué necesita el usuario (sigue siendo válido)
✅ **Edge cases** - Casos reales que el app debe manejar
✅ **Domain knowledge** - Cómo funcionan bancos, statements, transfers
❌ **Abstracciones prediseñadas** - NO usar primitivos/systems ya diseñados
❌ **Separation app/machinery** - V1 es TODO hardcoded, no hay separación todavía

---

## 🌟 Vision & Core Philosophy

### **1. Timeline Continuo (NO separación histórico vs diario)**

**Principio Fundamental:**
> NO hay diferencia entre "cargar statements históricos" y "usar el app día a día".
> Es UN SOLO FLUJO que funciona para cualquier fecha.

**Ejemplo Concreto:**
```
el usuario puede hacer esto en CUALQUIER orden:

Día 1: Sube BofA_Oct2024.pdf (este mes)
Día 2: Sube BofA_Oct2022.pdf (hace 2 años)
Día 3: Sube BofA_Nov2024.pdf (próximo mes)
Día 4: Busca "Uber" → encuentra matches de 2022, 2023, 2024
Día 5: Dashboard muestra trend completo (2022-2024)

Todo en el mismo timeline, misma vista, mismo flujo.
```

**Implicaciones Técnicas:**
- ✅ Upload funciona igual con statement de 2022 o 2024
- ✅ Transaction list muestra TODO el timeline (sin paginación temporal)
- ✅ Búsqueda funciona sobre TODO el periodo disponible
- ✅ Dashboard calcula trends sobre TODO el periodo
- ✅ Transfer detection busca en TODO el timeline
- ❌ NO hay "modo setup" vs "modo daily use"
- ❌ NO hay botón "importar históricos" separado

---

### **2. Simple pero Completa**

**Definición de "Simple":**
- Hardcoded OK (ej: currency rate = 0.058 hardcoded)
- SQLite (no PostgreSQL, no Redis)
- ~1500 LOC total
- Un archivo por parser (bofa.py con regex hardcoded)
- Funciones directas (no clases abstractas complejas)

**Definición de "Completa":**
- ✅ Soporta 4 bancos de el usuario (BofA, Apple Card, Wise, Scotia)
- ✅ Soporta 2 currencies (USD, MXN)
- ✅ Todas las features necesarias para uso diario:
  - Upload statements
  - Ver transacciones (list + detail)
  - Buscar/filtrar (por merchant, date, amount, category)
  - Categorizar gastos
  - Detectar transfers automáticamente
  - Convertir currencies (MXN ↔ USD)
  - Dashboard con trends mensuales
- ✅ Maneja casos edge reales (duplicates, corrupted PDFs, layout changes)

**NO incluye (fuera de scope V1):**
- ❌ API pública (solo web UI)
- ❌ Multi-user (solo el usuario)
- ❌ Real-time sync con bancos
- ❌ Mobile app
- ❌ ML/predictions
- ❌ Budgets/forecasting avanzado
- ❌ Audit trails detallados (ProvenanceLedger)

---

### **3. Example-First, Abstract-Later Methodology**

**Proceso:**

**Fase 1 (V1 - Tu trabajo ahora):**
```python
# Hardcoded, directo, simple
def parse_bofa_statement(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        text = pdf.pages[0].extract_text()

        # Regex hardcoded específico para BofA
        pattern = r'(\d{2}/\d{2})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})'
        matches = re.findall(pattern, text)

        transactions = []
        for date, merchant, amount in matches:
            transactions.append({
                'date': f"2024-{date}",  # Year hardcoded
                'merchant': merchant,
                'amount': float(amount.replace('$','').replace(',',''))
            })

        return transactions

# Similar para apple_card, wise, scotia (copy-paste + modify regex)
```

**Fase 2 (V2 - Futuro, NO ahora):**
```python
# Después de ver qué se repite, abstraer
class Parser:
    def parse(self, pdf_path):
        raise NotImplementedError

class BofAParser(Parser):
    def parse(self, pdf_path):
        # Same logic, pero ahora en clase
        ...

# V2 usa abstracciones emergentes (no prediseñadas)
```

**Tu trabajo es SOLO Fase 1 (V1).**

---

## 🏗️ Truth Construction Pipeline (Core Architecture)

### **Why Pipeline is Necessary**

**Problem without pipeline:**
```sql
-- Single table approach (incomplete)
CREATE TABLE transactions (
    merchant TEXT  -- ¿"UBER *EATS" (raw) o "Uber Eats" (clean)?
);

-- If you store raw → UI looks ugly
-- If you store clean → you lost original data
-- If you change normalization rule → can't re-process
```

**Solution with pipeline:**
```
Upload → Parse → ObservationStore (raw, AS-IS)
                      ↓
                  Clustering (group similar)
                      ↓
                  Normalization (apply rules)
                      ↓
              CanonicalStore (truth, clean)
```

---

### **Pipeline Stages (4 steps, each simple)**

#### **Stage 1: Parse → ObservationStore**
```python
# Extract raw data from PDF (AS-IS)
def parse_and_store(pdf_path):
    """Extract transactions as-is from PDF."""
    raw_transactions = parser.parse(pdf_path)

    # Store exactly as extracted (no cleaning)
    for raw in raw_transactions:
        db.execute("""
            INSERT INTO observations (obs_id, upload_id, row_id,
                                      date, raw_merchant, amount, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (generate_id(), upload_id, raw['row'],
              raw['date'], raw['merchant'], raw['amount'], 'USD'))

    return raw_transactions

# Example stored observation:
# obs_id: "obs_123"
# raw_merchant: "UBER *EATS"  (exactly as in PDF)
# amount: -15.00
```

---

#### **Stage 2: Clustering**
```python
# Group similar merchant names (simple string similarity)
def cluster_merchants(observations):
    """Group merchant variants using string similarity."""
    clusters = {}

    for obs in observations:
        merchant = obs['raw_merchant']
        # Normalize for comparison
        normalized = merchant.upper().replace('*', '').replace('-', ' ').strip()

        # Find existing similar cluster
        found = False
        for cluster_id, members in clusters.items():
            if string_similarity(normalized, cluster_id) > 0.80:
                members.append(merchant)
                found = True
                break

        if not found:
            clusters[normalized] = [merchant]

    return clusters

# Example output:
# {
#     "UBER EATS": ["UBER *EATS", "UberEATS", "Uber Eats", "UBER EATS SF"],
#     "STARBUCKS": ["STARBUCKS", "STARBUCKS STORE 1234", "Starbucks Coffee"]
# }

def string_similarity(a, b):
    """Simple Levenshtein distance (edit distance)."""
    # Standard algorithm, ~20 LOC
    # Returns 0.0-1.0 (1.0 = identical)
    ...
```

**Why clustering is simple:**
- No ML, no training data needed
- Just string comparison (edit distance)
- ~50 LOC total
- Hardcoded threshold (80% similarity) OK

---

#### **Stage 3: Normalization**
```python
# Apply rules to create canonical version
def normalize(observation, clusters):
    """Normalize using clusters + rules."""
    raw_merchant = observation['raw_merchant']

    # Step 1: Check cluster
    canonical = clusters.get_canonical(raw_merchant)
    category = None

    # Step 2: Apply regex rules (higher priority)
    for rule in load_normalization_rules():
        if re.match(rule['pattern'], raw_merchant, re.IGNORECASE):
            canonical = rule['canonical']
            category = rule['category']
            break

    # Step 3: Fallback to title case
    if not canonical:
        canonical = raw_merchant.title()

    return {
        'obs_id': observation['obs_id'],
        'canonical_merchant': canonical,
        'category': category or 'Uncategorized'
    }

# Example:
# Input:  obs_id="obs_123", raw_merchant="UBER *EATS"
# Output: canonical_merchant="Uber Eats", category="Food & Dining"
```

**Normalization rules (JSON):**
```json
{
  "rules": [
    {
      "pattern": "UBER.*EATS",
      "canonical": "Uber Eats",
      "category": "Food & Dining",
      "priority": 2
    },
    {
      "pattern": "UBER.*",
      "canonical": "Uber",
      "category": "Transportation",
      "priority": 1
    },
    {
      "pattern": "STARBUCKS.*",
      "canonical": "Starbucks",
      "category": "Food & Dining",
      "priority": 1
    }
  ]
}
```

---

#### **Stage 4: CanonicalStore**
```python
# Store normalized "truth" version
def store_canonical(normalized):
    """Store canonical transaction."""
    db.execute("""
        INSERT INTO transactions
        (txn_id, obs_id, date, canonical_merchant, amount,
         currency, category, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (generate_id(), normalized['obs_id'],
          normalized['date'], normalized['canonical_merchant'],
          normalized['amount'], normalized['currency'],
          normalized['category'], now()))

# Example stored transaction:
# txn_id: "txn_456"
# obs_id: "obs_123" (link to observation)
# canonical_merchant: "Uber Eats" (clean)
# category: "Food & Dining"
```

---

### **Complete Pipeline Orchestration**

```python
def process_upload(pdf_path, upload_id):
    """
    Complete pipeline after upload.

    Total: ~150 LOC for entire pipeline
    Simple, sequential, no async/queues
    """

    # Stage 1: Parse + Store Observations (~30 LOC)
    observations = parse_and_store(pdf_path, upload_id)
    print(f"✓ Extracted {len(observations)} observations")

    # Stage 2: Clustering (~50 LOC)
    clusters = cluster_merchants(observations)
    print(f"✓ Identified {len(clusters)} merchant clusters")

    # Stage 3: Normalization (~40 LOC)
    normalized = []
    for obs in observations:
        canonical = normalize(obs, clusters)
        normalized.append(canonical)
    print(f"✓ Normalized {len(normalized)} transactions")

    # Stage 4: Store Canonical (~20 LOC)
    for txn in normalized:
        store_canonical(txn)
    print(f"✓ Stored {len(normalized)} canonical transactions")

    # Stage 5: Post-processing (~30 LOC)
    detect_transfers(upload_id)
    update_merchant_registry(clusters)
    print(f"✓ Pipeline complete")

    return {
        'observations': len(observations),
        'transactions': len(normalized),
        'clusters': len(clusters)
    }
```

---

### **Data Model: Two Stores**

**ObservationStore (Raw Data):**
```sql
CREATE TABLE observations (
    obs_id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL,
    row_id INTEGER NOT NULL,         -- Row number in PDF (1, 2, 3...)
    date TEXT NOT NULL,              -- ISO: 2022-10-15
    raw_merchant TEXT NOT NULL,      -- "UBER *EATS" (AS-IS from PDF)
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (upload_id) REFERENCES uploads(upload_id)
);

-- Index for querying
CREATE INDEX idx_obs_upload ON observations(upload_id);
CREATE INDEX idx_obs_merchant ON observations(raw_merchant);
```

**CanonicalStore (Truth):**
```sql
CREATE TABLE transactions (
    txn_id TEXT PRIMARY KEY,
    obs_id TEXT NOT NULL,            -- Link to observation
    account_id TEXT NOT NULL,
    upload_id TEXT NOT NULL,
    date TEXT NOT NULL,
    canonical_merchant TEXT NOT NULL, -- "Uber Eats" (normalized)
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    category TEXT,                   -- "Food & Dining"
    is_transfer BOOLEAN DEFAULT 0,
    transfer_pair_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (obs_id) REFERENCES observations(obs_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Indexes for querying
CREATE INDEX idx_txn_date ON transactions(date);
CREATE INDEX idx_txn_merchant ON transactions(canonical_merchant);
CREATE INDEX idx_txn_category ON transactions(category);
CREATE INDEX idx_txn_account ON transactions(account_id);
```

**Why Two Tables:**
1. ✅ **Preserve raw data**: Can always see what PDF actually said
2. ✅ **Re-normalize**: Change rules → re-run pipeline on observations
3. ✅ **Audit trail**: Track what changed from raw to canonical
4. ✅ **UI clean**: Show canonical_merchant ("Uber Eats") not raw ("UBER *EATS")

---

### **Pipeline Complexity Budget**

**Total LOC breakdown:**
```
Stage 1: Parse + ObservationStore    ~30 LOC
Stage 2: Clustering                   ~50 LOC
Stage 3: Normalization                ~40 LOC
Stage 4: CanonicalStore               ~20 LOC
Stage 5: Post-processing              ~30 LOC
Pipeline orchestration                ~30 LOC
─────────────────────────────────────────────
Total Pipeline:                      ~200 LOC

Plus:
- Parsers (4 × 100 LOC):             400 LOC
- UI (Flask + templates):            500 LOC
- Other features:                    700 LOC
─────────────────────────────────────────────
Total V1:                          ~1800 LOC
```

**Remains simple because:**
- ❌ No ML (just string similarity)
- ❌ No async/queues (sequential)
- ❌ No complex abstractions
- ✅ Hardcoded thresholds (80% similarity)
- ✅ Simple regex rules (JSON file)
- ✅ Standard algorithms (Levenshtein distance)

---

### **User Experience (Pipeline Hidden)**

**el usuario sees:**
```
1. Upload BofA_Oct2024.pdf
2. [2 seconds...]
3. ✓ 48 transactions added

[Click "View Transactions"]

Date         Merchant        Amount
2024-10-31   Uber Eats      -$18.00  ← Clean!
2024-10-30   Starbucks      -$5.50   ← Clean!
```

**Behind the scenes (el usuario doesn't see):**
```
Upload → Parse (48 raw) → ObservationStore
      → Cluster (15 groups) → Normalize (48 canonical)
      → CanonicalStore → UI reads canonical
```

**Principle: Complexity hidden, experience simple** ✅

---

## 👤 el usuario's Real Context

### **Perfil Personal**
- **Ubicación**: USA/México (trabaja remotamente, vive en ambos lugares)
- **Situación financiera**: Multi-país (USD + MXN)
- **Motivación**: 2 años de statements sin revisar, necesita visibilidad de flujo de dinero
- **Tech comfort**: Developer, prefiere localhost simple sobre SaaS complejo

---

### **Sistema de Cuentas (4 total)**

el usuario tiene un sistema multi-país optimizado para minimizar fees de conversión:

```python
DARWIN_ACCOUNTS = [
    {
        "id": "bofa_checking",
        "name": "BofA Checking",
        "institution": "Bank of America",
        "currency": "USD",
        "type": "checking",
        "purpose": "Primary income account (USA)",
        "typical_balance": "$5,000-10,000",
        "inflows": "Salary, freelance income (USD)",
        "outflows": "USA expenses, transfers to Wise"
    },
    {
        "id": "apple_card",
        "name": "Apple Card",
        "institution": "Apple/Goldman Sachs",
        "currency": "USD",
        "type": "credit",
        "purpose": "Primary spending (cashback 2-3%)",
        "typical_balance": "-$1,000 to -$2,000 (paid monthly from BofA)",
        "inflows": "Payments from BofA",
        "outflows": "Daily purchases, subscriptions"
    },
    {
        "id": "wise_usd",
        "name": "Wise USD",
        "institution": "Wise",
        "currency": "USD",
        "type": "checking",
        "purpose": "Currency exchange intermediary (low fees)",
        "typical_balance": "$500-1,500",
        "inflows": "Transfers from BofA",
        "outflows": "Conversions to MXN → Scotia"
    },
    {
        "id": "scotia_mxn",
        "name": "Scotia MXN",
        "institution": "Scotiabank Mexico",
        "currency": "MXN",
        "type": "checking",
        "purpose": "Mexico expenses (rent, family, local purchases)",
        "typical_balance": "10,000-20,000 MXN (~$600-1,200 USD)",
        "inflows": "USD→MXN conversions from Wise",
        "outflows": "Mexico rent, groceries, local expenses"
    }
]
```

---

### **Flujo de Dinero Mensual**

**Ingresos (Income):**
```
$4,500-6,000 USD/month → BofA Checking
├─ Salary (empleado remoto)
└─ Freelance projects (ocasional)
```

**Flujo Principal (Main Flow):**
```
BofA Checking ($5,000)
    ↓
    ├─→ Apple Card Payment ($1,500-2,000)  [USA expenses]
    │   ├─ Food & Dining: $800-1,000
    │   ├─ Transportation: $300-400 (Uber)
    │   ├─ Shopping: $400-600
    │   └─ Subscriptions: $150 (Netflix, Spotify, etc)
    │
    ├─→ Direct USA expenses from BofA ($500-1,000)
    │   └─ Utilities, insurance, misc
    │
    └─→ Transfer to Wise USD ($500-1,000)
            ↓
        Convert USD→MXN (better rate than bank)
            ↓
        Transfer to Scotia MXN ($300-500 → ~6,000-10,000 MXN)
            ↓
        Mexico expenses:
            ├─ Rent: ~8,000 MXN (~$400)
            ├─ Groceries: ~2,000 MXN (~$100)
            ├─ Family support: varies
            └─ Local purchases: varies
```

**Total Monthly Flow:**
- **Income**: $4,500-6,000 USD
- **USA Expenses**: ~$2,500-3,000 USD (via Apple Card + BofA direct)
- **Mexico Expenses**: ~$500-800 USD (via Wise→Scotia)
- **Net**: ~$1,000-2,500 USD saved/invested

---

### **Por Qué Este Setup**

**1. BofA (Primary):**
- Cuenta principal en USA
- Recibe todos los ingresos
- Familiarity (cuenta desde hace años)
- Network de ATMs en USA

**2. Apple Card (Credit):**
- Cashback 2-3% en compras
- No foreign transaction fees
- Apple ecosystem integration
- Build credit score

**3. Wise (Currency Exchange):**
- **Problema que resuelve**: Banks charge 3-4% for USD→MXN
- **Solución Wise**: 0.5-1% fee (save $20-40 per transfer)
- Mid-market exchange rate (no markup)
- Fast transfers (1-2 days)

**4. Scotia MXN (Mexico):**
- Local bank account required for Mexico
- Rent payments (landlord requires local transfer)
- Local ATM withdrawals without fees
- Family support (can transfer to relatives)

---

### **Pain Points el usuario Quiere Resolver**

**1. Visibilidad de Flujo:**
- "¿A dónde va mi dinero realmente?"
- "¿Gasto más ahora que hace 2 años?"
- "¿Cuánto va a USA vs México?"

**2. Transfer Tracking:**
- "¿Esa transferencia BofA→Wise corresponde con Wise→Scotia?"
- "¿Estoy perdiendo dinero en conversiones?"

**3. Merchant Normalization:**
- "UBER *EATS", "UberEATS", "Uber Eats" → should all be "Uber Eats"
- "STARBUCKS STORE 1234" → should be "Starbucks"

**4. Currency Clarity:**
- "¿Cuánto gasto total en USD equivalente?"
- "$1,000 USD transferido = ¿cuántos MXN recibidos?"

**5. Historical Analysis:**
- Tiene 2 años de PDFs sin revisar
- Quiere cargar todo de una vez
- Ver trends (¿gasto más en 2024 que 2022?)

---

### **Por Qué V1 Necesita Estas Features**

**Upload & Parse:**
- el usuario tiene 96 PDFs acumulados (24 meses × 4 cuentas)
- Necesita cargar todos rápidamente (timeline continuo)

**Normalization:**
- el usuario ve "UBER *EATS" en BofA, "Uber Eats" en Apple Card
- Quiere entender: "¿Cuánto gasté en Uber total?"

**Transfer Detection:**
- el usuario mueve $500-1,000/mes entre cuentas
- Sin detección: aparecen como +$500 (income) y -$500 (expense) → infla totales
- Con detección: se marcan como transfers → totales correctos

**Currency Conversion:**
- el usuario necesita ver: "Gasté $2,800 total (incluyendo MXN convertido)"
- Scotia muestra "8,000 MXN" → convertir a "$400 USD" para dashboard

**Dashboard:**
- "Gasté $3,200 en Oct 2024 vs $2,800 en Oct 2022" (+14%)
- "Food & Dining aumentó $150/mes desde 2022"
- "Transfers a México promedio: $650/mes"

---

### **Volumen de Datos**
- **Transacciones/mes**: ~500 (125 por cuenta promedio)
- **Periodo histórico**: 2 años (Oct 2022 - Oct 2024)
- **Total transacciones**: ~12,000 (2 años × 500/mes)
- **Statements/mes**: 4 (uno por cuenta)
- **Total statements a cargar**: ~96 (24 meses × 4 cuentas)

### **Uso Típico**

**Semana 1 (Carga inicial):**
- el usuario sube 96 PDFs (todos sus statements de 2 años)
- ~12,000 transacciones cargadas
- Normalization detecta ~200 merchants únicos
- Transfer detection encuentra ~150 transfers

**Semana 2-4 (Exploración):**
- el usuario busca "Uber" → 150 matches (2022-2024)
- Filtra "Food & Dining" → 3,500 transacciones
- Revisa dashboard → "Gastas $200 más/mes que hace 2 años"
- Categoriza ~50 transacciones uncategorized

**Mes 2+ (Uso continuo):**
- el usuario recibe nuevos statements (4 PDFs/mes)
- Sube los 4 PDFs
- Se agregan al timeline existente
- Dashboard se actualiza automáticamente
- Continúa usando el app normalmente

---

## 🎯 Scope V1: Qué Incluye

### **✅ Features Incluidas**

#### **1. Upload & Parse (Critical)**
- Upload PDF via web form
- Auto-detect banco (BofA, Apple Card, Wise, Scotia) basado en layout
- Parse statement → extract raw observations (AS-IS)
- Store en ObservationStore con fecha original del statement
- Duplicate detection (hash SHA256 del PDF)
- Handle corrupted PDFs gracefully

#### **2. Truth Construction Pipeline (Critical)**
- **ObservationStore**: Store raw data exactly as extracted from PDF
- **Clustering**: Group similar merchant variants (string similarity, no ML)
- **Normalization**: Apply regex rules + clusters → canonical names
- **CanonicalStore**: Store clean "truth" version for UI
- **Pipeline automático**: Runs after every upload (sequential, simple)

#### **3. Transaction Management (Critical)**
- List todas las transacciones from CanonicalStore (TODO el timeline)
- Filtros: date range, merchant, amount range, category, account
- Search por texto (busca en canonical merchant name)
- Transaction detail view (ver raw observation + canonical transaction)
- Paginación (50 txns/page)

#### **4. Normalization & Clustering (Critical)**
- Merchant clustering: String similarity (Levenshtein distance, 80% threshold)
- Normalization rules: Regex patterns en JSON file
- Rule priority: Higher priority wins
- Manual override: el usuario puede editar canonical name
- Auto-categorization basada en normalized merchant

#### **5. Accounts & Merchants (Important)**
- List el usuario's 4 accounts
- View balance per account
- List all known merchants
- Add/edit merchant info (canonical name, aliases, default category)

#### **6. Intelligence (Important)**
- Transfer detection automática (matching debit/credit, ±3 days, same amount)
- Currency conversion (MXN → USD usando rate hardcoded)
- Categorization (10-15 categories: Food, Transport, etc)
- Manual category assignment

#### **7. Dashboard (Important)**
- Total balance (across all accounts, converted to USD)
- Spending by category (pie chart, last 30 days)
- Monthly trend (line chart, todos los meses disponibles)
- Top merchants (top 10 by spending)

#### **8. UI (Critical)**
- Web interface (Flask/FastAPI)
- 5 páginas principales:
  1. Upload (form + recent uploads list)
  2. Transactions (list + filters)
  3. Transaction Detail (single transaction view)
  4. Accounts & Merchants (registry views)
  5. Dashboard (summary + charts)
- Responsive (funciona en desktop, no móvil optimizado)

---

### **❌ Fuera de Scope V1**

- ❌ API pública (REST endpoints para terceros)
- ❌ Multi-user / authentication (solo el usuario usa, localhost)
- ❌ Real-time bank sync (no plaid, no OAuth)
- ❌ Mobile app nativa
- ❌ Budgets / forecasting avanzado
- ❌ Split transactions (1 txn → múltiples categories)
- ❌ Recurring transaction detection
- ❌ Receipt scanning / OCR
- ❌ Export to CSV/QBO
- ❌ Tax reporting detallado
- ❌ Investment tracking
- ❌ Loans/mortgages
- ❌ ProvenanceLedger / audit trails detallados
- ❌ Bitemporal queries

---

## 🏗️ Technical Constraints

### **Architecture**
```
finance-app-v1/
├── parsers/              # 4 archivos (bofa.py, apple_card.py, wise.py, scotia.py)
├── app/
│   ├── upload.py        # Upload handler
│   ├── pipeline.py      # Truth construction pipeline (cluster + normalize)
│   ├── observations.py  # ObservationStore operations
│   ├── transactions.py  # CanonicalStore operations
│   ├── accounts.py      # Account management
│   ├── merchants.py     # Merchant registry
│   ├── transfers.py     # Transfer detection
│   ├── currency.py      # Currency conversion
│   └── db.py            # SQLite helpers
├── ui/                   # Flask/FastAPI + templates + static
├── data/
│   ├── finance.db       # SQLite database (2 main tables: observations + transactions)
│   ├── uploads/         # PDF files
│   └── rules.json       # Normalization rules
├── scripts/
│   ├── init_db.py       # Create schema (observations + transactions tables)
│   └── seed_data.py     # el usuario's 4 accounts + initial rules
└── main.py               # Entry point

~1800 LOC total
```

### **Tech Stack**
- **Language**: Python 3.10+
- **Web**: Flask or FastAPI (tu elección)
- **DB**: SQLite (single file: `data/finance.db`)
- **PDF parsing**: pdfplumber
- **No dependencies pesadas**: No pandas, no ML libs, no Redis

### **Data Model (SQLite)**

**Tables (6 principales):**
1. **accounts** (4 rows - el usuario's accounts)
2. **observations** (12k+ rows - raw data from PDFs)
3. **transactions** (12k+ rows - canonical/normalized data)
4. **uploads** (96+ rows - tracking de PDFs subidos)
5. **merchants** (200+ rows - counterparty registry)
6. **normalization_rules** (50+ rows - regex patterns)

**Schema completo:**
```sql
-- accounts: el usuario's 4 cuentas
CREATE TABLE accounts (
    account_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    institution TEXT NOT NULL,
    currency TEXT NOT NULL,
    type TEXT NOT NULL
);

-- observations: Raw data (AS-IS from PDF)
CREATE TABLE observations (
    obs_id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL,
    row_id INTEGER NOT NULL,         -- Row number in PDF (1, 2, 3...)
    date TEXT NOT NULL,              -- ISO: 2022-10-15
    raw_merchant TEXT NOT NULL,      -- "UBER *EATS" (exactly as in PDF)
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (upload_id) REFERENCES uploads(upload_id)
);

CREATE INDEX idx_obs_upload ON observations(upload_id);
CREATE INDEX idx_obs_merchant ON observations(raw_merchant);

-- transactions: Canonical data (normalized/clean)
CREATE TABLE transactions (
    txn_id TEXT PRIMARY KEY,
    obs_id TEXT NOT NULL,            -- Link to observation
    account_id TEXT NOT NULL,
    upload_id TEXT NOT NULL,
    date TEXT NOT NULL,              -- ISO: 2022-10-15
    canonical_merchant TEXT NOT NULL, -- "Uber Eats" (normalized)
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    category TEXT,                   -- "Food & Dining"
    is_transfer BOOLEAN DEFAULT 0,
    transfer_pair_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (obs_id) REFERENCES observations(obs_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE INDEX idx_txn_date ON transactions(date);
CREATE INDEX idx_txn_merchant ON transactions(canonical_merchant);
CREATE INDEX idx_txn_category ON transactions(category);
CREATE INDEX idx_txn_account ON transactions(account_id);

-- uploads: Tracking de PDFs
CREATE TABLE uploads (
    upload_id TEXT PRIMARY KEY,
    file_hash TEXT UNIQUE NOT NULL,  -- SHA256
    file_name TEXT NOT NULL,
    bank TEXT NOT NULL,              -- "bofa", "apple_card", etc
    upload_date TEXT NOT NULL,
    obs_count INTEGER NOT NULL,      -- Observations extracted
    txn_count INTEGER NOT NULL       -- Transactions created
);

-- merchants: Counterparty registry
CREATE TABLE merchants (
    merchant_id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    aliases TEXT,                    -- JSON array: ["UBER *EATS", "UberEATS"]
    category TEXT,
    notes TEXT
);

-- normalization_rules: Regex patterns
CREATE TABLE normalization_rules (
    rule_id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,           -- "UBER.*EATS"
    canonical_merchant TEXT NOT NULL,
    category TEXT,
    priority INTEGER DEFAULT 1       -- Higher priority wins
);
```

**Key Difference:**
- **observations**: Raw data preserved (what PDF actually said)
- **transactions**: Clean data for UI (normalized merchant names)
- Link: `transactions.obs_id → observations.obs_id`

---

## 📦 Deliverables: Qué Debes Crear

### **Estructura de Carpeta Nueva**
```
/Users/darwinborges/finance-app-v1-docs/
├── README.md                           # Overview + how to use docs
├── 0-scope.md                          # Scope detallado (incluye/no incluye)
├── 1-architecture.md                   # Arquitectura V1 completa
├── 2-data-model.md                     # SQLite schema completo
├── 3-tech-stack.md                     # Tech decisions + justifications
│
├── batches/                            # 10 batches de trabajo
│   ├── batch-1-foundation.md          # Setup + DB (2 tables) + config
│   ├── batch-2-upload-parse.md        # Upload + 4 parsers + ObservationStore
│   ├── batch-3-pipeline.md            # Truth construction (Cluster → Normalize → Canonical)
│   ├── batch-4-normalization.md       # Normalization rules + merchant registry
│   ├── batch-5-registry.md            # Accounts + Merchants management
│   ├── batch-6-intelligence.md        # Transfers + Currency + Categories
│   ├── batch-7-ui-upload.md           # Upload UI
│   ├── batch-8-ui-transactions.md     # Transaction list + filters
│   ├── batch-9-ui-detail.md           # Transaction detail view (raw + canonical)
│   └── batch-10-ui-dashboard.md       # Dashboard + charts
│
├── user-flows/                         # 5 flujos principales
│   ├── flow-1-timeline-continuo.md    # Carga inicial + uso continuo (UNIFICADO)
│   ├── flow-2-search-filter.md        # Buscar/filtrar en timeline
│   ├── flow-3-categorization.md       # Asignar categorías
│   ├── flow-4-transfers.md            # Revisar transfers detectados
│   └── flow-5-dashboard.md            # Monthly review
│
├── technical/                          # Specs técnicos detallados
│   ├── parsers/
│   │   ├── bofa-parser.md             # BofA parser (layout, regex, edge cases)
│   │   ├── apple-card-parser.md       # Apple Card parser
│   │   ├── wise-parser.md             # Wise parser
│   │   └── scotia-parser.md           # Scotia parser (MXN)
│   ├── pipeline/
│   │   ├── pipeline-overview.md       # Complete pipeline flow
│   │   ├── clustering-algorithm.md    # String similarity (Levenshtein)
│   │   ├── normalization-engine.md    # Rules + clusters → canonical
│   │   └── observation-vs-canonical.md # Why two stores
│   ├── auto-detection.md              # Cómo auto-detectar banco del PDF
│   ├── normalization-rules.md         # Regex patterns + priority
│   ├── transfer-detection.md          # Transfer matching algorithm
│   ├── currency-conversion.md         # MXN ↔ USD conversion
│   └── duplicate-handling.md          # Duplicate PDF detection
│
└── storytelling/
    ├── darwin-complete-story.md        # Historia completa (timeline continuo)
    └── edge-cases.md                   # 20+ edge cases que V1 debe manejar
```

---

## 📝 Formato de Cada Documento

### **Batch Documents (9 archivos)**

Cada batch debe incluir:

```markdown
# Batch N: [Nombre]

## Overview
- **Purpose**: Para qué sirve este batch
- **Dependencies**: Qué batches previos necesita completados
- **Estimated LOC**: ~200 LOC
- **Estimated Time**: 3-4 horas

## Components
Lista de archivos/módulos a crear:
- `app/upload.py` - Upload handler
- `parsers/bofa.py` - BofA parser
- ...

## Detailed Specifications

### Component 1: upload.py
**Purpose**: Handle PDF upload, detect bank, trigger parsing

**Functions:**
```python
def upload_statement(pdf_file) -> dict:
    """
    Upload PDF statement.

    Args:
        pdf_file: Uploaded file object

    Returns:
        {
            "upload_id": "upl_abc123",
            "bank": "bofa",
            "txn_count": 45,
            "status": "success"
        }

    Edge cases:
    - Duplicate PDF (same hash) → return existing upload_id
    - Corrupted PDF → return error with details
    - Unknown bank → return error "Unsupported bank"
    """
    # 1. Calculate file hash (SHA256)
    # 2. Check if already uploaded
    # 3. Detect bank from PDF layout
    # 4. Call appropriate parser
    # 5. Store transactions in DB
    # 6. Return upload summary
```

[Spec detallada para cada función]

## Acceptance Criteria
- [ ] Can upload BofA PDF → 45 transactions extracted
- [ ] Can upload Apple Card PDF → 52 transactions extracted
- [ ] Duplicate PDF rejected with clear message
- [ ] Corrupted PDF returns error (not crash)
- [ ] All tests pass

## Testing
**Unit tests:**
- `test_upload_valid_pdf()` - Upload BofA statement
- `test_upload_duplicate()` - Upload same PDF twice
- `test_upload_corrupted()` - Upload invalid PDF

**Integration tests:**
- Upload 4 different banks → all succeed
- Upload 96 PDFs (el usuario's 2 years) → all succeed

## Edge Cases
1. **Duplicate upload**: Hash exists → return existing upload_id, don't re-parse
2. **Corrupted PDF**: pdfplumber fails → catch exception, return friendly error
3. **Unknown bank**: No parser matches → return error with "Please contact support"
```

---

### **User Flow Documents (5 archivos)**

Cada flow debe incluir:

```markdown
# User Flow: [Nombre]

## Context
**User**: el usuario
**Goal**: [Objetivo del usuario]
**Preconditions**: [Estado inicial]

## Story

### Part 1: [Título]
**Narrative:**
el usuario [acción]...

**Steps:**
1. el usuario opens http://localhost:5000/upload
2. Clicks "Choose File"
3. Selects `BofA_Oct2022.pdf` from ~/Downloads
4. Clicks "Upload"

**System behavior:**
- Server receives PDF
- Calculates hash: `sha256_abc123...`
- Checks uploads table → hash not found (first upload)
- Detects bank: "bofa" (from PDF layout)
- Calls `parsers.bofa.parse()`
- Extracts 45 transactions
- Inserts to transactions table
- Creates upload record

**User sees:**
```
✓ Upload successful
  File: BofA_Oct2022.pdf
  Bank: Bank of America
  Transactions: 45
  Period: Oct 1-31, 2022
```

[Continuar con más parts del flow]

## Edge Cases Encountered
1. el usuario uploads same PDF twice
2. el usuario uploads corrupted PDF
3. el usuario uploads statement from unsupported bank

## UI Mockups
[Descripción de wireframes/screenshots]

## Success Criteria
- [ ] el usuario can complete entire flow without errors
- [ ] All transactions appear in list
- [ ] Search works across all uploaded statements
- [ ] Dashboard updates with new data
```

---

### **Technical Specs (8 archivos)**

Formato de parser specs:

```markdown
# BofA Parser Specification

## Bank Information
- **Institution**: Bank of America
- **Statement Type**: Checking Account
- **Format**: PDF (text-based)
- **Layout**: Table format, 3 columns (Date, Description, Amount)

## PDF Layout Example
```
BANK OF AMERICA
Checking Account Statement
Account: ...1234

Date        Description              Amount
10/01      UBER *EATS               -$15.00
10/02      DEPOSIT PAYROLL        +$2,500.00
10/03      STARBUCKS STORE 1234    -$5.50
...
```

## Parsing Strategy

### Detection
How to detect this is a BofA statement:
```python
def is_bofa_statement(text):
    """Returns True if PDF is BofA checking statement."""
    indicators = [
        "BANK OF AMERICA" in text,
        "Checking Account Statement" in text,
        re.search(r"Account:.*\d{4}", text)
    ]
    return all(indicators)
```

### Extraction
```python
def parse_bofa_statement(pdf_path):
    """
    Extract transactions from BofA checking statement.

    Returns:
        List[dict]: [
            {
                "date": "2022-10-01",
                "merchant": "UBER *EATS",
                "amount": -15.00,
                "currency": "USD"
            },
            ...
        ]
    """
    # Implementation details
    # 1. Open PDF with pdfplumber
    # 2. Extract text from all pages
    # 3. Find transaction table
    # 4. Apply regex pattern
    # 5. Parse each transaction
    # 6. Return list
```

## Edge Cases
1. **Multi-page statements**: Iterate all pages
2. **Pending transactions**: Skip (not posted yet)
3. **Foreign transactions**: May include "FOREIGN TRANSACTION FEE" line
4. **Layout changes**: BofA changes format occasionally

## Test Data
Include 3 sample statements:
- `bofa_oct2022.pdf` - Normal statement (45 txns)
- `bofa_dec2023.pdf` - Holiday spending (120 txns)
- `bofa_jan2024.pdf` - Layout change (new format)

## Validation
After parsing, verify:
- [ ] All dates are valid ISO format
- [ ] All amounts are floats
- [ ] Currency is "USD"
- [ ] No duplicate transactions within same statement
```

---

### **Storytelling Document (darwin-complete-story.md)**

Narrativa completa de el usuario usando el app:

```markdown
# el usuario's Complete Story: Finance App V1

## Prologue: The Problem
el usuario has been downloading bank statements for 2 years (Oct 2022 - Oct 2024).
He has 96 PDFs sitting in ~/Downloads, never opened.

He wants to:
- Know his total spending last year
- Find all Uber rides in 2023
- See if he's spending more or less than before
- Track where his money goes

Excel is too tedious. Mint.com is bloated. He wants something simple but complete.

---

## Chapter 1: First Contact (Week 1, Day 1)

**Monday, November 4, 2024 - 8:00 PM**

el usuario opens terminal:
```bash
cd ~/finance-app-v1
python main.py
```

Browser opens: http://localhost:5000

He sees:
```
╔════════════════════════════════════╗
║     Finance App V1                 ║
║     Upload your first statement    ║
╚════════════════════════════════════╝

[Choose File]  [Upload]
```

el usuario drags `BofA_Oct2024.pdf` from ~/Downloads.

Clicks "Upload".

**2 seconds later:**
```
✓ Upload successful
  File: BofA_Oct2024.pdf
  Bank: Bank of America
  Transactions: 48
  Period: Oct 1-31, 2024

[View Transactions]
```

el usuario clicks "View Transactions".

He sees a table:
```
Date         Account        Merchant          Amount
2024-10-31   BofA Checking  UBER *EATS       -$18.00
2024-10-31   BofA Checking  SPOTIFY          -$10.99
2024-10-30   BofA Checking  WHOLE FOODS      -$87.34
...
```

"It works!" el usuario thinks.

---

## Chapter 2: The Historical Load (Week 1, Days 2-3)

el usuario realizes: "I have 2 years of statements. Let me load them all."

He opens ~/Downloads, selects all BofA statements:
- BofA_Oct2022.pdf
- BofA_Nov2022.pdf
- ...
- BofA_Sep2024.pdf

24 files total.

**Upload process:**
- First file: 2 seconds
- Second file: 2 seconds
- ...
- 24th file: 2 seconds

Total time: 48 seconds.

el usuario refreshes transaction list.

Now he sees:
```
Showing 1-50 of 1,127 transactions (Oct 2022 - Oct 2024)

Date         Account        Merchant          Amount
2024-10-31   BofA Checking  UBER *EATS       -$18.00
...
2022-10-01   BofA Checking  STARBUCKS        -$4.50
```

"Wow. 2 years of data in one view."

---

[Continuar con más capítulos: subir otros bancos, exploración, categorización, etc]

## Epilogue: Daily Use (Month 2+)

November 30, 2024.

el usuario receives email: "Your October statement is ready".

He downloads BofA_Nov2024.pdf.

Opens app. Drags file. Clicks upload.

2 seconds.

51 new transactions added.

Dashboard updates automatically:
```
November 2024 Spending: $2,847.23 (-8% vs October)
```

"This is so simple," el usuario thinks. "Why didn't I build this 2 years ago?"

---

## Lessons Learned

1. **Timeline continuo works**: No distinction between loading old statements vs new ones
2. **Auto-detection is crucial**: No dropdowns, just upload
3. **Pipeline is invisible**: el usuario sees clean data, doesn't know about clustering/normalization
4. **Normalization saves time**: "UBER *EATS" → "Uber Eats" automatically
5. **Transfer detection is magic**: "Wait, these $1000 transactions match!"
6. **Two stores = power**: Can always see raw data, can re-normalize anytime
7. **Simple is powerful**: ~1800 LOC, simple algorithms, works perfectly

**el usuario is happy. V1 is complete.**
```

---

## ✅ Success Criteria

### **Documentation Quality**
- [ ] Cada batch es self-contained (puede implementarse independientemente)
- [ ] Cada spec incluye edge cases concretos
- [ ] User flows son narrativos (story-driven, no solo bullets)
- [ ] Technical specs incluyen código de ejemplo (pseudo-code OK)
- [ ] el usuario's story es completa (intro → daily use)

### **Completeness**
- [ ] 10 batches documentados (foundation → pipeline → dashboard)
- [ ] 5 user flows completos
- [ ] 4 parser specs detallados
- [ ] 4 pipeline specs (overview, clustering, normalization, obs vs canonical)
- [ ] Normalization rules, transfers, currency specs
- [ ] Edge cases document con 20+ casos

### **Clarity**
- [ ] Alguien sin contexto puede leer docs y entender qué hacer
- [ ] No ambigüedad sobre qué está in/out of scope
- [ ] Ejemplos concretos (no abstractos)
- [ ] Hardcoded está explícitamente OK (donde aplique)

### **Alignment con Vision**
- [ ] Timeline continuo está presente en todos los flows
- [ ] No separación "histórico vs diario"
- [ ] Simple pero completo (no simplificado al punto de inútil)
- [ ] Example-first approach visible (hardcoded → refactor later)

---

## 🚫 Anti-Patterns: Qué NO Hacer

### **1. NO Pre-diseñar Abstracciones**
❌ **Wrong:**
```markdown
# Batch 2: Upload

First, create abstract StorageEngine interface:
- store(content) → ref
- retrieve(ref) → content

Then implement LocalFileSystemBackend...
```

✅ **Correct:**
```markdown
# Batch 2: Upload

Create simple upload handler:
```python
def upload_statement(pdf_file):
    # Save to ~/uploads/ directly (hardcoded path OK)
    path = f"~/uploads/{hash_value}.pdf"
    with open(path, 'wb') as f:
        f.write(pdf_file.read())
```

No abstractions. No interfaces. Just make it work.
```

---

### **2. NO Separar "Setup" de "Daily Use"**
❌ **Wrong:**
```markdown
# Flow 1: Initial Setup (historical load)
# Flow 2: Daily Use (new statements)
```

✅ **Correct:**
```markdown
# Flow 1: Timeline Continuo (carga inicial + uso diario es EL MISMO FLUJO)
```

---

### **3. NO Sobre-generalizar Parsers**
❌ **Wrong:**
```python
class UniversalBankParser:
    def parse(self, pdf, config):
        # Generic parser for ANY bank
        ...
```

✅ **Correct:**
```python
def parse_bofa(pdf_path):
    # Hardcoded regex for BofA
    pattern = r'(\d{2}/\d{2})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})'
    ...

def parse_apple_card(pdf_path):
    # Different hardcoded regex for Apple Card
    pattern = r'(\w{3}\s\d{2})\s+(.+?)\s+\$(\d+\.\d{2})'
    ...
```

---

### **4. NO Documentar Abstracciones que No Existen**
❌ **Wrong:**
```markdown
V1 uses these universal primitives:
- StorageEngine (from truth-construction system)
- ProvenanceLedger (from audit system)
- ObservationStore (from extraction system)
```

✅ **Correct:**
```markdown
V1 uses:
- SQLite directly (transactions table)
- Local filesystem (~/uploads/ folder)
- Hardcoded logic (no abstraction layers)
```

---

### **5. NO Complexity Bleeding**
❌ **Wrong:**
```html
<!-- User sees internal states -->
Status: queued_for_parse → parsing → parsed
```

✅ **Correct:**
```html
<!-- User sees simple labels -->
Status: Processing... → Ready
```

---

## 📚 Knowledge Base: Relevant Context from Previous Work

### **From 23 Verticals (usar como referencia, NO copiar)**

**Upload Flow (1.1):**
- Duplicate detection via SHA256 hash
- Error handling (corrupted PDF, unsupported format)
- Multi-file upload (el usuario uploads 96 PDFs)

**Extraction (1.2):**
- Parser per bank (different layouts)
- Extract raw observations (date, merchant, amount)
- Handle 0 transactions (empty statement)

**Normalization (1.3):**
- Merchant name normalization ("UBER *EATS" → "Uber Eats")
- Rule-based (regex patterns)
- Manual override capability

**Transaction List (2.1):**
- Filtros: date range, merchant, amount, category, account
- Search full-text en merchant name
- Pagination (50 per page)

**Dashboard (2.3):**
- Balance across accounts
- Spending by category (pie chart)
- Monthly trend (line chart)
- Top merchants (top 10)

**Account Registry (3.1):**
- CRUD for accounts
- Balance calculation
- Currency support (USD, MXN)

**Counterparty Registry (3.2):**
- Merchant list
- Aliases (multiple names → canonical name)
- Default category per merchant

**Relationships (3.5):**
- Transfer detection (matching debit/credit)
- Criteria: same amount, opposite sign, ±3 days, different accounts

**Currency (3.6):**
- Multi-currency support (USD, MXN)
- Conversion to base currency (hardcoded rate OK for V1)

**Edge Cases (from storytelling):**
- Duplicate upload → reject with message
- Corrupted PDF → error but don't crash
- Empty statement (0 transactions) → success with warning
- Layout changes → parser needs update
- Foreign transaction fees → separate line item
- Pending transactions → skip (not yet posted)

---

### **el usuario's Real Usage Patterns**

**Monthly Spending:**
- Food & Dining: $800-1000
- Transportation: $300-400 (mostly Uber)
- Shopping: $400-600
- Subscriptions: $150 (Netflix, Spotify, etc)
- Total: $2,500-3,000/month

**Common Merchants (top 20):**
- Uber / Uber Eats (200+ transactions/year)
- Starbucks (150+ transactions/year)
- Whole Foods (100+ transactions/year)
- Amazon (80+ transactions/year)
- Netflix, Spotify, Apple Music (recurring)

**Transfer Patterns:**
- BofA → Wise USD (monthly, $500-1000)
- Wise USD → Scotia MXN (monthly, $300-500)
- Apple Card payment from BofA (monthly, $1000-2000)

**Edge Cases el usuario Encounters:**
- Uploads wrong file (non-PDF) → error
- Uploads statement twice → duplicate detected
- PDF from unknown bank → unsupported error
- Statement has layout change → parser fails (needs update)

---

## 🎯 Final Checklist Before You Start

- [ ] Entendido: Timeline continuo (NO separación histórico/diario)
- [ ] Entendido: Simple pero completo (~1800 LOC, todas las features + pipeline)
- [ ] Entendido: Truth Construction Pipeline (Observe → Cluster → Normalize → Canonical)
- [ ] Entendido: Dos stores (observations = raw, transactions = canonical)
- [ ] Entendido: Clustering simple (string similarity, no ML, ~50 LOC)
- [ ] Entendido: Hardcoded OK (no pre-diseñar abstracciones)
- [ ] Entendido: el usuario tiene 4 cuentas, 2 años de historia
- [ ] Entendido: 10 batches + 5 flows + technical specs (incluye pipeline) + storytelling
- [ ] Entendido: NO copiar abstracciones de /Description/
- [ ] Entendido: Example-first (V1 hardcoded, V2 abstraído después)

---

## 🚀 Getting Started

### **Step 1: Create New Folder**
```bash
mkdir /Users/darwinborges/finance-app-v1-docs
cd /Users/darwinborges/finance-app-v1-docs
```

### **Step 2: Start with Core Documents**
1. README.md (overview + table of contents)
2. 0-scope.md (in/out scope detallado)
3. 1-architecture.md (arquitectura V1)
4. 2-data-model.md (SQLite schema)

### **Step 3: Batches (en orden)**
1. batch-1-foundation.md
2. batch-2-upload-parse.md
3. ... (continuar en orden)

### **Step 4: User Flows**
1. flow-1-timeline-continuo.md (ESTE ES EL MÁS IMPORTANTE)
2. ... (continuar)

### **Step 5: Technical Specs**
1. parsers/bofa-parser.md
2. ... (continuar)

### **Step 6: Storytelling**
1. darwin-complete-story.md (narrativa completa)

---

## 📞 Questions?

Si durante el trabajo necesitas clarificación:

**Pregunta 1: "¿Debo pre-diseñar esta abstracción?"**
→ NO. Hardcoded primero. Abstraer en V2.

**Pregunta 2: "¿Esto está in/out of scope?"**
→ Checa sección "Scope V1" arriba.

**Pregunta 3: "¿Cómo manejo este edge case?"**
→ Busca en "Knowledge Base" o inventa solución simple.

**Pregunta 4: "¿Separo 'setup inicial' de 'uso diario'?"**
→ NO. Timeline continuo. UN SOLO FLUJO.

**Pregunta 5: "¿Cuánto detalle incluir en specs?"**
→ Suficiente para que alguien pueda implementar sin preguntar.

---

## ✅ You're Ready

Ahora tienes:
- ✅ Vision clara (timeline continuo, simple pero completo)
- ✅ Pipeline completo (Observe → Cluster → Normalize → Canonical)
- ✅ Scope definido (qué incluir, qué no, clustering incluido)
- ✅ Methodology (example-first, hardcoded OK, ~1800 LOC)
- ✅ el usuario's context (4 cuentas, 2 años, uso real)
- ✅ Deliverables (10 batches + 5 flows + pipeline specs + storytelling)
- ✅ Success criteria (qué hace buen trabajo)
- ✅ Anti-patterns (qué evitar)
- ✅ Knowledge base (de 23 verticals previos)
- ✅ Data model (observations + transactions, dos stores)

**Important Reminders:**
- Pipeline adds ~200 LOC but remains simple (no ML, no async, sequential)
- Clustering = string similarity (Levenshtein, 80% threshold)
- Two tables preserve raw data + clean UI
- User never sees pipeline complexity

**Start with README.md and 0-scope.md. Go! 🚀**

---

**Document Version**: 2.1 (Updated with Complete el usuario Context)
**Date**: 2025-10-28
**Author**: Claude (Session 1 - Handoff to Session 2)
**Status**: Ready for execution

**Changes from v1.0**:
- Added complete pipeline (Observe → Cluster → Normalize → Canonical)
- Updated LOC to ~1800, 10 batches instead of 9
- **v2.1**: Added complete el usuario context (money flow, account purposes, pain points, geographic context)
