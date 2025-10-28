# Integration: Upload Flow

**Cómo se conecta todo desde que subes un PDF hasta que aparece en el timeline**

## El flujo completo

```
1. User arrastra PDF
   ↓
2. Renderer captura evento
   ↓
3. IPC message a main process
   ↓
4. Main process: detectar banco
   ↓
5. Parser extrae transactions
   ↓
6. Insert en observations table
   ↓
7. Run pipeline (cluster + normalize + canonical)
   ↓
8. IPC message de vuelta a renderer
   ↓
9. Renderer refetch transactions
   ↓
10. Timeline se actualiza
   ↓
11. User ve transacciones limpias
```

**Tiempo total**: 2-5 segundos para ~100 transacciones.

---

## Step 1-3: Renderer → Main

```javascript
// renderer/components/UploadZone.jsx

function UploadZone() {
  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);

    // Filter PDFs only
    const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      alert('Please upload PDF files only');
      return;
    }

    // Show progress modal
    setUploading(true);
    setProgress({ current: 0, total: pdfFiles.length });

    // Upload each file
    for (const file of pdfFiles) {
      try {
        await window.electron.uploadPDF(file.path);
        setProgress(p => ({ ...p, current: p.current + 1 }));
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    // Hide modal
    setUploading(false);

    // Refresh timeline
    refreshTransactions();
  };

  return (
    <div
      className="upload-zone"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      📁 Drag PDFs here or click to select
    </div>
  );
}
```

---

## Step 4-7: Main process

```javascript
// main/index.js

const { ipcMain } = require('electron');
const { processUpload } = require('./upload');

ipcMain.handle('upload-pdf', async (event, filePath) => {
  try {
    // Step 4: Detect account
    const account = detectAccount(filePath);

    // Step 5-7: Process upload
    const result = await processUpload(filePath, account);

    return { status: 'success', ...result };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
});

// main/upload.js

const { parsePDF } = require('./parsers');
const { runPipeline } = require('./pipeline');

async function processUpload(filePath, account) {
  // Step 5: Parse PDF
  const transactions = await parsePDF(filePath, account);

  // Step 6: Insert observations
  const hash = sha256(filePath);

  // Check duplicate
  const exists = db.queryOne('SELECT 1 FROM observations WHERE pdf_hash = ?', [hash]);
  if (exists) {
    return { status: 'skipped', reason: 'Already processed' };
  }

  // Insert all observations
  transactions.forEach(txn => {
    insertObservation({
      account,
      pdf_filename: path.basename(filePath),
      pdf_hash: hash,
      ...txn
    });
  });

  // Step 7: Run pipeline
  await runPipeline();

  return {
    count: transactions.length,
    dateRange: {
      from: transactions[0].date,
      to: transactions[transactions.length - 1].date
    }
  };
}
```

---

## Step 8-11: Main → Renderer

```javascript
// renderer/App.jsx

useEffect(() => {
  // Listen for upload complete
  window.electron.on('upload-complete', (result) => {
    console.log('Upload complete:', result);

    // Refetch transactions
    fetchTransactions();

    // Show toast
    toast.success(`${result.count} transactions added`);
  });

  return () => {
    window.electron.off('upload-complete');
  };
}, []);

async function fetchTransactions() {
  const txns = await window.electron.getTransactions(filters);
  setTransactions(txns);
}
```

---

## Progress tracking

Para múltiples PDFs, mostrar progreso.

```javascript
// main/upload.js

async function processMultiplePDFs(filePaths, progressCallback) {
  const results = [];

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];

    // Report progress
    progressCallback({
      current: i + 1,
      total: filePaths.length,
      file: path.basename(filePath)
    });

    try {
      const result = await processUpload(filePath);
      results.push({ file: path.basename(filePath), ...result });
    } catch (error) {
      results.push({
        file: path.basename(filePath),
        status: 'error',
        error: error.message
      });
    }
  }

  return results;
}

ipcMain.handle('upload-multiple-pdfs', async (event, filePaths) => {
  const results = await processMultiplePDFs(filePaths, (progress) => {
    // Send progress update to renderer
    event.sender.send('upload-progress', progress);
  });

  return results;
});
```

```javascript
// renderer/components/UploadProgress.jsx

function UploadProgress({ files }) {
  const [progress, setProgress] = useState({ current: 0, total: files.length });

  useEffect(() => {
    window.electron.on('upload-progress', setProgress);
    return () => window.electron.off('upload-progress');
  }, []);

  return (
    <div className="upload-progress">
      <h3>Uploading {progress.total} PDFs...</h3>
      <ProgressBar value={progress.current / progress.total} />
      <div>{progress.current} / {progress.total} completed</div>
      <div className="text-sm text-gray-500">
        Processing: {progress.file}
      </div>
    </div>
  );
}
```

---

## Error handling

```javascript
// main/upload.js

async function processUpload(filePath, account) {
  try {
    // ... normal flow
  } catch (error) {
    // Log error
    console.error('Upload failed:', error);

    // Return error to renderer
    throw new Error(`Failed to process ${path.basename(filePath)}: ${error.message}`);
  }
}
```

```javascript
// renderer/components/UploadZone.jsx

try {
  await window.electron.uploadPDF(file.path);
} catch (error) {
  // Show error modal
  showErrorModal({
    title: 'Upload Failed',
    message: error.message,
    file: file.name
  });
}
```

---

## LOC estimate

- `UploadZone.jsx`: ~80 LOC
- `upload.js` (main): ~100 LOC
- `UploadProgress.jsx`: ~50 LOC
- Error handling: ~30 LOC

**Total**: ~260 LOC

---

**Próximo doc**: Lee [10-error-handling.md](10-error-handling.md)
