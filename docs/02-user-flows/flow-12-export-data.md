# Flow 12: Export Data 📤

**Export a CSV, PDF, o JSON**

## Funcionalidad

Export de transactions y reports en múltiples formatos para sharing y backup.

**Formatos soportados**:
1. **CSV** - Excel-compatible, con field selection configurable
2. **PDF** - Reports profesionales con charts y tablas
3. **JSON** - API-friendly con estructuras configurables

**Options**:
- Export current view (filtered)
- Export all transactions
- Export selected transactions
- Custom field selection
- Pretty/minified (JSON)
- Include charts (PDF)

---

## Implementación: Export engines

el usuario puede exportar:
1. **CSV** - Para Excel, Google Sheets
2. **PDF** - Report profesional para compartir
3. **JSON** - Para integración con otros tools

**Click "Export" → Selecciona formato → Listo**.

---

## Story: el usuario exporta data para su contador

### Escena 1: Export transactions a CSV

el usuario quiere enviar todas sus transacciones de 2025 a su contador.

**Hace esto**:
1. Filter: [All accounts] [2025] [All types]
2. Click en "Export" button (top right)

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Export Data                    [×]     │
├─────────────────────────────────────────┤
│  What to export:                        │
│  ● Current view (2,451 transactions)    │
│  ○ All transactions (12,034 total)      │
│  ○ Selected (0 selected)                │
│                                         │
│  Format:                                │
│  ● CSV (Excel-compatible)               │
│  ○ PDF (Report)                         │
│  ○ JSON (API/Integration)               │
│                                         │
│  Include:                               │
│  [☑] Date                               │
│  [☑] Merchant                           │
│  [☑] Amount                             │
│  [☑] Currency                           │
│  [☑] Type                               │
│  [☑] Account                            │
│  [☑] Category                           │
│  [☑] Tags                               │
│  [ ] Original description               │
│  [ ] Source file                        │
│                                         │
│  [Cancel]  [Export]                     │
└─────────────────────────────────────────┘
```

3. Deja defaults seleccionados
4. Click "Export"

**Ve confirmación**:
```
┌─────────────────────────────────────────┐
│  ✓ Export Complete                      │
├─────────────────────────────────────────┤
│  transactions_2025.csv                  │
│  has been saved to Downloads            │
│                                         │
│  2,451 transactions • 325 KB            │
│                                         │
│  [Open File] [Open Folder] [Close]      │
└─────────────────────────────────────────┘
```

---

### Escena 2: CSV format

el usuario abre el CSV en Excel:

```csv
Date,Merchant,Amount,Currency,Type,Account,Category,Tags
2025-09-28,Starbucks,-5.67,USD,expense,bofa,Food & Dining,""
2025-09-27,Amazon,-89.99,USD,expense,apple-card,Shopping,"online,electronics"
2025-09-26,Salary deposit,3500.00,USD,income,bofa,Income,""
2025-09-25,Netflix,-15.99,USD,expense,apple-card,Entertainment,subscription
...
```

**Perfecto**: Su contador puede abrir esto directamente en Excel.

---

### Escena 3: Export report a PDF

el usuario quiere enviar un report visual a su financial advisor.

**Hace esto**:
1. Abre report "Spending by Category"
2. Click "Export" en el report

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Export Report                  [×]     │
├─────────────────────────────────────────┤
│  Report: Spending by Category           │
│  Period: Last 3 months                  │
│                                         │
│  Format:                                │
│  ● PDF (with charts)                    │
│  ○ CSV (data only)                      │
│                                         │
│  Include in PDF:                        │
│  [☑] Cover page                         │
│  [☑] Charts                             │
│  [☑] Data tables                        │
│  [☑] Summary statistics                 │
│  [☑] Generated date                     │
│                                         │
│  [Cancel]  [Export to PDF]              │
└─────────────────────────────────────────┘
```

3. Click "Export to PDF"

**Ve confirmación**:
```
┌─────────────────────────────────────────┐
│  ✓ PDF Generated                        │
├─────────────────────────────────────────┤
│  spending_by_category_2025.pdf          │
│  has been saved to Downloads            │
│                                         │
│  3 pages • 847 KB                       │
│                                         │
│  [Open PDF] [Share via Email] [Close]   │
└─────────────────────────────────────────┘
```

---

### Escena 4: PDF format

el usuario abre el PDF. Ve esto:

```
┌──────────────────────────────────────────┐
│                                          │
│       Finance App Report                 │
│                                          │
│    Spending by Category                  │
│    October 1 - December 31, 2025         │
│                                          │
│    Generated: Dec 31, 2025               │
│    Total transactions: 2,451             │
│    Total spending: $7,575                │
│                                          │
└──────────────────────────────────────────┘

--- Page 2 ---

┌──────────────────────────────────────────┐
│  Spending by Category                    │
│                                          │
│  [PIE CHART IMAGE]                       │
│                                          │
│  Housing        $4,950  (65%)            │
│  Food & Dining  $1,350  (18%)            │
│  Shopping         $900  (12%)            │
│  ...                                     │
└──────────────────────────────────────────┘

--- Page 3 ---

┌──────────────────────────────────────────┐
│  Detailed Breakdown                      │
│                                          │
│  Category          Amount   Count  Avg   │
│  Housing          $4,950    127   $38.98 │
│  Food & Dining    $1,350     89   $15.17 │
│  Shopping           $900     45   $20.00 │
│  ...                                     │
│                                          │
│  Generated with Finance App v1.0         │
└──────────────────────────────────────────┘
```

**Perfecto**: Report profesional listo para compartir.

---

### Escena 5: Export a JSON (API integration)

el usuario tiene un custom analytics tool que lee JSON.

**Hace esto**:
1. Timeline → Export → JSON

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Export to JSON                 [×]     │
├─────────────────────────────────────────┤
│  What to export:                        │
│  ● Current view (2,451 transactions)    │
│                                         │
│  JSON format:                           │
│  ● Pretty (readable)                    │
│  ○ Minified (compact)                   │
│                                         │
│  Structure:                             │
│  ● Array of objects                     │
│  ○ Nested by month                      │
│  ○ Nested by account                    │
│                                         │
│  [Cancel]  [Export JSON]                │
└─────────────────────────────────────────┘
```

2. Click "Export JSON"

**Result** (`transactions_2025.json`):
```json
[
  {
    "id": "txn_abc123",
    "date": "2025-09-28",
    "merchant": "Starbucks",
    "amount": -5.67,
    "currency": "USD",
    "type": "expense",
    "account": "bofa",
    "category": "Food & Dining",
    "tags": [],
    "original_description": "STARBUCKS STORE #12345"
  },
  {
    "id": "txn_def456",
    "date": "2025-09-27",
    "merchant": "Amazon",
    "amount": -89.99,
    "currency": "USD",
    "type": "expense",
    "account": "apple-card",
    "category": "Shopping",
    "tags": ["online", "electronics"],
    "original_description": "AMAZON.COM*234JK8H9"
  }
]
```

**Perfecto**: el usuario puede importar esto directamente a su analytics tool.

---

## Cómo funciona: Export engines

### CSV export

```javascript
async function exportToCSV(transactions, filename) {
  const headers = [
    'Date',
    'Merchant',
    'Amount',
    'Currency',
    'Type',
    'Account',
    'Category',
    'Tags',
    'Notes'
  ];

  const rows = transactions.map(txn => [
    txn.date,
    txn.merchant,
    txn.amount,
    txn.currency,
    txn.type,
    txn.account,
    txn.category || '',
    txn.tags ? JSON.parse(txn.tags).join(', ') : '',
    txn.notes || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Write to file
  const fs = require('fs');
  const path = require('path');
  const filepath = path.join(app.getPath('downloads'), filename);

  fs.writeFileSync(filepath, csv, 'utf-8');

  return filepath;
}
```

---

### PDF export

```javascript
const PDFDocument = require('pdfkit');

async function exportToPDF(reportData, filename) {
  const doc = new PDFDocument();
  const filepath = path.join(app.getPath('downloads'), filename);

  doc.pipe(fs.createWriteStream(filepath));

  // Cover page
  doc.fontSize(24).text('Finance App Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(18).text(reportData.config.name, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

  // Charts (convert to image first)
  if (reportData.chart) {
    doc.addPage();
    doc.image(reportData.chart.imageData, 50, 50, { width: 500 });
  }

  // Data table
  doc.addPage();
  doc.fontSize(16).text('Detailed Breakdown');
  doc.moveDown();

  const tableTop = doc.y;
  const colWidths = [150, 100, 100, 100];
  let y = tableTop;

  // Headers
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Category', 50, y, { width: colWidths[0] });
  doc.text('Total', 200, y, { width: colWidths[1] });
  doc.text('Count', 300, y, { width: colWidths[2] });
  doc.text('Average', 400, y, { width: colWidths[3] });

  y += 20;

  // Data rows
  doc.font('Helvetica');
  reportData.data.forEach(row => {
    doc.text(row.category || 'N/A', 50, y, { width: colWidths[0] });
    doc.text(`$${row.total.toFixed(2)}`, 200, y, { width: colWidths[1] });
    doc.text(row.count.toString(), 300, y, { width: colWidths[2] });
    doc.text(`$${row.average.toFixed(2)}`, 400, y, { width: colWidths[3] });

    y += 20;
  });

  doc.end();

  return filepath;
}
```

---

### JSON export

```javascript
async function exportToJSON(data, filename, options = {}) {
  const { pretty = true, structure = 'array' } = options;

  let output;

  if (structure === 'array') {
    output = data;
  } else if (structure === 'nested-month') {
    output = nestByMonth(data);
  } else if (structure === 'nested-account') {
    output = nestByAccount(data);
  }

  const json = pretty
    ? JSON.stringify(output, null, 2)
    : JSON.stringify(output);

  const filepath = path.join(app.getPath('downloads'), filename);

  fs.writeFileSync(filepath, json, 'utf-8');

  return filepath;
}

function nestByMonth(transactions) {
  const nested = {};

  transactions.forEach(txn => {
    const month = txn.date.substring(0, 7); // YYYY-MM
    if (!nested[month]) {
      nested[month] = [];
    }
    nested[month].push(txn);
  });

  return nested;
}
```

---

## Export options

### Filters before export

el usuario puede filtrar antes de exportar:

```
Timeline → Filter to "Food & Dining" only → Export CSV
→ Solo exports Food transactions
```

---

### Selected transactions

el usuario puede seleccionar específicas transactions:

```
Timeline → Shift+Click para seleccionar 10 transactions → Export → "Selected (10)"
→ Solo exports esas 10
```

---

### Custom fields

el usuario puede elegir qué columnas incluir:

```
Export dialog:
[☑] Date
[☑] Merchant
[☑] Amount
[ ] Currency (desmarcar si solo usa USD)
[ ] Original description (muy largo para CSV)
```

---

## Edge cases

### Edge case 1: Export con edits

**Escenario**: el usuario editó algunas transactions manualmente. ¿Exportar original o edited?

**Lógica**: Exportar current state (edited values), pero incluir `is_edited` flag en JSON.

```json
{
  "merchant": "Trader Joe's",
  "original_merchant": "TRADER JOE'S #234",
  "is_edited": true,
  "edited_fields": ["merchant"]
}
```

---

### Edge case 2: Large export

**Escenario**: el usuario exporta 50,000 transactions (CSV = 15MB).

**UI**:
```
┌─────────────────────────────────────────┐
│  ⏳ Exporting...                        │
├─────────────────────────────────────────┤
│  Processing 50,000 transactions...      │
│                                         │
│  ████████████░░░░░░░░  67%              │
│                                         │
│  Estimated time: 15 seconds             │
│                                         │
│  [Cancel]                               │
└─────────────────────────────────────────┘
```

**Result**: Chunked processing para no bloquear UI.

---

### Edge case 3: Attachments

**Escenario**: el usuario quiere exportar PDFs originales junto con data.

**Opción futura**:
```
Export dialog:
[☑] Include source PDFs (creates .zip)
```

**Result**: `export_2025.zip` con:
- `transactions.csv`
- `pdfs/bofa_2025_09.pdf`
- `pdfs/apple_card_2025_09.pdf`
- ...

---

## Resumen: Export Data

### Formatos soportados
- **CSV** - Excel-compatible, 2,451 rows = 325 KB
- **PDF** - Professional report con charts, 3 pages = 847 KB
- **JSON** - API-friendly, estructurado

### Export options
- Current view (filtered)
- All transactions
- Selected transactions
- Custom field selection
- Pretty or minified (JSON)

### Benefits
- **Compartir** con contador, advisor, etc
- **Backup** de data completa
- **Integration** con otros tools via JSON
- **Fast** export en <5 segundos

### Phase 3 scope
- ✅ CSV export
- ✅ PDF export (reports)
- ✅ JSON export
- ✅ Field selection
- ✅ Filter before export
- ❌ Scheduled exports (Phase 4)
- ❌ Auto-sync to Google Sheets (Phase 4)
- ❌ Include source PDFs (Phase 4)

---

**Próximo flow**: Lee [flow-13-multi-user.md](flow-13-multi-user.md) para ver cómo el usuario comparte la app con su pareja.
