# Flow 9: Recurring Transactions 🔁

**Detección automática de gastos recurrentes**

## Funcionalidad

Detecta automáticamente gastos recurrentes (subscriptions, utility bills, etc.) analizando patterns de transacciones.

**Capacidades**:
- Auto-detección de recurring patterns (≥3 transacciones con intervalos consistentes)
- Confidence scoring basado en regularidad (0-100%)
- Tracking de próximos pagos esperados
- Alertas de cambios de precio
- Notificaciones de pagos missing

---

## Implementación: Auto-detection

El sistema detecta automáticamente:
- "Netflix aparece cada mes el día 15"
- "Siempre $15.99"
- "Muy consistente → 95% confidence"

**Resultado**:
```
🔁 Netflix  $15.99/month  (subscription detected)
   Next payment: Oct 15
```

el usuario ve todas sus subscriptions en un panel. Puede cancelar las que no usa.

---

## Story: el usuario descubre sus subscriptions

### Escena 1: Detección automática

el usuario ha estado usando Finance App por 3 meses. Tiene Netflix desde hace años.

**El sistema analiza**:
```javascript
// Buscar transactions con mismo merchant
SELECT * FROM transactions
WHERE merchant = 'Netflix'
ORDER BY date ASC;

Results:
Jul 15  Netflix  -$15.99
Aug 15  Netflix  -$15.99
Sep 15  Netflix  -$15.99

// Calcular intervalos
intervals = [31 days, 31 days]
avgInterval = 31 days
stdDev = 0 (perfecto)
confidence = 1.0 - (0 / 31) = 1.0 = 100%

// RECURRING DETECTED ✓
frequency = 'monthly' (30-32 days)
expectedAmount = $15.99
nextExpectedDate = Oct 15
```

**Sistema crea entry en `recurring_groups`**:
```javascript
{
  id: 'rec_netflix',
  merchant: 'Netflix',
  frequency: 'monthly',
  expectedAmount: 15.99,
  currency: 'USD',
  confidence: 1.0,
  nextExpectedDate: '2025-10-15',
  isActive: true
}
```

---

### Escena 2: Ver recurring transactions

el usuario va a Settings → "Recurring".

**Ve esto**:
```
┌─────────────────────────────────────────────────────┐
│  Settings > Recurring Transactions       [+ Add]    │
├─────────────────────────────────────────────────────┤
│  Detected Automatically (6 subscriptions)           │
│                                                     │
│  🎬 Netflix                              $15.99/mo  │
│  ████████████████████████  95% confidence           │
│  Next payment: Oct 15 • Category: Entertainment     │
│  [View History] [Mark as Not Recurring]             │
│                                                     │
│  🎵 Spotify                              $9.99/mo   │
│  ████████████████████████  98% confidence           │
│  Next payment: Oct 3 • Category: Entertainment      │
│  [View History] [Mark as Not Recurring]             │
│                                                     │
│  📱 AT&T                               $67.50/mo    │
│  ████████████████████████  92% confidence           │
│  Next payment: Oct 10 • Category: Utilities         │
│  [View History] [Mark as Not Recurring]             │
│                                                     │
│  🏋️ Gym Membership                     $45.00/mo    │
│  ████████████████████████  89% confidence           │
│  Next payment: Oct 1 • Category: Healthcare         │
│  [View History] [Mark as Not Recurring]             │
│                                                     │
│  💻 GitHub Pro                           $4.00/mo   │
│  ████████████████████████  100% confidence          │
│  Next payment: Oct 7 • Category: Business           │
│  [View History] [Mark as Not Recurring]             │
│                                                     │
│  ☁️ iCloud Storage                      $0.99/mo    │
│  ████████████████████████  100% confidence          │
│  Next payment: Oct 20 • Category: Utilities         │
│  [View History] [Mark as Not Recurring]             │
│                                                     │
│  Total recurring: $143.46/month                     │
└─────────────────────────────────────────────────────┘
```

**¡Boom!** el usuario ve que gasta $143/mes en subscriptions.

---

### Escena 3: "Didn't know I had that!"

el usuario ve "GitHub Pro $4/mo". Lo había olvidado completamente.

**Hace esto**:
1. Click en "View History"

**Ve histórico**:
```
┌─────────────────────────────────────────┐
│  GitHub Pro - Recurring History [×]     │
├─────────────────────────────────────────┤
│  💻 GitHub Pro                          │
│  $4.00/month • 100% confidence          │
│  Next payment: Oct 7, 2025              │
│                                         │
│  Payment History:                       │
│  Sep 7   -$4.00  ✓                      │
│  Aug 7   -$4.00  ✓                      │
│  Jul 7   -$4.00  ✓                      │
│  Jun 7   -$4.00  ✓                      │
│  May 7   -$4.00  ✓                      │
│  ...                                    │
│                                         │
│  Pattern: Monthly (every 30-31 days)    │
│  Started: Jan 7, 2023                   │
│  Total payments: 34 months              │
│  Total spent: $136.00                   │
│                                         │
│  [Cancel Subscription] [Close]          │
└─────────────────────────────────────────┘
```

el usuario: "¡$136 en 3 años! Ya ni uso GitHub Pro. Voy a cancelarlo."

---

### Escena 4: Subscription price change

**Oct 15**: Netflix sube precio de $15.99 a $17.99.

el usuario sube `apple-card_2025_10.pdf`.

**El sistema detecta**:
```javascript
// Nueva transaction
Oct 15  Netflix  -$17.99

// Compare con expected
expected: $15.99
actual: $17.99
diff = $2.00 (12.5% increase)

// Update recurring group
UPDATE recurring_groups
SET expected_amount = 17.99
WHERE id = 'rec_netflix';

// Create notification
notifyPriceChange({
  merchant: 'Netflix',
  oldAmount: 15.99,
  newAmount: 17.99,
  increase: 2.00
});
```

**el usuario ve alerta**:
```
┌─────────────────────────────────────────┐
│  💰 Price Change Detected               │
├─────────────────────────────────────────┤
│  Netflix increased their price          │
│                                         │
│  $15.99 → $17.99 (+$2.00)               │
│                                         │
│  This adds $24/year to your expenses    │
│                                         │
│  [View Details] [Dismiss]               │
└─────────────────────────────────────────┘
```

**Perfecto**: el usuario se entera del cambio de precio automáticamente.

---

### Escena 5: Missed payment detection

**Oct 15**: el usuario esperaba pago de Netflix, pero no aparece.

**El sistema detecta**:
```javascript
// Check expected payments today
const today = '2025-10-15';
const expected = await db.all(`
  SELECT * FROM recurring_groups
  WHERE next_expected_date = ?
`, today);

// Netflix esperado pero no hay transaction
const actual = await db.get(`
  SELECT * FROM transactions
  WHERE merchant = 'Netflix'
  AND date = ?
`, today);

if (!actual) {
  // MISSED PAYMENT
  notifyMissedPayment({
    merchant: 'Netflix',
    expectedAmount: 17.99,
    expectedDate: today
  });
}
```

**el usuario ve alerta**:
```
┌─────────────────────────────────────────┐
│  ⚠️ Missed Payment                      │
├─────────────────────────────────────────┤
│  Netflix payment expected today but     │
│  not found                              │
│                                         │
│  Expected: $17.99 on Oct 15             │
│                                         │
│  Possible reasons:                      │
│  • Payment pending                      │
│  • Subscription cancelled               │
│  • Payment method failed                │
│                                         │
│  [Mark as Paid] [Dismiss]               │
└─────────────────────────────────────────┘
```

---

## Cómo funciona: Detection algorithm

### Database schema

```sql
CREATE TABLE recurring_groups (
  id TEXT PRIMARY KEY,
  merchant TEXT NOT NULL,
  frequency TEXT NOT NULL,        -- 'weekly' | 'monthly' | 'yearly'
  expected_amount REAL NOT NULL,
  currency TEXT NOT NULL,
  confidence REAL NOT NULL,       -- 0.0 - 1.0
  next_expected_date TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Relationship con transactions**:
- `transactions.recurring_group_id` (optional) - Puede cachear el grupo detectado
- **NO es FK requerido** - Sistema usa matching dinámico por merchant + amount
- Útil para performance: evita re-calcular patterns cada vez
- Si es NULL, el sistema detecta el pattern on-the-fly

---

### Detection algorithm

```javascript
async function detectRecurring(merchant) {
  // 1. Get all transactions for this merchant
  const txns = await db.all(`
    SELECT * FROM transactions
    WHERE merchant = ?
    AND type = 'expense'
    ORDER BY date ASC
  `, merchant);

  // Need at least 3 transactions to detect pattern
  if (txns.length < 3) {
    return null;
  }

  // 2. Calculate intervals between transactions
  const intervals = [];
  for (let i = 1; i < txns.length; i++) {
    const days = daysBetween(txns[i-1].date, txns[i].date);
    intervals.push(days);
  }

  // 3. Calculate average interval
  const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;

  // 4. Calculate standard deviation
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.pow(interval - avgInterval, 2);
  }, 0) / intervals.length;

  const stdDev = Math.sqrt(variance);

  // 5. Calculate confidence
  // Lower stdDev = more consistent = higher confidence
  const confidence = Math.max(0, 1 - (stdDev / avgInterval));

  // 6. Need confidence >= 0.7 to consider recurring
  if (confidence < 0.7) {
    return null;
  }

  // 7. Determine frequency
  const frequency = determineFrequency(avgInterval);

  // 8. Calculate average amount
  const amounts = txns.map(t => Math.abs(t.amount));
  const avgAmount = amounts.reduce((a, b) => a + b) / amounts.length;

  // 9. Calculate next expected date
  const lastDate = txns[txns.length - 1].date;
  const nextDate = addDays(lastDate, Math.round(avgInterval));

  // 10. Create or update recurring group
  return {
    merchant,
    frequency,
    expectedAmount: avgAmount,
    currency: txns[0].currency,
    confidence,
    nextExpectedDate: nextDate,
    transactionCount: txns.length
  };
}

function determineFrequency(avgDays) {
  if (avgDays >= 6 && avgDays <= 8) return 'weekly';
  if (avgDays >= 13 && avgDays <= 15) return 'biweekly';
  if (avgDays >= 28 && avgDays <= 32) return 'monthly';
  if (avgDays >= 88 && avgDays <= 92) return 'quarterly';
  if (avgDays >= 360 && avgDays <= 370) return 'yearly';
  return 'custom';
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diff = Math.abs(d2 - d1);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
```

---

### Run detection

```javascript
async function runRecurringDetection() {
  // Get all unique merchants
  const merchants = await db.all(`
    SELECT DISTINCT merchant FROM transactions
    WHERE type = 'expense'
  `);

  for (const { merchant } of merchants) {
    const recurring = await detectRecurring(merchant);

    if (recurring && recurring.confidence >= 0.7) {
      // Create or update recurring group
      await db.run(`
        INSERT OR REPLACE INTO recurring_groups
        (id, merchant, frequency, expected_amount, currency,
         confidence, next_expected_date, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
      `, [
        `rec_${merchant.toLowerCase().replace(/\s+/g, '_')}`,
        merchant,
        recurring.frequency,
        recurring.expectedAmount,
        recurring.currency,
        recurring.confidence,
        recurring.nextExpectedDate,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
    }
  }
}

// Run after each PDF upload
async function extractFromPDF(...) {
  // ... process PDF ...

  // Detect recurring patterns
  await runRecurringDetection();
}
```

---

## Confidence scoring examples

### High confidence (100%)

```javascript
// Netflix - perfect pattern
dates: [Jul 15, Aug 15, Sep 15]
intervals: [31, 31]
avgInterval: 31
stdDev: 0
confidence: 1.0 - (0 / 31) = 1.0 = 100% ✓
```

---

### Medium confidence (75%)

```javascript
// Gym - occasional variance
dates: [Jul 1, Aug 3, Sep 1]
intervals: [33, 29]
avgInterval: 31
stdDev: 2.8
confidence: 1.0 - (2.8 / 31) = 0.91 = 91% ✓
```

---

### Low confidence (50%) - not detected

```javascript
// Random coffee shop - irregular
dates: [Jul 5, Aug 20, Sep 3]
intervals: [46, 14]
avgInterval: 30
stdDev: 22.6
confidence: 1.0 - (22.6 / 30) = 0.25 = 25% ✗

// Confidence < 0.7 → Not considered recurring
```

---

## Manual management

### Add manual recurring

el usuario puede agregar recurring manualmente (si el sistema no lo detectó).

**UI**:
```
┌─────────────────────────────────────────┐
│  Add Recurring Transaction      [×]     │
├─────────────────────────────────────────┤
│  Merchant *                             │
│  [Therapy - Dr. Smith    ]              │
│                                         │
│  Amount *                               │
│  [$150.00                ]              │
│                                         │
│  Frequency *                            │
│  [Monthly               ▾]              │
│                                         │
│  Next payment date *                    │
│  [Nov 1, 2025           ]               │
│                                         │
│  Category                               │
│  [Healthcare            ▾]              │
│                                         │
│  [Cancel]  [Add]                        │
└─────────────────────────────────────────┘
```

---

### Mark as not recurring

el usuario puede decir "esto no es recurring" si el sistema se equivocó.

**Escenario**: el usuario va a Starbucks ~4 veces al mes, pero NO es subscription.

**Hace esto**:
1. Settings → Recurring
2. Click en "Starbucks"
3. Click "Mark as Not Recurring"

**Resultado**: Entry removido de `recurring_groups`.

```javascript
UPDATE recurring_groups
SET is_active = FALSE
WHERE merchant = 'Starbucks';
```

---

## Summary panel

el usuario ve resumen de todos los recurring en dashboard.

**UI**:
```
┌──────────────────────────────────────────────────────┐
│  📊 Monthly Subscriptions                            │
├──────────────────────────────────────────────────────┤
│  🎬 Entertainment                        $25.98      │
│  Netflix, Spotify                                    │
│                                                      │
│  📱 Utilities                            $68.49      │
│  AT&T, iCloud Storage                                │
│                                                      │
│  🏋️ Healthcare                          $45.00      │
│  Gym Membership                                      │
│                                                      │
│  💻 Business                              $4.00      │
│  GitHub Pro                                          │
│                                                      │
│  Total recurring: $143.47/month                      │
│  Annual cost: $1,721.64                              │
│                                                      │
│  [Manage Subscriptions →]                            │
└──────────────────────────────────────────────────────┘
```

---

## Edge cases

### Edge case 1: Skipped month

**Escenario**: el usuario pausa Netflix por 1 mes.

```
Jul 15  Netflix  -$15.99
Aug 15  Netflix  -$15.99
Sep 15  (skipped)
Oct 15  Netflix  -$15.99
```

**Lógica**:
```javascript
// intervals = [31, 61]
// avgInterval = 46
// stdDev = 21
// confidence = 1.0 - (21/46) = 0.54 < 0.7 ✗

// Pattern broken → confidence drops below threshold
// Recurring removed from list
```

**Solución**: Cuando el usuario resume, sistema detecta nuevo pattern:
```javascript
// New pattern starting Oct 15
intervals = [31, 31] (Nov 15, Dec 15)
confidence = 100% ✓
// Recurring re-detected
```

---

### Edge case 2: Amount variation

**Escenario**: Utility bill varía cada mes.

```
Jul 10  Electric Company  -$120.45
Aug 10  Electric Company  -$145.67
Sep 10  Electric Company  -$98.23
```

**Lógica**:
```javascript
// Frequency detection: OK (consistent dates)
intervals = [31, 31]
confidence = 100% ✓

// Amount variation: OK (use average)
avgAmount = ($120.45 + $145.67 + $98.23) / 3 = $121.45

// Mark as "variable amount"
recurring = {
  merchant: 'Electric Company',
  frequency: 'monthly',
  expectedAmount: 121.45,  // average
  amountVariability: 'high',  // ±20%
  confidence: 1.0
};
```

**UI**:
```
📱 Electric Company                     ~$121/mo
████████████████████████  100% confidence
Amount varies: $98 - $145 typical range
Next payment: Oct 10
```

---

### Edge case 3: Multiple recurring same merchant

**Escenario**: el usuario tiene 2 Netflix accounts (family + personal).

```
Jul 15  Netflix  -$15.99  [Account A]
Jul 20  Netflix  -$7.99   [Account B]
Aug 15  Netflix  -$15.99  [Account A]
Aug 20  Netflix  -$7.99   [Account B]
```

**Problema**: Sistema agrupa ambos como 1 merchant.

**Solución**: Detectar 2 patterns diferentes:
```javascript
// Group by amount
group1 = transactions where amount ≈ $15.99
group2 = transactions where amount ≈ $7.99

// Detect separately
recurring1 = detect(group1)  // $15.99/mo
recurring2 = detect(group2)  // $7.99/mo
```

**UI**:
```
🎬 Netflix (Premium)                     $15.99/mo
🎬 Netflix (Basic)                        $7.99/mo
```

---

## Upcoming payments calendar

el usuario puede ver calendario de próximos pagos.

**UI**:
```
┌──────────────────────────────────────────────────────┐
│  📅 Upcoming Recurring Payments - October 2025       │
├──────────────────────────────────────────────────────┤
│  Oct 1   🏋️ Gym Membership           $45.00         │
│  Oct 3   🎵 Spotify                   $9.99          │
│  Oct 7   💻 GitHub Pro                $4.00          │
│  Oct 10  📱 AT&T                     $67.50          │
│  Oct 15  🎬 Netflix                  $17.99          │
│  Oct 20  ☁️ iCloud Storage            $0.99          │
│                                                      │
│  Expected total: $145.47                             │
└──────────────────────────────────────────────────────┘
```

---

## Resumen: Recurring Transactions

### Qué hace
- **Auto-detects** subscriptions y gastos recurrentes
- **Tracks** próximos pagos esperados
- **Alerts** cambios de precio
- **Notifica** pagos missing
- **Summarizes** gasto mensual/anual total

### Cómo funciona
- Analiza intervalos entre transacciones del mismo merchant
- Calcula confidence score basado en consistencia
- Detecta patterns: weekly, monthly, quarterly, yearly
- Crea entries en `recurring_groups` table
- Updates automático cuando aparecen nuevas transacciones

### Benefits
- **Visibility**: el usuario ve TODAS sus subscriptions en un lugar
- **Control**: Puede cancelar subscriptions olvidadas
- **Awareness**: Se entera de cambios de precio
- **Planning**: Sabe cuánto gasta en recurring cada mes

### Phase 2 scope
- ✅ Auto-detection (confidence >= 70%)
- ✅ Frequency detection (weekly/monthly/yearly)
- ✅ Amount variation handling
- ✅ Price change alerts
- ✅ Missed payment detection
- ✅ Manual add/remove
- ✅ Summary dashboard
- ❌ Upcoming payments calendar (Phase 3)
- ❌ Subscription cancellation flow (Phase 3)
- ❌ Savings recommendations (Phase 3)

---

**Próximo flow**: Lee [flow-10-view-reports.md](flow-10-view-reports.md) para ver cómo el usuario explora pre-built reports.
