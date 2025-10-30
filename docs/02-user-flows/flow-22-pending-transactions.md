# Flow 22: Pending Transactions ⏳

**Phase**: 1 (Core)
**Priority**: High
**Complexity**: Medium
**Related Flows**: flow-2, flow-6, flow-21

---

## 1. Funcionalidad

Manejo de transactions que aparecen como "pending" en bank statements y luego post con cambios.

**Escenarios cubiertos**:
1. **Pending → Posted** - Amount changes ($50 → $48)
2. **Pending → Cancelled** - Transaction never posts
3. **Pending → Posted (same amount)** - Simple transition
4. **Multiple pendings** - Mismo merchant, diferentes amounts
5. **Cross-statement pendings** - Pending en Sep, posted en Oct

**Impacto en reconciliation**:
- Balance checks must handle pendings correctly
- System health tracks pending transitions
- Timeline shows current state accurately

---

## 2. Implementación

### Schema Extension

```sql
-- Add to transactions table
ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'posted';
-- Values: 'pending' | 'posted' | 'cancelled'

ALTER TABLE transactions ADD COLUMN pending_link_id TEXT;
-- Links pending to its posted version

ALTER TABLE transactions ADD COLUMN status_changed_at TEXT;
-- When status last changed

CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_pending_link ON transactions(pending_link_id);
```

### Detection During Import

```javascript
// When parsing PDF
function parsePDFTransaction(line) {
  const txn = extractFields(line);

  // Detect pending indicators in description
  const pendingKeywords = [
    'PENDING',
    'AUTHORIZATION',
    'PRE-AUTH',
    'HOLD',
    'TEMP HOLD'
  ];

  const isPending = pendingKeywords.some(keyword =>
    txn.description.toUpperCase().includes(keyword)
  );

  return {
    ...txn,
    status: isPending ? 'pending' : 'posted',
    status_changed_at: new Date().toISOString()
  };
}
```

### Matching Algorithm

```javascript
// When importing new PDF, check for pending → posted transitions
async function matchPendingToPosted(newTransactions) {
  const matches = [];

  // Get all unresolved pendings
  const pendings = await db.all(`
    SELECT * FROM transactions
    WHERE status = 'pending'
    AND pending_link_id IS NULL
    ORDER BY date DESC
  `);

  for (const posted of newTransactions) {
    if (posted.status === 'posted') {
      // Find matching pending
      const match = pendings.find(pending =>
        // Same merchant (normalized)
        pending.merchant === posted.merchant &&
        // Amount within 5% (tips, fees can change amount)
        Math.abs(pending.amount - posted.amount) / Math.abs(pending.amount) < 0.05 &&
        // Posted date within 7 days of pending
        daysBetween(pending.date, posted.date) <= 7 &&
        // Same account
        pending.account_id === posted.account_id &&
        // Not already linked
        !pending.pending_link_id
      );

      if (match) {
        matches.push({
          pending: match,
          posted: posted,
          amount_changed: match.amount !== posted.amount,
          confidence: calculateMatchConfidence(match, posted)
        });
      }
    }
  }

  return matches;
}
```

### Confidence Scoring

```javascript
function calculateMatchConfidence(pending, posted) {
  let score = 0;

  // Exact merchant match
  if (pending.merchant === posted.merchant) score += 0.4;

  // Exact amount match
  if (pending.amount === posted.amount) score += 0.3;
  else if (Math.abs(pending.amount - posted.amount) < 5) score += 0.2;

  // Date proximity
  const days = daysBetween(pending.date, posted.date);
  if (days <= 1) score += 0.2;
  else if (days <= 3) score += 0.15;
  else if (days <= 7) score += 0.1;

  // Same account (required)
  if (pending.account_id === posted.account_id) score += 0.1;

  return Math.min(score, 1.0);
}
```

---

## 3. User Story: Pending becomes posted with amount change

### Escena 1: Restaurant pending

**Sep 28**: Usuario cena en restaurant. Paga con credit card.

Bank statement muestra:
```
Sep 28  PENDING - OLIVE GARDEN  -$50.00
```

Finance App importa:
```javascript
{
  date: '2025-09-28',
  merchant: 'Olive Garden',
  amount: -50.00,
  status: 'pending',  // Detected from "PENDING" keyword
  description: 'PENDING - OLIVE GARDEN #1234'
}
```

### Escena 2: Timeline shows pending

```
┌─────────────────────────────────────────────┐
│  Timeline                                   │
├─────────────────────────────────────────────┤
│  Sep 28  Olive Garden  -$50.00  ⏳ PENDING │
│          May change when posted             │
└─────────────────────────────────────────────┘
```

### Escena 3: Transaction posts with tip

**Sep 30**: Transaction posts. Usuario left $8 tip.

New statement:
```
Sep 30  OLIVE GARDEN #1234  -$58.00
```

Finance App imports, runs matching:

```javascript
// Found match!
{
  pending: { id: 'txn_pending_123', amount: -50.00, date: '2025-09-28' },
  posted: { id: 'txn_posted_456', amount: -58.00, date: '2025-09-30' },
  amount_changed: true,
  confidence: 0.85
}
```

### Escena 4: User confirmation

System shows notification:

```
┌─────────────────────────────────────────────┐
│  ⏳ Pending Transaction Posted              │
├─────────────────────────────────────────────┤
│                                             │
│  Pending:                                   │
│  Sep 28  Olive Garden  -$50.00             │
│                                             │
│  Posted as:                                 │
│  Sep 30  Olive Garden  -$58.00             │
│                                             │
│  Difference: -$8.00 (tip added)             │
│  Confidence: 85% ✅                          │
│                                             │
│  [Link Transactions]  [Keep Separate]       │
└─────────────────────────────────────────────┘
```

Usuario click "Link Transactions".

### Escena 5: Linked state

Database update:

```javascript
// Mark pending as replaced
await db.run(`
  UPDATE transactions
  SET status = 'posted',
      pending_link_id = ?,
      status_changed_at = ?
  WHERE id = ?
`, [postedId, new Date().toISOString(), pendingId]);

// Mark posted as replacement of pending
await db.run(`
  UPDATE transactions
  SET pending_link_id = ?
  WHERE id = ?
`, [pendingId, postedId]);
```

Timeline now shows:

```
┌─────────────────────────────────────────────┐
│  Sep 30  Olive Garden  -$58.00  ✅ POSTED  │
│          ↳ Replaced pending from Sep 28     │
│          Amount changed: $50 → $58 (+$8)    │
└─────────────────────────────────────────────┘
```

**Pending transaction hidden from timeline** (unless "Show replaced pendings" enabled)

---

## 4. Edge Cases

### Edge case 1: Pending cancelled

**Scenario**: Authorization for $100, but purchase cancelled. Never posts.

**Detection**: After 30 days, pending with no match = likely cancelled.

**UI**:
```
┌─────────────────────────────────────────────┐
│  ⚠️  Old Pending Transaction                │
├─────────────────────────────────────────────┤
│  Sep 1   Amazon  -$100.00  ⏳ PENDING       │
│                                             │
│  This transaction has been pending for      │
│  30+ days and hasn't posted.                │
│                                             │
│  Actions:                                   │
│  [Mark as Cancelled]                        │
│  [Still Waiting]                            │
└─────────────────────────────────────────────┘
```

User marks as cancelled → status = 'cancelled', excluded from balance.

### Edge case 2: Multiple pendings same merchant

**Scenario**: 2 Amazon purchases pending, both post.

**Solution**: Match by closest date + amount proximity.

```javascript
// Sort matches by confidence
matches.sort((a, b) => b.confidence - a.confidence);

// Take best match for each pending (no duplicates)
const finalMatches = [];
const usedPendings = new Set();
const usedPosted = new Set();

for (const match of matches) {
  if (!usedPendings.has(match.pending.id) &&
      !usedPosted.has(match.posted.id)) {
    finalMatches.push(match);
    usedPendings.add(match.pending.id);
    usedPosted.add(match.posted.id);
  }
}
```

### Edge case 3: Cross-statement pending

**Scenario**: Pending Sep 30, posted Oct 2 (different PDFs).

**Solution**: Search window = 30 days across all transactions.

```javascript
const pendings = await db.all(`
  SELECT * FROM transactions
  WHERE status = 'pending'
  AND date >= date('now', '-30 days')
  AND pending_link_id IS NULL
`);
```

### Edge case 4: Amount drops to $0 (void)

**Scenario**: Pending $50, posted as $0 (merchant voided).

**Solution**: Treat as cancelled.

```javascript
if (posted.amount === 0 && Math.abs(pending.amount) > 0) {
  // This is a void
  await markAsCancelled(pending.id);
  // Don't import the $0 transaction
  return;
}
```

---

## 5. Balance Reconciliation Impact

### Query for balance checks

```javascript
async function calculateBalance(accountId, upToDate) {
  const result = await db.get(`
    SELECT SUM(
      CASE
        WHEN type = 'income' AND status != 'cancelled' THEN amount
        WHEN type = 'expense' AND status != 'cancelled' THEN -amount
        ELSE 0
      END
    ) as balance
    FROM transactions
    WHERE account_id = ?
    AND date <= ?
    AND (status = 'posted' OR status = 'pending')
    -- Include pendings in balance calculation
  `, [accountId, upToDate]);

  return result?.balance || 0;
}
```

### Pending transactions note

Balance check UI shows:

```
┌─────────────────────────────────────────────┐
│  Balance Check - Apple Card                 │
├─────────────────────────────────────────────┤
│  Expected:   $1,234.56                      │
│  Calculated: $1,234.56                      │
│  Difference: $0.00 ✅                        │
│                                             │
│  ℹ️  Note: Includes 3 pending transactions  │
│  Total pending: -$127.50                    │
│                                             │
│  [View Pending Transactions]                │
└─────────────────────────────────────────────┘
```

---

## 6. System Health Integration

### Health check: Unresolved pendings

```javascript
async function checkUnresolvedPendings() {
  const oldPendings = await db.all(`
    SELECT * FROM transactions
    WHERE status = 'pending'
    AND date < date('now', '-30 days')
    AND pending_link_id IS NULL
  `);

  return {
    metric_type: 'unresolved_pendings',
    metric_value: oldPendings.length,
    threshold: 0,
    status: oldPendings.length === 0 ? 'good' : 'warning',
    details: JSON.stringify({
      count: oldPendings.length,
      oldest_date: oldPendings[0]?.date,
      total_amount: oldPendings.reduce((sum, p) => sum + p.amount, 0)
    })
  };
}
```

### System Health Dashboard

```
┌─────────────────────────────────────────────┐
│  🏥 System Health                           │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │ Unresolved Pendings              ⚠️  │  │
│  │ 2 transactions pending 30+ days      │  │
│  │ Total: -$127.50                      │  │
│  │ [Review Pendings →]                  │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 7. Timeline Filters

### Show/hide pendings

```
Filters:
☑ Posted transactions
☑ Pending transactions
☐ Cancelled transactions
☐ Replaced pendings
```

Default: Show posted + pending, hide cancelled + replaced.

---

## 8. Reporting Impact

### Spending reports

```javascript
// Exclude cancelled, include pending
SELECT
  category,
  SUM(CASE WHEN status != 'cancelled' THEN amount ELSE 0 END) as total
FROM transactions
WHERE type = 'expense'
GROUP BY category
```

### Budget tracking

Pending transactions count towards budget:

```
Food & Dining Budget: $800
Used: $547 (posted) + $32 (pending) = $579
Remaining: $221
```

---

## 9. Resumen

### Qué hace
- Detecta pending transactions automáticamente
- Matches pending → posted con confidence scoring
- Handles amount changes (tips, fees)
- Tracks cancelled transactions
- Integrates con balance checks y health dashboard

### Estados
- **pending** - Authorization, not yet posted
- **posted** - Cleared transaction
- **cancelled** - Pending that never posted

### Matching heuristics
- Merchant match (normalized)
- Amount within 5%
- Date within 7 days
- Same account
- Confidence > 0.7 → auto-link

### Benefits
- **Accurate balances** - Pendings included in calculations
- **Reconciliation trust** - System knows about pending state
- **No surprises** - Amount changes tracked and explained
- **Clean timeline** - Replaced pendings hidden by default

### Phase 1 scope
- ✅ Pending detection from PDF keywords
- ✅ Auto-matching with confidence scoring
- ✅ Amount change tracking
- ✅ Cancelled pending detection (30 days)
- ✅ System health integration
- ⏭️ Manual pending entry (Phase 2)
- ⏭️ Bank API sync for real-time pendings (Phase 5)

---

**LOC estimate**: ~250 líneas (detection + matching + UI + health)

**Próximo flow**: Lee [flow-23-backup-restore.md](flow-23-backup-restore.md) para backup completo del sistema.
