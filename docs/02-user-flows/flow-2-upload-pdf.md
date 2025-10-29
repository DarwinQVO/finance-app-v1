# Flow 2: Upload PDF

**Cómo funciona el drag & drop de PDFs**

## Overview

El usuario arrastra un PDF → La app lo procesa → Aparecen transacciones en el timeline.

**Tiempo total**: 2-5 segundos para un PDF con ~100 transacciones.

---

## Story: Darwin sube su primer PDF

### Paso 1: La zona de drop

Darwin abre Finance App. Ve la zona de upload:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                      📁                          │
│                                                  │
│          Arrastra un PDF bancario aquí           │
│          o haz click para seleccionar            │
│                                                  │
└──────────────────────────────────────────────────┘
```

Darwin tiene `bofa_2025_09.pdf` en su Downloads. Lo arrastra.

---

### Paso 2: Visual feedback instantáneo

**En cuanto el PDF entra en la zona**, la UI cambia:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                  📄 → 📁                         │
│                                                  │
│             Suelta para procesar                 │
│             bofa_2025_09.pdf                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

Darwin suelta el archivo.

---

### Paso 3: Procesando

**Inmediatamente** aparece un modal de progreso:

```
┌──────────────────────────────────────────────────┐
│  Procesando bofa_2025_09.pdf                     │
├──────────────────────────────────────────────────┤
│                                                  │
│  ✓ Leyendo PDF                                   │
│  ✓ Extrayendo texto                              │
│  ✓ Parseando transacciones                       │
│  ⏳ Normalizando merchants...                     │
│  ⏺ Clasificando tipos                            │
│                                                  │
│  ████████████░░░░░░░░  60%                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**2 segundos después**:

```
┌──────────────────────────────────────────────────┐
│  ✅ Procesado exitosamente                        │
├──────────────────────────────────────────────────┤
│                                                  │
│  127 transacciones agregadas                     │
│  De: Sep 1, 2025                                 │
│  A:  Sep 30, 2025                                │
│                                                  │
│  [Ver timeline]                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

Darwin hace click en "Ver timeline" y ¡boom! Ve las 127 transacciones.

---

## Flujo técnico completo

### 1. Electron recibe el drop

```javascript
// renderer/components/UploadZone.jsx
function UploadZone() {
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];

    if (!file.name.endsWith('.pdf')) {
      alert('Solo PDFs permitidos');
      return;
    }

    // Enviar a main process
    window.electron.uploadPDF(file.path);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="upload-zone"
    >
      📁 Arrastra PDF aquí
    </div>
  );
}
```

---

### 2. Main process procesa el archivo

```javascript
// main/upload.js
ipcMain.on('upload-pdf', async (event, filePath) => {
  try {
    // Detectar banco por contenido
    const account = detectAccount(filePath);

    // Procesar con pipeline
    const result = await processUpload(filePath, account);

    // Notificar renderer
    event.reply('upload-complete', result);

  } catch (error) {
    event.reply('upload-error', error.message);
  }
});

async function processUpload(filePath, account) {
  // 1. Extract & parse PDF → INSERT transactions
  const result = await extractFromPDF({
    file: { path: filePath, name: basename(filePath) },
    accountId: account,
    config: {
      autoDetect: true,
      skipDuplicates: true  // Check source_hash for dedup
    }
  });

  if (result.metadata.duplicatesSkipped > 0) {
    return { status: 'skipped', reason: 'Already processed' };
  }

  // 2. Run pipeline stages on newly inserted transactions
  await runPipeline(result.transactions);

  return {
    status: 'success',
    count: result.transactions.length,
    dateRange: {
      from: result.transactions[0].date,
      to: result.transactions[result.transactions.length - 1].date
    }
  };
}
```

---

### 3. Pipeline ejecuta

```javascript
async function runPipeline(newTransactions) {
  // Stage 1: Clustering (optional - generates clusterMap)
  let clusterMap = new Map();
  if (config.stages.clustering.enabled) {
    const result = await clusterMerchants(newTransactions, {
      similarityThreshold: 0.8
    });
    clusterMap = result.clusterMap;
  }

  // Stage 2: Normalization (UPDATE transactions.merchant)
  await normalizeTransactions({
    transactions: newTransactions,
    clusterMap,
    config: { useRules: true, useClusters: true }
  });

  // Stage 3: Classification (UPDATE transactions.type)
  await classifyTransactions({
    transactions: newTransactions,
    config: { useKeywords: true }
  });

  // Stage 4: Link transfers (UPDATE transactions.transfer_pair_id)
  await linkTransfers(newTransactions, {
    timeWindowDays: 3,
    amountTolerance: 0.01
  });
}
```

---

### 4. UI se actualiza

```javascript
// renderer/App.jsx
useEffect(() => {
  window.electron.on('upload-complete', (result) => {
    // Refetch transactions
    fetchTransactions();

    // Show success message
    toast.success(`${result.count} transacciones agregadas`);
  });
}, []);
```

---

## Detección automática de banco

**¿Cómo sabe la app de qué banco es el PDF?**

### Método 1: Buscar keywords en el texto

```javascript
function detectAccount(pdfPath) {
  const text = extractText(pdfPath);

  // Buscar keywords específicos
  if (text.includes('Bank of America')) return 'bofa';
  if (text.includes('Apple Card')) return 'apple-card';
  if (text.includes('Wise')) return 'wise';
  if (text.includes('Scotiabank')) return 'scotia';

  throw new Error('Banco no reconocido');
}
```

### Método 2: Pattern matching

```javascript
function detectAccount(pdfPath) {
  const text = extractText(pdfPath);

  // BofA tiene este header específico
  if (/Statement Date:.*\nAccount Number:/.test(text)) return 'bofa';

  // Apple Card tiene este formato
  if (/Apple Card Monthly Statement/.test(text)) return 'apple-card';

  // Wise tiene "Your statement for"
  if (/Your statement for.*Wise/.test(text)) return 'wise';

  // Scotia tiene "Estado de Cuenta"
  if (/Estado de Cuenta.*Scotiabank/.test(text)) return 'scotia';

  throw new Error('Banco no reconocido');
}
```

**Resultado**: El usuario NO tiene que decir "este PDF es de BofA". La app lo detecta.

---

## Upload múltiple

Darwin puede arrastrar **varios PDFs a la vez**.

### UI con múltiples archivos

```
┌──────────────────────────────────────────────────┐
│  Procesando 10 PDFs...                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  ✓ bofa_2025_01.pdf   (98 trans)                │
│  ✓ bofa_2025_02.pdf   (102 trans)               │
│  ✓ bofa_2025_03.pdf   (87 trans)                │
│  ⏳ bofa_2025_04.pdf   Procesando...             │
│  ⏺ bofa_2025_05.pdf                              │
│  ⏺ bofa_2025_06.pdf                              │
│  ⏺ bofa_2025_07.pdf                              │
│  ⏺ bofa_2025_08.pdf                              │
│  ⏺ bofa_2025_09.pdf                              │
│  ⏺ bofa_2025_10.pdf                              │
│                                                  │
│  ████░░░░░░░░░░░░░░  30% (3/10)                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Código para batch processing

```javascript
async function uploadMultiple(filePaths) {
  const results = [];

  for (const filePath of filePaths) {
    try {
      // Procesar secuencial (no paralelo, para evitar race conditions en DB)
      const result = await processUpload(filePath);
      results.push({ file: basename(filePath), ...result });

      // Notificar progreso
      event.reply('upload-progress', {
        current: results.length,
        total: filePaths.length,
        file: basename(filePath)
      });

    } catch (error) {
      results.push({
        file: basename(filePath),
        status: 'error',
        error: error.message
      });
    }
  }

  return results;
}
```

**Tiempo**: ~2 segundos por PDF → 10 PDFs = ~20 segundos.

---

## Deduplicación

**Problema**: Darwin arrastra el mismo PDF dos veces por error.

**Solución**: Hash del archivo.

```javascript
function sha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

function isDuplicate(hash) {
  const exists = db.queryOne(
    'SELECT 1 FROM transactions WHERE source_hash = ?',
    [hash]
  );
  return !!exists;
}
```

**Resultado**:
```
┌──────────────────────────────────────────────────┐
│  ⚠️ PDF ya procesado                              │
├──────────────────────────────────────────────────┤
│                                                  │
│  bofa_2025_09.pdf ya fue procesado previamente.  │
│                                                  │
│  No se agregaron transacciones.                  │
│                                                  │
│  [Ok]                                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Re-upload + Edit Conflicts

### Scenario: User edita transaction y luego re-sube PDF

**Caso común**: Darwin edita un merchant mal normalizado y luego por error re-sube el mismo PDF.

#### Step 1: User edita transaction

```
Sep 28  Trader  -$45.67  USD  →  Darwin edita → "Trader Joe's"
```

Database:
```sql
UPDATE transactions
SET
  merchant = 'Trader Joe''s',
  is_edited = TRUE,
  edited_fields = '["merchant"]',
  edited_at = '2025-09-28T15:30:00Z'
WHERE id = 'txn_abc123';
```

---

#### Step 2: User re-sube `bofa_2025_09.pdf`

Darwin accidentalmente arrastra el mismo PDF de nuevo.

**Sistema detecta**:
1. PDF hash = mismo hash
2. Transactions already exist
3. Algunas transactions tienen `is_edited = TRUE`

---

#### Step 3: Sistema protege edits

```javascript
// main/pipeline/extract-from-pdf.js

async function extractFromPDF({ file, accountId, config }) {
  const hash = computeHash(file.path);

  // Check if already processed
  const existingTransactions = await db.all(`
    SELECT id, merchant, is_edited, edited_fields
    FROM transactions
    WHERE source_hash = ?
  `, hash);

  if (existingTransactions.length === 0) {
    // New PDF, process normally
    return processNewPDF(file, accountId, config);
  }

  // PDF already uploaded

  // Check for edited transactions
  const editedTransactions = existingTransactions.filter(t => t.is_edited);

  if (editedTransactions.length > 0) {
    // Show warning with edit details
    return {
      status: 'duplicate_with_edits',
      reason: 'PDF already processed with manual edits',
      metadata: {
        totalTransactions: existingTransactions.length,
        editedTransactions: editedTransactions.length,
        edits: editedTransactions.map(t => ({
          id: t.id,
          merchant: t.merchant,
          editedFields: JSON.parse(t.edited_fields)
        }))
      }
    };
  }

  // No edits, simple duplicate
  return {
    status: 'duplicate',
    reason: 'PDF already processed',
    metadata: {
      totalTransactions: existingTransactions.length
    }
  };
}
```

---

#### Step 4: UI muestra warning con detalles

```
┌──────────────────────────────────────────────────┐
│  ⚠️ PDF Ya Procesado con Edits Manuales          │
├──────────────────────────────────────────────────┤
│                                                  │
│  bofa_2025_09.pdf fue procesado previamente y    │
│  contiene 2 transacciones editadas manualmente:  │
│                                                  │
│  📝 Trader → "Trader Joe's" (merchant edited)    │
│  📝 Salary Deposit → tipo "income" (type edited) │
│                                                  │
│  ¿Qué quieres hacer?                             │
│                                                  │
│  ○ Mantener edits (recomendado)                  │
│  ○ Sobrescribir con datos originales del PDF    │
│                                                  │
│  [Cancelar]  [Continuar]                         │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

#### Step 5: User selecciona opción

**Opción 1: Mantener edits (recomendado)** ✅

```javascript
if (userChoice === 'keep_edits') {
  // Do nothing, just skip upload
  return {
    status: 'skipped',
    message: 'Manual edits preserved. No changes made.'
  };
}
```

**Resultado**: Edits se preservan. PDF no se re-procesa.

---

**Opción 2: Sobrescribir con original** ⚠️

```javascript
if (userChoice === 'overwrite') {
  // Delete existing transactions
  await db.run('DELETE FROM transactions WHERE source_hash = ?', hash);

  // Re-process PDF
  return processNewPDF(file, accountId, config);
}
```

**Resultado**: Edits se pierden. Transactions se re-crean desde PDF.

**UI Confirmation**:
```
┌──────────────────────────────────────────────────┐
│  ⚠️ ¿Estás seguro?                                │
├──────────────────────────────────────────────────┤
│                                                  │
│  Esto borrará 2 edits manuales:                  │
│                                                  │
│  • "Trader Joe's" → volverá a "Trader"          │
│  • Tipo "income" → volverá a "expense"          │
│                                                  │
│  Esta acción NO se puede deshacer.              │
│                                                  │
│  [Cancelar]  [Sí, sobrescribir]                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

### Edge Cases

#### 1. User edita y luego sube PDF diferente

**Síntoma**: User edita transactions de `bofa_2025_09.pdf` y luego sube `bofa_2025_10.pdf`.

**Resultado**: ✅ No hay conflicto. Hashes diferentes, se procesan normalmente.

---

#### 2. User borra transaction y re-sube PDF

**Síntoma**: User borra una transaction manualmente. Luego re-sube el PDF.

**Pregunta**: ¿La transaction borrada re-aparece?

**Solución**: Track deletions

```sql
-- Add deleted_at field to track deletions
ALTER TABLE transactions ADD COLUMN deleted_at TEXT;

-- When user deletes
UPDATE transactions SET deleted_at = ? WHERE id = ?;
-- Don't actually DELETE (preserve for conflict detection)
```

**On re-upload**:
```javascript
const deletedTransactions = existingTransactions.filter(t => t.deleted_at);

if (deletedTransactions.length > 0) {
  // Show warning
  return {
    status: 'duplicate_with_deletions',
    reason: 'PDF contains transactions you previously deleted'
  };
}
```

**UI**:
```
┌──────────────────────────────────────────────────┐
│  ⚠️ PDF contiene transactions borradas           │
├──────────────────────────────────────────────────┤
│                                                  │
│  Este PDF contiene 1 transaction que borraste:   │
│                                                  │
│  🗑️ Starbucks -$5.67 USD (deleted Sep 28)       │
│                                                  │
│  ¿Restaurar esta transaction?                   │
│                                                  │
│  [No, mantener borrada]  [Sí, restaurar]        │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

#### 3. PDF con partial overlap

**Síntoma**: User sube PDF truncado o diferente versión.

**Ejemplo**:
- Upload 1: `bofa_2025_09.pdf` con 127 transactions
- Upload 2: `bofa_2025_09_partial.pdf` con 50 transactions (mismo mes)

**Resultado**: ✅ Different hashes, tratados como PDFs diferentes.

**Posible mejora (Phase 2)**: Detectar overlap por `date + amount + description`.

---

### Code: Complete Re-upload Handler

```javascript
// renderer/components/UploadHandler.jsx

async function handleFileUpload(file) {
  const result = await window.electron.uploadPDF(file.path, account);

  // Handle different statuses
  switch (result.status) {
    case 'success':
      showSuccess(`${result.metadata.transactionsAdded} transactions added`);
      break;

    case 'duplicate':
      showWarning('PDF already processed. No changes made.');
      break;

    case 'duplicate_with_edits':
      showEditConflictDialog(result.metadata);
      break;

    case 'duplicate_with_deletions':
      showDeletionConflictDialog(result.metadata);
      break;

    case 'error':
      showError(result.reason);
      break;
  }
}

function showEditConflictDialog(metadata) {
  const { editedTransactions } = metadata;

  const choice = showDialog({
    title: '⚠️ PDF Ya Procesado con Edits Manuales',
    message: `This PDF contains ${editedTransactions.length} manually edited transactions.`,
    details: editedTransactions.map(t =>
      `• ${t.merchant} (${t.editedFields.join(', ')} edited)`
    ).join('\n'),
    options: [
      { label: 'Keep edits (recommended)', value: 'keep', default: true },
      { label: 'Overwrite with original', value: 'overwrite', danger: true }
    ]
  });

  if (choice === 'overwrite') {
    // Show confirmation
    const confirmed = confirm(
      'This will delete manual edits. Are you sure?'
    );

    if (confirmed) {
      await window.electron.reprocessPDF(file.path, { overwrite: true });
    }
  }
}
```

---

### Summary: Re-upload Behavior

| Scenario | Behavior | User Choice |
|----------|----------|-------------|
| **Simple duplicate** (no edits) | Skip, show warning | N/A |
| **Duplicate + edits** | Protect edits by default | Keep / Overwrite |
| **Duplicate + deletions** | Ask to restore | Restore / Keep deleted |
| **Different PDF (different hash)** | Process normally | N/A |

**Default behavior**: **Protect user edits** (no data loss).

---

## Error handling

### Error 1: PDF corrupto

**Síntoma**: No se puede extraer texto.

```javascript
try {
  const text = await pdfParse(pdfBuffer);
} catch (error) {
  throw new Error('No se pudo leer el PDF. ¿Está corrupto?');
}
```

**UI**:
```
┌──────────────────────────────────────────────────┐
│  ❌ Error procesando bofa_2025_09.pdf            │
├──────────────────────────────────────────────────┤
│                                                  │
│  No se pudo leer el PDF. ¿Está corrupto?        │
│                                                  │
│  [Reintentar] [Cancelar]                         │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

### Error 2: Banco no reconocido

**Síntoma**: El texto del PDF no coincide con ningún banco conocido.

```javascript
function detectAccount(text) {
  // ... búsqueda de keywords

  throw new Error('Banco no reconocido');
}
```

**UI**:
```
┌──────────────────────────────────────────────────┐
│  ❌ PDF no reconocido                            │
├──────────────────────────────────────────────────┤
│                                                  │
│  Este PDF no parece ser de ninguno de estos     │
│  bancos soportados:                              │
│                                                  │
│  • Bank of America                               │
│  • Apple Card                                    │
│  • Wise                                          │
│  • Scotiabank                                    │
│                                                  │
│  [Ok]                                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

### Error 3: Parse falló

**Síntoma**: El parser no pudo extraer transacciones (formato cambió).

```javascript
const transactions = parser.parse(text);

if (transactions.length === 0) {
  throw new Error('No se encontraron transacciones en el PDF');
}
```

**UI**:
```
┌──────────────────────────────────────────────────┐
│  ❌ Error parseando bofa_2025_09.pdf             │
├──────────────────────────────────────────────────┤
│                                                  │
│  No se encontraron transacciones en el PDF.     │
│                                                  │
│  Posibles causas:                                │
│  • El formato del PDF cambió                     │
│  • El PDF está vacío                             │
│  • El PDF no es un statement                     │
│                                                  │
│  [Ok]                                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Click para seleccionar archivo

Además de drag & drop, el usuario puede hacer **click** para abrir file picker.

```javascript
function UploadZone() {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    window.electron.uploadPDF(file.path);
  };

  return (
    <div onClick={handleClick} onDrop={handleDrop}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      📁 Arrastra PDF aquí o haz click para seleccionar
    </div>
  );
}
```

---

## Persistencia del upload

**Pregunta**: Si cierro la app mientras procesa, ¿se pierde?

**Respuesta**: No. Cada transaction se guarda en DB inmediatamente durante Stage 0 (PDF Extraction).

```javascript
// Stage 0 hace INSERT directo a transactions
async function insertTransaction(txn) {
  await db.run(`
    INSERT INTO transactions (
      id, account_id, date, original_description,
      amount_raw, amount, merchant, type, currency,
      source_type, source_file, source_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    txn.id,
    txn.account_id,
    txn.date,
    txn.original_description,
    txn.amount_raw,
    txn.amount,
    txn.merchant,  // Initially = original_description
    null,          // type (null - will be set by Stage 3)
    txn.currency,
    'pdf',
    basename(pdfPath),
    txn.source_hash,
    now(),
    now()
  ]);
}
```

**Si la app crashea**: Al reabrir, las transactions ya están en DB con:
- `merchant` = `original_description` (sin normalizar)
- `type` = null (sin clasificar)
- Solo falta correr pipeline stages para completar UPDATE.

---

## Botón "Upload" siempre visible

Después del primer upload, el botón "Upload" aparece en el header.

```
┌──────────────────────────────────────────────────┐
│  Finance App              [Upload] [Filter] [⚙️]  │
├──────────────────────────────────────────────────┤
│  Timeline aquí...                                │
└──────────────────────────────────────────────────┘
```

**Click en "Upload"** → Abre file picker.

**Drag & drop en cualquier parte** → También funciona (toda la ventana es drop zone).

---

## Resumen del flujo (1-Table Architecture)

```
1. Usuario arrastra PDF
   ↓
2. Electron recibe file path
   ↓
3. Stage 0: PDF Extraction
   - Detectar banco (auto-detect via keywords)
   - Extraer texto con pdf-parse
   - Parser específico → Array de transactions
   - INSERT en transactions (con source_hash para dedup)
   ↓
4. Stage 1: Clustering (opcional)
   - Agrupar merchants similares
   - Retorna clusterMap (ephemeral - no persiste)
   ↓
5. Stage 2: Normalization
   - UPDATE transactions.merchant (de "STARBUCKS #123" a "Starbucks")
   - Usa rules de normalization_rules table
   ↓
6. Stage 3: Classification
   - UPDATE transactions.type (expense/income/transfer)
   - Usa keywords de parser_configs table
   ↓
7. Stage 4: Transfer Linking
   - UPDATE transactions.transfer_pair_id (link A→B con B←A)
   ↓
8. UI refetch transactions
   ↓
9. Timeline se actualiza
   ↓
10. Usuario ve transacciones limpias
```

**Tiempo total**: 2-5 segundos.

**Key difference**:
- ❌ OLD: Insert observations → run pipeline → create canonical transactions
- ✅ NEW: Insert transactions → run pipeline (UPDATE merchant, type, etc.)

---

## Performance

| PDFs | Transactions | Tiempo |
|------|-------------|--------|
| 1    | ~100        | 2-3 seg |
| 10   | ~1,000      | 20-30 seg |
| 96   | ~12,000     | 3-5 min |

**Nota**: Secuencial, no paralelo (para evitar race conditions en clustering).

---

**Próximo flow**: Lee [flow-3-view-transaction.md](flow-3-view-transaction.md) para ver cómo funciona el panel de detalles.
