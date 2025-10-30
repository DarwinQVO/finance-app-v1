# Flow 15: Manual Entry (Desktop Quick Add) 🖊️

**Phase**: 1 (Core)
**Priority**: High
**Complexity**: Low
**Related Flows**: flow-1, flow-2, flow-6

---

## 1. Problem Statement

**Problema**: No todas las transacciones vienen en PDFs bancarios:
- Gastos en efectivo (coffee shop, parking, tips)
- Transacciones de apps que no generan PDFs (Venmo, PayPal entre amigos)
- Compras pequeñas sin comprobante
- Ajustes manuales (reembolsos, correcciones)

**Problema actual**: Si solo soportamos upload de PDFs, el usuario tiene que:
1. Esperar al PDF mensual para registrar gastos en efectivo
2. O perder la información de esas transacciones
3. O usar otro sistema (Excel, notes) temporalmente

**Impacto**: Finance App no refleja la realidad completa de el usuario's finances.

---

## 2. Solution Overview

**Solución**: **Quick Add Form** - Un dialog/drawer que permite crear transacciones manualmente en ~10 segundos.

**Características clave**:
1. **Auto-complete inteligente** - Sugiere merchants, categories, accounts basado en historial
2. **Validación en tiempo real** - Detecta errores antes de submit
3. **Duplicate detection** - Alerta si existe transacción similar
4. **Smart defaults** - Pre-llena campos comunes (account, currency, date=today)
5. **Keyboard shortcuts** - `Cmd+N` para abrir Quick Add desde cualquier vista

**UX Goal**: Agregar transacción debe ser más rápido que sacar el celular y abrir otra app.

---

## 3. User Story: el usuario agrega un gasto en efectivo

### Context
el usuario compró un café ($4.50) en efectivo en "Blue Bottle Coffee". Llegó a casa, abrió Finance App, y quiere registrar el gasto.

### Narrative

**10:30 AM - el usuario abre Finance App**

el usuario está en el Timeline view revisando sus gastos del día. Recuerda que pagó el café en efectivo.

**Action**: Presiona `Cmd+N` (o click en botón "+ Add Transaction" en toolbar)

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├─────────────────────────────────────────────────┤
│                                                 │
│  📅 Timeline                     Cmd+N pressed  │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  + Add Transaction          [Quick Add]   │ │
│  │  ────────────────────────────────────────│ │
│  │                                           │ │
│  │  Amount *                                 │ │
│  │  ┌────────┐ ┌─────────┐                  │ │
│  │  │ $      │ │ USD ▼   │                  │ │
│  │  └────────┘ └─────────┘                  │ │
│  │                                           │ │
│  │  Merchant *                               │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ Blue Bot...                       ▼ │ │ <- Auto-complete dropdown
│  │  └─────────────────────────────────────┘ │ │
│  │   🔍 Blue Bottle Coffee (3 past txns)    │ │
│  │   🔍 Blue Hill Bakery                    │ │
│  │                                           │ │
│  │  Date *                                   │ │
│  │  ┌───────────┐                            │ │
│  │  │ Today ▼   │ (Oct 29, 2025)            │ │
│  │  └───────────┘                            │ │
│  │                                           │ │
│  │  Account *                                │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ 💵 Cash                           ▼ │ │ <- Detected from past
│  │  └─────────────────────────────────────┘ │ │
│  │                                           │ │
│  │  Category                                 │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ ☕ Food & Dining                   ▼ │ │ <- Auto-suggested
│  │  └─────────────────────────────────────┘ │ │
│  │   (Auto-suggested from "Blue Bottle")    │ │
│  │                                           │ │
│  │  Tags (optional)                          │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ + Add tag                            │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  │                                           │ │
│  │  Notes (optional)                         │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │                                      │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  │                                           │ │
│  │            [Cancel]  [Add Transaction]    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Step 1: el usuario escribe el monto**

el usuario teclea `4.50` en el campo Amount.

```
Amount field:
┌────────┐ ┌─────────┐
│ $ 4.50 │ │ USD ▼   │  <- Currency pre-selected (based on account)
└────────┘ └─────────┘
```

**Step 2: el usuario empieza a escribir "Blue Bot..."**

Cuando escribe "Blu", el auto-complete activa:

```
Merchant field:
┌─────────────────────────────────────┐
│ Blu█                              ▼ │
└─────────────────────────────────────┘

Dropdown appears:
┌─────────────────────────────────────────┐
│ 🔍 Recent                               │
├─────────────────────────────────────────┤
│ ☕ Blue Bottle Coffee                   │  <- 3 past transactions
│    Last: Oct 15, 2025 ($5.20)          │
│                                         │
│ 🍞 Blue Hill Bakery                     │  <- 1 past transaction
│    Last: Sep 2, 2025 ($12.00)          │
│                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ✏️  Use "Blu" as new merchant           │
└─────────────────────────────────────────┘
```

el usuario selecciona "Blue Bottle Coffee" con `Enter`.

**Step 3: Auto-fill cascades**

Cuando el usuario selecciona el merchant conocido, Finance App auto-llena:

```
Category: ☕ Food & Dining  (from past Blue Bottle txns)
Account:  💵 Cash           (most common account for this merchant)
```

**Step 4: el usuario ajusta la fecha (opcional)**

Por defecto, Date = "Today". Si hubiera sido ayer:

```
Date field:
┌───────────┐
│ Today ▼   │ <- Click dropdown
└───────────┘

Dropdown:
┌─────────────────────┐
│ Today (Oct 29)      │  <- Default
│ Yesterday (Oct 28)  │
│ Oct 27              │
│ Oct 26              │
│ ───────────────────│
│ 📅 Custom date...    │
└─────────────────────┘
```

el usuario deja "Today" porque compró el café hoy.

**Step 5: el usuario click "Add Transaction"**

Finance App:
1. Valida campos requeridos ✅
2. Ejecuta duplicate detection
3. Crea la transacción
4. La inserta en Timeline (top, porque es hoy)

```
Success toast:
┌────────────────────────────────────┐
│ ✅ Transaction added               │
│ $4.50 at Blue Bottle Coffee       │
└────────────────────────────────────┘

Timeline updates:
┌─────────────────────────────────────┐
│ 📅 Today - Oct 29, 2025             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ☕ Blue Bottle Coffee      $4.50│ │ <- NEW (manual)
│ │ Food & Dining • Cash            │ │
│ │ 10:30 AM • Manual Entry         │ │ <- Source badge
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🛒 Whole Foods          $47.82 │ │
│ │ Groceries • Chase Visa          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Result**: Transacción agregada en 10 segundos. el usuario puede continuar usando Finance App con datos completos.

---

## 4. UI Mockups

### 4.1 Quick Add Button (Toolbar)

```
Toolbar (visible en todas las vistas):
┌─────────────────────────────────────────────────┐
│  Finance App                   [🔍] [⚙️] [+ Add]│
└─────────────────────────────────────────────────┘
                                         ↑
                                    Keyboard: Cmd+N
                                    Tooltip: "Add Transaction"
```

### 4.2 Quick Add Dialog (Empty State)

```
┌───────────────────────────────────────────┐
│  + Add Transaction                    [×] │
│  ─────────────────────────────────────────│
│                                           │
│  Amount * (required)                      │
│  ┌────────┐ ┌─────────┐                  │
│  │ $      │ │ USD ▼   │                  │
│  └────────┘ └─────────┘                  │
│  💡 Tip: Type "-45.50" for expenses      │
│                                           │
│  Merchant *                               │
│  ┌─────────────────────────────────────┐ │
│  │ Start typing...                    │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Date *                                   │
│  ┌───────────┐                            │
│  │ Today ▼   │ (Oct 29, 2025)            │
│  └───────────┘                            │
│                                           │
│  Account *                                │
│  ┌─────────────────────────────────────┐ │
│  │ Select account...                  ▼│ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Category (optional)                      │
│  ┌─────────────────────────────────────┐ │
│  │ Auto-categorize                    ▼│ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Tags (optional)                          │
│  ┌─────────────────────────────────────┐ │
│  │ + Add tag                            │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Notes (optional)                         │
│  ┌─────────────────────────────────────┐ │
│  │                                      │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  ⌨️  Tip: Press Enter to submit           │
│                                           │
│            [Cancel]  [Add Transaction]    │
│                     (Cmd+Enter)           │
└───────────────────────────────────────────┘
```

### 4.3 Auto-complete States

#### Merchant Auto-complete (Existing Merchant)
```
User typed: "starbuck"
┌─────────────────────────────────────────┐
│ starbuck█                             ▼ │
└─────────────────────────────────────────┘
 ↓
Dropdown:
┌──────────────────────────────────────────────┐
│ 🔍 Found 1 match                             │
├──────────────────────────────────────────────┤
│ ☕ Starbucks                                  │  <- Normalized merchant
│    42 transactions • Avg $5.80               │
│    Category: Food & Dining                   │
│    Last seen: Oct 20, 2025                   │
│                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ ✏️  Use "starbuck" as new merchant            │
└──────────────────────────────────────────────┘
```

#### Category Auto-suggest (After Merchant Selected)
```
Merchant selected: "Uber"
 ↓
Category field auto-fills:
┌─────────────────────────────────────┐
│ 🚗 Transportation                 ▼ │  <- Auto-suggested (90% confidence)
└─────────────────────────────────────┘
💡 Based on 15 past Uber transactions
```

### 4.4 Validation States

#### Error State (Missing Required Field)
```
User clicked "Add Transaction" without filling Amount:

Amount field:
┌────────┐ ┌─────────┐
│ $      │ │ USD ▼   │  <- Red border
└────────┘ └─────────┘
⚠️  Amount is required

Button state:
[Add Transaction] <- Disabled until valid
```

#### Warning State (Duplicate Detection)
```
el usuario tries to add:
- Blue Bottle Coffee
- $4.50
- Today
- Cash

System detects similar transaction:
┌────────────────────────────────────────┐
│ ⚠️  Possible Duplicate                 │
│                                        │
│ A similar transaction already exists:  │
│                                        │
│ ☕ Blue Bottle Coffee          $4.50  │
│ Today at 8:30 AM • Cash               │
│                                        │
│ This might be the same purchase.      │
│                                        │
│     [Go to Transaction]  [Add Anyway] │
└────────────────────────────────────────┘
```

---

## 5. Technical Implementation

### 5.1 Data Model

Manual transactions use the same `transactions` table, with `source` field = `'manual'`:

```sql
-- Same table as PDF imports
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  type TEXT CHECK(type IN ('expense', 'income', 'transfer')),
  account_id TEXT,
  category_id TEXT,
  tags TEXT, -- JSON array
  notes TEXT,

  -- Source tracking
  source TEXT CHECK(source IN ('pdf', 'manual', 'csv', 'api')),
  source_file TEXT, -- NULL for manual
  source_page INTEGER, -- NULL for manual

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Index for duplicate detection
CREATE INDEX idx_txn_duplicate_detection
ON transactions(merchant, date, ABS(amount), account_id)
WHERE source = 'manual';
```

### 5.2 Quick Add Component

```javascript
// components/QuickAddDialog.jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

function QuickAddDialog({ isOpen, onClose, onSuccess }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      amount: '',
      currency: 'USD',
      merchant: '',
      date: new Date().toISOString().split('T')[0], // Today
      accountId: '',
      categoryId: null,
      tags: [],
      notes: ''
    }
  });

  const [merchantSuggestions, setMerchantSuggestions] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const merchant = watch('merchant');

  // Auto-complete: Fetch merchant suggestions
  useEffect(() => {
    if (merchant.length < 2) {
      setMerchantSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      const suggestions = await window.api.getMerchantSuggestions(merchant);
      setMerchantSuggestions(suggestions);
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [merchant]);

  // Auto-fill: When merchant selected, suggest category & account
  const handleMerchantSelect = async (selectedMerchant) => {
    setValue('merchant', selectedMerchant.normalized_name);

    // Auto-suggest category (from past transactions)
    if (selectedMerchant.most_common_category_id) {
      setValue('categoryId', selectedMerchant.most_common_category_id);
    }

    // Auto-suggest account (from past transactions)
    if (selectedMerchant.most_common_account_id) {
      setValue('accountId', selectedMerchant.most_common_account_id);
    }

    setMerchantSuggestions([]); // Close dropdown
  };

  // Duplicate detection: Check before submit
  const onSubmit = async (data) => {
    const duplicate = await window.api.checkDuplicate({
      merchant: data.merchant,
      amount: parseFloat(data.amount),
      date: data.date,
      accountId: data.accountId
    });

    if (duplicate) {
      setDuplicateWarning(duplicate);
      return; // Show warning, don't submit yet
    }

    // Create transaction
    await createManualTransaction(data);
  };

  const createManualTransaction = async (data) => {
    try {
      const txn = await window.api.createTransaction({
        ...data,
        source: 'manual',
        type: parseFloat(data.amount) < 0 ? 'expense' : 'income',
        amount: Math.abs(parseFloat(data.amount))
      });

      onSuccess(txn);
      onClose();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction. Please try again.');
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>+ Add Transaction</DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Amount Field */}
        <FormControl error={!!errors.amount}>
          <Label>Amount *</Label>
          <Input
            {...register('amount', {
              required: 'Amount is required',
              pattern: { value: /^-?\d+\.?\d{0,2}$/, message: 'Invalid amount' }
            })}
            placeholder="45.50"
            type="text"
            autoFocus
          />
          {errors.amount && <ErrorText>{errors.amount.message}</ErrorText>}
          <HintText>💡 Tip: Use negative for expenses (e.g., -45.50)</HintText>
        </FormControl>

        {/* Merchant Field with Auto-complete */}
        <FormControl error={!!errors.merchant}>
          <Label>Merchant *</Label>
          <AutocompleteInput
            {...register('merchant', { required: 'Merchant is required' })}
            suggestions={merchantSuggestions}
            onSelect={handleMerchantSelect}
            placeholder="Start typing..."
          />
          {errors.merchant && <ErrorText>{errors.merchant.message}</ErrorText>}
        </FormControl>

        {/* Date Field */}
        <FormControl>
          <Label>Date *</Label>
          <DatePicker
            {...register('date', { required: true })}
          />
        </FormControl>

        {/* Account Field */}
        <FormControl error={!!errors.accountId}>
          <Label>Account *</Label>
          <AccountSelect
            {...register('accountId', { required: 'Account is required' })}
          />
          {errors.accountId && <ErrorText>{errors.accountId.message}</ErrorText>}
        </FormControl>

        {/* Category Field (Optional) */}
        <FormControl>
          <Label>Category</Label>
          <CategorySelect {...register('categoryId')} />
        </FormControl>

        {/* Tags Field (Optional) */}
        <FormControl>
          <Label>Tags</Label>
          <TagInput {...register('tags')} />
        </FormControl>

        {/* Notes Field (Optional) */}
        <FormControl>
          <Label>Notes</Label>
          <Textarea {...register('notes')} />
        </FormControl>

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <Alert severity="warning">
            <AlertTitle>⚠️ Possible Duplicate</AlertTitle>
            <p>A similar transaction already exists:</p>
            <TransactionCard transaction={duplicateWarning} />
            <Button onClick={() => setDuplicateWarning(null)}>Go to Transaction</Button>
            <Button onClick={() => { setDuplicateWarning(null); handleSubmit(createManualTransaction)(); }}>
              Add Anyway
            </Button>
          </Alert>
        )}

        {/* Actions */}
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Add Transaction</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

### 5.3 Backend: Merchant Suggestions

```javascript
// main/api/getMerchantSuggestions.js
const db = require('../database');

async function getMerchantSuggestions(searchTerm) {
  const normalized = searchTerm.toLowerCase().trim();

  // Search in normalization_rules (for quick match)
  const rules = await db.all(`
    SELECT
      normalized_merchant,
      COUNT(DISTINCT source_merchant) as variant_count
    FROM normalization_rules
    WHERE normalized_merchant LIKE ?
    GROUP BY normalized_merchant
    LIMIT 10
  `, [`%${normalized}%`]);

  // For each match, get stats
  const suggestions = await Promise.all(rules.map(async (rule) => {
    const stats = await db.get(`
      SELECT
        COUNT(*) as txn_count,
        AVG(amount) as avg_amount,
        MAX(date) as last_seen,
        category_id as most_common_category,
        account_id as most_common_account
      FROM transactions
      WHERE merchant = ?
      GROUP BY category_id, account_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `, [rule.normalized_merchant]);

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [stats.most_common_category]);

    return {
      normalized_name: rule.normalized_merchant,
      variant_count: rule.variant_count,
      txn_count: stats.txn_count,
      avg_amount: stats.avg_amount,
      last_seen: stats.last_seen,
      most_common_category_id: stats.most_common_category,
      most_common_category_name: category?.name,
      most_common_category_icon: category?.icon,
      most_common_account_id: stats.most_common_account
    };
  }));

  return suggestions;
}

module.exports = { getMerchantSuggestions };
```

### 5.4 Backend: Duplicate Detection

```javascript
// main/api/checkDuplicate.js
const db = require('../database');

async function checkDuplicate({ merchant, amount, date, accountId }) {
  // Look for transactions within ±2 hours on same day, same merchant, similar amount
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const duplicate = await db.get(`
    SELECT * FROM transactions
    WHERE merchant = ?
    AND ABS(amount - ?) < 0.01
    AND date >= ? AND date <= ?
    AND account_id = ?
    AND source = 'manual'
    ORDER BY created_at DESC
    LIMIT 1
  `, [merchant, Math.abs(amount), dateStart.toISOString(), dateEnd.toISOString(), accountId]);

  return duplicate || null;
}

module.exports = { checkDuplicate };
```

### 5.5 Backend: Create Transaction

```javascript
// main/api/createTransaction.js
const db = require('../database');
const { nanoid } = require('nanoid');

async function createTransaction(txnData) {
  const id = nanoid();
  const now = new Date().toISOString();

  // Validate required fields
  if (!txnData.merchant || !txnData.amount || !txnData.date || !txnData.accountId) {
    throw new Error('Missing required fields');
  }

  // Determine type from amount
  const type = txnData.amount < 0 ? 'expense' : 'income';
  const amount = Math.abs(txnData.amount);

  // Insert transaction
  await db.run(`
    INSERT INTO transactions (
      id, date, merchant, amount, currency, type,
      account_id, category_id, tags, notes,
      source, source_file, source_page,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
  `, [
    id,
    txnData.date,
    txnData.merchant,
    amount,
    txnData.currency || 'USD',
    type,
    txnData.accountId,
    txnData.categoryId || null,
    txnData.tags ? JSON.stringify(txnData.tags) : '[]',
    txnData.notes || '',
    'manual',
    now,
    now
  ]);

  // Return created transaction
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', [id]);
  return txn;
}

module.exports = { createTransaction };
```

---

## 6. Edge Cases & Solutions

### 6.1 Duplicate Detection Edge Cases

**Case**: User tries to add same transaction twice (accidentally double-click)

**Solution**:
- Detect duplicates within 2-hour window
- Show warning dialog before creating
- Allow "Add Anyway" if user confirms

**Code**:
```javascript
// In checkDuplicate, add time window check
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
WHERE created_at >= ?
```

**Case**: Legitimate duplicate (e.g., bought 2 coffees in same day)

**Solution**:
- Warning shows, but user clicks "Add Anyway"
- Both transactions exist (correct behavior)

---

### 6.2 Auto-complete Edge Cases

**Case**: Merchant has no history (completely new)

**Solution**:
- Auto-complete shows "Use 'X' as new merchant"
- No category suggestion (user must select)
- No account suggestion (user must select)

**Code**:
```javascript
// In getMerchantSuggestions
if (suggestions.length === 0) {
  return [{
    normalized_name: searchTerm,
    is_new: true,
    txn_count: 0
  }];
}
```

**Case**: Merchant has ambiguous normalization (e.g., "Amazon" could be "Amazon.com" or "Amazon Fresh")

**Solution**:
- Show all variants in dropdown
- Let user pick correct one
- Learn from user's choice for future suggestions

---

### 6.3 Validation Edge Cases

**Case**: User types amount with wrong sign (e.g., types "45.50" for an expense instead of "-45.50")

**Solution**:
- Accept both positive and negative
- Show hint: "Tip: Use negative for expenses"
- Infer type from merchant history (if expense 90% of time, assume expense)

**Code**:
```javascript
// In createTransaction
if (Math.abs(txnData.amount) === txnData.amount) {
  // User typed positive number
  const merchantStats = await db.get(
    'SELECT type, COUNT(*) as cnt FROM transactions WHERE merchant = ? GROUP BY type ORDER BY cnt DESC LIMIT 1',
    [txnData.merchant]
  );

  if (merchantStats?.type === 'expense') {
    amount = -Math.abs(txnData.amount); // Make negative
  }
}
```

**Case**: User selects future date (typo)

**Solution**:
- Allow future dates (for planned transactions)
- Show warning if > 30 days in future: "⚠️ Date is in the future"

---

### 6.4 Currency Edge Cases

**Case**: User's transaction is in different currency than account

**Solution**:
- Allow currency selection in Quick Add
- Store original currency in transaction
- Convert to account currency for aggregations (use exchange rate from date)

**Code**:
```javascript
// In createTransaction
if (txnData.currency !== account.currency) {
  const rate = await getExchangeRate(txnData.currency, account.currency, txnData.date);
  txn.amount_in_account_currency = txnData.amount * rate;
}
```

---

### 6.5 Performance Edge Cases

**Case**: User has 10,000+ transactions, auto-complete is slow

**Solution**:
- Index merchant column: `CREATE INDEX idx_merchant ON transactions(merchant)`
- Limit suggestions to 10 results
- Debounce search by 300ms

**Case**: User types very fast, auto-complete lags behind

**Solution**:
- Debounce: Wait 300ms after last keystroke before fetching
- Cancel previous request if new one starts

---

## 7. Summary

### What This Flow Covers

✅ **Manual transaction entry** from desktop
✅ **Auto-complete** for merchants, categories, accounts
✅ **Duplicate detection** to prevent double-entry
✅ **Smart defaults** to reduce typing
✅ **Keyboard shortcuts** for power users
✅ **Validation** before submit
✅ **Source tracking** (`source='manual'`) for provenance

### Scope Boundaries

**In Scope**:
- Single transaction creation
- Auto-complete based on history
- Duplicate detection (same day, same merchant)
- Basic validation (required fields, amount format)

**Out of Scope** (future enhancements):
- Bulk manual entry (use CSV import - flow-16)
- Recurring transaction setup (use flow-9)
- Transaction templates (Phase 5)
- Voice input (Phase 5)

### Impact on Other Flows

- **flow-1** (Timeline): Manual transactions appear with "Manual Entry" badge
- **flow-3** (Transaction Detail): Manual transactions show `source: manual`, no PDF link
- **flow-4** (Normalization): Manual entry merchants are normalized same as PDF merchants
- **flow-6** (Edit Transaction): Manual transactions can be edited freely (no PDF constraint)

### Why This Flow is Important

Without manual entry, Finance App only reflects PDF-imported transactions. This means:
- Cash transactions are missing
- Small purchases without receipts are missing
- Finance App is incomplete picture of reality

With manual entry:
- el usuario can log ANY transaction (cash, digital, etc.)
- Finance App becomes single source of truth
- Budget tracking is accurate (includes all spending)

**Result**: Finance App is now a complete personal finance system, not just a PDF viewer.

---

**Lines of Code**: ~650 (form + validation + auto-complete + duplicate detection)
**Testing Priority**: High (core feature for MVP)
**Dependencies**: flow-1 (timeline), flow-4 (normalization)
**Phase**: 1 (must-have for MVP)
