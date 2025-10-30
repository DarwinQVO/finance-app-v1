# Flow 20: Refunds & Disputes 🔄

**Phase**: 2 (Organization)
**Priority**: Medium
**Complexity**: Medium
**Related Flows**: flow-3, flow-6, flow-5

---

## 1. Funcionalidad

Manejo de refunds, chargebacks, y disputes con tracking completo del ciclo.

**Casos cubiertos**:
1. **Refunds** - Merchant procesa devolución (purchase + refund aparecen en statements)
2. **Chargebacks** - Usuario disputa cargo con banco (reverso forzado)
3. **Partial refunds** - Devolución parcial del monto
4. **Cross-statement refunds** - Purchase en Sep, refund en Oct (diferentes PDFs)

**Features principales**:
- Linking de refund a transaction original
- Estado tracking (pending, completed, failed)
- Timeline visual mostrando ambos lados
- Net amount calculation (purchase - refund)
- Reporting que excluye refunds de spending totals

---

## 2. Implementación

### Schema

```sql
-- Extend transactions table
ALTER TABLE transactions ADD COLUMN refund_status TEXT;
-- Values: null | 'original' | 'refund' | 'disputed'

ALTER TABLE transactions ADD COLUMN refund_link_id TEXT;
-- References id of linked transaction

ALTER TABLE transactions ADD COLUMN refund_amount REAL;
-- Amount refunded (puede ser partial)

CREATE INDEX idx_transactions_refund_link ON transactions(refund_link_id);
```

### Detection Heuristics

```javascript
// Auto-detect refunds during PDF import
function detectRefunds(newTransactions, existingTransactions) {
  const refunds = [];

  for (const txn of newTransactions) {
    // Refund indicators:
    // 1. Amount is positive (income on credit card)
    // 2. Merchant matches existing expense
    // 3. Date within 90 days of original
    // 4. Description contains "REFUND", "RETURN", "REVERSAL"

    if (txn.amount > 0 && txn.type === 'income') {
      // Search for matching expense
      const matches = existingTransactions.filter(existing =>
        existing.merchant === txn.merchant &&
        existing.amount === -txn.amount &&
        existing.type === 'expense' &&
        daysBetween(existing.date, txn.date) <= 90 &&
        !existing.refund_link_id // Not already linked
      );

      if (matches.length > 0) {
        // Most likely match: closest date
        const bestMatch = matches.reduce((closest, current) =>
          daysBetween(current.date, txn.date) < daysBetween(closest.date, txn.date)
            ? current : closest
        );

        refunds.push({
          refundTxn: txn,
          originalTxn: bestMatch,
          confidence: calculateRefundConfidence(txn, bestMatch)
        });
      }
    }
  }

  return refunds;
}
```

### Confidence Scoring

```javascript
function calculateRefundConfidence(refund, original) {
  let score = 0;

  // Exact amount match
  if (refund.amount === -original.amount) score += 0.4;

  // Merchant exact match
  if (refund.merchant === original.merchant) score += 0.3;

  // Description contains refund keywords
  if (/REFUND|RETURN|REVERSAL|CREDIT/i.test(refund.description)) score += 0.2;

  // Date proximity (closer = higher score)
  const days = daysBetween(original.date, refund.date);
  if (days <= 7) score += 0.1;
  else if (days <= 30) score += 0.05;

  return Math.min(score, 1.0);
}
```

---

## 3. User Story: el usuario recibe refund

### Escena 1: Original purchase

**Sep 15**: el usuario compra laptop en Amazon - $1,299.99

Transaction aparece en timeline:
```
Sep 15  Amazon  -$1,299.99 USD  [Expense]
```

### Escena 2: Return & refund

**Sep 20**: el usuario devuelve laptop. Amazon procesa refund.

**Sep 22**: Refund aparece en bank statement.

el usuario sube `apple-card_2025_09.pdf`. Sistema detecta:

```javascript
{
  date: '2025-09-22',
  merchant: 'Amazon',
  amount: 1299.99,  // Positive
  description: 'AMAZON.COM REFUND'
}
```

### Escena 3: Auto-linking

Sistema ejecuta detection heuristics:

```javascript
// Match found!
{
  originalTxn: { id: 'txn_abc', date: '2025-09-15', amount: -1299.99 },
  refundTxn: { id: 'txn_xyz', date: '2025-09-22', amount: 1299.99 },
  confidence: 0.95  // High confidence
}
```

Sistema muestra confirmation:

```
┌─────────────────────────────────────────────┐
│  🔗 Refund Detected                         │
├─────────────────────────────────────────────┤
│                                             │
│  Found potential refund link:               │
│                                             │
│  Original:                                  │
│  Sep 15  Amazon  -$1,299.99                │
│                                             │
│  Refund:                                    │
│  Sep 22  Amazon  +$1,299.99                │
│                                             │
│  Confidence: 95% ✅                          │
│                                             │
│  [Link Transactions]  [Ignore]              │
└─────────────────────────────────────────────┘
```

el usuario click "Link Transactions".

### Escena 4: Linked transactions

Timeline ahora muestra ambos linked:

```
┌─────────────────────────────────────────────┐
│  Sep 22  Amazon  +$1,299.99  [REFUND]      │
│          ↳ Refund of Sep 15 purchase        │
│          Net impact: $0.00                  │
│                                             │
│  Sep 15  Amazon  -$1,299.99  [REFUNDED]    │
│          ↳ Refunded on Sep 22               │
│          Net impact: $0.00                  │
└─────────────────────────────────────────────┘
```

### Escena 5: Transaction detail view

Click en original purchase:

```
┌─────────────────────────────────────────────┐
│  Transaction Details                        │
├─────────────────────────────────────────────┤
│  Amazon                                     │
│  Sep 15, 2025                               │
│                                             │
│  💰 Amount: -$1,299.99 USD                  │
│                                             │
│  🔄 Status: REFUNDED                        │
│  Refund processed: Sep 22, 2025             │
│  Refund amount: +$1,299.99                  │
│  Net impact: $0.00                          │
│                                             │
│  [View Refund Transaction]                  │
│  [Unlink Refund]                            │
└─────────────────────────────────────────────┘
```

---

## 4. Edge Cases

### Edge case 1: Partial refund

**Scenario**: Bought 3 items ($100 + $50 + $30 = $180). Returned 1 item ($50 refund).

**Detection**:
```javascript
// Original: -$180
// Refund: +$50 (partial)
// System detects: refund_amount !== original_amount

// Mark as partial refund
{
  refund_status: 'partial',
  refund_amount: 50,
  remaining_amount: 130  // $180 - $50
}
```

**UI**:
```
Sep 15  Target  -$180.00  [PARTIAL REFUND]
        ↳ $50 refunded on Sep 18
        Net: -$130.00
```

### Edge case 2: Cross-statement refund

**Scenario**: Purchase Sep 28, refund Oct 3 (different PDFs).

**Solution**: Search window = 90 days across all transactions, not just current PDF.

### Edge case 3: Multiple purchases same merchant

**Scenario**: 3 Amazon purchases in September, 1 refund. Which one?

**Solution**: Confidence scoring prioritizes:
1. Exact amount match (highest priority)
2. Closest date
3. Same account

If ambiguous (confidence < 0.7), show user picker:

```
┌─────────────────────────────────────────────┐
│  🔗 Link Refund                             │
├─────────────────────────────────────────────┤
│  Which purchase was refunded?               │
│                                             │
│  ○ Sep 5   Amazon  -$1,299.99  (89% match) │
│  ○ Sep 12  Amazon  -$1,250.00  (65% match) │
│  ○ Sep 20  Amazon  -$1,299.99  (95% match) │
│  ○ None of these                            │
│                                             │
│  [Link Selected]  [Skip]                    │
└─────────────────────────────────────────────┘
```

### Edge case 4: Chargeback (disputed)

**Scenario**: Fraudulent charge. Usuario disputa con banco.

**Manual flow**:
1. User marks transaction as "disputed"
2. Sets expected refund date (e.g., 45 days)
3. When refund appears, links automatically

**UI**:
```
Sep 10  Unknown Merchant  -$500.00  [DISPUTED]
        ↳ Dispute filed: Sep 12
        Expected resolution: Oct 27
        Status: Pending
```

---

## 5. Reporting Impact

### Spending calculations

```javascript
// BEFORE refund support:
SELECT SUM(amount) FROM transactions WHERE type = 'expense'
// Result: -$10,000 (includes refunded purchases)

// AFTER refund support:
SELECT SUM(
  CASE
    WHEN refund_status = 'original' AND refund_link_id IS NOT NULL
      THEN 0  -- Exclude fully refunded
    WHEN refund_status = 'partial'
      THEN amount + refund_amount  -- Net amount
    WHEN refund_status = 'refund'
      THEN 0  -- Exclude refund transactions
    ELSE amount
  END
) FROM transactions WHERE type = 'expense'
// Result: -$8,500 (accurate net spending)
```

### Reports toggle

All reports have toggle:
```
☐ Include refunded transactions
```

Default: OFF (exclude from totals)

---

## 6. Database Operations

### Link refund

```javascript
async function linkRefund(originalId, refundId) {
  await db.run(`
    UPDATE transactions
    SET refund_status = 'original',
        refund_link_id = ?
    WHERE id = ?
  `, [refundId, originalId]);

  await db.run(`
    UPDATE transactions
    SET refund_status = 'refund',
        refund_link_id = ?
    WHERE id = ?
  `, [originalId, refundId]);
}
```

### Unlink refund

```javascript
async function unlinkRefund(transactionId) {
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);

  if (txn.refund_link_id) {
    await db.run(`
      UPDATE transactions
      SET refund_status = NULL,
          refund_link_id = NULL
      WHERE id = ? OR id = ?
    `, [transactionId, txn.refund_link_id]);
  }
}
```

---

## 7. Resumen

### Qué hace
- Detecta refunds automáticamente (90%+ accuracy)
- Links refund a transaction original
- Tracks partial refunds
- Handles cross-statement refunds
- Excluye refunds de spending totals
- Supports disputes/chargebacks

### Cómo funciona
- Heuristics: amount match + merchant match + date proximity
- Confidence scoring (0.0-1.0)
- Manual linking si confidence < 0.7
- Database fields: refund_status, refund_link_id, refund_amount

### Benefits
- **Accurate spending** - No cuenta purchases que fueron refunded
- **Visibility** - Ve full refund cycle en timeline
- **Trust** - Sistema trackea todo el flow, no solo final state
- **Reporting** - Reports excluyen refunds automáticamente

### Phase 2 scope
- ✅ Auto-detection con heuristics
- ✅ Manual linking option
- ✅ Partial refunds
- ✅ Reporting integration
- ❌ Dispute tracking workflow (Phase 3)
- ❌ Automated dispute resolution tracking (Phase 4)

---

**LOC estimate**: ~200 líneas (detection + UI + reporting)

**Próximo flow**: Lee [flow-21-system-health.md](flow-21-system-health.md) para ver dashboard de confianza del sistema.
