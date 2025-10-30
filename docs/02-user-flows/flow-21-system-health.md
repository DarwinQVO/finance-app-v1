# Flow 21: System Health Dashboard 🏥

**Phase**: 3 (Analysis)
**Priority**: High
**Complexity**: Medium
**Related Flows**: flow-5, flow-6, flow-11, flow-20

---

## 1. Funcionalidad

Dashboard centralizado que muestra el "estado de salud" del sistema financiero.

**Métricas tracked**:
1. **Data quality** - % transactions con confidence > 0.8
2. **Pending items** - Transfers sin linking, possible duplicates
3. **Balance reconciliation** - Discrepancias detectadas
4. **Coverage gaps** - Missing statements, date gaps
5. **Edit tracking** - Transactions modificadas recientemente
6. **Currency conversion** - Rate sources y confidence

**Goal**: Usuario ve en < 10 segundos si hay algo que necesita atención.

---

## 2. Implementación

### Database Schema

```sql
CREATE TABLE system_health_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  threshold REAL,
  status TEXT CHECK(status IN ('good', 'warning', 'error')),
  details TEXT,  -- JSON con info adicional
  created_at TEXT NOT NULL
);

CREATE INDEX idx_health_metrics_type ON system_health_metrics(metric_type);
CREATE INDEX idx_health_metrics_status ON system_health_metrics(status);
```

### Health Checks

```javascript
// Run health checks (ejecutar diariamente o on-demand)
async function runHealthChecks() {
  const checks = [];

  // 1. Data quality check
  checks.push(await checkDataQuality());

  // 2. Pending transfers check
  checks.push(await checkPendingTransfers());

  // 3. Balance reconciliation check
  checks.push(await checkBalanceReconciliation());

  // 4. Coverage gaps check
  checks.push(await checkCoverageGaps());

  // 5. Currency conversion check
  checks.push(await checkCurrencyRates());

  // Store results
  for (const check of checks) {
    await storeHealthMetric(check);
  }

  return checks;
}
```

### Check 1: Data Quality

```javascript
async function checkDataQuality() {
  const result = await db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN confidence >= 0.8 THEN 1 ELSE 0 END) as high_confidence,
      SUM(CASE WHEN confidence < 0.5 THEN 1 ELSE 0 END) as low_confidence
    FROM transactions
    WHERE created_at > date('now', '-30 days')
  `);

  const qualityScore = result.high_confidence / result.total;

  return {
    metric_type: 'data_quality',
    metric_value: qualityScore,
    threshold: 0.85,
    status: qualityScore >= 0.85 ? 'good' : (qualityScore >= 0.7 ? 'warning' : 'error'),
    details: JSON.stringify({
      total: result.total,
      high_confidence: result.high_confidence,
      low_confidence: result.low_confidence,
      percentage: Math.round(qualityScore * 100)
    })
  };
}
```

### Check 2: Pending Transfers

```javascript
async function checkPendingTransfers() {
  // Find potential transfers not linked
  const pendingTransfers = await db.all(`
    SELECT
      t1.id as txn1_id,
      t2.id as txn2_id,
      t1.merchant,
      t1.amount,
      t1.date as date1,
      t2.date as date2
    FROM transactions t1
    JOIN transactions t2 ON
      ABS(t1.amount + t2.amount) < 0.01 AND  -- Same amount (opposite signs)
      t1.account_id != t2.account_id AND     -- Different accounts
      ABS(julianday(t1.date) - julianday(t2.date)) <= 3 AND  -- Within 3 days
      t1.transfer_link_id IS NULL AND        -- Not linked
      t2.transfer_link_id IS NULL
    WHERE t1.id < t2.id  -- Avoid duplicates
  `);

  return {
    metric_type: 'pending_transfers',
    metric_value: pendingTransfers.length,
    threshold: 0,
    status: pendingTransfers.length === 0 ? 'good' : 'warning',
    details: JSON.stringify({
      count: pendingTransfers.length,
      items: pendingTransfers.slice(0, 5)  // Top 5
    })
  };
}
```

### Check 3: Balance Reconciliation

```javascript
async function checkBalanceReconciliation() {
  // Get balance checks with discrepancies
  const discrepancies = await db.all(`
    SELECT * FROM balance_checks
    WHERE status IN ('warning', 'error')
    AND resolved_at IS NULL
    ORDER BY check_date DESC
  `);

  return {
    metric_type: 'balance_reconciliation',
    metric_value: discrepancies.length,
    threshold: 0,
    status: discrepancies.length === 0 ? 'good' :
           (discrepancies.length <= 2 ? 'warning' : 'error'),
    details: JSON.stringify({
      count: discrepancies.length,
      total_difference: discrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0),
      items: discrepancies.map(d => ({
        account: d.account_id,
        date: d.check_date,
        difference: d.difference
      }))
    })
  };
}
```

### Check 4: Coverage Gaps

```javascript
async function checkCoverageGaps() {
  // Find date gaps > 40 days in statements
  const gaps = await db.all(`
    SELECT
      account_id,
      MAX(date) as last_statement_date,
      julianday('now') - julianday(MAX(date)) as days_since
    FROM transactions
    GROUP BY account_id
    HAVING days_since > 40
  `);

  return {
    metric_type: 'coverage_gaps',
    metric_value: gaps.length,
    threshold: 0,
    status: gaps.length === 0 ? 'good' : 'warning',
    details: JSON.stringify({
      count: gaps.length,
      accounts: gaps.map(g => ({
        account_id: g.account_id,
        last_statement: g.last_statement_date,
        days_ago: Math.round(g.days_since)
      }))
    })
  };
}
```

### Check 5: Currency Rates

```javascript
async function checkCurrencyRates() {
  // Check if currency rates are recent (< 24 hours old)
  const staleRates = await db.all(`
    SELECT DISTINCT currency
    FROM transactions
    WHERE currency != 'USD'
    AND NOT EXISTS (
      SELECT 1 FROM exchange_rates
      WHERE from_currency = transactions.currency
      AND to_currency = 'USD'
      AND updated_at > datetime('now', '-24 hours')
    )
  `);

  return {
    metric_type: 'currency_rates',
    metric_value: staleRates.length,
    threshold: 0,
    status: staleRates.length === 0 ? 'good' : 'warning',
    details: JSON.stringify({
      stale_currencies: staleRates.map(r => r.currency)
    })
  };
}
```

---

## 3. User Story: el usuario revisa system health

### Escena 1: Dashboard access

el usuario abre Finance App → Click en "Health" en sidebar.

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├───────┬─────────────────────────────────────────┤
│ 📊    │                                         │
│ Views │  🏥 System Health                       │
│       │                                         │
│ 📅 Tm │  Overall Status: ⚠️  NEEDS ATTENTION    │
│ 💳 CC │  Last check: 2 hours ago                │
│ 📈 Rp │                          [Run Check]    │
│ 💰 Bg │                                         │
│       │  ┌──────────────────────────────────┐  │
│ 🏥    │  │ Data Quality                     │  │
│ Hlth  │  │ ████████████████████░  92%  ✅   │  │
│  ←    │  │ 1,234 / 1,340 high confidence    │  │
│       │  └──────────────────────────────────┘  │
│       │                                         │
│       │  ┌──────────────────────────────────┐  │
│       │  │ Pending Transfers                │  │
│       │  │ 3 potential transfers ⚠️          │  │
│       │  │ [Review Transfers →]             │  │
│       │  └──────────────────────────────────┘  │
│       │                                         │
│       │  ┌──────────────────────────────────┐  │
│       │  │ Balance Reconciliation           │  │
│       │  │ 1 discrepancy found ⚠️            │  │
│       │  │ Apple Card: -$4.56               │  │
│       │  │ [View Details →]                 │  │
│       │  └──────────────────────────────────┘  │
│       │                                         │
│       │  ┌──────────────────────────────────┐  │
│       │  │ Coverage Gaps                    │  │
│       │  │ All accounts up to date ✅        │  │
│       │  └──────────────────────────────────┘  │
│       │                                         │
│       │  ┌──────────────────────────────────┐  │
│       │  │ Currency Rates                   │  │
│       │  │ All rates current ✅              │  │
│       │  └──────────────────────────────────┘  │
└───────┴─────────────────────────────────────────┘
```

### Escena 2: Review pending transfers

el usuario click "Review Transfers":

```
┌─────────────────────────────────────────────────┐
│  🔄 Pending Transfers (3)                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Transfer 1: (95% confidence)                   │
│  ┌────────────────────────────────────────────┐│
│  │ Sep 15  Transfer to Wise    -$500.00      ││
│  │         Account: Chase Checking            ││
│  └────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────┐│
│  │ Sep 16  Transfer from Chase  +$500.00     ││
│  │         Account: Wise EUR                  ││
│  └────────────────────────────────────────────┘│
│  [Link as Transfer]  [Not a Transfer]          │
│                                                 │
│  Transfer 2: (87% confidence)                   │
│  ┌────────────────────────────────────────────┐│
│  │ Sep 20  Payment               -$1,200.00   ││
│  │         Account: BofA Credit               ││
│  └────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────┐│
│  │ Sep 20  Payment Received     +$1,200.00   ││
│  │         Account: BofA Checking             ││
│  └────────────────────────────────────────────┘│
│  [Link as Transfer]  [Not a Transfer]          │
└─────────────────────────────────────────────────┘
```

### Escena 3: Resolve balance discrepancy

el usuario click "View Details" en Balance Reconciliation:

```
┌─────────────────────────────────────────────────┐
│  ⚠️  Balance Discrepancy - Apple Card           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Check Date: Oct 29, 2025                       │
│                                                 │
│  Expected Balance:   $1,234.56                  │
│  Calculated Balance: $1,230.00                  │
│  Difference:            -$4.56                  │
│                                                 │
│  Possible reasons:                              │
│  • Pending transaction not yet posted           │
│  • Missing transaction from statement           │
│  • Manual entry error                           │
│                                                 │
│  Actions:                                       │
│  [View Recent Transactions]                     │
│  [Add Missing Transaction]                      │
│  [Mark as Resolved]                             │
└─────────────────────────────────────────────────┘
```

el usuario revisa transactions, encuentra que una compra de $4.56 en Starbucks no estaba en el PDF (pending cuando se generó el statement).

Action: Click "Add Missing Transaction" → Manual entry.

---

## 4. Health Score Calculation

### Overall score

```javascript
function calculateOverallHealth(checks) {
  const weights = {
    data_quality: 0.30,
    pending_transfers: 0.20,
    balance_reconciliation: 0.25,
    coverage_gaps: 0.15,
    currency_rates: 0.10
  };

  let score = 0;
  for (const check of checks) {
    const checkScore = check.status === 'good' ? 1.0 :
                      (check.status === 'warning' ? 0.5 : 0.0);
    score += checkScore * weights[check.metric_type];
  }

  return {
    score: Math.round(score * 100),
    status: score >= 0.9 ? 'excellent' :
           (score >= 0.7 ? 'good' :
           (score >= 0.5 ? 'needs_attention' : 'critical'))
  };
}
```

### Badge display

```
┌──────────────────────┐
│  System Health       │
│  ████████████░  86%  │
│  Status: GOOD ✅     │
└──────────────────────┘
```

---

## 5. Automated Alerts

### Email digest (weekly)

```
Subject: Finance App Weekly Health Report

Overall Health: 86% (Good ✅)

⚠️  Items needing attention (3):
1. 3 pending transfers detected - Review now
2. Balance discrepancy: Apple Card (-$4.56)
3. BofA Checking: Last statement 45 days ago

✅  Everything else looks good:
- Data quality: 92%
- Currency rates: Up to date
- 1,234 transactions processed this week

[View Dashboard]
```

### Push notifications

```javascript
// If health score drops below 70%
if (overallHealth.score < 70) {
  sendNotification({
    title: 'Finance App needs attention',
    body: `System health: ${overallHealth.score}%. Click to review.`,
    action: 'open_health_dashboard'
  });
}
```

---

## 6. Historical Tracking

### Track health over time

```sql
CREATE TABLE health_snapshots (
  id TEXT PRIMARY KEY,
  overall_score INTEGER NOT NULL,
  data_quality_score REAL,
  pending_items_count INTEGER,
  created_at TEXT NOT NULL
);

-- Query for chart
SELECT
  DATE(created_at) as date,
  AVG(overall_score) as avg_score
FROM health_snapshots
WHERE created_at > date('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date ASC;
```

### Chart UI

```
┌─────────────────────────────────────────────────┐
│  Health Trend (Last 30 Days)                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ 100%│                               ●           │
│     │                       ●   ●               │
│  90%│           ●       ●                       │
│     │       ●       ●                           │
│  80%│   ●                                       │
│     │                                           │
│  70%│●                                          │
│     └───────────────────────────────────────   │
│      Oct 1    Oct 10    Oct 20    Oct 29       │
│                                                 │
│  Average: 87%  •  Trend: ↗️  Improving          │
└─────────────────────────────────────────────────┘
```

---

## 7. Integration with Other Flows

### Link to flows

Each health metric links to relevant flow:

```
Pending Transfers (3) ⚠️
└─→ [flow-5-transfer-linking.md]

Balance Discrepancy ⚠️
└─→ [11-validations.md] (balance checks)

Data Quality (92%) ✅
└─→ [flow-6-edit-transaction.md] (review low confidence)

Coverage Gaps ✅
└─→ [flow-2-upload-pdf.md] (upload missing statements)
```

---

## 8. Resumen

### Qué hace
- Monitorea 5 métricas clave de system health
- Detecta issues automáticamente
- Proporciona actions claras para resolver
- Tracks health over time
- Weekly digest emails

### Métricas tracked
1. **Data quality** - % high confidence transactions
2. **Pending transfers** - Unlinked potential transfers
3. **Balance reconciliation** - Discrepancias vs bank
4. **Coverage gaps** - Missing statements
5. **Currency rates** - Staleness of exchange rates

### Benefits
- **Proactive** - User knows immediately if something needs attention
- **Trust** - Visual confirmation que data está correcta
- **Actionable** - Each metric links to resolution flow
- **Historical** - Track improvements over time

### Phase 3 scope
- ✅ All 5 health checks
- ✅ Dashboard UI
- ✅ Overall health score
- ✅ Action links to flows
- ⏭️ Email digests (Phase 4)
- ⏭️ Push notifications (Phase 4)
- ⏭️ Historical tracking chart (Phase 4)

---

**LOC estimate**: ~300 líneas (checks + UI + scoring)

**Próximo**: Sistema completamente cuadrado con trust construction ✅
