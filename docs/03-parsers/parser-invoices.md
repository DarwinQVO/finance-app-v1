# Parser: Invoices (Receivables)

**Config-driven parser para facturas emitidas a clientes**

---

## 🎯 Qué parsea

Este parser extrae:
- Invoice number
- Client name
- Amount due
- Invoice date
- Due date
- Status (paid/unpaid)

**Current Approach**: Config-driven parser que lee su configuración de la tabla `parser_configs` o archivo YAML.

**No más parsers hardcodeados** - Agregar un nuevo formato de invoice solo requiere agregar un config.

---

## Formato del Invoice

### Standard Format

```
INVOICE
──────────────────────────────────
Invoice #: 1234
Date: October 1, 2025

Bill To:
Cliente X Corp.
123 Main Street
City, State 12345

Description                    Amount
──────────────────────────────────
Consulting Services - Oct    $1,000.00
Software Development          $200.00

                    Subtotal: $1,200.00
                         Tax:     $0.00
                       TOTAL: $1,200.00

Payment Due: October 14, 2025
──────────────────────────────────
```

### Campos a extraer

| Campo | Ubicación | Ejemplo |
|-------|-----------|---------|
| **Invoice Number** | "Invoice #: 1234" | `1234` |
| **Date** | "Date: October 1, 2025" | `2025-10-01` |
| **Client** | "Bill To:" section | `Cliente X Corp.` |
| **Amount** | "TOTAL:" line | `1200.00` |
| **Due Date** | "Payment Due:" line | `2025-10-14` |
| **Currency** | $ or MXN or EUR | `USD` |

---

## Config-Driven Parser

### YAML Config

```yaml
# configs/parsers/invoice-standard.yaml

id: invoice_standard
name: Standard Invoice Format
type: receivable
currency: USD

parsing:
  invoice_number:
    regex: "Invoice #:\\s*(\\d+)"
    required: true

  date:
    regex: "Date:\\s*([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})"
    format: "MMMM D, YYYY"
    required: true

  client:
    regex: "Bill To:\\s*([A-Za-z0-9\\s\\.]+)"
    multiline: true
    max_lines: 3
    required: true

  amount:
    regex: "TOTAL:\\s*\\$([\\d,]+\\.\\d{2})"
    type: number
    required: true

  due_date:
    regex: "Payment Due:\\s*([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})"
    format: "MMMM D, YYYY"
    required: true

  status:
    default: "unpaid"

validation:
  amount_positive: true
  due_after_invoice: true
  client_not_empty: true

output:
  type: receivable
  source_type: invoice
```

### Variante: Spanish Invoice

```yaml
# configs/parsers/invoice-spanish.yaml

id: invoice_spanish
name: Spanish Invoice Format
type: receivable
currency: MXN

parsing:
  invoice_number:
    regex: "Factura #:\\s*(\\d+)"
    required: true

  date:
    regex: "Fecha:\\s*(\\d{1,2}\\s+de\\s+[a-z]+\\s+de\\s+\\d{4})"
    format: "D de MMMM de YYYY"
    locale: es
    required: true

  client:
    regex: "Cliente:\\s*([A-Za-zÁ-ú0-9\\s\\.]+)"
    multiline: true
    required: true

  amount:
    regex: "TOTAL:\\s*\\$([\\d,]+\\.\\d{2})"
    type: number
    required: true

  due_date:
    regex: "Vencimiento:\\s*(\\d{1,2}\\s+de\\s+[a-z]+\\s+de\\s+\\d{4})"
    format: "D de MMMM de YYYY"
    locale: es
    required: true
```

---

## Database Schema

### Receivables Table

```sql
CREATE TABLE receivables (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  -- Invoice info
  invoice_number TEXT UNIQUE,
  client_name TEXT NOT NULL,

  -- Amounts
  amount REAL NOT NULL,
  currency TEXT NOT NULL,

  -- Dates
  invoice_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_date TEXT,

  -- Status
  status TEXT DEFAULT 'pending',  -- pending | paid | overdue | cancelled

  -- Matching
  matched_transaction_id TEXT,    -- FK to transactions table
  match_confidence REAL,

  -- Source
  source_file TEXT,
  source_hash TEXT,

  -- Metadata
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (matched_transaction_id) REFERENCES transactions(id)
);

CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_due_date ON receivables(due_date);
CREATE INDEX idx_receivables_client ON receivables(client_name);
```

---

## Parsing Logic

### Step 1: Extract Text from PDF

```javascript
// Same as bank statements
const pdfText = await extractPDFText(filePath);
```

### Step 2: Apply Config Rules

```javascript
async function parseInvoice(pdfText, config) {
  const parsed = {};

  // Extract each field using config regex
  for (const [field, rules] of Object.entries(config.parsing)) {
    const regex = new RegExp(rules.regex, rules.multiline ? 'gm' : 'g');
    const match = pdfText.match(regex);

    if (match) {
      let value = match[1];

      // Apply transformations
      if (rules.type === 'number') {
        value = parseFloat(value.replace(/,/g, ''));
      } else if (rules.format) {
        value = parseDate(value, rules.format, rules.locale);
      }

      parsed[field] = value;
    } else if (rules.required) {
      throw new Error(`Required field ${field} not found`);
    } else if (rules.default) {
      parsed[field] = rules.default;
    }
  }

  return parsed;
}
```

### Step 3: Validate

```javascript
function validateInvoice(parsed, config) {
  // Amount must be positive
  if (config.validation.amount_positive && parsed.amount <= 0) {
    throw new Error('Amount must be positive');
  }

  // Due date must be after invoice date
  if (config.validation.due_after_invoice) {
    if (new Date(parsed.due_date) < new Date(parsed.invoice_date)) {
      throw new Error('Due date must be after invoice date');
    }
  }

  // Client name not empty
  if (config.validation.client_not_empty && !parsed.client.trim()) {
    throw new Error('Client name cannot be empty');
  }

  return true;
}
```

### Step 4: Insert into Database

```javascript
async function saveReceivable(parsed) {
  const id = generateId('rcv');

  await db.run(`
    INSERT INTO receivables (
      id, invoice_number, client_name, amount, currency,
      invoice_date, due_date, status, source_file, source_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id,
    parsed.invoice_number,
    parsed.client,
    parsed.amount,
    parsed.currency,
    parsed.invoice_date,
    parsed.due_date,
    parsed.status,
    parsed.source_file,
    parsed.source_hash,
    new Date().toISOString(),
    new Date().toISOString()
  );

  return id;
}
```

---

## Automatic Matching

### Match Invoice to Payment

Cuando entra un pago en tu bank statement, Finance App intenta matchearlo automáticamente:

```javascript
async function matchInvoiceToPayment(transactionId) {
  const txn = await db.get('SELECT * FROM transactions WHERE id = ?', transactionId);

  // Only match incoming payments
  if (txn.type !== 'income') return;

  // Find pending receivables with matching amount
  const candidates = await db.all(`
    SELECT * FROM receivables
    WHERE status = 'pending'
    AND ABS(amount - ?) < 0.01
    AND currency = ?
    ORDER BY due_date ASC
  `, Math.abs(txn.amount), txn.currency);

  if (candidates.length === 0) return;

  // Try to match by client name
  for (const invoice of candidates) {
    const similarity = stringSimilarity(
      invoice.client_name.toLowerCase(),
      txn.merchant.toLowerCase()
    );

    if (similarity > 0.8) {
      // Strong match
      await linkInvoiceToPayment(invoice.id, transactionId, similarity);
      return { matched: true, invoice: invoice.id, confidence: similarity };
    }
  }

  // Suggest manual matching
  return {
    matched: false,
    suggestions: candidates.map(c => ({
      invoice: c.id,
      client: c.client_name,
      amount: c.amount,
      due: c.due_date
    }))
  };
}
```

### Link Invoice to Payment

```javascript
async function linkInvoiceToPayment(receivableId, transactionId, confidence) {
  await db.run(`
    UPDATE receivables
    SET status = 'paid',
        matched_transaction_id = ?,
        match_confidence = ?,
        paid_date = ?,
        updated_at = ?
    WHERE id = ?
  `,
    transactionId,
    confidence,
    new Date().toISOString(),
    new Date().toISOString(),
    receivableId
  );

  // Also update transaction with receivable reference
  await db.run(`
    UPDATE transactions
    SET receivable_id = ?,
        updated_at = ?
    WHERE id = ?
  `, receivableId, new Date().toISOString(), transactionId);
}
```

---

## Overdue Detection

```javascript
async function detectOverdueReceivables() {
  const today = new Date().toISOString().split('T')[0];

  const overdue = await db.all(`
    SELECT * FROM receivables
    WHERE status = 'pending'
    AND due_date < ?
    ORDER BY due_date ASC
  `, today);

  // Update status
  for (const invoice of overdue) {
    await db.run(`
      UPDATE receivables
      SET status = 'overdue',
          updated_at = ?
      WHERE id = ?
    `, new Date().toISOString(), invoice.id);

    // Create alert
    await createAlert({
      type: 'INVOICE_OVERDUE',
      severity: 'HIGH',
      message: `Invoice #${invoice.invoice_number} from ${invoice.client_name} is overdue`,
      data: {
        invoice_id: invoice.id,
        client: invoice.client_name,
        amount: invoice.amount,
        due_date: invoice.due_date,
        days_overdue: daysBetween(invoice.due_date, today)
      }
    });
  }

  return overdue;
}
```

---

## UI Integration

### Upload Invoice

```javascript
// Same drag & drop as bank PDFs
<DropZone
  onDrop={async (files) => {
    for (const file of files) {
      const type = detectDocumentType(file); // 'bank_statement' | 'invoice'

      if (type === 'invoice') {
        await parseInvoice(file);
      } else {
        await parseBankStatement(file);
      }
    }
  }}
/>
```

### Receivables Dashboard

```javascript
// Show all receivables
const receivables = await db.all(`
  SELECT
    r.*,
    t.date as paid_on,
    t.merchant as paid_by
  FROM receivables r
  LEFT JOIN transactions t ON r.matched_transaction_id = t.id
  ORDER BY
    CASE r.status
      WHEN 'overdue' THEN 1
      WHEN 'pending' THEN 2
      WHEN 'paid' THEN 3
    END,
    r.due_date ASC
`);

// Display:
┌─────────────────────────────────────┐
│ Receivables Summary                 │
├─────────────────────────────────────┤
│ Total pending:  $1,700.00           │
│ Total overdue:  $1,200.00  🔴       │
│ Paid this month: $3,500.00          │
└─────────────────────────────────────┘

Overdue (2):
┌─────────────────────────────────────┐
│ Cliente X - Invoice #1234           │
│ $1,200.00                           │
│ Due: Oct 14 (5 days overdue)   🔴  │
└─────────────────────────────────────┘

Pending (1):
┌─────────────────────────────────────┐
│ Cliente Y - Invoice #1235           │
│ $500.00                             │
│ Due: Oct 20 (in 5 days)        🟡  │
└─────────────────────────────────────┘
```

---

## Loan Tracking (Special Case)

Para préstamos personales (no invoices formales):

```javascript
// Manual entry cuando haces transfer
async function createLoan(data) {
  const id = generateId('loan');

  await db.run(`
    INSERT INTO receivables (
      id, invoice_number, client_name, amount, currency,
      invoice_date, due_date, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id,
    `LOAN-${id.slice(-8)}`,  // Auto-generate "invoice" number
    data.person_name,         // "Juan"
    data.amount,              // 400
    data.currency,            // USD
    data.transfer_date,       // Today
    data.expected_return,     // Nov 1, 2025
    'pending',
    data.notes,               // "Préstamo personal"
    new Date().toISOString(),
    new Date().toISOString()
  );

  // Link to transfer transaction
  if (data.transaction_id) {
    await db.run(`
      UPDATE receivables
      SET matched_transaction_id = ?
      WHERE id = ?
    `, data.transaction_id, id);
  }

  return id;
}
```

UI muestra:
```
Loans Out (prestaste):
┌─────────────────────────────────────┐
│ Juan - Personal Loan                │
│ $400.00                             │
│ Due: Nov 1 (in 10 days)             │
│ Notes: Préstamo personal            │
└─────────────────────────────────────┘
```

---

## Extensibility

### Add New Invoice Format

1. **Create YAML config**:
```yaml
# configs/parsers/invoice-quickbooks.yaml
id: invoice_quickbooks
name: QuickBooks Invoice
type: receivable
# ... field mappings
```

2. **Upload invoice** → Finance App auto-detects format → Parsea

3. **Done** ✅

### CSV Import

```javascript
// Import from accounting software CSV export
async function importReceivablesCSV(filePath) {
  const rows = await parseCSV(filePath);

  for (const row of rows) {
    await saveReceivable({
      invoice_number: row['Invoice #'],
      client: row['Customer'],
      amount: parseFloat(row['Amount']),
      currency: row['Currency'] || 'USD',
      invoice_date: row['Date'],
      due_date: row['Due Date'],
      status: row['Status'].toLowerCase()
    });
  }
}
```

---

## Summary

**Invoice parser provides**:
- ✅ Parse invoices from PDF/CSV
- ✅ Track receivables (cuentas por cobrar)
- ✅ Automatic payment matching
- ✅ Overdue detection & alerts
- ✅ Loan tracking (special case)
- ✅ Config-driven (no hardcoding)
- ✅ Multi-currency support

**Next doc**: [ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md) para schema completo
