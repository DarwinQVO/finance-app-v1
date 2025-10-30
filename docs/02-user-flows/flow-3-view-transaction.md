# Flow 3: View Transaction

**Cómo funciona el panel de detalles de una transacción**

## Story: el usuario ve los detalles

### Escena 1: Timeline normal

el usuario está viendo su timeline:

```
┌──────────────────────────────────────────────────┐
│  Finance App              [Upload] [Filter] [⚙️]  │
├──────────────────────────────────────────────────┤
│  Filters: [All accounts] [Sep 2025]              │
├──────────────────────────────────────────────────┤
│                                                  │
│  Sep 28  Starbucks              -$5.67  USD     │
│  Sep 27  Amazon                 -$89.99 USD     │
│  Sep 26  Netflix                -$15.99 USD     │
│  Sep 25  Costco                -$234.56 USD     │
│                                                  │
└──────────────────────────────────────────────────┘
```

Hace **click** en "Starbucks".

---

### Escena 2: Panel de detalles aparece

Un panel slide desde la derecha:

```
┌────────────────────────┬─────────────────────────┐
│  Timeline              │  Transaction Details    │
├────────────────────────┼─────────────────────────┤
│  Filters: [All]        │  Starbucks              │
│                        │  Sep 28, 2025           │
│  Sep 28  Starbucks ◄───┼─────────────────────────┤
│  Sep 27  Amazon        │  💰 Amount              │
│  Sep 26  Netflix       │  -$5.67 USD             │
│  Sep 25  Costco        │                         │
│                        │  🏦 Account             │
│                        │  Bank of America        │
│                        │                         │
│                        │  📄 Original            │
│                        │  STARBUCKS STORE #12345 │
│                        │                         │
│                        │  📁 Source              │
│                        │  bofa_2025_09.pdf       │
│                        │                         │
│                        │  🎯 Confidence          │
│                        │  ████████░░  85%        │
│                        │                         │
│                        │  [Delete] [Close]       │
└────────────────────────┴─────────────────────────┘
```

el usuario puede ver:
- **Merchant normalizado**: "Starbucks"
- **Merchant original**: "STARBUCKS STORE #12345"
- **Source PDF**: De dónde vino
- **Confidence**: Qué tan seguro está el clustering

---

## Información mostrada

### 1. Básico
- **Merchant** (normalizado): "Starbucks"
- **Date**: "Sep 28, 2025"
- **Amount**: "-$5.67 USD"
- **Account**: "Bank of America"

### 2. Metadata
- **Original description**: Lo que decía el PDF
- **Source PDF**: `bofa_2025_09.pdf`
- **Statement date**: "Sep 30, 2025" (fecha del statement, no de la transacción)
- **Line number**: 47 (línea del PDF donde apareció)

### 3. Pipeline info
- **Cluster ID**: `cluster_abc123` (para debug)
- **Confidence**: 85% (0.0-1.0)
- **Type**: expense | income | transfer
- **Created at**: "2025-09-28 10:34:22"

### 4. Transfer info (si aplica)
- **Transfer pair**: Link a la otra mitad
- **From account**: "BofA"
- **To account**: "Wise"

---

## UI Components

### Component principal

```javascript
// renderer/components/TransactionDetail.jsx
function TransactionDetail({ transactionId, onClose }) {
  const [txn, setTxn] = useState(null);
  const [observation, setObservation] = useState(null);

  useEffect(() => {
    // Fetch transaction
    const t = window.electron.getTransaction(transactionId);
    setTxn(t);

    // Fetch original observation
    const obs = window.electron.getObservation(t.observation_id);
    setObservation(obs);
  }, [transactionId]);

  if (!txn) return <div>Loading...</div>;

  return (
    <div className="transaction-detail">
      <h2>{txn.merchant}</h2>
      <p className="date">{formatDate(txn.date)}</p>

      <Section title="💰 Amount">
        <Amount value={txn.amount} currency={txn.currency} />
      </Section>

      <Section title="🏦 Account">
        <AccountBadge account={txn.account} />
      </Section>

      <Section title="📄 Original">
        <code>{observation.description}</code>
      </Section>

      <Section title="📁 Source">
        {observation.pdf_filename}
      </Section>

      <Section title="🎯 Confidence">
        <ProgressBar value={txn.confidence} />
        <span>{Math.round(txn.confidence * 100)}%</span>
      </Section>

      {txn.transfer_pair_id && (
        <Section title="↔️ Transfer">
          <TransferLink pairId={txn.transfer_pair_id} />
        </Section>
      )}

      <div className="actions">
        <Button danger onClick={() => handleDelete(txn.id)}>
          Delete
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
```

---

## Layout: Split panel

El timeline NO desaparece. El panel aparece al lado.

### Desktop (1920x1080)
```
┌─────────────────────┬──────────────────────┐
│  Timeline (60%)     │  Details (40%)       │
│                     │                      │
│  [Lista de trans]   │  [Detalles de 1]     │
│                     │                      │
└─────────────────────┴──────────────────────┘
```

### Responsive: Mobile/smaller screen
El panel cubre toda la pantalla, con botón "Back".

```
┌──────────────────────────────────────────┐
│  [← Back]  Transaction Details           │
├──────────────────────────────────────────┤
│  Starbucks                               │
│  Sep 28, 2025                            │
│  ...                                     │
└──────────────────────────────────────────┘
```

---

## Transfer linking en UI

Cuando una transacción es un **transfer**, se ve diferente.

### En el timeline
```
Sep 26  ↔️ Transfer to Wise    -$1,000.00  USD  [BofA]
                              +$1,000.00  USD  [Wise]
```

**Nota**: Las 2 transacciones aparecen agrupadas visualmente.

### En el panel de detalles
```
┌─────────────────────────────────────────┐
│  Transfer to Wise                       │
│  Sep 26, 2025                           │
├─────────────────────────────────────────┤
│  💰 Amount                              │
│  -$1,000.00 USD                         │
│                                         │
│  🏦 From Account                        │
│  Bank of America                        │
│                                         │
│  ↔️ Linked Transfer                     │
│  ┌─────────────────────────────────┐   │
│  │ +$1,000.00 USD                 │   │
│  │ Wise                           │   │
│  │ Sep 27, 2025 (1 day later)    │   │
│  │ [View details →]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📄 Original                            │
│  TRANSFER TO WISE                       │
│                                         │
│  [Delete pair] [Close]                  │
└─────────────────────────────────────────┘
```

**Click en "View details"** → Abre el detalle del otro lado del transfer.

---

## Confidence score explicado

El confidence score indica qué tan seguro está el pipeline de la normalización.

### Alto confidence (>80%)
```
🎯 Confidence
████████░░  85%

✓ Merchant conocido
✓ Patrón encontrado en reglas
✓ Cluster bien definido
```

### Medio confidence (50-80%)
```
🎯 Confidence
██████░░░░  65%

⚠️ Merchant nuevo
✓ Cluster encontrado (5 miembros)
```

### Bajo confidence (<50%)
```
🎯 Confidence
███░░░░░░░  35%

⚠️ Merchant desconocido
⚠️ Cluster pequeño (2 miembros)
⚠️ String muy diferente a otros
```

**Uso futuro**: el usuario puede filtrar por confidence para revisar transacciones dudosas.

---

## Delete transaction

el usuario hace click en "Delete" en el panel.

### Confirmación
```
┌─────────────────────────────────────────┐
│  ⚠️ Borrar transacción                  │
├─────────────────────────────────────────┤
│                                         │
│  ¿Borrar "Starbucks -$5.67"?           │
│                                         │
│  Esta acción no se puede deshacer.     │
│                                         │
│  También se borrará de observations.   │
│                                         │
│  [Cancelar] [Borrar]                   │
│                                         │
└─────────────────────────────────────────┘
```

### Código
```javascript
function handleDelete(transactionId) {
  const confirmed = confirm('¿Borrar esta transacción?');
  if (!confirmed) return;

  // Delete from transactions
  db.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);

  // Delete from observations
  db.execute('DELETE FROM observations WHERE canonical_id = ?', [transactionId]);

  // Close panel
  onClose();

  // Refetch timeline
  fetchTransactions();
}
```

**Nota**: Si vuelves a subir el mismo PDF, la transacción volverá a aparecer.

---

## Keyboard shortcuts

- **Esc**: Cerrar panel
- **Delete**: Borrar transacción (con confirmación)
- **←/→**: Navegar a transacción anterior/siguiente
- **Ctrl+F**: Focus en search (en timeline)

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Delete') handleDelete(txn.id);
    if (e.key === 'ArrowLeft') navigatePrevious();
    if (e.key === 'ArrowRight') navigateNext();
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## Animation

El panel **slide in** desde la derecha con animación suave.

```css
.transaction-detail {
  position: fixed;
  right: 0;
  top: 0;
  width: 40%;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0,0,0,0.1);

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
```

Al cerrar, **slide out** hacia la derecha.

---

## Edge cases

### 1. Transacción sin observation

**Síntoma**: La transacción está en `transactions` pero no hay observation linkeada.

**UI**:
```
📄 Original
⚠️ No disponible (observation eliminada)
```

---

### 2. Transfer sin pareja

**Síntoma**: `type = 'transfer'` pero `transfer_pair_id` es NULL.

**UI**:
```
↔️ Transfer
⚠️ No se encontró la otra mitad del transfer
```

**Acción sugerida**: Revisar si el otro PDF fue subido.

---

### 3. Confidence = 0

**Síntoma**: El clustering falló completamente.

**UI**:
```
🎯 Confidence
░░░░░░░░░░  0%

⚠️ Normalización manual recomendada
```

**Acción futura**: Permitir editar merchant.

---

## Mockup completo

```
┌────────────────────────────────────┬─────────────────────────────────────┐
│  Finance App         [Upload] [⚙️]  │  Transaction Details        [×]      │
├────────────────────────────────────┼─────────────────────────────────────┤
│  Filters: [BofA] [Sep 2025]        │                                     │
│                                    │  Starbucks                          │
│  Sep 28  Starbucks ◄───────────────│  Sep 28, 2025  •  10:34 AM         │
│          -$5.67 USD                │                                     │
│                                    │  ─────────────────────────────────  │
│  Sep 27  Amazon                    │                                     │
│          -$89.99 USD               │  💰 Amount                          │
│                                    │  -$5.67 USD                         │
│  Sep 26  Netflix                   │                                     │
│          -$15.99 USD               │  🏦 Account                         │
│                                    │  Bank of America (****1234)         │
│  Sep 25  Costco                    │                                     │
│          -$234.56 USD              │  🏷️ Type                           │
│                                    │  Expense                            │
│                                    │                                     │
│  127 transactions                  │  📄 Original Description            │
│                                    │  STARBUCKS STORE #12345             │
│                                    │  SANTA MONICA CA                    │
│                                    │                                     │
│                                    │  📁 Source File                     │
│                                    │  bofa_2025_09.pdf                   │
│                                    │  Line 47  •  Statement: Sep 30      │
│                                    │                                     │
│                                    │  🎯 Confidence                      │
│                                    │  ████████░░  85%                    │
│                                    │  ✓ Pattern matched: STARBUCKS.*     │
│                                    │                                     │
│                                    │  🔗 Cluster                         │
│                                    │  cluster_abc123 (12 members)        │
│                                    │  • Starbucks Store #12345           │
│                                    │  • Starbucks Store #67890           │
│                                    │  • Starbucks #11111                 │
│                                    │  ... 9 more                         │
│                                    │                                     │
│                                    │  ─────────────────────────────────  │
│                                    │                                     │
│                                    │  [🗑️ Delete]        [Close]        │
│                                    │                                     │
└────────────────────────────────────┴─────────────────────────────────────┘
```

---

## Resumen

### Qué muestra
- Info normalizada (merchant, amount, date, account)
- Info raw (original description del PDF)
- Metadata (source, line number, confidence)
- Transfers (si aplica, con link a la pareja)
- Cluster info (para debug)

### Acciones
- **Delete**: Borrar transacción (con confirmación)
- **Close**: Cerrar panel
- **Navigate**: Flechas para ir a prev/next
- **View transfer pair**: Si es transfer, ver el otro lado

### UX
- Panel slide desde derecha
- Timeline sigue visible (split screen)
- Keyboard shortcuts
- Animaciones suaves

---

**Próximo flow**: Lee [flow-4-merchant-normalization.md](flow-4-merchant-normalization.md) para entender cómo funciona la normalización.
