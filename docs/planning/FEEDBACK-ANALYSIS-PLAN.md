# Análisis de Feedback & Plan de Acción

**Fecha**: 2025-10-30
**Contexto**: App retroactiva (PDFs/CSVs históricos), NO en vivo

---

## Estado Actual del Codebase

### ✅ Lo que YA Tenemos (Muy Bien)

#### 1. **Views Layer** - COMPLETO ✅
```
src/views/
├── category-views.js   - Queries reutilizables de categorías
├── transaction-views.js - Queries de transacciones
├── budget-views.js     - Queries de budgets
└── tag-views.js        - Queries de tags
```

**Calidad**: 10/10 - Queries centralizadas, desacopladas de UI

#### 2. **Data Sources** - COMPLETO ✅
```
src/data-sources/
├── electron-data-source.js  - Wrapper de window.electronAPI
└── mock-data-source.js      - Para tests
```

**Calidad**: 10/10 - Dependency injection implementado

#### 3. **Refactor 100% Modular** - COMPLETO ✅
- 10 componentes refactorizados (CategoryManager, BudgetManager, ManualEntry, etc.)
- 0 referencias `window.electronAPI` en componentes
- Hooks, actions, utils, constants separados
- ~102 archivos modulares (~5,587 líneas)

**Calidad**: 10/10 - Arquitectura modular establecida

#### 4. **Schema Robusto** - COMPLETO ✅
- Transactions table: 25 edge cases cubiertos
- Normalization rules: pattern matching + priority
- Categories: con hierarchy (parent_id)
- Budgets, recurring, tags, saved_filters

**Calidad**: 9/10 - Muy completo, listo para entity linking

---

## Problemas Identificados del Feedback

### 🔴 CRÍTICO 1: Normalization NO es Entity Linking

**Problema Actual**:
```javascript
// normalization.js hace STRING matching:
"UBER *EATS" → "Uber Eats" (string)
"UBER EATS" → "Uber Eats" (string)
"Uber BV" → ??? (no match, queda "Uber BV")
```

**Por qué es malo**:
- No puedes agrupar TODAS las transacciones de "Uber Eats"
- Si cambias la categoría del merchant, no actualiza TODAS las variantes
- No puedes track spending across accounts con nombres diferentes

**Lo que necesitamos**: Entity Linking System
```javascript
// Con entities:
"UBER *EATS" → Entity { id: "entity-uber-eats", canonical: "Uber Eats", category: "Food" }
"UBER EATS" → Entity { id: "entity-uber-eats", ... } // MISMA entidad
"Uber BV" → Entity { id: "entity-uber-eats", ... }   // Manual linking

// Ahora:
- getTransactionsByEntity('entity-uber-eats') → TODAS las variantes
- changeEntityCategory('entity-uber-eats', 'Transport') → actualiza TODAS
- getSpendingByEntity() → suma correcta cross-accounts
```

**Schema necesario**:
```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  category_id TEXT,                        -- Categoría de la ENTIDAD
  entity_type TEXT,                        -- merchant | person | government
  confidence_score REAL DEFAULT 1.0,       -- Qué tan seguro estamos del link
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE entity_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  alias TEXT NOT NULL,                     -- "UBER *EATS", "UBER EATS", etc
  source TEXT,                             -- 'normalization_rule' | 'manual' | 'ml'
  confidence REAL DEFAULT 1.0,
  times_seen INTEGER DEFAULT 0,
  last_seen TEXT,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

-- Transactions ahora apuntan a entities:
ALTER TABLE transactions ADD COLUMN entity_id TEXT REFERENCES entities(id);

-- Migrar normalization_rules → entities
-- Each rule.normalized_name → entity.canonical_name
-- Each rule.pattern → entity_alias.alias
```

---

### 🔴 CRÍTICO 2: Auto-Categorization Timing Issue

**Problema Actual** (auto-categorization.js):
```javascript
export async function autoCategorizeTransaction(db, transaction) {
  // 1. Normaliza merchant
  const { normalizeMerchant } = await import('./normalization.js');
  const normalizedMerchant = normalizeMerchant(db, transaction.description);

  // 2. Busca category
  const categoryId = getCategoryForMerchant(db, normalizedMerchant);

  return { normalized_merchant: normalizedMerchant, category_id: categoryId };
}
```

**Problemas**:
1. **Import dinámico innecesario**: `await import()` hace async sin razón
2. **Función inexistente**: `normalizeMerchant()` NO existe en normalization.js (exports `NormalizationEngine` class)
3. **Dos pasos separados**: Normaliza → luego categoriza (debería ser atómico)

**Con Entity Linking, el flow correcto**:
```javascript
// Upload flow:
function processTransaction(db, rawTransaction) {
  // 1. Resolve entity (atómico: normalization + linking)
  const entity = EntityResolver.resolve(db, rawTransaction.description);
  //    → { entity_id: "entity-uber-eats", canonical: "Uber Eats", confidence: 0.95 }

  // 2. Entity ya tiene category_id (o null si no se ha asignado)
  const categoryId = entity.category_id;

  // 3. Guardar transaction con entity_id + category_id
  db.prepare(`
    INSERT INTO transactions (id, merchant, merchant_raw, entity_id, category_id, ...)
    VALUES (?, ?, ?, ?, ?, ...)
  `).run(uuid(), entity.canonical, rawTransaction.description, entity.entity_id, categoryId, ...);
}
```

**Beneficios**:
- 1 paso atómico (no race conditions)
- Entity resolution reutilizable
- Category viene de la entidad, no de la rule

---

### 🟡 IMPORTANTE 3: Budget Alerts NO Aplican (Retroactivo)

**Feedback del reviewer**: Agregar tabla `budget_alerts` para tracking.

**TU corrección**: App NO es en vivo, NO tiene sentido alertar sobre el pasado.

**Lo que SÍ aplica**:
```javascript
// En vez de "alertas", hacer análisis retroactivo:
getBudgetAnalysis(db, budgetId, period) {
  return {
    planned: 500,
    actual: 620,
    variance: +120,              // Te pasaste $120
    percentage: 124,             // 24% over
    recurring_total: 150,        // De esos $620, $150 fueron recurrentes
    discretionary_total: 470,    // $470 discrecional
    insights: [
      "70% de tu presupuesto fue gasto recurrente",
      "Te pasaste del presupuesto 3 meses este año"
    ]
  };
}
```

**NO hacer**:
- ❌ Tabla `budget_alerts` con dismissed_at
- ❌ "Push notifications" de presupuesto
- ❌ "Ya te pasaste!" en UI

**SÍ hacer**:
- ✅ Comparación planned vs actual (retroactivo)
- ✅ Breakdown recurring vs discretionary
- ✅ Historical analysis ("te pasaste 3 meses este año")
- ✅ Upload reminders: "Sube tus docs de Octubre" (esto SÍ es útil)

---

### 🟡 IMPORTANTE 4: Budget ↔ Recurring NO Conectados

**Problema**: Tienes 2 sistemas separados:
- Budgets: "Gasté $500 en Entertainment"
- Recurring: "Netflix, Spotify son recurrentes"

**No puedes responder**: "¿Cuánto de mi budget es fijo vs discrecional?"

**Solución**:
```javascript
// budget-views.js - AGREGAR:
getBudgetWithRecurringBreakdown(dataSource, budgetId, period) {
  const budget = await dataSource.getBudget(budgetId);
  const spending = await getActualSpending(dataSource, budgetId, period);

  // Separar recurring de discretionary
  const recurring = spending.filter(t => t.is_recurring);
  const discretionary = spending.filter(t => !t.is_recurring);

  return {
    ...budget,
    period,
    planned: budget.amount,
    actual: sum(spending),
    variance: sum(spending) - budget.amount,

    // NEW: Breakdown
    recurring: {
      total: sum(recurring),
      percentage: (sum(recurring) / sum(spending)) * 100,
      transactions: recurring.map(t => ({
        merchant: t.merchant,
        amount: t.amount,
        frequency: t.recurring_frequency
      }))
    },

    discretionary: {
      total: sum(discretionary),
      percentage: (sum(discretionary) / sum(spending)) * 100,
      count: discretionary.length
    },

    insights: [
      `${recurring.length} gastos recurrentes (${recurringPercentage}% del total)`,
      `$${discretionaryTotal} disponible para gastos discrecionales`
    ]
  };
}
```

---

### 🟢 MENOR 5: Code Formatting Issues

**Problema** (normalization.js:14-59):
```javascript
/**
   * Normalizar merchant usando rules de DB

   *

   * Edge Case #3: "UBER *EATS" → "Uber Eats"

   *

   * Proceso:

   * 1. Iterar rules ordenadas por priority (DESC - higher first)
```

**Causa**: Literate programming docs tienen blank lines entre líneas de comentarios.

**Fix**: En el tangle script, normalizar whitespace:
```javascript
// tangle.js - AGREGAR:
function normalizeCodeWhitespace(code) {
  return code
    .split('\n')
    .map(line => line.trimEnd())                    // Remove trailing spaces
    .reduce((acc, line, i, arr) => {
      // Remove excessive blank lines in comments
      if (line.trim() === '' && arr[i-1]?.trim() === '' && arr[i+1]?.trim().startsWith('*')) {
        return acc; // Skip duplicate blank line
      }
      acc.push(line);
      return acc;
    }, [])
    .join('\n');
}
```

---

### 🟢 MENOR 6: Language Mixing

**Problema**:
```javascript
// Sort por priority (higher = matched first)  ← Spanish + English
const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
```

**Recomendación**: Pick one language.

**Opción A** (Recomendada): English para código, Spanish para docs
```javascript
// Sort by priority (higher matched first)
const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
```

**Opción B**: Todo en inglés
```javascript
// Sort by priority (higher matched first)
const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
```

---

### 🟢 MENOR 7: No Type Safety

**Problema**: No JSDoc types.

**Solución**: Agregar JSDoc annotations:
```javascript
/**
 * Get category for a normalized merchant
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {string} normalizedMerchant - Normalized merchant name
 * @returns {string | null} - category_id or null
 */
export function getCategoryForMerchant(db, normalizedMerchant) {
  // ...
}
```

---

## Plan de Acción

### Badge 13: Entity Linking System 🔴 PRIORIDAD 1

**Objetivo**: Migrar de string normalization → entity linking.

**Trabajo**:
1. Schema changes:
   - CREATE TABLE entities
   - CREATE TABLE entity_aliases
   - ALTER TABLE transactions ADD COLUMN entity_id
   - Migración: normalization_rules → entities + entity_aliases

2. EntityResolver module:
   ```javascript
   // src/lib/entity-resolver.js
   export class EntityResolver {
     static resolve(db, merchantRaw) {
       // 1. Check exact alias match
       // 2. Check pattern match (regex rules)
       // 3. Create new entity if no match
       return { entity_id, canonical_name, category_id, confidence };
     }

     static linkAlias(db, entityId, alias, source = 'manual') {
       // Manual linking: "Uber BV" → entity-uber-eats
     }

     static mergeEntities(db, sourceEntityId, targetEntityId) {
       // Merge two entities (dedupe)
     }
   }
   ```

3. Views:
   ```javascript
   // src/views/entity-views.js
   export const EntityViews = {
     getTransactionsByEntity(dataSource, entityId, dateRange),
     getSpendingByEntity(dataSource, dateRange),
     getEntityWithAliases(dataSource, entityId),
     suggestEntityMerges(dataSource) // ML candidates for merging
   };
   ```

4. UI Component:
   ```javascript
   // src/components/EntityManager/EntityManager.jsx
   // - List entities with aliases
   // - Merge entities
   // - Add/remove aliases
   // - Assign category to entity
   ```

5. Tests:
   - Entity resolution with multiple aliases
   - Category assignment propagation
   - Entity merging
   - Confidence scoring

**LOC estimado**: ~800 líneas
**Archivos**: ~15 archivos (module + views + component + tests)

---

### Badge 14: Connect Budgets ↔ Recurring 🟡 PRIORIDAD 2

**Objetivo**: Mostrar breakdown recurring vs discretionary en budgets.

**Trabajo**:
1. Extend BudgetViews:
   ```javascript
   // src/views/budget-views.js - AGREGAR:
   getBudgetWithRecurringBreakdown(dataSource, budgetId, period) {
     // Implementation above
   }
   ```

2. Update BudgetManager component:
   ```javascript
   // src/components/BudgetManager/components/BudgetDetailCard.jsx
   // - Show recurring breakdown
   // - Show discretionary spending
   // - Insights sobre fixed vs variable
   ```

3. Tests:
   - Budget with recurring transactions
   - Breakdown calculation
   - Percentage accuracy

**LOC estimado**: ~200 líneas
**Archivos**: ~5 archivos (views + component updates + tests)

---

### Badge 15: Fix Auto-Categorization (depends on Badge 13) 🟡 PRIORIDAD 2

**Objetivo**: Integrar auto-categorization con entity linking.

**Trabajo**:
1. Refactor auto-categorization.js:
   ```javascript
   // src/lib/auto-categorization.js
   export function autoCategorizeTransaction(db, rawTransaction) {
     // Use EntityResolver (not string normalization)
     const entity = EntityResolver.resolve(db, rawTransaction.description);

     return {
       entity_id: entity.entity_id,
       normalized_merchant: entity.canonical_name,
       category_id: entity.category_id,
       confidence: entity.confidence
     };
   }
   ```

2. Update upload flow:
   - Use autoCategorizeTransaction() atomically
   - Save entity_id + category_id en 1 paso

3. Tests:
   - Auto-categorization with entity resolution
   - Category propagation from entity
   - Confidence scoring

**LOC estimado**: ~150 líneas
**Archivos**: ~3 archivos (refactor + tests)

---

### Badge 16: Code Quality Fixes 🟢 PRIORIDAD 3

**Objetivo**: Arreglar formatting, language mixing, type safety.

**Trabajo**:
1. Fix tangle.js - normalizar whitespace en output
2. Standardize comments - todo inglés
3. Add JSDoc types a todas las funciones públicas
4. Standardize exports - named exports everywhere

**LOC estimado**: ~100 líneas (mostly refactor)
**Archivos**: ~20 archivos (touch many files)

---

### Badge 17: Upload Reminders (Optional) 🟢 NICE TO HAVE

**Objetivo**: Recordar al usuario subir docs del mes.

**Trabajo**:
1. Detect último upload:
   ```javascript
   // src/lib/upload-tracker.js
   export function getLastUploadDate(db) {
     // Check uploaded_files table
   }

   export function shouldRemindUpload(db) {
     const lastUpload = getLastUploadDate(db);
     const daysSince = differenceInDays(new Date(), lastUpload);
     return daysSince > 30; // Remind after 30 days
   }
   ```

2. UI notification:
   ```javascript
   // src/components/UploadReminder/UploadReminder.jsx
   // Show banner: "Han pasado 32 días desde tu último upload"
   ```

**LOC estimado**: ~100 líneas
**Archivos**: ~4 archivos

---

## Resumen de Prioridades

### 🔴 HACER ANTES DE PHASE 3:
1. **Badge 13: Entity Linking** (~800 LOC, 15 archivos)
   - Schema migration
   - EntityResolver module
   - EntityViews
   - EntityManager component
   - Tests

2. **Badge 14: Budget ↔ Recurring** (~200 LOC, 5 archivos)
   - Extend BudgetViews
   - Update BudgetManager component
   - Tests

3. **Badge 15: Fix Auto-Categorization** (~150 LOC, 3 archivos)
   - Integrate with EntityResolver
   - Atomic upload flow
   - Tests

**Total antes de Phase 3**: ~1,150 LOC, ~23 archivos

---

### 🟢 DESPUÉS DE PHASE 3:
4. **Badge 16: Code Quality** (~100 LOC, 20 archivos)
5. **Badge 17: Upload Reminders** (~100 LOC, 4 archivos)

---

## Decisiones Importantes

### ✅ Views Layer - YA TENEMOS
El feedback pedía crear views layer, pero **YA EXISTE** y está bien implementado.

**Acción**: NINGUNA (salvo extender con entity views en Badge 13)

### ✅ Budget Alerts - NO HACER
El feedback pedía tabla `budget_alerts`, pero **NO APLICA** (app retroactiva).

**Acción**: Hacer análisis retroactivo en vez de alertas en vivo.

### ✅ Entity Linking - CRÍTICO
El feedback identificó que normalization es string-only, necesita entity linking.

**Acción**: Badge 13 (PRIORIDAD 1)

### ✅ Code Quality - MENOR
Formatting, language mixing, types son importantes pero no bloquean features.

**Acción**: Badge 16 (PRIORIDAD 3, después de Phase 3)

---

## Próximos Pasos

**Recomendación**:

1. ¿Aprobar este plan?
2. Empezar Badge 13 (Entity Linking) - Es la base arquitectónica más importante
3. Badge 14 y 15 en paralelo después
4. Badge 16 y 17 son nice-to-have

**Pregunta para ti**:
- ¿Ya tienes `normalization_rules` en producción con data real?
- ¿O podemos migrar limpiamente a `entities` + `entity_aliases`?
- ¿Quieres que lo documente en literate programming primero, o directamente implementar?
