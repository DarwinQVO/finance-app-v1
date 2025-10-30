# Flow 16: CSV Import (Bulk Data Migration) 📊

**Phase**: 2 (Organization)
**Priority**: Medium
**Complexity**: Medium
**Related Flows**: flow-2, flow-4, flow-15

---

## 1. Problem Statement

**Problema**: el usuario tiene 2 años de transaction history en otras apps (Mint, YNAB, Excel) que quiere migrar a Finance App.

**Problemas con alternativas**:
1. **Manual entry** (flow-15): Demasiado lento para 2,000+ transactions
2. **PDF re-upload**: No todos los bancos guardan PDFs de hace 2 años
3. **Perder historial**: Empezar desde cero pierde contexto de spending patterns

**Use cases específicos**:
- Migrar desde Mint/YNAB/Personal Capital
- Importar export CSV del banco (Chase, BofA tienen CSV export)
- Bulk import de historical data desde Excel spreadsheet
- Importar transacciones de tarjetas de crédito que no generan PDF

**Impacto sin CSV import**: el usuario no puede ver trends multi-year, budgets no tienen baseline, reports están incompletos.

---

## 2. Solution Overview

**Solución**: **CSV Importer** - Upload CSV/Excel file, map columns, preview, import con deduplication.

**Características clave**:
1. **Flexible column mapping** - Detecta automáticamente formato (Mint, YNAB, custom)
2. **Preview antes de import** - Muestra primeras 10 rows para verificar
3. **Smart deduplication** - No duplica transacciones que ya existen
4. **Error handling** - Identifica rows inválidas, permite corregir o skip
5. **Batch processing** - Importa 1,000s de transacciones en segundos
6. **Rollback support** - Puede deshacer import si algo sale mal

**UX Goal**: Importar 2 años de data debe tomar < 2 minutos (upload + map + import).

---

## 3. User Story: el usuario importa historial desde Mint

### Context
el usuario usó Mint.com durante 2 años (2023-2025). Tiene 2,400 transacciones. Mint permite export a CSV. el usuario quiere ese historial en Finance App para ver trends multi-year.

### Narrative

**10:00 AM - el usuario descarga CSV desde Mint**

el usuario va a Mint.com → Settings → Export Data → Download CSV.

Mint genera `mint-transactions-2023-2025.csv`:

```csv
Date,Description,Original Description,Amount,Transaction Type,Category,Account Name,Labels,Notes
01/15/2023,Starbucks,STARBUCKS #12345 SAN FRANCISCO CA,-5.45,debit,Coffee Shops,Chase Freedom,"coffee, morning",
01/15/2023,Salary,DIRECT DEPOSIT ACME CORP,3500.00,credit,Paycheck,Chase Checking,,
01/16/2023,Whole Foods,WHOLE FOODS MKT #123,-87.32,debit,Groceries,Chase Freedom,,
...
```

**10:02 AM - el usuario abre Finance App**

el usuario navega a Settings → Import/Export → **Import from CSV**.

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚙️  Settings                                    │
│                                                 │
│  📤 Import / Export                             │
│  ├─ Upload PDF Statements          (flow-2)    │
│  ├─ 📊 Import from CSV              <- Selected │
│  ├─ 📥 Export to CSV                (flow-12)  │
│  └─ 📄 Export to PDF                (flow-12)  │
│                                                 │
│  🔧 Preferences                                 │
│  👤 Profile                                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Step 1: Upload CSV**

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 1 of 4: Upload File                        │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │                                             │ │
│  │         📂 Drag CSV or Excel file here       │ │
│  │                                             │ │
│  │              [Choose File]                  │ │
│  │                                             │ │
│  │  Supported formats: .csv, .xlsx, .xls      │ │
│  │  Max size: 50 MB                           │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  💡 Tips:                                         │
│  • Export from Mint: Settings → Export Data      │
│  • Export from YNAB: File → Export → CSV         │
│  • Bank exports: Usually in Account → Statements │
│                                                   │
│                                [Cancel]  [Next]   │
└───────────────────────────────────────────────────┘
```

el usuario arrastra `mint-transactions-2023-2025.csv` al dropzone.

**Step 2: Auto-detect & Column Mapping**

Finance App lee el CSV y detecta el formato automáticamente:

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 2 of 4: Map Columns                        │
│                                                   │
│  ✅ File detected: mint-transactions-2023-2025.csv│
│  📊 Format: Mint (auto-detected)                 │
│  📈 Rows: 2,400 transactions                      │
│                                                   │
│  Map CSV columns to Finance App fields:          │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Finance App Field    CSV Column             │ │
│  ├─────────────────────────────────────────────┤ │
│  │ Date *              Date ▼         ✅ OK    │ │
│  │ Merchant *          Description ▼  ✅ OK    │ │
│  │ Amount *            Amount ▼       ✅ OK    │ │
│  │ Type *              Transaction Type ▼      │ │
│  │ Category            Category ▼     ✅ OK    │ │
│  │ Account             Account Name ▼ ✅ OK    │ │
│  │ Tags                Labels ▼       ⚠️ Optional│ │
│  │ Notes               Notes ▼        ⚠️ Optional│ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  💡 All required fields mapped correctly!         │
│                                                   │
│              [Back]        [Cancel]  [Preview]    │
└───────────────────────────────────────────────────┘
```

**Auto-detection logic**:
- Detectó "Mint" porque header tiene "Original Description" (unique to Mint)
- Mapeó automáticamente columnas usando preset "Mint"
- User puede ajustar mappings si necesita

**Step 3: Preview**

el usuario click "Preview" para ver cómo se verán las transacciones:

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 3 of 4: Preview                            │
│                                                   │
│  Showing first 10 of 2,400 transactions:         │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Date        Merchant        Amount Category │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 01/15/2023  Starbucks       -$5.45  Coffee  │ │ <- Expense (negative)
│  │ 01/15/2023  Salary        $3,500.00 Paycheck│ │ <- Income (positive)
│  │ 01/16/2023  Whole Foods     -$87.32 Grocery │ │
│  │ 01/16/2023  Shell Gas       -$45.00 Gas     │ │
│  │ 01/17/2023  Netflix         -$15.99 Streaming│ │
│  │ 01/18/2023  Blue Bottle     -$4.50  Coffee  │ │
│  │ 01/19/2023  Uber            -$18.20 Transport│ │
│  │ 01/20/2023  Amazon          -$32.99 Shopping│ │
│  │ 01/21/2023  Costco         -$127.45 Grocery │ │
│  │ 01/22/2023  Apple Store     -$99.00 Tech    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ✅ 2,400 valid rows                              │
│  ⚠️  0 invalid rows                               │
│  ⚠️  0 duplicates detected                        │
│                                                   │
│              [Back]        [Cancel]  [Import]     │
└───────────────────────────────────────────────────┘
```

Validations passed:
- All dates are valid ✅
- All amounts are numeric ✅
- No missing required fields ✅
- No duplicates (checked against existing transactions) ✅

**Step 4: Import**

el usuario click "Import". Finance App procesa las 2,400 transacciones:

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 4 of 4: Importing...                       │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ ████████████████░░░░░░░░░░░░░░░░ 67%       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Processing: 1,608 / 2,400 transactions          │
│                                                   │
│  ✅ Inserted: 1,608                               │
│  ⏭️  Skipped (duplicates): 0                      │
│  ❌ Failed: 0                                     │
│                                                   │
│  Estimated time remaining: 8 seconds              │
│                                                   │
└───────────────────────────────────────────────────┘
```

**10:05 AM - Import Complete**

```
┌───────────────────────────────────────────────────┐
│  📊 Import Complete!                         [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  ✅ Successfully imported 2,400 transactions      │
│                                                   │
│  Summary:                                         │
│  • Inserted: 2,400 transactions                   │
│  • Skipped: 0 duplicates                          │
│  • Failed: 0 errors                               │
│                                                   │
│  Date range: Jan 15, 2023 - Oct 29, 2025         │
│                                                   │
│  Your transactions are now available in Timeline. │
│                                                   │
│  ⚠️  Note: Imported transactions have source='csv'│
│                                                   │
│              [View Timeline]  [Import More]  [Done]│
└───────────────────────────────────────────────────┘
```

**Result**: el usuario ahora tiene 2 años de historial completo. Puede ver:
- Spending trends desde 2023
- Category breakdowns multi-year
- Budget baselines basados en historial real

---

## 4. UI Mockups

### 4.1 Import Entry Point (Settings)

```
Settings Screen:
┌─────────────────────────────────────────────────┐
│  ⚙️  Settings                                    │
│                                                 │
│  📤 Import / Export                             │
│  ├─ 📄 Upload PDF Statements                    │
│  ├─ 📊 Import from CSV           <- This flow   │
│  ├─ 📥 Export to CSV                            │
│  └─ 📄 Export to PDF                            │
│                                                 │
│  🔧 Preferences                                 │
│  👤 Profile                                      │
└─────────────────────────────────────────────────┘
```

### 4.2 Step 1: Upload File

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 1 of 4: Upload File                        │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │                                             │ │
│  │         📂 Drag CSV or Excel file here       │ │
│  │                                             │ │
│  │              [Choose File]                  │ │
│  │                                             │ │
│  │  Supported: .csv, .xlsx, .xls              │ │
│  │  Max size: 50 MB (~500,000 rows)           │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  📝 Common CSV formats:                           │
│  • Mint (mint.com)                               │
│  • YNAB (youneedabudget.com)                     │
│  • Personal Capital                              │
│  • Chase Bank Export                             │
│  • Bank of America Export                        │
│  • Custom (we'll help you map columns)           │
│                                                   │
│                                [Cancel]  [Next]   │
└───────────────────────────────────────────────────┘
```

### 4.3 Step 2: Column Mapping (Auto-detected)

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 2 of 4: Map Columns                        │
│                                                   │
│  ✅ mint-transactions-2023-2025.csv               │
│  📊 Format: Mint (auto-detected)                 │
│  📈 2,400 rows detected                           │
│                                                   │
│  Map CSV columns to Finance App fields:          │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Finance App Field    CSV Column        Status││
│  ├─────────────────────────────────────────────┤ │
│  │ Date *              Date ▼             ✅    │ │
│  │ Merchant *          Description ▼      ✅    │ │
│  │ Amount *            Amount ▼           ✅    │ │
│  │ Type *              Transaction Type ▼ ✅    │ │
│  │ Category            Category ▼         ✅    │ │
│  │ Account             Account Name ▼     ✅    │ │
│  │ Tags                Labels ▼           ⚠️     │ │
│  │ Notes               Notes ▼            ⚠️     │ │
│  │ Currency            [Use USD ▼]        ℹ️     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ✅ All required fields mapped                    │
│                                                   │
│  💡 Date format detected: MM/DD/YYYY              │
│  💡 Amount format: Negative = expense            │
│                                                   │
│              [Back]        [Cancel]  [Preview]    │
└───────────────────────────────────────────────────┘
```

### 4.4 Step 2: Column Mapping (Custom Format - Not Detected)

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 2 of 4: Map Columns                        │
│                                                   │
│  ⚠️  custom-transactions.csv                      │
│  📊 Format: Custom (not recognized)              │
│  📈 532 rows detected                             │
│                                                   │
│  Please map columns manually:                     │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Finance App Field    CSV Column        Status││
│  ├─────────────────────────────────────────────┤ │
│  │ Date *              [Select column ▼]  ❌    │ │
│  │ Merchant *          [Select column ▼]  ❌    │ │
│  │ Amount *            [Select column ▼]  ❌    │ │
│  │ Type                [Select column ▼]  ⚠️     │ │
│  │ Category            [Skip ▼]           ℹ️     │ │
│  │ Account             [Skip ▼]           ℹ️     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Available columns in your CSV:                   │
│  • transaction_date                               │
│  • description                                    │
│  • debit                                          │
│  • credit                                         │
│  • balance                                        │
│                                                   │
│  ❌ Please map all required fields (*)            │
│                                                   │
│              [Back]        [Cancel]  [Preview]    │
└───────────────────────────────────────────────────┘
```

### 4.5 Step 3: Preview (With Errors)

```
┌───────────────────────────────────────────────────┐
│  📊 Import from CSV                          [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  Step 3 of 4: Preview                            │
│                                                   │
│  ⚠️  Found issues in 3 rows (out of 2,400)       │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Row  Issue                            Action │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 142  Invalid date: "2023-13-01"      [Skip] │ │
│  │ 589  Missing merchant                [Skip] │ │
│  │ 1203 Invalid amount: "N/A"           [Skip] │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Options:                                         │
│  ○ Skip invalid rows (import 2,397)              │
│  ○ Fix errors in CSV and re-upload               │
│                                                   │
│  Preview of valid transactions (first 10):       │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Date        Merchant        Amount Category │ │
│  ├─────────────────────────────────────────────┤ │
│  │ 01/15/2023  Starbucks       -$5.45  Coffee  │ │
│  │ 01/15/2023  Salary        $3,500.00 Paycheck│ │
│  │ ...                                         │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ✅ 2,397 valid • ⚠️ 3 invalid • ⚠️ 0 duplicates  │
│                                                   │
│              [Back]        [Cancel]  [Import]     │
└───────────────────────────────────────────────────┘
```

### 4.6 Step 4: Import Progress

```
┌───────────────────────────────────────────────────┐
│  📊 Importing Transactions...               [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ ████████████████████████████████████░ 95%   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Processing: 2,280 / 2,397 transactions          │
│                                                   │
│  ✅ Inserted: 2,280                               │
│  ⏭️  Skipped (duplicates): 0                      │
│  ❌ Failed: 0                                     │
│                                                   │
│  Estimated time remaining: 2 seconds              │
│                                                   │
│  [Cancel Import]                                  │
└───────────────────────────────────────────────────┘
```

### 4.7 Import Complete (Success)

```
┌───────────────────────────────────────────────────┐
│  📊 Import Complete!                         [×]  │
│  ─────────────────────────────────────────────────│
│                                                   │
│  ✅ Successfully imported 2,397 transactions      │
│                                                   │
│  Summary:                                         │
│  • Inserted: 2,397 new transactions               │
│  • Skipped: 3 invalid rows                        │
│  • Duplicates: 0                                  │
│                                                   │
│  Date range: Jan 15, 2023 - Oct 29, 2025         │
│  Total amount: $127,450.23                        │
│                                                   │
│  📋 Import ID: import_2025-10-29_10h05m          │
│                                                   │
│  Your transactions are now in Timeline.           │
│                                                   │
│  ⚠️  Note: You can undo this import in Settings   │
│  for the next 24 hours.                           │
│                                                   │
│              [View Timeline]  [Import More]  [Done]│
└───────────────────────────────────────────────────┘
```

---

## 5. Technical Implementation

### 5.1 Data Model

CSV imports use same `transactions` table with `source='csv'`:

```sql
-- Same table as PDF/manual imports
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  type TEXT CHECK(type IN ('expense', 'income', 'transfer')),
  account_id TEXT,
  category_id TEXT,
  tags TEXT,
  notes TEXT,

  -- Source tracking
  source TEXT CHECK(source IN ('pdf', 'manual', 'csv', 'api')),
  source_file TEXT, -- "mint-transactions.csv"
  source_line INTEGER, -- Row number in CSV
  import_id TEXT, -- Links all transactions from same import

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Import metadata table
CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  format TEXT, -- 'mint', 'ynab', 'custom'
  row_count INTEGER,
  imported_count INTEGER,
  skipped_count INTEGER,
  failed_count INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- user_id (for multi-user)

  -- For rollback
  can_rollback BOOLEAN DEFAULT 1,
  rollback_expires_at TEXT -- 24 hours from import
);
```

### 5.2 CSV Parser

```javascript
// lib/csvParser.js
const csv = require('csv-parser');
const fs = require('fs');

async function parseCSV(filepath) {
  const rows = [];
  let headers = null;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve({ headers, rows });
      })
      .on('error', reject);
  });
}

// Detect CSV format based on headers
function detectFormat(headers) {
  const headerLower = headers.map(h => h.toLowerCase());

  // Mint format
  if (headerLower.includes('original description') && headerLower.includes('transaction type')) {
    return 'mint';
  }

  // YNAB format
  if (headerLower.includes('payee') && headerLower.includes('outflow') && headerLower.includes('inflow')) {
    return 'ynab';
  }

  // Personal Capital
  if (headerLower.includes('user description') && headerLower.includes('categorization')) {
    return 'personal-capital';
  }

  // Bank generic
  if (headerLower.includes('debit') && headerLower.includes('credit')) {
    return 'bank-generic';
  }

  return 'custom';
}

// Get preset mapping for known formats
function getPresetMapping(format) {
  const presets = {
    mint: {
      date: 'Date',
      merchant: 'Description',
      amount: 'Amount',
      type: 'Transaction Type',
      category: 'Category',
      account: 'Account Name',
      tags: 'Labels',
      notes: 'Notes'
    },
    ynab: {
      date: 'Date',
      merchant: 'Payee',
      amount: ['Outflow', 'Inflow'], // Combined
      category: 'Category',
      account: 'Account',
      notes: 'Memo'
    },
    'personal-capital': {
      date: 'Date',
      merchant: 'Description',
      amount: 'Amount',
      category: 'Category',
      account: 'Account'
    },
    'bank-generic': {
      date: 'Date',
      merchant: 'Description',
      amount: ['Debit', 'Credit'], // Combined
      account: 'Account'
    }
  };

  return presets[format] || null;
}

module.exports = { parseCSV, detectFormat, getPresetMapping };
```

### 5.3 Import Wizard Component

```javascript
// components/CSVImportWizard.jsx
import React, { useState } from 'react';

function CSVImportWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview, 4=import
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [columnMapping, setColumnMapping] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importProgress, setImportProgress] = useState(0);

  // Step 1: Upload File
  const handleFileUpload = async (uploadedFile) => {
    setFile(uploadedFile);

    // Parse CSV
    const formData = new FormData();
    formData.append('file', uploadedFile);

    const response = await window.api.parseCSV(formData);
    setParsedData(response);

    // Auto-detect format and apply preset mapping
    const format = response.detected_format;
    const preset = response.preset_mapping;

    if (preset) {
      setColumnMapping(preset);
    }

    setStep(2); // Go to mapping
  };

  // Step 2: Column Mapping
  const handleMappingComplete = () => {
    setStep(3); // Go to preview
  };

  // Step 3: Preview & Validate
  const handlePreview = async () => {
    const previewData = await window.api.previewImport({
      rows: parsedData.rows,
      mapping: columnMapping
    });

    setPreview(previewData);
  };

  // Step 4: Import
  const handleImport = async () => {
    setStep(4);

    const importId = await window.api.startImport({
      filename: file.name,
      rows: parsedData.rows,
      mapping: columnMapping,
      onProgress: (progress) => setImportProgress(progress)
    });

    onComplete(importId);
  };

  return (
    <Dialog open={true} onClose={onCancel}>
      {step === 1 && <UploadStep onUpload={handleFileUpload} />}
      {step === 2 && <MappingStep data={parsedData} mapping={columnMapping} onComplete={handleMappingComplete} />}
      {step === 3 && <PreviewStep preview={preview} onImport={handleImport} onBack={() => setStep(2)} />}
      {step === 4 && <ImportStep progress={importProgress} />}
    </Dialog>
  );
}

export default CSVImportWizard;
```

### 5.4 Backend: Import Processor

```javascript
// main/api/importCSV.js
const db = require('../database');
const { nanoid } = require('nanoid');
const { parseDate, parseAmount } = require('../utils');

async function startImport({ filename, rows, mapping, onProgress }) {
  const importId = nanoid();
  const now = new Date().toISOString();

  // Create import record
  await db.run(`
    INSERT INTO imports (id, filename, format, row_count, created_at, can_rollback, rollback_expires_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now', '+24 hours'))
  `, [importId, filename, mapping.format || 'custom', rows.length, now]);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Process rows in batches
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    for (const row of batch) {
      try {
        // Map row to transaction
        const txn = mapRowToTransaction(row, mapping, importId, i + batch.indexOf(row));

        // Validate
        if (!txn.date || !txn.merchant || !txn.amount) {
          skipped++;
          continue;
        }

        // Check duplicate
        const duplicate = await checkDuplicate(txn);
        if (duplicate) {
          skipped++;
          continue;
        }

        // Insert
        await insertTransaction(txn);
        imported++;

      } catch (error) {
        console.error(`Failed to import row ${i + batch.indexOf(row)}:`, error);
        failed++;
      }
    }

    // Report progress
    onProgress({ current: i + batch.length, total: rows.length, imported, skipped, failed });
  }

  // Update import record
  await db.run(`
    UPDATE imports
    SET imported_count = ?, skipped_count = ?, failed_count = ?
    WHERE id = ?
  `, [imported, skipped, failed, importId]);

  return { importId, imported, skipped, failed };
}

function mapRowToTransaction(row, mapping, importId, lineNumber) {
  const txn = {
    id: nanoid(),
    date: parseDate(row[mapping.date]),
    merchant: row[mapping.merchant],
    amount: parseAmount(row, mapping), // Handles debit/credit or single amount
    currency: mapping.currency || 'USD',
    type: determineType(row, mapping),
    account_id: findOrCreateAccount(row[mapping.account]),
    category_id: findOrCreateCategory(row[mapping.category]),
    tags: mapping.tags ? JSON.stringify(row[mapping.tags].split(',')) : '[]',
    notes: row[mapping.notes] || '',
    source: 'csv',
    source_file: filename,
    source_line: lineNumber + 2, // +2 because line 1 is header, array is 0-indexed
    import_id: importId,
    created_at: new Date().toISOString()
  };

  return txn;
}

async function checkDuplicate(txn) {
  // Check if transaction with same date, merchant, amount, account already exists
  const existing = await db.get(`
    SELECT id FROM transactions
    WHERE date = ? AND merchant = ? AND ABS(amount - ?) < 0.01 AND account_id = ?
  `, [txn.date, txn.merchant, txn.amount, txn.account_id]);

  return existing ? true : false;
}

async function insertTransaction(txn) {
  await db.run(`
    INSERT INTO transactions (
      id, date, merchant, amount, currency, type,
      account_id, category_id, tags, notes,
      source, source_file, source_line, import_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    txn.id, txn.date, txn.merchant, txn.amount, txn.currency, txn.type,
    txn.account_id, txn.category_id, txn.tags, txn.notes,
    txn.source, txn.source_file, txn.source_line, txn.import_id, txn.created_at
  ]);
}

module.exports = { startImport };
```

### 5.5 Rollback Support

```javascript
// main/api/rollbackImport.js
async function rollbackImport(importId) {
  // Check if import can be rolled back
  const importRecord = await db.get(`
    SELECT * FROM imports WHERE id = ? AND can_rollback = 1 AND rollback_expires_at > datetime('now')
  `, [importId]);

  if (!importRecord) {
    throw new Error('Import cannot be rolled back (either expired or already rolled back)');
  }

  // Delete all transactions from this import
  await db.run('DELETE FROM transactions WHERE import_id = ?', [importId]);

  // Mark import as rolled back
  await db.run('UPDATE imports SET can_rollback = 0 WHERE id = ?', [importId]);

  return { success: true, deleted_count: importRecord.imported_count };
}

module.exports = { rollbackImport };
```

---

## 6. Edge Cases & Solutions

### 6.1 Duplicate Detection

**Case**: CSV contains transactions that already exist (e.g., re-importing same file)

**Solution**:
- Check for duplicates using: date + merchant + amount + account
- Skip duplicates automatically
- Show count in preview: "⚠️ 50 duplicates will be skipped"

---

### 6.2 Invalid Data

**Case**: CSV has invalid dates, missing fields, non-numeric amounts

**Solution**:
- Validate each row before import
- Show errors in preview with row numbers
- Give option: "Skip invalid rows" or "Fix CSV and re-upload"

**Code**:
```javascript
function validateRow(row, mapping) {
  const errors = [];

  if (!row[mapping.date] || !isValidDate(row[mapping.date])) {
    errors.push('Invalid date');
  }

  if (!row[mapping.merchant]) {
    errors.push('Missing merchant');
  }

  if (!row[mapping.amount] || isNaN(parseAmount(row, mapping))) {
    errors.push('Invalid amount');
  }

  return errors.length > 0 ? errors : null;
}
```

---

### 6.3 Debit/Credit Columns (Bank Format)

**Case**: Bank CSVs have separate "Debit" and "Credit" columns instead of signed amount

**Solution**:
- Detect this format in column mapping
- Combine debit/credit: `amount = credit - debit`
- Type: if debit > 0 → expense, if credit > 0 → income

**Code**:
```javascript
function parseAmount(row, mapping) {
  if (Array.isArray(mapping.amount)) {
    // Bank format: ['Debit', 'Credit']
    const debit = parseFloat(row[mapping.amount[0]]) || 0;
    const credit = parseFloat(row[mapping.amount[1]]) || 0;
    return credit - debit;
  } else {
    // Single amount column
    return parseFloat(row[mapping.amount]);
  }
}
```

---

### 6.4 Unknown Accounts/Categories

**Case**: CSV has account/category names that don't exist in Finance App

**Solution**:
- Auto-create accounts/categories during import
- Or map to existing ones (e.g., "Chase Freedom" → "Credit Card")
- Show mapping UI: "3 new accounts will be created"

**Code**:
```javascript
async function findOrCreateAccount(accountName) {
  if (!accountName) return null;

  let account = await db.get('SELECT id FROM accounts WHERE name = ?', [accountName]);

  if (!account) {
    const id = nanoid();
    await db.run('INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)', [id, accountName, 'other']);
    return id;
  }

  return account.id;
}
```

---

### 6.5 Large Files (10,000+ rows)

**Case**: Import takes > 30 seconds, user thinks it froze

**Solution**:
- Process in batches of 100 rows
- Show progress bar with percentage
- Allow cancel during import

**Code**:
```javascript
// In startImport
for (let i = 0; i < rows.length; i += batchSize) {
  // ... process batch ...

  onProgress({
    current: i + batchSize,
    total: rows.length,
    percentage: Math.floor((i + batchSize) / rows.length * 100)
  });
}
```

---

### 6.6 Currency Conversion

**Case**: CSV has transactions in multiple currencies (e.g., travel expenses in EUR, GBP)

**Solution**:
- Detect currency column or ask user for currency
- Store original currency in transaction
- Convert to account currency for aggregations (use exchange rate from transaction date)

---

## 7. Summary

### What This Flow Covers

✅ **Bulk import** from CSV/Excel files
✅ **Auto-detect formats** (Mint, YNAB, banks)
✅ **Column mapping** with presets
✅ **Preview & validation** before import
✅ **Duplicate detection** to prevent re-imports
✅ **Error handling** for invalid data
✅ **Batch processing** for large files
✅ **Rollback support** (undo import within 24h)

### Scope Boundaries

**In Scope**:
- Import from CSV, XLSX, XLS
- Known formats (Mint, YNAB, banks) + custom
- Duplicate detection based on date+merchant+amount
- Basic validation (dates, amounts, required fields)

**Out of Scope** (future):
- Scheduled imports (auto-fetch from banks)
- Two-way sync (changes in Finance App → export back to Mint)
- API imports (Plaid, Teller)
- Import from QBO, QFX formats

### Impact on Other Flows

- **flow-1** (Timeline): CSV transactions appear with "CSV Import" badge
- **flow-4** (Normalization): CSV merchants are normalized same way as PDFs
- **flow-2** (PDF Upload): CSV import is alternative to PDF upload

### Why This Flow is Important

Without CSV import:
- Migration from other apps is painful (manual re-entry)
- Historical data is lost
- el usuario can't see multi-year trends

With CSV import:
- One-time migration takes 2 minutes
- All historical data preserved
- Reports and budgets have full context

**Result**: Finance App becomes viable replacement for Mint/YNAB, not just a supplement.

---

**Lines of Code**: ~700 (parser + wizard + validator + import processor + rollback)
**Testing Priority**: High (complex edge cases)
**Dependencies**: flow-2 (import concept), flow-4 (normalization)
**Phase**: 2 (nice-to-have, not blocking MVP)
