# Integration: Error Handling

**Qué pasa cuando algo sale mal**

## Tipos de errores

### 1. PDF corrupto / no se puede leer

**Error**:
```
Error: Failed to extract text from PDF
```

**UI**:
```
┌──────────────────────────────────────────┐
│  ❌ Upload Failed                        │
├──────────────────────────────────────────┤
│  Could not read bofa_2025_09.pdf        │
│                                          │
│  The PDF file may be corrupted or       │
│  password-protected.                     │
│                                          │
│  [Try Again] [Cancel]                    │
└──────────────────────────────────────────┘
```

---

### 2. Banco no reconocido

**Error**:
```
Error: Bank not recognized
```

**UI**:
```
┌──────────────────────────────────────────┐
│  ❌ PDF Not Recognized                   │
├──────────────────────────────────────────┤
│  This PDF does not appear to be from:   │
│  • Bank of America                       │
│  • Apple Card                            │
│  • Wise                                  │
│  • Scotiabank                            │
│                                          │
│  [Ok]                                    │
└──────────────────────────────────────────┘
```

---

### 3. Parser falló

**Error**:
```
Error: No transactions found in PDF
```

**UI**:
```
┌──────────────────────────────────────────┐
│  ❌ Parsing Failed                       │
├──────────────────────────────────────────┤
│  No transactions found in PDF.          │
│                                          │
│  Possible causes:                        │
│  • The PDF format changed                │
│  • The PDF is empty                      │
│  • The PDF is not a statement            │
│                                          │
│  [Ok]                                    │
└──────────────────────────────────────────┘
```

---

### 4. Database error

**Error**:
```
Error: SQLITE_CONSTRAINT: UNIQUE constraint failed
```

**UI**:
```
┌──────────────────────────────────────────┐
│  ⚠️ Database Error                       │
├──────────────────────────────────────────┤
│  An unexpected database error occurred.  │
│                                          │
│  Please restart the app and try again.  │
│                                          │
│  If the problem persists, contact       │
│  support with the error log.             │
│                                          │
│  [View Log] [Restart] [Cancel]           │
└──────────────────────────────────────────┘
```

---

## Code: Error handling

```javascript
// main/error-handler.js

class AppError extends Error {
  constructor(message, type, details = {}) {
    super(message);
    this.type = type;
    this.details = details;
  }
}

function handleError(error) {
  console.error('Error:', error);

  // Classify error
  if (error.message.includes('Failed to extract text')) {
    return new AppError(
      'Could not read PDF file',
      'PDF_READ_ERROR',
      { userMessage: 'The PDF file may be corrupted or password-protected.' }
    );
  }

  if (error.message.includes('Bank not recognized')) {
    return new AppError(
      'PDF not recognized',
      'BANK_NOT_RECOGNIZED',
      { userMessage: 'This PDF is not from a supported bank.' }
    );
  }

  if (error.message.includes('No transactions found')) {
    return new AppError(
      'No transactions found',
      'PARSE_ERROR',
      { userMessage: 'The PDF format may have changed.' }
    );
  }

  // Database errors
  if (error.message.includes('SQLITE')) {
    return new AppError(
      'Database error',
      'DATABASE_ERROR',
      { userMessage: 'An unexpected database error occurred. Please restart the app.' }
    );
  }

  // Generic error
  return new AppError(
    'Unknown error',
    'UNKNOWN_ERROR',
    { userMessage: 'An unexpected error occurred. Please try again.' }
  );
}

module.exports = { AppError, handleError };
```

---

## Error logging

```javascript
// main/logger.js

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(app.getPath('userData'), 'finance-app.log');

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...data
  };

  // Write to file
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

  // Also log to console
  console.log(`[${level}] ${message}`, data);
}

function logError(error, context = {}) {
  log('ERROR', error.message, {
    type: error.type,
    stack: error.stack,
    ...context
  });
}

module.exports = { log, logError };
```

---

## Retry logic

```javascript
// main/upload.js

async function processUploadWithRetry(filePath, account, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await processUpload(filePath, account);
    } catch (error) {
      logError(error, { filePath, attempt });

      // Si es último intento, throw
      if (attempt === retries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));

      console.log(`Retry ${attempt + 1} for ${filePath}...`);
    }
  }
}
```

---

## Graceful degradation

Si el pipeline falla, al menos guarda las observations.

```javascript
async function processUpload(filePath, account) {
  // Step 1: Parse PDF
  const transactions = await parsePDF(filePath, account);

  // Step 2: Insert observations (ALWAYS)
  transactions.forEach(txn => insertObservation(txn));

  // Step 3: Try pipeline (best-effort)
  try {
    await runPipeline();
  } catch (error) {
    logError(error, { context: 'pipeline' });
    // Don't throw - observations are already saved
    console.warn('Pipeline failed, but observations saved. You can regenerate canonical later.');
  }

  return { count: transactions.length };
}
```

**Resultado**: Las observations están guardadas. Puedes regenerar canonical más tarde con `regenerateCanonical()`.

---

## User-facing error modal

```javascript
// renderer/components/ErrorModal.jsx

function ErrorModal({ error, onClose }) {
  const { type, message, details } = error;

  return (
    <div className="error-modal">
      <div className="error-icon">
        {type === 'ERROR' ? '❌' : '⚠️'}
      </div>

      <h2>{getErrorTitle(type)}</h2>

      <p>{details.userMessage || message}</p>

      {type === 'DATABASE_ERROR' && (
        <div className="error-actions">
          <Button onClick={viewLog}>View Log</Button>
          <Button onClick={restart}>Restart App</Button>
        </div>
      )}

      <Button onClick={onClose}>Close</Button>
    </div>
  );
}

function getErrorTitle(type) {
  const titles = {
    PDF_READ_ERROR: 'Could Not Read PDF',
    BANK_NOT_RECOGNIZED: 'PDF Not Recognized',
    PARSE_ERROR: 'Parsing Failed',
    DATABASE_ERROR: 'Database Error',
    UNKNOWN_ERROR: 'Unexpected Error'
  };
  return titles[type] || 'Error';
}
```

---

## LOC estimate

- `error-handler.js`: ~60 LOC
- `logger.js`: ~30 LOC
- `ErrorModal.jsx`: ~50 LOC
- Retry logic: ~30 LOC

**Total**: ~170 LOC

---

## Resumen Batch 6: Integration

| Doc | LOC |
|-----|-----|
| 9-upload-flow.md | ~260 |
| 10-error-handling.md | ~170 |
| **Total** | **~430** |

---

**Final doc**: Lee [STORYTELLING.md](STORYTELLING.md) - La historia completa narrada.
