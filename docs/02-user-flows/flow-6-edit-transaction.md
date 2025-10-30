# Flow 6: Edit Transaction

**Cómo el usuario puede corregir transacciones mal normalizadas**

---

## Funcionalidad

Permite editar transacciones para corregir normalizaciones incorrectas.

**Casos típicos**:
```
"TRADER JOES #123" → corregir a "Trader Joe's"
"SALARY DEPOSIT" → cambiar tipo de expense a income
"TRANSFER TO WISE" → re-linkear correctamente
```

---

## Story: el usuario corrige un merchant

### Escena 1: el usuario ve un merchant mal normalizado

el usuario está viendo su timeline:

```
┌──────────────────────────────────────────────────┐
│  Sep 28  Trader                 -$45.67  USD    │  ← ❌ Mal normalizado
│  Sep 27  Amazon                 -$89.99  USD    │
│  Sep 26  Starbucks              -$5.67   USD    │
└──────────────────────────────────────────────────┘
```

el usuario hace **click** en "Trader" para ver detalles.

---

### Escena 2: Panel de detalles con botón Edit

```
┌────────────────────────┬─────────────────────────┐
│  Timeline              │  Transaction Details    │
├────────────────────────┼─────────────────────────┤
│  Sep 28  Trader   ◄────│  Trader                 │
│  Sep 27  Amazon        │  Sep 28, 2025           │
│  Sep 26  Starbucks     │                         │
│                        │  💰 Amount              │
│                        │  -$45.67 USD            │
│                        │                         │
│                        │  🏦 Account             │
│                        │  Bank of America        │
│                        │                         │
│                        │  📄 Original            │
│                        │  TRADER JOES #123       │
│                        │                         │
│                        │  [✏️ Edit] [Delete]     │
└────────────────────────┴─────────────────────────┘
```

el usuario hace **click en "Edit"**.

---

### Escena 3: Edit mode

El panel cambia a modo edición:

```
┌─────────────────────────────────────────┐
│  Edit Transaction              [×]      │
├─────────────────────────────────────────┤
│                                         │
│  Merchant *                             │
│  [Trader Joe's            ]  ← Editable│
│                                         │
│  Amount *                               │
│  [-$45.67                 ]  ← Editable│
│                                         │
│  Currency *                             │
│  [USD ▾]                                │
│                                         │
│  Type *                                 │
│  ⚪ Expense  ⚪ Income  ⚪ Transfer      │
│                                         │
│  Date *                                 │
│  [2025-09-28              ]             │
│                                         │
│  Account                                │
│  Bank of America           (read-only) │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📄 Original Description (read-only)   │
│  TRADER JOES #123                       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [Cancel]  [Save Changes]               │
│                                         │
└─────────────────────────────────────────┘
```

el usuario cambia:
- Merchant: "Trader" → "Trader Joe's"
- Hace click en **"Save Changes"**

---

### Escena 4: Confirmation

```
┌─────────────────────────────────────────┐
│  ✅ Changes Saved                       │
├─────────────────────────────────────────┤
│                                         │
│  Transaction updated successfully.      │
│                                         │
│  Changes will be preserved even if you  │
│  re-upload this PDF.                    │
│                                         │
│  [Ok]                                   │
│                                         │
└─────────────────────────────────────────┘
```

---

### Escena 5: Timeline actualizado

```
┌──────────────────────────────────────────────────┐
│  Sep 28  Trader Joe's ✏️        -$45.67  USD    │  ← ✅ Corregido
│  Sep 27  Amazon                 -$89.99  USD    │
│  Sep 26  Starbucks              -$5.67   USD    │
└──────────────────────────────────────────────────┘
```

**Nota el icono ✏️**: Indica que esta transaction fue editada manualmente.

---

## Campos Editables

### ✅ Editable
| Campo | Validación | Ejemplo |
|-------|------------|---------|
| **merchant** | Min 1 char, max 200 | "Trader Joe's" |
| **amount** | Número, no cero | -45.67 |
| **currency** | USD, MXN, EUR | USD |
| **type** | expense, income, transfer | expense |
| **date** | ISO format, not future | 2025-09-28 |

### ❌ NO Editable (Read-only)
- **account**: No puede cambiar de cuenta (integrity)
- **original_description**: Siempre refleja el PDF original
- **source_file**: De qué PDF vino
- **source_hash**: Hash del PDF
- **created_at**: Timestamp de creación

---

## Database Schema: Tracking Edits

Usamos campos existentes en `transactions` table:

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,

  -- Editable fields
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,

  -- Original values (immutable)
  original_description TEXT NOT NULL,  -- Nunca cambia

  -- Edit tracking
  is_edited BOOLEAN DEFAULT FALSE,     -- True si fue editado
  edited_fields TEXT,                  -- JSON: ["merchant", "type"]
  edited_at TEXT,                      -- ISO timestamp

  -- ...otros campos
);
```

---

## Code: Edit Transaction

```javascript
// renderer/components/EditTransactionDialog.jsx

function EditTransactionDialog({ transaction, onClose, onSave }) {
  const [formData, setFormData] = useState({
    merchant: transaction.merchant,
    amount: transaction.amount,
    currency: transaction.currency,
    type: transaction.type,
    date: transaction.date,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });

    // Clear error for this field
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const validate = () => {
    const newErrors = {};

    // Merchant
    if (!formData.merchant || formData.merchant.trim().length === 0) {
      newErrors.merchant = 'Merchant is required';
    }
    if (formData.merchant.length > 200) {
      newErrors.merchant = 'Merchant too long (max 200 chars)';
    }

    // Amount
    if (isNaN(formData.amount) || formData.amount === 0) {
      newErrors.amount = 'Amount must be a non-zero number';
    }

    // Date
    const date = new Date(formData.date);
    const today = new Date();
    if (date > today) {
      newErrors.date = 'Date cannot be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    // Detect which fields changed
    const editedFields = [];
    if (formData.merchant !== transaction.merchant) editedFields.push('merchant');
    if (formData.amount !== transaction.amount) editedFields.push('amount');
    if (formData.currency !== transaction.currency) editedFields.push('currency');
    if (formData.type !== transaction.type) editedFields.push('type');
    if (formData.date !== transaction.date) editedFields.push('date');

    if (editedFields.length === 0) {
      // No changes, just close
      onClose();
      return;
    }

    // Save to DB
    await window.electron.updateTransaction({
      id: transaction.id,
      ...formData,
      is_edited: true,
      edited_fields: JSON.stringify(editedFields),
      edited_at: new Date().toISOString(),
    });

    // Show confirmation
    alert('Changes saved successfully!');

    onSave();
    onClose();
  };

  return (
    <div className="edit-transaction-dialog">
      <h2>Edit Transaction</h2>

      {/* Merchant */}
      <div className="form-field">
        <label>Merchant *</label>
        <input
          type="text"
          value={formData.merchant}
          onChange={(e) => handleChange('merchant', e.target.value)}
          maxLength={200}
        />
        {errors.merchant && <span className="error">{errors.merchant}</span>}
      </div>

      {/* Amount */}
      <div className="form-field">
        <label>Amount *</label>
        <input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
        />
        {errors.amount && <span className="error">{errors.amount}</span>}
      </div>

      {/* Currency */}
      <div className="form-field">
        <label>Currency *</label>
        <select
          value={formData.currency}
          onChange={(e) => handleChange('currency', e.target.value)}
        >
          <option value="USD">USD</option>
          <option value="MXN">MXN</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      {/* Type */}
      <div className="form-field">
        <label>Type *</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              checked={formData.type === 'expense'}
              onChange={() => handleChange('type', 'expense')}
            />
            Expense
          </label>
          <label>
            <input
              type="radio"
              checked={formData.type === 'income'}
              onChange={() => handleChange('type', 'income')}
            />
            Income
          </label>
          <label>
            <input
              type="radio"
              checked={formData.type === 'transfer'}
              onChange={() => handleChange('type', 'transfer')}
            />
            Transfer
          </label>
        </div>
      </div>

      {/* Date */}
      <div className="form-field">
        <label>Date *</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => handleChange('date', e.target.value)}
        />
        {errors.date && <span className="error">{errors.date}</span>}
      </div>

      {/* Read-only section */}
      <div className="read-only-section">
        <h3>Original (read-only)</h3>
        <p><strong>Description:</strong> {transaction.original_description}</p>
        <p><strong>Account:</strong> {transaction.account}</p>
        <p><strong>Source:</strong> {transaction.source_file}</p>
      </div>

      {/* Actions */}
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={handleSave} className="primary">Save Changes</button>
      </div>
    </div>
  );
}
```

---

## Backend: Update Transaction

```javascript
// main/ipc-handlers.js

ipcMain.handle('update-transaction', async (event, updates) => {
  const { id, merchant, amount, currency, type, date, is_edited, edited_fields, edited_at } = updates;

  // Update transaction
  await db.run(`
    UPDATE transactions
    SET
      merchant = ?,
      amount = ?,
      currency = ?,
      type = ?,
      date = ?,
      is_edited = ?,
      edited_fields = ?,
      edited_at = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    merchant,
    amount,
    currency,
    type,
    date,
    is_edited ? 1 : 0,
    edited_fields,
    edited_at,
    new Date().toISOString(),
    id
  ]);

  return { success: true };
});
```

---

## Visual Indicator: Edited Icon

En el timeline, las transactions editadas muestran un icono ✏️:

```javascript
// renderer/components/TimelineRow.jsx

function TimelineRow({ transaction }) {
  return (
    <div className="timeline-row" onClick={() => openDetails(transaction.id)}>
      <span className="date">{formatDate(transaction.date)}</span>
      <span className="merchant">
        {transaction.merchant}
        {transaction.is_edited && <span className="edited-icon" title="Manually edited">✏️</span>}
      </span>
      <span className="amount">{formatAmount(transaction.amount, transaction.currency)}</span>
    </div>
  );
}
```

**CSS**:
```css
.edited-icon {
  margin-left: 4px;
  font-size: 12px;
  opacity: 0.6;
  cursor: help;
}

.edited-icon:hover {
  opacity: 1.0;
}
```

---

## Re-upload Behavior

**Pregunta**: Si el usuario edita una transaction y luego re-sube el mismo PDF, ¿qué pasa?

**Respuesta**: **Preserve edits** (no overwrite).

### Lógica en Upload

```javascript
// main/pipeline/extract-from-pdf.js

async function extractFromPDF({ file, accountId, config }) {
  const hash = computeHash(file.path);

  // Check if already processed
  const existingTransactions = await db.all(`
    SELECT id, is_edited, edited_fields
    FROM transactions
    WHERE source_hash = ?
  `, hash);

  if (existingTransactions.length > 0) {
    // PDF already uploaded

    // Check if any edited
    const editedCount = existingTransactions.filter(t => t.is_edited).length;

    if (editedCount > 0) {
      // Show warning dialog
      return {
        status: 'already_uploaded',
        reason: `This PDF was already processed. ${editedCount} transactions were manually edited and will be preserved.`,
        transactions: []
      };
    } else {
      // No edits, just skip
      return {
        status: 'skipped',
        reason: 'Already processed',
        transactions: []
      };
    }
  }

  // Process PDF normally...
}
```

**Resultado**: Las edits se preservan. El PDF no se re-procesa.

---

## Edge Cases

### 1. User edita y luego quiere revertir

**Opción 1**: Botón "Revert to Original" en edit dialog

```javascript
const handleRevert = async () => {
  // Restaurar valores originales
  await window.electron.updateTransaction({
    id: transaction.id,
    merchant: transaction.original_description,  // Restaurar
    amount: transaction.amount,  // (amount original no se guarda actualmente)
    is_edited: false,
    edited_fields: null,
    edited_at: null,
  });
};
```

**Problema**: No guardamos `original_amount`, `original_type`, etc.

**Solución Phase 2**: Agregar campos `original_*` para todos los editables.

**Solución Phase 1**: Solo revertir merchant (es lo más común).

---

### 2. User edita amount y luego transfer linking falla

**Síntoma**: User edita transfer de $1,000 → $1,001. Transfer linking ya no encuentra pareja.

**Solución**: Cuando user edita amount en transfer, mostrar warning:

```
⚠️ Warning: Changing the amount may break transfer linking.

Transfer pair: [View pair →]

Continue editing?

[Cancel] [Continue]
```

---

### 3. User edita type de "expense" a "transfer"

**Síntoma**: User cambia type pero no hay transfer pair.

**Solución**: Auto-run transfer linking cuando type cambia a "transfer":

```javascript
const handleSave = async () => {
  // ... validación ...

  await window.electron.updateTransaction(updates);

  // Si cambió a transfer, buscar pareja
  if (formData.type === 'transfer' && transaction.type !== 'transfer') {
    await window.electron.runTransferLinking([transaction.id]);
  }
};
```

---

### 4. Multiple edits al mismo tiempo

**Síntoma**: User abre 2 edit dialogs para la misma transaction.

**Solución**: Lock transaction mientras se edita:

```javascript
// Estado global
const editingTransactions = new Set();

const handleEdit = (transactionId) => {
  if (editingTransactions.has(transactionId)) {
    alert('This transaction is already being edited.');
    return;
  }

  editingTransactions.add(transactionId);
  openEditDialog(transactionId);
};

const handleClose = (transactionId) => {
  editingTransactions.delete(transactionId);
};
```

---

## Validación Completa

```javascript
function validateTransactionEdit(formData, original) {
  const errors = {};

  // Merchant
  if (!formData.merchant || formData.merchant.trim() === '') {
    errors.merchant = 'Merchant cannot be empty';
  }
  if (formData.merchant.length > 200) {
    errors.merchant = 'Merchant too long (max 200 characters)';
  }

  // Amount
  if (isNaN(formData.amount)) {
    errors.amount = 'Amount must be a number';
  }
  if (formData.amount === 0) {
    errors.amount = 'Amount cannot be zero';
  }

  // Currency
  const validCurrencies = ['USD', 'MXN', 'EUR', 'GBP', 'CAD'];
  if (!validCurrencies.includes(formData.currency)) {
    errors.currency = 'Invalid currency';
  }

  // Type
  const validTypes = ['expense', 'income', 'transfer'];
  if (!validTypes.includes(formData.type)) {
    errors.type = 'Invalid type';
  }

  // Date
  const date = new Date(formData.date);
  const today = new Date();
  if (isNaN(date.getTime())) {
    errors.date = 'Invalid date';
  }
  if (date > today) {
    errors.date = 'Date cannot be in the future';
  }
  const minDate = new Date('2000-01-01');
  if (date < minDate) {
    errors.date = 'Date too old (before 2000)';
  }

  return errors;
}
```

---

## UI States

### Loading state

Mientras se guarda:

```
┌─────────────────────────────────────────┐
│  Edit Transaction                       │
├─────────────────────────────────────────┤
│                                         │
│  💾 Saving changes...                   │
│                                         │
│  [Cancel disabled]  [Save disabled]     │
│                                         │
└─────────────────────────────────────────┘
```

### Error state

Si save falla:

```
┌─────────────────────────────────────────┐
│  ❌ Save Failed                         │
├─────────────────────────────────────────┤
│                                         │
│  Could not save changes to database.    │
│                                         │
│  Please try again or contact support.  │
│                                         │
│  [Ok]                                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

En edit dialog:

- **Ctrl+S**: Save changes
- **Esc**: Cancel (sin guardar)
- **Tab**: Navigate entre campos

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [formData]);
```

---

## Mockup Completo

```
┌──────────────────────────┬─────────────────────────────────────┐
│  Timeline                │  Edit Transaction          [×]      │
├──────────────────────────┼─────────────────────────────────────┤
│  Sep 28  Trader     ◄────│                                     │
│  Sep 27  Amazon          │  Merchant *                         │
│  Sep 26  Starbucks       │  [Trader Joe's             ]        │
│                          │                                     │
│                          │  Amount *                           │
│                          │  [-$45.67                  ]        │
│                          │                                     │
│                          │  Currency *                         │
│                          │  [USD ▾]                            │
│                          │                                     │
│                          │  Type *                             │
│                          │  ● Expense  ○ Income  ○ Transfer   │
│                          │                                     │
│                          │  Date *                             │
│                          │  [2025-09-28               ]        │
│                          │                                     │
│                          │  Account (read-only)                │
│                          │  Bank of America                    │
│                          │                                     │
│                          │  ───────────────────────────────    │
│                          │                                     │
│                          │  📄 Original (read-only)            │
│                          │  TRADER JOES #123                   │
│                          │                                     │
│                          │  Source: bofa_2025_09.pdf           │
│                          │  Line: 47                           │
│                          │                                     │
│                          │  ───────────────────────────────    │
│                          │                                     │
│                          │  [Revert to Original]               │
│                          │                                     │
│                          │  [Cancel]  [Save Changes]  (Ctrl+S)│
│                          │                                     │
└──────────────────────────┴─────────────────────────────────────┘
```

---

## Resumen

### Qué se puede editar
- ✅ Merchant (normalizado)
- ✅ Amount
- ✅ Currency
- ✅ Type (expense/income/transfer)
- ✅ Date

### Qué NO se puede editar
- ❌ Account (integrity)
- ❌ Original description (immutable)
- ❌ Source file/hash (provenance)

### Tracking
- `is_edited` = TRUE
- `edited_fields` = JSON array ["merchant", "type"]
- `edited_at` = ISO timestamp
- Visual icon ✏️ en timeline

### Re-upload behavior
- **Preserve edits** (no overwrite)
- PDF no se re-procesa si tiene edits
- Warning dialog si user intenta

### Validación
- Merchant: not empty, max 200 chars
- Amount: not zero, valid number
- Date: not future, not before 2000
- Type: expense | income | transfer
- Currency: USD | MXN | EUR

---

**Próximo**: Lee [flow-7-add-account.md](flow-7-add-account.md) para agregar nuevas cuentas.
