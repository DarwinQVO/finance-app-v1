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
│  ⏳ Parseando transacciones...                    │
│  ⏺ Normalizando merchants                        │
│  ⏺ Creando transacciones                         │
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
  // 1. Check duplicado
  const hash = sha256(filePath);
  const exists = db.queryOne(
    'SELECT 1 FROM observations WHERE pdf_hash = ?',
    [hash]
  );

  if (exists) {
    return { status: 'skipped', reason: 'Already processed' };
  }

  // 2. Parse PDF
  const transactions = await parsePDF(filePath, account);

  // 3. Insert observations
  transactions.forEach(txn => insertObservation(txn, filePath, hash));

  // 4. Run pipeline
  await runPipeline();

  return {
    status: 'success',
    count: transactions.length,
    dateRange: {
      from: transactions[0].date,
      to: transactions[transactions.length - 1].date
    }
  };
}
```

---

### 3. Pipeline ejecuta

```javascript
async function runPipeline() {
  // Stage 2: Clustering
  const newObservations = db.query(
    'SELECT * FROM observations WHERE canonical_id IS NULL'
  );
  const clusters = clusterMerchants(newObservations);

  // Stage 3: Normalization
  const normalized = newObservations.map(obs => ({
    ...obs,
    merchant: normalizeMerchant(obs.description, clusters[obs.id])
  }));

  // Stage 4: Create canonical
  normalized.forEach(obs => {
    const txn = createCanonicalTransaction(obs);
  });

  // Stage 5: Link transfers
  linkTransfers();
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
    'SELECT 1 FROM observations WHERE pdf_hash = ?',
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

**Respuesta**: No. Cada observation se guarda en DB inmediatamente.

```javascript
function insertObservation(txn, pdfPath, hash) {
  // Transaction SQL para atomicidad
  db.transaction(() => {
    db.insert('observations', {
      id: uuid(),
      account: txn.account,
      pdf_filename: basename(pdfPath),
      pdf_hash: hash,
      date: txn.date,
      description: txn.description,
      amount_raw: txn.amount,
      currency: txn.currency,
      created_at: now()
    });
  });
}
```

**Si la app crashea**: Al reabrir, las observations ya están en DB. Solo falta correr el pipeline.

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

## Resumen del flujo

```
1. Usuario arrastra PDF
   ↓
2. Electron recibe file path
   ↓
3. Detectar banco (auto)
   ↓
4. Extraer texto con pdf-parse
   ↓
5. Parser específico → Array de transactions
   ↓
6. Insert en observations (con hash para dedup)
   ↓
7. Run pipeline (cluster + normalize + canonical)
   ↓
8. UI refetch transactions
   ↓
9. Timeline se actualiza
   ↓
10. Usuario ve transacciones limpias
```

**Tiempo total**: 2-5 segundos.

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
