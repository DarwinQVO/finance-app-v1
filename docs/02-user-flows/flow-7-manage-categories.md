# Flow 7: Categories & Auto-Categorization 🏷️

**Organización automática de gastos**

## Funcionalidad

Organiza transacciones en categorías jerárquicas para análisis de gastos.

**Uso típico**: Usuario quiere saber cuánto gasta en comida, transporte, entretenimiento.

**Solución**: Categories automáticas + custom categories.

---

## La solución: Auto-categorization

**Categoriza automáticamente** basado en el merchant.

- "Starbucks" → Food & Dining
- "Shell Gas" → Transportation
- "Netflix" → Entertainment

el usuario no hace nada. Las transacciones ya vienen categorizadas.

---

## Story: el usuario descubre categorías

### Escena 1: Primeras transacciones ya categorizadas

el usuario acaba de subir `bofa_2025_09.pdf`. Ve el timeline:

```
┌──────────────────────────────────────────────────────┐
│  Finance App                    [Upload] [Filter] [⚙️]│
├──────────────────────────────────────────────────────┤
│  Sep 28  🏪 Starbucks           -$5.67  Food        │
│  Sep 27  ⛽ Shell Gas            -$65.00 Transportation│
│  Sep 26  🎬 Netflix              -$15.99 Entertainment│
│  Sep 25  🛒 Target               -$42.30 Shopping     │
└──────────────────────────────────────────────────────┘
```

**¡Ya están categorizadas!**

el usuario no tuvo que hacer nada. El sistema:
1. Detectó "Starbucks" → normalizó a "Starbucks"
2. Buscó en reglas: "Starbucks" → category "Food & Dining"
3. Asignó category_id automáticamente

---

### Escena 2: Ver gastos por categoría

el usuario quiere ver cuánto gasta en comida.

**Hace esto**:
1. Click en filtro "[All categories ▾]"
2. Ve dropdown:

```
┌─────────────────────────────────┐
│  All categories              ▾  │
├─────────────────────────────────┤
│  ✓ All categories               │
│  🍔 Food & Dining               │
│  🚗 Transportation              │
│  🏠 Housing                     │
│  🎬 Entertainment               │
│  🛒 Shopping                    │
│  💼 Business                    │
│  💰 Income                      │
│  ⚕️ Healthcare                  │
│  ✈️ Travel                      │
│  🎓 Education                   │
│  📱 Utilities                   │
│  🔧 Other                       │
└─────────────────────────────────┘
```

3. Selecciona "Food & Dining"

**Ve esto**:
```
┌──────────────────────────────────────────────────────┐
│  Filters: [All accounts] [Sep 2025] [Food & Dining] │
├──────────────────────────────────────────────────────┤
│  Sep 28  🏪 Starbucks           -$5.67              │
│  Sep 27  🍔 McDonald's          -$12.45             │
│  Sep 26  🍕 Pizza Hut           -$28.90             │
│  Sep 25  🏪 Starbucks           -$5.67              │
│  Sep 24  🛒 Whole Foods         -$123.45            │
│  Sep 23  🏪 Starbucks           -$6.50              │
│  ...                                                │
│                                                      │
│  67 transactions • $892.34 spent                    │
└──────────────────────────────────────────────────────┘
```

**Perfecto**: el usuario ve que gastó $892 en comida este mes.

---

### Escena 3: Cambiar categoría manualmente

el usuario ve que "Whole Foods" está en "Food & Dining". Pero él usa Whole Foods solo para productos de limpieza (no comida).

**Hace esto**:
1. Click en "Whole Foods" transaction
2. Ve panel de detalles:

```
┌─────────────────────────────────────────┐
│  Whole Foods Market                     │
│  Sep 24, 2025                           │
├─────────────────────────────────────────┤
│  💰 Amount                              │
│  -$123.45 USD                           │
│                                         │
│  🏦 Account                             │
│  Bank of America                        │
│                                         │
│  🏷️ Category                           │
│  [Food & Dining         ▾]             │
│                                         │
│  📄 Original                            │
│  WHOLE FOODS MARKET #1234               │
│                                         │
│  [Save] [Delete] [Close]                │
└─────────────────────────────────────────┘
```

3. Click en dropdown de Category
4. Selecciona "Shopping"
5. Click "Save"

**Resultado**: La transacción cambia a "Shopping". Aparece en timeline con nuevo icon 🛒.

---

### Escena 4: Crear categoría custom

el usuario tiene gastos de "Therapy" (terapia). No hay categoría específica.

**Hace esto**:
1. Click en ⚙️ Settings
2. Click en "Categories"

**Ve esto**:
```
┌─────────────────────────────────────────────────────┐
│  Settings > Categories                   [+ New]    │
├─────────────────────────────────────────────────────┤
│  System Categories                                  │
│  🍔 Food & Dining                        (active)   │
│  🚗 Transportation                       (active)   │
│  🏠 Housing                              (active)   │
│  🎬 Entertainment                        (active)   │
│  🛒 Shopping                             (active)   │
│  ...                                                │
│                                                     │
│  Custom Categories                                  │
│  🧘 Therapy                              (active)   │
│  🎸 Music Gear                           (active)   │
│                                                     │
│  [Add Category]                                     │
└─────────────────────────────────────────────────────┘
```

3. Click "[Add Category]"

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Create Category                [×]     │
├─────────────────────────────────────────┤
│  Name *                                 │
│  [Therapy                ]              │
│                                         │
│  Icon                                   │
│  [🧘] [😌] [💆] [🏥] [❤️]              │
│                                         │
│  Color                                  │
│  [🔴] [🟢] [🔵] [🟡] [🟣]              │
│                                         │
│  Parent Category (optional)             │
│  [Healthcare              ▾]            │
│                                         │
│  [Cancel]  [Create]                     │
└─────────────────────────────────────────┘
```

4. Escribe "Therapy"
5. Selecciona icon 🧘
6. Selecciona color 🟣 (purple)
7. Selecciona parent "Healthcare"
8. Click "Create"

**Resultado**: Nueva categoría creada. Ahora puede asignar transacciones a "Therapy".

---

### Escena 5: Crear regla de auto-categorización

el usuario siempre va al mismo therapist: "Dr. Smith Psychology".

Quiere que **todas las transacciones futuras** se categoricen automáticamente como "Therapy".

**Hace esto**:
1. Click en una transacción "Dr. Smith Psychology"
2. Click derecho → "Create auto-categorization rule"

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Create Categorization Rule     [×]     │
├─────────────────────────────────────────┤
│  When merchant is:                      │
│  [Dr. Smith Psychology  ]               │
│                                         │
│  Automatically set category to:         │
│  [Therapy               ▾]              │
│                                         │
│  Apply to existing transactions?        │
│  ☑ Yes, update 12 existing transactions │
│                                         │
│  [Cancel]  [Create Rule]                │
└─────────────────────────────────────────┘
```

3. Click "Create Rule"

**Resultado**:
- Nueva regla creada en `normalization_rules` table
- Las 12 transacciones existentes se recategorizan a "Therapy"
- Todas las transacciones futuras de "Dr. Smith Psychology" → "Therapy" automáticamente

---

## Cómo funciona: Auto-categorization

### Database schema

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id TEXT,              -- Para jerarquía (Food → Fast Food)
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  normalized_merchant TEXT NOT NULL,
  category_id TEXT,            -- Link a categories
  confidence REAL DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE
);
```

### Flujo de categorización

```javascript
async function extractFromPDF({ file, accountId, config }) {
  // 1. Extract raw transactions
  const rawTransactions = await parsePDF(file);

  // 2. Para cada transaction
  for (const raw of rawTransactions) {
    // 3. Normalize merchant
    const normalized = await normalizeMerchant(raw.description);

    // 4. Get category from rule
    const categoryId = await getCategoryFromRule(normalized);

    // 5. Insert into transactions table
    await db.run(`
      INSERT INTO transactions
      (id, account_id, date, merchant, amount, currency, type,
       category_id, source_type, source_hash, original_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateId(),
      accountId,
      raw.date,
      normalized,         // "Starbucks"
      raw.amount,
      raw.currency,
      raw.type,
      categoryId,         // "cat_food"
      'pdf',
      hash,
      raw.description     // "STARBUCKS STORE #12345"
    ]);
  }
}

async function getCategoryFromRule(merchant) {
  const rule = await db.get(
    'SELECT category_id FROM normalization_rules WHERE normalized_merchant = ?',
    merchant
  );

  return rule?.category_id || null;
}
```

---

## Default categories (system categories)

```javascript
const defaultCategories = [
  { id: 'cat_food', name: 'Food & Dining', icon: '🍔', color: '#FF6B6B', parent: null },
  { id: 'cat_transport', name: 'Transportation', icon: '🚗', color: '#4ECDC4', parent: null },
  { id: 'cat_housing', name: 'Housing', icon: '🏠', color: '#95E1D3', parent: null },
  { id: 'cat_entertainment', name: 'Entertainment', icon: '🎬', color: '#F38181', parent: null },
  { id: 'cat_shopping', name: 'Shopping', icon: '🛒', color: '#AA96DA', parent: null },
  { id: 'cat_business', name: 'Business', icon: '💼', color: '#FCBAD3', parent: null },
  { id: 'cat_income', name: 'Income', icon: '💰', color: '#51CF66', parent: null },
  { id: 'cat_healthcare', name: 'Healthcare', icon: '⚕️', color: '#A8DADC', parent: null },
  { id: 'cat_travel', name: 'Travel', icon: '✈️', color: '#457B9D', parent: null },
  { id: 'cat_education', name: 'Education', icon: '🎓', color: '#F1FAEE', parent: null },
  { id: 'cat_utilities', name: 'Utilities', icon: '📱', color: '#E63946', parent: null },
  { id: 'cat_other', name: 'Other', icon: '🔧', color: '#999999', parent: null }
];
```

---

## Default categorization rules

```javascript
const defaultRules = [
  // Food & Dining
  { pattern: /starbucks/i, merchant: 'Starbucks', category: 'cat_food' },
  { pattern: /mcdonald/i, merchant: "McDonald's", category: 'cat_food' },
  { pattern: /pizza hut/i, merchant: 'Pizza Hut', category: 'cat_food' },
  { pattern: /whole foods/i, merchant: 'Whole Foods', category: 'cat_food' },
  { pattern: /trader joe/i, merchant: "Trader Joe's", category: 'cat_food' },

  // Transportation
  { pattern: /shell.*gas/i, merchant: 'Shell Gas', category: 'cat_transport' },
  { pattern: /chevron/i, merchant: 'Chevron', category: 'cat_transport' },
  { pattern: /uber/i, merchant: 'Uber', category: 'cat_transport' },
  { pattern: /lyft/i, merchant: 'Lyft', category: 'cat_transport' },

  // Entertainment
  { pattern: /netflix/i, merchant: 'Netflix', category: 'cat_entertainment' },
  { pattern: /spotify/i, merchant: 'Spotify', category: 'cat_entertainment' },
  { pattern: /hbo/i, merchant: 'HBO', category: 'cat_entertainment' },
  { pattern: /disney/i, merchant: 'Disney+', category: 'cat_entertainment' },

  // Shopping
  { pattern: /amazon/i, merchant: 'Amazon', category: 'cat_shopping' },
  { pattern: /target/i, merchant: 'Target', category: 'cat_shopping' },
  { pattern: /walmart/i, merchant: 'Walmart', category: 'cat_shopping' },
  { pattern: /costco/i, merchant: 'Costco', category: 'cat_shopping' }
];
```

---

## Hierarchical categories (opcional)

el usuario puede crear sub-categorías:

```
Food & Dining
├── Fast Food
│   ├── McDonald's
│   ├── Burger King
│   └── Taco Bell
├── Coffee
│   ├── Starbucks
│   └── Dunkin'
└── Groceries
    ├── Whole Foods
    └── Trader Joe's
```

**Database**:
```javascript
const categories = [
  { id: 'cat_food', name: 'Food & Dining', parent: null },
  { id: 'cat_food_fast', name: 'Fast Food', parent: 'cat_food' },
  { id: 'cat_food_coffee', name: 'Coffee', parent: 'cat_food' },
  { id: 'cat_food_groceries', name: 'Groceries', parent: 'cat_food' }
];
```

**UI**:
```
┌─────────────────────────────────┐
│  🍔 Food & Dining            ▾  │
├─────────────────────────────────┤
│    🍟 Fast Food                 │
│    ☕ Coffee                     │
│    🛒 Groceries                 │
└─────────────────────────────────┘
```

---

## Manual categorization

### Individual transaction

el usuario puede cambiar category de una transacción específica:

```javascript
async function updateTransactionCategory(transactionId, categoryId) {
  await db.run(
    'UPDATE transactions SET category_id = ? WHERE id = ?',
    categoryId,
    transactionId
  );
}
```

**NO crea regla**. Solo afecta esa transacción.

---

### Bulk categorization

el usuario puede seleccionar múltiples transacciones y categorizarlas juntas:

**UI**:
```
┌──────────────────────────────────────────────────────┐
│  [Shift+Click para seleccionar múltiples]           │
├──────────────────────────────────────────────────────┤
│  ☑ Sep 28  Starbucks           -$5.67              │
│  ☑ Sep 25  Starbucks           -$5.67              │
│  ☑ Sep 23  Starbucks           -$6.50              │
│                                                      │
│  3 selected  [Set category ▾] [Create rule]         │
└──────────────────────────────────────────────────────┘
```

---

## Edge cases

### Edge case 1: Merchant sin categoría

**Escenario**: el usuario sube un PDF con merchant desconocido.

```
Sep 28  LOCAL DELI #5678   -$12.34
```

**Resultado**: `category_id = NULL`

**Timeline**:
```
┌──────────────────────────────────────────────────────┐
│  Sep 28  ❓ Local Deli #5678   -$12.34  [No category]│
└──────────────────────────────────────────────────────┘
```

**Action**: el usuario puede categorizarlo manualmente o crear regla.

---

### Edge case 2: Misma merchant, diferentes categorías

**Escenario**: el usuario usa "Amazon" para:
- Libros (Education)
- Electrónicos (Shopping)
- Comida (Food)

**Problema**: Una sola regla no es suficiente.

**Solución inicial**: Categorizar todo como "Shopping" (default). el usuario recategoriza manualmente cuando sea necesario.

**Solución futura**: Subcategorías automáticas basadas en monto o patterns en description.

---

### Edge case 3: Cambiar regla existente

**Escenario**: el usuario cambió de opinión. "Whole Foods" debe ser "Food", no "Shopping".

**Hace esto**:
1. Settings → Categories → Rules
2. Find "Whole Foods" rule
3. Edit category: "Shopping" → "Food & Dining"

**Dialog**:
```
┌─────────────────────────────────────────┐
│  Edit Rule                      [×]     │
├─────────────────────────────────────────┤
│  Merchant: Whole Foods                  │
│                                         │
│  Category:                              │
│  [Food & Dining         ▾]              │
│                                         │
│  Apply to existing transactions?        │
│  ☑ Yes, update 45 existing transactions │
│                                         │
│  [Cancel]  [Save]                       │
└─────────────────────────────────────────┘
```

**Resultado**: 45 transacciones existentes se recategorizan.

---

### Edge case 4: Borrar categoría

**Escenario**: el usuario quiere borrar categoría "Music Gear" (ya no la usa).

**Hace esto**:
1. Settings → Categories
2. Click en "Music Gear"
3. Click "Delete"

**Dialog**:
```
┌─────────────────────────────────────────┐
│  Delete Category                [×]     │
├─────────────────────────────────────────┤
│  ⚠️ Warning: 23 transactions are        │
│  currently using this category.         │
│                                         │
│  What should happen to them?            │
│  ○ Move to "Other"                      │
│  ○ Remove category (set to null)        │
│  ○ Cancel                               │
│                                         │
│  [Delete Category]                      │
└─────────────────────────────────────────┘
```

**Resultado**: el usuario elige qué hacer con las 23 transacciones.

---

## Summary stats por categoría

el usuario puede ver resumen de gastos por categoría.

**UI**:
```
┌──────────────────────────────────────────────────────┐
│  September 2025                                      │
├──────────────────────────────────────────────────────┤
│  🍔 Food & Dining                        $892.34     │
│  █████████████████████░░░░░  32%                     │
│                                                      │
│  🚗 Transportation                       $456.78     │
│  ███████████░░░░░░░░░░░░░░  16%                     │
│                                                      │
│  🏠 Housing                            $1,800.00     │
│  ███████████████████████████████████  65%            │
│                                                      │
│  🎬 Entertainment                        $234.56     │
│  ████████░░░░░░░░░░░░░░░░░░  8%                     │
│                                                      │
│  🛒 Shopping                             $567.89     │
│  ████████████░░░░░░░░░░░░░  20%                     │
│                                                      │
│  Total spent: $2,751.57                              │
└──────────────────────────────────────────────────────┘
```

---

## Resumen: Categories & Auto-categorization

### Qué hace
- **Auto-categoriza** transacciones basadas en merchant
- **Default rules** para merchants comunes (Starbucks, Amazon, etc)
- **Custom categories** que el usuario puede crear
- **Hierarchical categories** (opcional)
- **Manual override** cuando auto-categorization falla

### Cómo funciona
- Normalization rules tienen `category_id`
- Al normalizar merchant, se asigna category automáticamente
- el usuario puede cambiar category manualmente
- el usuario puede crear reglas custom

### Benefits
- **Zero friction**: Las transacciones ya vienen categorizadas
- **Flexible**: el usuario puede override o crear reglas custom
- **Escalable**: Funciona igual con 10 o 10,000 transacciones
- **Insights**: el usuario puede ver gastos por categoría

### Phase 2 scope
- ✅ System categories (12 default)
- ✅ Auto-categorization via rules
- ✅ Manual categorization (individual)
- ✅ Custom categories
- ✅ Create rules from UI
- ❌ Hierarchical categories (Phase 3)
- ❌ Bulk categorization (Phase 3)
- ❌ Category analytics/charts (Phase 3)

---

**Próximo flow**: Lee [flow-8-setup-budget.md](flow-8-setup-budget.md) para ver cómo el usuario crea budgets.
