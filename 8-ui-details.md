# UI: Transaction Details Panel

**Panel lateral con toda la info de una transacción**

## Overview

Cuando Darwin hace click en una transacción, aparece un panel desde la derecha con todos los detalles.

```
┌──────────────┬────────────────────────┐
│  Timeline    │  Transaction Details   │
│              │                        │
│  Sep 28      │  Starbucks             │
│  Starbucks ◄─┤  Sep 28, 2025          │
│  -$5.67      │  ──────────────────    │
│              │  💰 Amount: -$5.67 USD │
│              │  🏦 Account: BofA      │
│              │  📄 Original:          │
│              │     STARBUCKS #12345   │
│              │  🎯 Confidence: 95%    │
│              │  [Delete] [Close]      │
└──────────────┴────────────────────────┘
```

---

## Code: TransactionDetail

```javascript
// renderer/components/TransactionDetail.jsx

function TransactionDetail({ transactionId, onClose }) {
  const [txn, setTxn] = useState(null);
  const [observation, setObservation] = useState(null);

  useEffect(() => {
    fetchData();
  }, [transactionId]);

  const fetchData = async () => {
    const t = await window.electron.getTransaction(transactionId);
    setTxn(t);

    // Fetch original observation
    const obs = await window.electron.getObservationByCanonicalId(transactionId);
    setObservation(obs);
  };

  if (!txn) return <div>Loading...</div>;

  return (
    <div className="transaction-detail">
      <div className="header">
        <h2>{txn.merchant}</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className="date">{formatDate(txn.date)}</div>

      <Section title="💰 Amount">
        <Amount value={txn.amount} currency={txn.currency} />
      </Section>

      <Section title="🏦 Account">
        <AccountBadge account={txn.account} />
      </Section>

      <Section title="🏷️ Type">
        <TypeBadge type={txn.type} />
      </Section>

      {observation && (
        <Section title="📄 Original Description">
          <code>{observation.description}</code>
        </Section>
      )}

      {observation && (
        <Section title="📁 Source">
          <div>{observation.pdf_filename}</div>
          <div className="text-sm text-gray-500">
            Line {observation.line_number} • Statement: {observation.statement_date}
          </div>
        </Section>
      )}

      <Section title="🎯 Confidence">
        <ProgressBar value={txn.confidence} />
        <div>{Math.round(txn.confidence * 100)}%</div>
      </Section>

      {txn.transfer_pair_id && (
        <Section title="↔️ Linked Transfer">
          <TransferLink pairId={txn.transfer_pair_id} />
        </Section>
      )}

      <div className="actions">
        <Button danger onClick={() => handleDelete(txn.id)}>Delete</Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      <div className="section-content">{children}</div>
    </div>
  );
}
```

---

## TransferLink component

```javascript
function TransferLink({ pairId }) {
  const [pair, setPair] = useState(null);

  useEffect(() => {
    fetchPair();
  }, [pairId]);

  const fetchPair = async () => {
    const p = await window.electron.getTransaction(pairId);
    setPair(p);
  };

  if (!pair) return <div>Loading...</div>;

  const daysDiff = calculateDaysDifference(pair.date, new Date());

  return (
    <div className="transfer-link">
      <div className="transfer-amount">
        {formatAmount(pair.amount, pair.currency)}
      </div>
      <div className="transfer-account">{pair.account}</div>
      <div className="transfer-date">
        {formatDate(pair.date)}
        {daysDiff > 0 && <span> ({daysDiff} day(s) later)</span>}
      </div>
      <button onClick={() => openDetail(pair.id)}>
        View details →
      </button>
    </div>
  );
}
```

---

## Delete confirmation

```javascript
function handleDelete(transactionId) {
  const confirmed = window.confirm(
    'Are you sure you want to delete this transaction? This action cannot be undone.'
  );

  if (!confirmed) return;

  // Delete
  window.electron.deleteTransaction(transactionId);

  // Close panel
  onClose();

  // Refresh timeline
  window.electron.emit('transactions-updated');
}
```

---

## Slide animation

```css
/* renderer/styles/transaction-detail.css */

.transaction-detail {
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  padding: 24px;

  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.transaction-detail.closing {
  animation: slideOut 0.3s ease-in;
}

@keyframes slideOut {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}

.section {
  @apply mb-6;
}

.section-title {
  @apply text-sm font-semibold text-gray-600 mb-2;
}

.section-content {
  @apply text-gray-800;
}
```

---

## LOC estimate

- `TransactionDetail.jsx`: ~120 LOC
- `TransferLink.jsx`: ~50 LOC
- `Section.jsx`: ~10 LOC
- CSS: ~40 LOC

**Total**: ~220 LOC

---

## Resumen Batch 5: UI/UX

| Doc | LOC |
|-----|-----|
| 6-ui-timeline.md | ~270 |
| 7-ui-filters.md | ~120 |
| 8-ui-details.md | ~220 |
| **Total** | **~610** |

**Objetivo era ~800**. Estamos bien. ✓

---

**Próximos docs**: Lee [Batch 6: Integration](9-upload-flow.md)
