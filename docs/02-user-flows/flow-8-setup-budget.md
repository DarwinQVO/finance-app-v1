# Flow 8: Budgets & Alerts 💰

**Control de gastos con alertas automáticas**

## Funcionalidad

Crea budgets con tracking automático y alertas.

**Caso típico**: Usuario gasta $1,200/mes en comida, quiere limitar a $800.

**Solución**: Budget con tracking real-time y alertas configurables.

---

## Implementación

el usuario crea un budget de $800 para "Food & Dining".

**El sistema trackea automáticamente**:
- Cuánto ha gastado hasta ahora
- Cuánto le queda
- % usado del budget

**Alerta cuando se pase del 80%**: "⚠️ Ya gastaste $640 de $800 en comida este mes"

---

## Story: el usuario crea su primer budget

### Escena 1: Crear budget

el usuario quiere controlar sus gastos de comida. Decide crear un budget.

**Hace esto**:
1. Click en ⚙️ Settings
2. Click en "Budgets"

**Ve esto**:
```
┌─────────────────────────────────────────────────────┐
│  Settings > Budgets                      [+ New]    │
├─────────────────────────────────────────────────────┤
│  No budgets created yet.                            │
│                                                     │
│  Budgets help you control spending by setting       │
│  limits for specific categories.                    │
│                                                     │
│  [Create Your First Budget]                         │
└─────────────────────────────────────────────────────┘
```

3. Click "[Create Your First Budget]"

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Create Budget                  [×]     │
├─────────────────────────────────────────┤
│  Name *                                 │
│  [Food Budget            ]              │
│                                         │
│  Amount *                               │
│  [$800.00                ]              │
│                                         │
│  Period *                               │
│  [Monthly               ▾]              │
│                                         │
│  Categories *                           │
│  [☑] 🍔 Food & Dining                  │
│  [ ] 🚗 Transportation                 │
│  [ ] 🎬 Entertainment                  │
│  [ ] 🛒 Shopping                       │
│                                         │
│  Alert when reaching:                   │
│  [80%                   ]               │
│                                         │
│  Start date                             │
│  [Oct 1, 2025           ]              │
│                                         │
│  [Cancel]  [Create Budget]              │
└─────────────────────────────────────────┘
```

4. Escribe "Food Budget"
5. Escribe "$800"
6. Deja "Monthly" seleccionado
7. Selecciona "Food & Dining"
8. Deja "80%" (default)
9. Click "Create Budget"

**Resultado**: Budget creado. Empieza a trackear desde hoy.

---

### Escena 2: Ver budget status

el usuario regresa al settings screen:

```
┌─────────────────────────────────────────────────────┐
│  Settings > Budgets                      [+ New]    │
├─────────────────────────────────────────────────────┤
│  Active Budgets                                     │
│                                                     │
│  💰 Food Budget                          [$800/month]│
│  ███████████████░░░░░░░░░░  $547.89 / $800.00      │
│  68% used • $252.11 remaining                       │
│  Categories: Food & Dining                          │
│  [Edit] [Delete] [View Details]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Perfecto**: el usuario ve que:
- Ya gastó $547.89 de $800
- Le quedan $252.11
- Va al 68% (OK, no alerta aún)

---

### Escena 3: Gastar más

el usuario sigue su vida normal. Cada vez que sube un PDF, el budget se actualiza automáticamente.

**Sep 29**: el usuario sube `bofa_2025_09.pdf` (más transacciones del mes).

**El sistema procesa**:
```javascript
// Nuevas transacciones detectadas
Sep 29  Starbucks  -$6.50  [Food & Dining]
Sep 29  Whole Foods  -$123.45  [Food & Dining]
Sep 28  Pizza Hut  -$28.90  [Food & Dining]

// Update budget status
totalSpent = $547.89 + $6.50 + $123.45 + $28.90 = $706.74
percentage = $706.74 / $800 = 88%

// 88% > 80% → TRIGGER ALERT
```

**el usuario ve notificación**:
```
┌─────────────────────────────────────────┐
│  ⚠️ Budget Alert                        │
├─────────────────────────────────────────┤
│  You've spent 88% of your Food Budget   │
│                                         │
│  $706.74 of $800.00                     │
│  Only $93.26 remaining this month       │
│                                         │
│  [View Details] [Dismiss]               │
└─────────────────────────────────────────┘
```

**Perfecto**: el usuario sabe que debe controlar sus gastos de comida.

---

### Escena 4: Budget exceeded

el usuario no hizo caso. Sep 30, va a Costco y gasta $150.

**El sistema procesa**:
```javascript
totalSpent = $706.74 + $150 = $856.74
percentage = $856.74 / $800 = 107%

// Over budget → TRIGGER ALERT (red)
```

**el usuario ve**:
```
┌─────────────────────────────────────────┐
│  🔴 Budget Exceeded                     │
├─────────────────────────────────────────┤
│  You've exceeded your Food Budget by    │
│  $56.74                                 │
│                                         │
│  $856.74 spent of $800.00 limit         │
│  107% of budget used                    │
│                                         │
│  [View Details] [Adjust Budget]         │
└─────────────────────────────────────────┘
```

**En settings**:
```
┌─────────────────────────────────────────────────────┐
│  💰 Food Budget                          [$800/month]│
│  ████████████████████████  $856.74 / $800.00 🔴    │
│  107% used • $56.74 over budget                     │
│  Categories: Food & Dining                          │
│  [Edit] [Delete] [View Details]                     │
└─────────────────────────────────────────────────────┘
```

**el usuario decide**: "OK, este mes me pasé. Próximo mes seré más cuidadoso."

---

### Escena 5: Reset automático (nuevo mes)

**Oct 1, 2025**: Nuevo mes empieza.

**El sistema automáticamente**:
```javascript
// Check budgets with period = 'monthly'
// If start_date was Sep 1 and period is 'monthly'
// → Reset tracking for October

// Budget status:
totalSpent = $0 (reset)
percentage = 0%
```

**el usuario ve**:
```
┌─────────────────────────────────────────────────────┐
│  💰 Food Budget                          [$800/month]│
│  ░░░░░░░░░░░░░░░░░░░░  $0.00 / $800.00            │
│  0% used • $800.00 remaining                        │
│  Categories: Food & Dining                          │
│  [Edit] [Delete] [View Details]                     │
└─────────────────────────────────────────────────────┘
```

**Perfecto**: Nuevo mes, budget reseteado. el usuario empieza de cero.

---

## Cómo funciona: Budget tracking

### Database schema

```sql
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT NOT NULL,         -- 'monthly' | 'weekly' | 'yearly'
  alert_threshold REAL DEFAULT 0.8,
  start_date TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE budget_categories (
  budget_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  PRIMARY KEY (budget_id, category_id)
);
```

---

### Calculate budget status

```javascript
async function getBudgetStatus(budgetId) {
  const budget = await db.get('SELECT * FROM budgets WHERE id = ?', budgetId);

  // Get categories for this budget
  const categoryIds = await db.all(
    'SELECT category_id FROM budget_categories WHERE budget_id = ?',
    budgetId
  );

  // Get current period
  const { startDate, endDate } = getCurrentPeriod(budget.period, budget.start_date);

  // Calculate spent
  const spent = await db.get(`
    SELECT SUM(ABS(amount)) as total
    FROM transactions
    WHERE category_id IN (${categoryIds.map(() => '?').join(',')})
    AND date >= ?
    AND date <= ?
    AND type = 'expense'
  `, [...categoryIds.map(c => c.category_id), startDate, endDate]);

  const totalSpent = spent?.total || 0;
  const percentage = (totalSpent / budget.amount) * 100;
  const remaining = budget.amount - totalSpent;

  return {
    budgetId: budget.id,
    name: budget.name,
    limit: budget.amount,
    spent: totalSpent,
    remaining,
    percentage,
    period: { startDate, endDate },
    isOverBudget: totalSpent > budget.amount,
    shouldAlert: percentage >= (budget.alert_threshold * 100)
  };
}

function getCurrentPeriod(period, startDate) {
  const now = new Date();

  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'weekly') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'yearly') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }
}
```

---

### Trigger alerts

```javascript
async function checkBudgetAlerts() {
  const budgets = await db.all('SELECT * FROM budgets WHERE is_active = TRUE');

  for (const budget of budgets) {
    const status = await getBudgetStatus(budget.id);

    // Alert when threshold reached
    if (status.shouldAlert && !status.isOverBudget) {
      await sendAlert({
        type: 'budget_warning',
        title: 'Budget Alert',
        message: `You've spent ${status.percentage.toFixed(0)}% of your ${budget.name}`,
        budgetId: budget.id
      });
    }

    // Alert when over budget
    if (status.isOverBudget) {
      await sendAlert({
        type: 'budget_exceeded',
        title: 'Budget Exceeded',
        message: `You've exceeded your ${budget.name} by $${Math.abs(status.remaining).toFixed(2)}`,
        budgetId: budget.id
      });
    }
  }
}

// Run every time new transactions are added
async function extractFromPDF(...) {
  // ... process PDF ...

  // Check budgets after processing
  await checkBudgetAlerts();
}
```

---

## Multiple budgets

el usuario puede crear varios budgets:

```
┌─────────────────────────────────────────────────────┐
│  Settings > Budgets                      [+ New]    │
├─────────────────────────────────────────────────────┤
│  💰 Food Budget                          [$800/month]│
│  ███████████████░░░░░░░░  $547.89 / $800.00         │
│  68% used • $252.11 remaining                       │
│                                                     │
│  🚗 Transportation Budget                [$400/month]│
│  ██████████████████░░░░░  $320.45 / $400.00         │
│  80% used • $79.55 remaining ⚠️                     │
│                                                     │
│  🎬 Entertainment Budget                 [$200/month]│
│  ██████░░░░░░░░░░░░░░░░  $67.89 / $200.00           │
│  33% used • $132.11 remaining                       │
│                                                     │
│  🛒 Shopping Budget                    [$1,000/month]│
│  ████████████████████████  $1,045.67 / $1,000.00 🔴 │
│  104% used • $45.67 over budget                     │
└─────────────────────────────────────────────────────┘
```

---

## Budget periods

### Monthly (default)

Resets el 1ro de cada mes.

```javascript
period: 'monthly'
// Sep 1-30 → Oct 1-31 → Nov 1-30
```

---

### Weekly

Resets cada domingo (o configurable).

```javascript
period: 'weekly'
// Sun-Sat → Sun-Sat
```

**Use case**: "Quiero gastar máximo $50/semana en cafés"

---

### Yearly

Resets el 1ro de enero.

```javascript
period: 'yearly'
// Jan 1 - Dec 31
```

**Use case**: "Quiero gastar máximo $5,000/año en viajes"

---

## Budget por múltiples categorías

el usuario puede asignar un budget a múltiples categorías:

```
┌─────────────────────────────────────────┐
│  Create Budget                  [×]     │
├─────────────────────────────────────────┤
│  Name: Entertainment & Dining           │
│  Amount: $1,000                         │
│  Period: Monthly                        │
│                                         │
│  Categories:                            │
│  [☑] 🍔 Food & Dining                  │
│  [☑] 🎬 Entertainment                  │
│  [ ] 🚗 Transportation                 │
│                                         │
│  [Create Budget]                        │
└─────────────────────────────────────────┘
```

**Resultado**: Budget trackea gastos de ambas categorías combinadas.

```javascript
SELECT SUM(ABS(amount)) FROM transactions
WHERE category_id IN ('cat_food', 'cat_entertainment')
AND date >= '2025-10-01' AND date <= '2025-10-31';
```

---

## Budget dashboard (main app)

el usuario puede ver resumen de budgets desde la app principal (no solo settings).

**UI**:
```
┌──────────────────────────────────────────────────────┐
│  Finance App              [Upload] [Filter] [⚙️]     │
├──────────────────────────────────────────────────────┤
│  📊 Budgets Overview - October 2025                  │
│                                                      │
│  💰 Food Budget                                      │
│  ███████████████░░░░░░░░  68%  $547 / $800          │
│                                                      │
│  🚗 Transportation Budget  ⚠️                        │
│  ██████████████████░░░░░  80%  $320 / $400          │
│                                                      │
│  🎬 Entertainment Budget                             │
│  ██████░░░░░░░░░░░░░░░░  33%  $67 / $200            │
│                                                      │
│  🛒 Shopping Budget  🔴                              │
│  ████████████████████████  104%  $1,045 / $1,000    │
│                                                      │
│  [View All Budgets →]                                │
├──────────────────────────────────────────────────────┤
│  Timeline                                            │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

---

## Edge cases

### Edge case 1: Cambiar budget amount mid-month

**Escenario**: el usuario creó budget de $800, ya gastó $600. Decide aumentar a $1,000.

**Hace esto**:
1. Settings → Budgets → "Food Budget" → Edit
2. Cambia amount: $800 → $1,000
3. Click "Save"

**Resultado**:
```
Before:
$600 / $800 = 75%

After:
$600 / $1,000 = 60%
```

**No resetea** el spent. Solo cambia el limit.

---

### Edge case 2: Budget para income

**Escenario**: el usuario quiere trackear que gana mínimo $3,000/mes.

**Crea budget**:
```
Name: Monthly Income Goal
Amount: $3,000
Period: Monthly
Categories: [Income]
Type: Income (minimum)
```

**Lógica inversa**:
```javascript
if (budget.type === 'income') {
  const earned = totalIncome;
  const percentage = (earned / budget.amount) * 100;
  const isUnderGoal = earned < budget.amount;

  if (isUnderGoal) {
    alert(`You've only earned ${percentage}% of your income goal`);
  }
}
```

---

### Edge case 3: Refund después de exceder budget

**Escenario**: el usuario excedió budget ($856/$800). Luego recibe refund de $100.

**Antes del refund**:
```
$856 / $800 = 107% 🔴
```

**Después del refund**:
```
$856 - $100 = $756 / $800 = 94% ⚠️
```

**Lógica**:
```javascript
// Refunds son type = 'income' pero negativos en monto
// O bien, amounts positivos en expense category

// Opción 1: Refunds reducen el spent
if (transaction.type === 'refund') {
  totalSpent -= Math.abs(transaction.amount);
}

// Opción 2: Refunds tienen amount positivo
// SELECT SUM(amount) WHERE category_id = 'food'
// → Gastos negativos, refunds positivos → suma correcta
```

---

### Edge case 4: Budget start mid-month

**Escenario**: el usuario crea budget el 15 de octubre. ¿Qué pasa con gastos del 1-14 de oct?

**Opción A**: Incluir todo el mes (default)
```javascript
// startDate = Oct 1 (inicio del mes actual)
```

**Opción B**: Solo desde hoy en adelante
```javascript
// startDate = Oct 15 (día de creación)
```

**Phase 2 usa Opción A** (más simple, más útil).

---

## Resumen: Budgets & Alerts

### Qué hace
- **Trackea gastos** automáticamente por categoría
- **Alertas** cuando alcanzas threshold (80% default)
- **Reset automático** cada período (monthly/weekly/yearly)
- **Multiple budgets** para diferentes categorías
- **Real-time status** visible en dashboard

### Cómo funciona
- `budgets` table con name, amount, period, threshold
- `budget_categories` table (many-to-many)
- Query suma gastos por categoría en período actual
- Compara con limit → calcula percentage
- Trigger alert si percentage >= threshold

### Benefits
- **Control de gastos**: el usuario sabe cuánto gasta en tiempo real
- **Proactive alerts**: Se entera ANTES de exceder budget
- **Flexible**: Múltiples budgets, múltiples categorías
- **Zero friction**: Tracking automático, no manual

### Phase 2 scope
- ✅ Create/edit/delete budgets
- ✅ Monthly/weekly/yearly periods
- ✅ Alert threshold (configurable)
- ✅ Multiple categories per budget
- ✅ Real-time tracking
- ✅ Budget dashboard in main app
- ❌ Budget history/trends (Phase 3)
- ❌ Budget forecasting (Phase 3)
- ❌ Shared budgets (Phase 4)

---

**Próximo flow**: Lee [flow-9-recurring-transactions.md](flow-9-recurring-transactions.md) para ver cómo el sistema detecta gastos recurrentes.
