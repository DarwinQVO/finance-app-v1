# Edge Cases Completos - Finance App

**Fecha**: Octubre 30, 2025
**Fuente**: Análisis de 6 archivos reales (BofA checking, BofA CC, Apple Card, Stripe, Wise, Scotiabank)
**Status**: 🔴 CRÍTICO - Leer antes de implementar cualquier parser

---

## 🎯 Objetivo de este Documento

Este documento cataloga **TODOS** los edge cases encontrados en datos bancarios reales. Cada edge case incluye:
1. **Descripción** del problema
2. **Ejemplos reales** de los archivos
3. **Estrategia de manejo** en el código
4. **Impacto** en el schema de la base de datos

**Principio**: Si no está documentado aquí, no existe. El código debe manejar 100% de estos casos.

---

## 📊 Categorías de Edge Cases

### 1. Formatos de Archivo Radicalmente Diferentes
### 2. Multi-Moneda y Exchange Rates
### 3. Merchant Normalization Nightmare
### 4. Transferencias Entre Cuentas Propias
### 5. Refunds, Reversals y Adjustments
### 6. Pending vs Posted Transactions
### 7. Fees Como Transacciones Separadas
### 8. Subscriptions y Recurring Payments
### 9. Payments Como Negativos
### 10. Cobranzas Domiciliadas (México)
### 11. Categorización Inconsistente
### 12. Transaction IDs Diferentes
### 13. Interest Charges
### 14. Cash Advances
### 15. Installment Plans
### 16. Exchange Rates Implícitos
### 17. Reversals Múltiples del Mismo Cargo
### 18. Running Balance
### 19. Timezone Issues
### 20. Account Linking Metadata
### 21. Tax Info (RFC en México)
### 22. Metadata Overload
### 23. SPEI Transfers (México)
### 24. Adjustments vs Reversals
### 25. Deposits Con Metadata

---

## 1. 📄 Formatos de Archivo Radicalmente Diferentes

### Problema
No todos los bancos usan PDF. Algunos usan CSV. Algunos PDFs tienen estructura, otros no.

### Ejemplos Reales

**CSV limpio (Apple Card)**:
```csv
Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)
09/01/2025,09/01/2025,"INTEREST CHARGE","Interest Charge","Interest","Interest","66.05"
```

**PDF estructurado (BofA Checking)**:
```
Date Description Amount
04/15/25 WISE US INC DES:Thera Pay ID:Thera Pay... 2,000.00
```

**PDF con watermarks (Wise)**:
```
This is not an official statement.
This is not an official statement.
This is not an official statement  ← WATERMARK en cada página!
```

### Estrategia de Manejo

1. **Detección automática de formato**:
   ```javascript
   function detectFileFormat(file) {
     const ext = file.name.split('.').pop().toLowerCase();
     if (ext === 'csv') return 'csv';
     if (ext === 'pdf') {
       const text = extractPDFText(file);
       if (text.includes('This is not an official statement')) {
         return 'pdf-watermarked';
       }
       return 'pdf-structured';
     }
     throw new Error('Unsupported format');
   }
   ```

2. **Parser específico por formato**:
   - `parser-csv.js` → Usa papa-parse
   - `parser-pdf-structured.js` → Usa pdf-parse + regex
   - `parser-pdf-watermarked.js` → Limpia watermarks primero

### Impacto en Schema
- Campo `source_type` debe incluir: `'pdf' | 'csv' | 'pdf-watermarked'`

---

## 2. 💱 Multi-Moneda y Exchange Rates

### Problema
Transacciones pueden tener:
- Monto original en moneda extranjera
- Monto convertido en moneda de la cuenta
- Exchange rate implícito (NO siempre explícito)
- Fee de foreign transaction como línea SEPARADA

### Ejemplos Reales

**BofA Credit Card** (2 líneas para 1 compra):
```
Date Description Amount
04/26 MERPAGO*COCOBONGO CIUDAD DE MEX
      1,900.00 MXN                             97.25 USD
04/26 FOREIGN TRANSACTION FEE                  2.91 USD
```

**Cálculo implícito**:
- Exchange rate: 1,900 / 97.25 = 19.538 MXN/USD
- Fee: 2.91 / 97.25 = 2.99% del monto convertido

**Scotiabank** (todo en MXN):
```
27 FEB TRANSF INTERBANCARIA SPEI
       /REMITTANCE TRAN B49NQ3DJ8KWZ
       WISE PAYMENTS LIMITED
       //110180000776462410              10,168.10 MXN
```

**Wise** (multi-currency nativo):
```
Sent | Eugenio Castro Garza                   7,268.94 MXN
September 22, 2025 | TRANSFER-1728462025
Fee: 3.92 USD                                  400 USD
```

### Estrategia de Manejo

1. **Detectar transacciones multi-moneda**:
   ```javascript
   function parseMultiCurrencyTransaction(description) {
     const regex = /([\d,]+\.\d{2})\s+(MXN|USD|EUR|GBP)/g;
     const matches = [...description.matchAll(regex)];

     if (matches.length === 2) {
       return {
         amountOriginal: parseFloat(matches[0][1].replace(',', '')),
         currencyOriginal: matches[0][2],
         amountConverted: parseFloat(matches[1][1].replace(',', '')),
         currencyConverted: matches[1][2],
         exchangeRate: calculateRate(matches[0][1], matches[1][1])
       };
     }
   }
   ```

2. **Detectar foreign fees posteriores**:
   ```javascript
   function linkForeignFee(transaction, nextTransaction) {
     if (
       nextTransaction.description.includes('FOREIGN TRANSACTION FEE') &&
       nextTransaction.date === transaction.date
     ) {
       transaction.foreign_fee_transaction_id = nextTransaction.id;
       nextTransaction.is_fee_for_transaction_id = transaction.id;
     }
   }
   ```

### Impacto en Schema

**Agregar campos**:
```sql
ALTER TABLE transactions ADD COLUMN amount_original DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN currency_original VARCHAR(3);
ALTER TABLE transactions ADD COLUMN exchange_rate DECIMAL(12,6);
ALTER TABLE transactions ADD COLUMN foreign_fee_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN is_fee_for_transaction_id TEXT;
```

---

## 3. 😱 Merchant Normalization Nightmare

### Problema
El MISMO merchant aparece con 8+ formatos diferentes dependiendo del banco.

### Ejemplos Reales - UBER

| Banco | Formato |
|-------|---------|
| Apple Card | `UBER *EATS MR TREUBLAAN 7 AMSTERDAM 1097 DP NH NLD` |
| Apple Card | `UBER * EATS PENDING MR TREUBLAAN 7 AMSTERDAM 1097 DP NH NLD` |
| Scotiabank | `ST UBER CARG RECUR.` |
| Scotiabank | `STR UBER EATS CARG RECUR.` |
| Scotiabank | `STR UBER EATS PENDING` |
| Scotiabank | `STRIPE UBER TRIP CIU` |
| Scotiabank | `STRIPE UBER EATS CIU` |
| Scotiabank | `UBER CORNERSHOP CARG RECUR.` |

**Todos son UBER! 8 formatos diferentes!**

### Ejemplos Reales - OpenAI

| Banco | Formato |
|-------|---------|
| Apple Card | `OPENAI 548 MARKET STREET PMB 97273 SAN FRANCISCO94104-5401CA USA` |
| Apple Card | `OPENAI *CHATGPT SUBSCR548 MARKET STREET PMB 97273 SAN FRANCISCO94104-5401CA USA` |
| BofA CC | `OPENAI *CHATGPT SUBSCR SAN FRANCISCOCA` |

### Estrategia de Manejo

**Nivel 1: Clustering por similitud de string**
```javascript
function clusterMerchants(transactions) {
  const clusters = {};

  for (const txn of transactions) {
    const canonical = findSimilarMerchant(txn.merchant, clusters);
    if (canonical) {
      clusters[canonical].push(txn);
    } else {
      clusters[txn.merchant] = [txn];
    }
  }

  return clusters;
}

function findSimilarMerchant(merchant, clusters) {
  for (const canonical in clusters) {
    if (stringSimilarity(merchant, canonical) > 0.75) {
      return canonical;
    }
  }
  return null;
}
```

**Nivel 2: Rules en DB**
```sql
INSERT INTO normalization_rules (pattern, canonical_merchant, rule_type) VALUES
('UBER.*EATS.*', 'Uber Eats', 'regex'),
('ST UBER.*', 'Uber', 'regex'),
('STR UBER.*', 'Uber', 'regex'),
('STRIPE UBER.*', 'Uber', 'regex'),
('OPENAI.*', 'OpenAI', 'regex'),
('OPENAI.*CHATGPT.*', 'OpenAI ChatGPT', 'regex');
```

**Nivel 3: User corrections**
```javascript
// Usuario dice: "UBER CORNERSHOP" → "Uber"
// Sistema crea rule automática
function learnFromUserCorrection(originalMerchant, correctedMerchant) {
  const pattern = generateRegexFromExample(originalMerchant);
  db.insert('normalization_rules', {
    pattern,
    canonical_merchant: correctedMerchant,
    rule_type: 'user-generated',
    confidence: 1.0
  });
}
```

### Impacto en Schema

**Tabla `normalization_rules`**:
```sql
CREATE TABLE normalization_rules (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,           -- "UBER.*EATS.*"
  canonical_merchant TEXT NOT NULL, -- "Uber Eats"
  rule_type TEXT NOT NULL,         -- 'regex' | 'exact' | 'contains' | 'user-generated'
  confidence DECIMAL(3,2),          -- 0.00 - 1.00
  priority INT DEFAULT 100,         -- Lower = higher priority
  created_at TEXT NOT NULL,
  created_by TEXT                   -- 'system' | user_id
);
```

---

## 4. 🔄 Transferencias Entre Cuentas Propias

### Problema
El MISMO dinero aparece 2 veces:
1. Como withdrawal en cuenta origen
2. Como deposit en cuenta destino

Sin linking explícito, parece que gastaste Y recibiste dinero.

### Ejemplos Reales

**Caso 1: BofA Checking → Apple Card**

BofA Checking (05/01/25):
```
APPLECARD GSBANK DES:PAYMENT ID:XXXXXXXXX
INDN:Eugenio Castro Garza CO ID:9999999999 WEB    -1,835.11
```

Apple Card Statement (08/30/25):
```
ACH DEPOSIT INTERNET TRANSFER FROM ACCOUNT ENDING IN 5226
Payment                                              -500.00
```

**Problema**: Diferentes fechas, diferentes montos (statement periods diferentes), descripción NO match.

**Caso 2: BofA Checking → BofA Credit Card**

```
04/23 BANK OF AMERICA CREDIT CARD Bill Payment      -843.62
04/24 Bank of America Credit Card Bill Payment      -174.38
04/28 Bank of America Credit Card Bill Payment       -5.00
```

**Caso 3: Scotiabank traspaso interno**

```
17 FEB SWEB TRASPASO ENTRE CUENTAS                  -1,200.00
       EUGENIO CASTRO GARZA
```

### Estrategia de Manejo

**Nivel 1: Heurística básica**
```javascript
function detectTransfers(transactions) {
  const transfers = [];

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const txn1 = transactions[i];
      const txn2 = transactions[j];

      // Check if amounts match (one positive, one negative)
      if (Math.abs(txn1.amount + txn2.amount) < 0.01) {
        // Check if dates are within 3 days
        const daysDiff = Math.abs(
          (new Date(txn1.date) - new Date(txn2.date)) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff <= 3) {
          // Check if descriptions suggest transfer
          if (
            isTransferDescription(txn1.description) ||
            isTransferDescription(txn2.description)
          ) {
            transfers.push({ from: txn1, to: txn2, confidence: 0.85 });
          }
        }
      }
    }
  }

  return transfers;
}

function isTransferDescription(desc) {
  const keywords = [
    'TRANSFER', 'TRASPASO', 'BILL PAYMENT', 'ACH DEPOSIT',
    'INTERNET TRANSFER', 'APPLECARD GSBANK', 'CREDIT CARD'
  ];
  return keywords.some(kw => desc.toUpperCase().includes(kw));
}
```

**Nivel 2: Cross-currency transfers**
```javascript
function detectCrossCurrencyTransfer(txn1, txn2) {
  if (txn1.currency !== txn2.currency) {
    // Example: BofA sends 500 USD, Scotiabank receives 10,168 MXN
    // Exchange rate: 10168 / 500 = 20.33 MXN/USD
    const rate = Math.abs(txn2.amount / txn1.amount);

    // Check if rate is reasonable (15-25 for MXN/USD)
    if (rate > 15 && rate < 25) {
      return { linked: true, exchange_rate: rate, confidence: 0.75 };
    }
  }
  return { linked: false };
}
```

**Nivel 3: User confirmation**
```javascript
// UI shows potential transfers, user confirms
function confirmTransferLink(txn1_id, txn2_id) {
  const pair_id = generateUUID();

  db.update('transactions', { id: txn1_id }, {
    transfer_pair_id: pair_id,
    type: 'transfer'
  });

  db.update('transactions', { id: txn2_id }, {
    transfer_pair_id: pair_id,
    type: 'transfer'
  });
}
```

### Impacto en Schema

**Campo existente**: `transfer_pair_id` TEXT
**Agregar**: `transfer_detection_confidence` DECIMAL(3,2)

---

## 5. ↩️ Refunds, Reversals y Adjustments

### Problema
3 tipos diferentes de "cancelaciones":
1. **Refund**: Merchant devuelve dinero (días/semanas después)
2. **Reversal**: Banco cancela transacción (mismo día, generalmente pending)
3. **Adjustment**: Corrección posterior (error de sistema)

### Ejemplos Reales

**Refund (PayPal - BofA CC)**:
```
05/02 PAYPAL *PPLFINDERS WWW 4029357733 CA        -24.95
```
Es un refund porque aparece como negative purchase (no como reversal).

**Reversal (Scotiabank - múltiples el mismo día)**:
```
20 FEB STR UBER EATS CARG RECUR.                  -1,365.56
20 FEB REV.STR UBER EATS CARG RECUR.              +1,365.56  ← PREFIX "REV."

20 FEB STR UBER EATS CARG RECUR.                    -424.56
20 FEB REV.STR UBER EATS CARG RECUR.                +424.56  ← REVERSA OTRA VEZ

20 FEB UBER CORNERSHOP CARG RECUR.                  -424.56
20 FEB REV.UBER CORNERSHOP CARG RECUR.              +424.56  ← Y OTRA!
```

**Reversal 4X el mismo día**:
```
19 FEB STR UBER EATS CARG RECUR.                    -640.98
19 FEB STR UBER EATS CARG RECUR.                    -640.98
19 FEB REV.STR UBER EATS CARG RECUR.                +640.98
19 FEB REV.STR UBER EATS CARG RECUR.                +640.98
19 FEB UBER CORNERSHOP CARG RECUR.                  -640.98
19 FEB REV.UBER CORNERSHOP CARG RECUR.              +640.98
19 FEB ST UBER CARG RECUR.                          -153.14
19 FEB REV.ST UBER CARG RECUR.                      +153.14
```

**Adjustment (Scotiabank)**:
```
21 FEB STR UBER EATS (AJUSTE)                       +68.06
26 FEB UBER CORNERSHOP (AJUSTE)                    +104.87
```
Nota: `(AJUSTE)` en el nombre, NO es reversal.

**Cancelación (Wise)**:
```
Cancelled | Eugenio Castro Garza                2,000 USD
April 23, 2025 | TRANSFER-1500844343 | To MXN
```

### Estrategia de Manejo

**Detectar reversals**:
```javascript
function detectReversals(transactions) {
  const reversals = [];

  for (let i = 0; i < transactions.length - 1; i++) {
    const curr = transactions[i];
    const next = transactions[i + 1];

    // Check if next transaction is reversal of current
    if (
      next.description.startsWith('REV.') &&
      next.date === curr.date &&
      Math.abs(next.amount + curr.amount) < 0.01
    ) {
      reversals.push({
        original: curr,
        reversal: next,
        type: 'reversal'
      });
    }
  }

  return reversals;
}
```

**Detectar adjustments**:
```javascript
function isAdjustment(transaction) {
  return (
    transaction.description.includes('(AJUSTE)') ||
    transaction.description.includes('ADJUSTMENT')
  );
}
```

**Detectar refunds**:
```javascript
function detectRefunds(transactions) {
  // Refunds are harder - same merchant, opposite sign, days/weeks later
  const refunds = [];

  for (const txn of transactions) {
    if (txn.amount > 0 && txn.type === 'expense') {
      // Positive amount for expense = likely refund
      // Find matching charge in previous 90 days
      const originalCharge = findMatchingCharge(
        txn.merchant,
        -txn.amount,
        txn.date
      );

      if (originalCharge) {
        refunds.push({
          original: originalCharge,
          refund: txn,
          type: 'refund'
        });
      }
    }
  }

  return refunds;
}
```

### Impacto en Schema

**Agregar campos**:
```sql
ALTER TABLE transactions ADD COLUMN is_reversal BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN is_adjustment BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN is_refund BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN reversal_of_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN refund_of_transaction_id TEXT;
```

**UI debe mostrar**:
- Original charge con nota "(Reversed)" si fue reversado
- Adjustment con tooltip explicando
- Refunds linked al charge original

---

## 6. ⏳ Pending vs Posted Transactions

### Problema
Transacciones pueden aparecer como "pending" primero, luego "posted" con:
- Fecha diferente
- Monto ligeramente diferente (exchange rate cambió)
- Description diferente

### Ejemplos Reales

**Apple Card**:
```csv
Transaction Date,Clearing Date,Description
08/05/2025,08/06/2025,"UBER * EATS PENDING..."    212.59
```
Note: Transaction date = 08/05, Clearing date = 08/06 (1 day later)

**Scotiabank - pending → cancelled → final**:
```
20 FEB STR UBER EATS PENDING                      -778.87  ← PENDING
21 FEB REV.STR UBER EATS PENDING                  +778.87  ← CANCELLED
21 FEB UBER CORNERSHOP                            -778.87  ← FINAL CHARGE (different merchant!)
```

**BofA - pending detection**:
```
REV.CHECKCARD 0502 UBER* ONE UBER.COM/MX/E
```
Prefix "REV." indica que fue pending y luego reversed.

### Estrategia de Manejo

**Opción A: Ignorar pending durante import**
```javascript
function shouldImportTransaction(transaction) {
  const pendingKeywords = ['PENDING', 'PEND', 'AUTHORIZATION'];

  if (pendingKeywords.some(kw => transaction.description.includes(kw))) {
    // Skip pending transactions, wait for posted
    return false;
  }

  return true;
}
```

**Opción B: Import pending, update cuando posted**
```javascript
function matchPendingToPosted(pending, posted) {
  return (
    pending.merchant === posted.merchant &&
    Math.abs(pending.amount - posted.amount) < 5.00 && // Allow small diff
    Math.abs(dateDiff(pending.date, posted.date)) <= 5  // Within 5 days
  );
}

function handlePostedTransaction(newTxn) {
  const pendingTxn = db.findPending(newTxn.merchant, newTxn.date);

  if (pendingTxn) {
    // Update existing pending transaction
    db.update('transactions', { id: pendingTxn.id }, {
      amount: newTxn.amount,
      date: newTxn.date,
      is_pending: false,
      posted_at: newTxn.date
    });
  } else {
    // Insert as new transaction
    db.insert('transactions', newTxn);
  }
}
```

### Impacto en Schema

**Agregar campos**:
```sql
ALTER TABLE transactions ADD COLUMN is_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN transaction_date DATE; -- When initiated
ALTER TABLE transactions ADD COLUMN posted_date DATE;      -- When cleared
```

**Índice para búsqueda rápida**:
```sql
CREATE INDEX idx_pending_transactions
ON transactions(merchant, is_pending, transaction_date)
WHERE is_pending = TRUE;
```

---

## 7. 💸 Fees Como Transacciones Separadas

### Problema
Algunos bancos ponen fees como línea separada, otros los incluyen en el monto.

### Ejemplos Reales

**BofA Credit Card - foreign fee separado (CADA compra internacional)**:
```
04/26 MERPAGO*COCOBONGO CIUDAD DE MEX             97.25
      1,900.00 MXN
04/26 FOREIGN TRANSACTION FEE                      2.91  ← SEPARADO!

04/26 CLIP MX*HANAICHI BENITO JUAREZ              94.95
      1,855.00 MXN
04/26 FOREIGN TRANSACTION FEE                      2.84  ← OTRA VEZ SEPARADO!
```

**Scotiabank - fee como cargo**:
```
05/09 DIRECT DEPOSIT BANK OF AMER                600.00  ← Charge
05/09 DIRECT DEPOSIT - TRANSACTION FEE           -24.00  ← Fee (4% fee!)
```

**Wise - fee en columna separada (inline)**:
```
Fee: 3.92 USD  |  Amount: 400 USD
```

**BofA Checking - international fee**:
```
05/02 CHECKCARD 0502 UBER* ONE UBER.COM/MX/E      -3.57
05/02 INTERNATIONAL TRANSACTION FEE                -0.11  ← TINY fee separado
```

### Estrategia de Manejo

**Detectar fees posteriores**:
```javascript
function linkTransactionFees(transactions) {
  for (let i = 0; i < transactions.length - 1; i++) {
    const curr = transactions[i];
    const next = transactions[i + 1];

    // Check if next is a fee for current
    if (
      next.date === curr.date &&
      isFeeDescription(next.description) &&
      Math.abs(next.amount) < Math.abs(curr.amount) * 0.10 // Fee < 10% of amount
    ) {
      curr.linked_fee_transaction_id = next.id;
      next.is_fee_for_transaction_id = curr.id;
    }
  }
}

function isFeeDescription(desc) {
  const keywords = [
    'FEE', 'FOREIGN TRANSACTION', 'INTERNATIONAL TRANSACTION',
    'TRANSACTION FEE', 'SERVICE CHARGE'
  ];
  return keywords.some(kw => desc.toUpperCase().includes(kw));
}
```

**Calcular fee percentage**:
```javascript
function calculateFeePercentage(transaction, feeTransaction) {
  return (Math.abs(feeTransaction.amount) / Math.abs(transaction.amount)) * 100;
}
```

### Impacto en Schema

**Ya agregado arriba**:
- `linked_fee_transaction_id` TEXT
- `is_fee_for_transaction_id` TEXT

**UI debe mostrar**:
```
Transaction: MERPAGO*COCOBONGO    $97.25
  + Foreign Fee                    $2.91 (2.99%)
  ----------------------------------------
  Total                           $100.16
```

---

## 8. 🔁 Subscriptions y Recurring Payments

### Problema
Detectar qué cargos son subscriptions automáticas vs compras one-time.

### Ejemplos Reales

**Apple Card - explicit installments**:
```
MONTHLY INSTALLMENTS (22 OF 24)                   49.95
MONTHLY INSTALLMENTS (21 OF 24)                   49.95
```

**Scotiabank - suffix "CARG RECUR."**:
```
ST UBER CARG RECUR.
STR UBER EATS CARG RECUR.
GOOGLE ONE GOOGLE ONE CARG RE
GOOGLE YOUTUBEPREMIUM CARG RE
```

**BofA - suffix "RECURRING"**:
```
CHECKCARD 0501 SLACK T04HFBU1QF4 DUBLIN...RECURRING  -10.15
CHECKCARD 0507 X CORP. PAID FEATURES...RECURRING     -41.29
```

**BofA Credit Card - monthly charges**:
```
05/07 SPOTIFY 8777781161 NY                       11.99
04/07 SPOTIFY 8777781161 NY                       11.99  ← Same merchant, ~30 days
03/07 SPOTIFY 8777781161 NY                       11.99  ← Pattern!
```

### Estrategia de Manejo

**Nivel 1: Explicit keywords**:
```javascript
function isRecurringByKeyword(description) {
  const keywords = [
    'RECURRING', 'RECUR', 'SUBSCRIPTION', 'MONTHLY',
    'CARG RECUR', 'INSTALLMENT'
  ];
  return keywords.some(kw => description.toUpperCase().includes(kw));
}
```

**Nivel 2: Pattern detection**:
```javascript
function detectRecurringPattern(transactions, merchant) {
  const merchantTxns = transactions.filter(t => t.merchant === merchant);

  if (merchantTxns.length < 3) return null; // Need 3+ for pattern

  // Sort by date
  merchantTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < merchantTxns.length; i++) {
    const days = dateDiffInDays(merchantTxns[i-1].date, merchantTxns[i].date);
    intervals.push(days);
  }

  // Check if intervals are consistent (±3 days tolerance)
  const avgInterval = average(intervals);
  const consistent = intervals.every(i => Math.abs(i - avgInterval) <= 3);

  if (consistent) {
    // Determine frequency
    let frequency;
    if (avgInterval >= 28 && avgInterval <= 32) frequency = 'monthly';
    else if (avgInterval >= 89 && avgInterval <= 92) frequency = 'quarterly';
    else if (avgInterval >= 363 && avgInterval <= 367) frequency = 'yearly';
    else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
    else frequency = `every-${Math.round(avgInterval)}-days`;

    return {
      merchant,
      frequency,
      avgInterval,
      confidence: 0.90,
      nextExpectedDate: addDays(merchantTxns[merchantTxns.length - 1].date, avgInterval)
    };
  }

  return null;
}
```

**Nivel 3: Store recurring groups**:
```javascript
function createRecurringGroup(pattern, transactions) {
  const groupId = generateUUID();

  db.insert('recurring_groups', {
    id: groupId,
    merchant: pattern.merchant,
    frequency: pattern.frequency,
    avg_interval_days: pattern.avgInterval,
    avg_amount: average(transactions.map(t => t.amount)),
    confidence: pattern.confidence,
    next_expected_date: pattern.nextExpectedDate,
    created_at: new Date().toISOString()
  });

  // Link transactions to group
  transactions.forEach(txn => {
    db.update('transactions', { id: txn.id }, {
      recurring_group_id: groupId
    });
  });
}
```

### Impacto en Schema

**Tabla `recurring_groups`** (ya documentada en flow-9):
```sql
CREATE TABLE recurring_groups (
  id TEXT PRIMARY KEY,
  merchant TEXT NOT NULL,
  frequency TEXT NOT NULL,           -- 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  avg_interval_days INT,
  avg_amount DECIMAL(12,2),
  confidence DECIMAL(3,2),
  next_expected_date DATE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Campo en transactions**:
- `recurring_group_id` TEXT (already exists)

---

## 9. 💳 Payments Como Negativos

### Problema
En **credit card statements**, "Payment" (pago DE la tarjeta) aparece como monto NEGATIVO.

En **checking accounts**, payment TO credit card es withdrawal (positivo para retiro).

### Ejemplos Reales

**Apple Card CSV**:
```csv
Type,Amount (USD)
Payment,-500.00     ← Negative = pagaste la tarjeta
Purchase,10.00      ← Positive = gastaste
```

**BofA Checking**:
```
04/23 BANK OF AMERICA CREDIT CARD Bill Payment    -843.62  ← Negative = salió dinero
```

**BofA Credit Card Statement**:
```
Payments and Other Credits                       -$213.68  ← Negative balance reduction
```

### Estrategia de Manejo

**Durante parsing, normalizar según account type**:
```javascript
function normalizeAmount(amount, accountType, transactionType) {
  if (accountType === 'credit-card') {
    if (transactionType === 'payment') {
      // Payment on CC statement reduces balance (negative)
      // We want to store as positive in DB (it's incoming money)
      return Math.abs(amount);
    } else {
      // Purchase increases balance
      // Store as negative (it's outgoing money)
      return -Math.abs(amount);
    }
  } else if (accountType === 'checking') {
    // Checking: negative = withdrawal (standard)
    return amount;
  }
}
```

**Classification**:
```javascript
function classifyTransaction(description, amount, accountType) {
  if (accountType === 'credit-card') {
    if (description.includes('PAYMENT') || amount < 0) {
      return 'payment-to-cc';
    } else {
      return 'purchase';
    }
  } else {
    if (amount < 0) return 'expense';
    if (amount > 0) return 'income';
  }
}
```

### Impacto en Schema

**Campo `account.type`**:
```sql
ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'checking';
-- Values: 'checking' | 'savings' | 'credit-card' | 'investment'
```

**UI debe mostrar correctamente**:
- Credit Card: "Payment -$500" → Display como "Payment Received $500"
- Checking: "Payment -$500" → Display como "Paid $500"

---

## 10. 🇲🇽 Cobranzas Domiciliadas (México)

### Problema
México tiene un sistema especial para pagos automáticos llamado "Cobranza Domiciliada" con formato único.

### Ejemplos Reales

**Scotiabank**:
```
17 FEB 03 POR COBRANZA DOMICILIADA                -3,139.82
       RFC/CURP: SAT8410245V8
       IVA: 433.08
       FOLIO DE RASTREO: 00020250217000268
       NUMERO REFERENCIA: 3082452

03 MAR 03 POR COBRANZA DOMICILIADA                -1,024.00
       RFC/CURP: CNM980114PI2
       IVA: 0.00
       FOLIO DE RASTREO: 00020250303049861
       NUMERO REFERENCIA: 0004321
```

**Estructura**:
- "03 POR COBRANZA DOMICILIADA" = prefix
- RFC/CURP = tax ID del cobrador
- IVA = tax amount
- FOLIO DE RASTREO = tracking number
- NUMERO REFERENCIA = merchant reference

### Estrategia de Manejo

**Parser específico**:
```javascript
function parseCobranzaDomiciliada(description) {
  if (!description.includes('COBRANZA DOMICILIADA')) return null;

  const rfcMatch = description.match(/RFC\/CURP:\s*([A-Z0-9]+)/);
  const ivaMatch = description.match(/IVA:\s*([\d,]+\.\d{2})/);
  const folioMatch = description.match(/FOLIO DE RASTREO:\s*(\d+)/);
  const refMatch = description.match(/NUMERO REFERENCIA:\s*(\d+)/);

  return {
    type: 'cobranza-domiciliada',
    rfc: rfcMatch ? rfcMatch[1] : null,
    iva: ivaMatch ? parseFloat(ivaMatch[1].replace(',', '')) : 0,
    folio: folioMatch ? folioMatch[1] : null,
    reference: refMatch ? refMatch[1] : null
  };
}
```

**Lookup merchant por RFC**:
```javascript
// Maintain DB of known RFCs
const rfcToMerchant = {
  'SAT8410245V8': 'SAT (Impuestos)',
  'CNM980114PI2': 'CFE (Luz)',
  // etc
};

function resolveMerchantByRFC(rfc) {
  return rfcToMerchant[rfc] || `Unknown RFC: ${rfc}`;
}
```

### Impacto en Schema

**Agregar campos**:
```sql
ALTER TABLE transactions ADD COLUMN rfc TEXT;              -- Tax ID
ALTER TABLE transactions ADD COLUMN iva_amount DECIMAL(12,2); -- Tax amount
ALTER TABLE transactions ADD COLUMN folio_rastreo TEXT;    -- Tracking
ALTER TABLE transactions ADD COLUMN numero_referencia TEXT; -- Reference
```

**Tabla auxiliar**:
```sql
CREATE TABLE rfc_registry (
  rfc TEXT PRIMARY KEY,
  merchant_name TEXT NOT NULL,
  merchant_type TEXT,
  verified BOOLEAN DEFAULT FALSE
);
```

---

## 11. 🏷️ Categorización Inconsistente

### Problema
Solo 2 de 5 bancos proveen categorías, y las categorías son diferentes.

### Ejemplos Reales

**Apple Card** (tiene categorías):
```csv
Category
Restaurants
Other
Interest
Payment
Installment
```

**Stripe** (tiene "Type" que es como categoría):
```csv
Type
payout
payment
charge
stripe_fee
```

**BofA, Wise, Scotiabank**: ❌ NO tienen categorías

### Estrategia de Manejo

**No confiar en categorías del banco, usar sistema propio**:
```javascript
function categorizeTransaction(transaction) {
  // Ignore bank-provided category
  // Use our normalization rules

  const rule = db.query(`
    SELECT suggested_category_id, confidence
    FROM normalization_rules
    WHERE merchant = ? OR ? LIKE pattern
    ORDER BY priority ASC
    LIMIT 1
  `, [transaction.merchant, transaction.merchant]);

  if (rule && rule.confidence > 0.70) {
    return {
      category_id: rule.suggested_category_id,
      category_confidence: rule.confidence,
      category_source: 'auto-rule'
    };
  }

  // Fallback to ML/heuristics
  return {
    category_id: null,
    category_confidence: 0,
    category_source: 'manual-needed'
  };
}
```

**Store bank category for reference**:
```sql
ALTER TABLE transactions ADD COLUMN bank_provided_category TEXT;
```

---

## 12. 🆔 Transaction IDs Diferentes

### Problema
Cada banco usa formato diferente para IDs.

### Ejemplos Reales

- **Scotiabank**: `0013732041` (numeric, short)
- **BofA**: No explicit ID visible
- **Wise**: `TRANSFER-1728462025`
- **Stripe**: `txn_1ReEKHIQid3PFnGVmzoauqsc`
- **Apple Card**: No explicit ID in CSV

### Estrategia de Manejo

**Generar nuestro propio ID estable**:
```javascript
function generateStableID(transaction) {
  // Use hash of key fields to generate deterministic ID
  const content = [
    transaction.account_id,
    transaction.date,
    transaction.merchant,
    transaction.amount,
    transaction.source_file
  ].join('|');

  return crypto.createHash('sha256').update(content).digest('hex');
}
```

**Store bank ID for reference**:
```sql
ALTER TABLE transactions ADD COLUMN bank_transaction_id TEXT;
```

---

## 13. 📈 Interest Charges

### Problema
Interest charges pueden ser por:
- Balance total
- Cash advances (higher rate)
- Balance transfers
- Cada uno con APR diferente

### Ejemplos Reales

**Apple Card**:
```
INTEREST CHARGE                                   66.05
INTEREST CHARGE                                   87.47
```

**BofA Credit Card** (breakdown por tipo):
```
05/27 INTEREST CHARGED ON PURCHASES                0.00
05/27 INTEREST CHARGED ON BALANCE TRANSFERS        0.00
05/27 INTEREST CHARGED ON DIR DEP&CHK CASHADV     21.94  ← Solo este tiene interest
05/27 INTEREST CHARGED ON BANK CASH ADVANCES       0.00
```

**BofA CC Statement detail**:
```
Type of Balance    APR     Balance    Interest
Purchases          27.49%  $0.00      $0.00
Balance Transfers  27.49%  $0.00      $0.00
Direct Deposit     28.99%  $920.93    $21.94  ← Higher APR!
Bank Cash Advances 28.99%  $0.00      $0.00
```

### Estrategia de Manejo

**Parse interest breakdown**:
```javascript
function parseInterestCharges(transactions) {
  const interestTxns = transactions.filter(t =>
    t.description.includes('INTEREST')
  );

  for (const txn of interestTxns) {
    if (txn.description.includes('PURCHASES')) {
      txn.interest_type = 'purchases';
    } else if (txn.description.includes('CASH ADV')) {
      txn.interest_type = 'cash-advance';
    } else if (txn.description.includes('BALANCE TRANSFER')) {
      txn.interest_type = 'balance-transfer';
    } else {
      txn.interest_type = 'general';
    }
  }
}
```

### Impacto en Schema

```sql
ALTER TABLE transactions ADD COLUMN interest_type TEXT;
-- Values: 'purchases' | 'cash-advance' | 'balance-transfer' | 'general'
```

---

## 14. 💵 Cash Advances

### Problema
Usar credit card para sacar efectivo (o depositar a checking) tiene fees altos.

### Ejemplos Reales

**BofA Credit Card**:
```
05/09 DIRECT DEPOSIT BANK OF AMER                600.00  ← Usando CC como ATM
05/09 DIRECT DEPOSIT - TRANSACTION FEE           -24.00  ← 4% fee!
05/27 INTEREST CHARGED ON DIR DEP&CHK CASHADV     21.94  ← Interest desde día 1
```

**Total cost**: $600 → $24 fee + $21.94 interest = $645.94 (7.6% cost!)

**Apple Card - no cash advance visible** (maybe not allowed)

### Estrategia de Manejo

**Flag cash advances**:
```javascript
function isCashAdvance(transaction, accountType) {
  if (accountType !== 'credit-card') return false;

  const keywords = [
    'ATM', 'CASH ADVANCE', 'DIRECT DEPOSIT BANK OF AMER',
    'OVERDRAFT PROTECTION', 'CASH EQUIVALENT'
  ];

  return keywords.some(kw => transaction.description.includes(kw));
}
```

**Warn user in UI**:
```javascript
if (transaction.is_cash_advance) {
  UI.showWarning(`
    ⚠️ Cash Advance detected!
    Fee: $${transaction.cash_advance_fee}
    Interest from day 1 at ${transaction.apr}%
    Total cost: $${calculateTotalCost(transaction)}
  `);
}
```

### Impacto en Schema

```sql
ALTER TABLE transactions ADD COLUMN is_cash_advance BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN cash_advance_fee DECIMAL(12,2);
```

---

## 15. 📅 Installment Plans

### Problema
Tracking de pagos en cuotas.

### Ejemplos Reales

**Apple Card**:
```
08/31 MONTHLY INSTALLMENTS (22 OF 24)            49.95
07/31 MONTHLY INSTALLMENTS (21 OF 24)            49.95
```

**Parse del paréntesis**:
- Current: 22
- Total: 24
- Remaining: 2 payments

### Estrategia de Manejo

**Parse installment info**:
```javascript
function parseInstallment(description) {
  const match = description.match(/\((\d+)\s+OF\s+(\d+)\)/i);

  if (match) {
    return {
      current: parseInt(match[1]),
      total: parseInt(match[2]),
      remaining: parseInt(match[2]) - parseInt(match[1])
    };
  }

  return null;
}
```

**Link installments together**:
```javascript
function linkInstallments(transactions) {
  const installments = transactions
    .map(t => ({ ...t, info: parseInstallment(t.description) }))
    .filter(t => t.info !== null);

  // Group by merchant + total
  const groups = {};
  for (const txn of installments) {
    const key = `${txn.merchant}_${txn.info.total}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(txn);
  }

  // Assign group IDs
  for (const group of Object.values(groups)) {
    const groupId = generateUUID();
    group.forEach(txn => {
      txn.installment_group_id = groupId;
    });
  }
}
```

### Impacto en Schema

```sql
ALTER TABLE transactions ADD COLUMN installment_current INT;
ALTER TABLE transactions ADD COLUMN installment_total INT;
ALTER TABLE transactions ADD COLUMN installment_group_id TEXT;
```

---

## 16. 💱 Exchange Rates Implícitos

### Problema
Exchange rate NO siempre está explícito, hay que calcularlo.

### Ejemplos Reales

**BofA CC**:
```
AEROMEXICO WEB PN CIUDAD DE MEXMEX
4,516.00 MXN                                     231.78 USD
```

**Cálculo**:
- Exchange rate: 4,516 / 231.78 = 19.487 MXN/USD
- Pero NO está en el statement!

### Estrategia de Manejo

Ya cubierto en **Edge Case #2 (Multi-Moneda)**.

---

## 17. 🔄🔄🔄 Reversals Múltiples del Mismo Cargo

### Problema
Scotiabank hace múltiples attempts del mismo cargo, reversando cada uno.

### Ejemplos Reales

Ya documentado en **Edge Case #5 (Refunds, Reversals y Adjustments)**.

El caso extremo es **8 transacciones en 1 día para 1 cargo real**.

---

## 18. 💰 Running Balance

### Problema
Algunos bancos muestran balance después de cada transacción, otros no.

### Ejemplos Reales

**Scotiabank** (running balance):
```
Date  Description                    Deposit  Retiro    Saldo
17 FEB SWEB TRANSF.INTERB SPEI                 500.00   15,287.37
17 FEB SWEB TRANSF.INTERB SPEI                3,700.00  11,587.37
```

**Apple Card**: ❌ No balance
**Stripe**: Balance implícito en "Net" column
**BofA Checking**: ✅ Balance después de cada txn
**Wise**: ❌ No balance

### Estrategia de Manejo

**Si el banco provee balance, VALIDAR nuestro cálculo**:
```javascript
function validateBalance(transactions) {
  let calculatedBalance = transactions[0].balance; // Starting balance

  for (let i = 1; i < transactions.length; i++) {
    const txn = transactions[i];
    calculatedBalance += txn.amount;

    if (txn.bank_reported_balance) {
      const diff = Math.abs(calculatedBalance - txn.bank_reported_balance);

      if (diff > 0.01) {
        console.error(`Balance mismatch on ${txn.date}:
          Calculated: ${calculatedBalance}
          Bank reported: ${txn.bank_reported_balance}
          Difference: ${diff}
        `);

        // Trust bank balance, adjust
        calculatedBalance = txn.bank_reported_balance;
      }
    }
  }
}
```

### Impacto en Schema

```sql
ALTER TABLE transactions ADD COLUMN bank_reported_balance DECIMAL(12,2);
```

---

## 19. 🌍 Timezone Issues

### Problema
Transacciones internacionales pueden tener timezone confusion.

### Ejemplos Reales

**Wise**:
```
Generated on: October 1, 2025 [EST]
September 22, 2025 | Transaction: TRANSFER-1728462025
```

**BofA**:
```
Transaction Date: 08/05/2025
Posting Date: 08/06/2025
```

**Problema**: Si upload en México (CST), fecha puede interpretarse wrong.

### Estrategia de Manejo

**Store dates como strings (ISO 8601)**:
```javascript
function parseDate(dateString, sourceTimezone) {
  // Always store in ISO 8601 format: YYYY-MM-DD
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // "2025-10-01"
}
```

**No hacer timezone conversion para dates (solo times)**:
```javascript
// ❌ NO hacer esto
const date = new Date('2025-10-01').toLocaleString('America/Mexico_City');

// ✅ Hacer esto
const date = '2025-10-01'; // Store as string
```

---

## 20. 🔗 Account Linking Metadata

### Problema
Transfers mencionan cuenta destino con diferentes formatos.

### Ejemplos Reales

**BofA**:
```
ACH DEPOSIT INTERNET TRANSFER FROM ACCOUNT ENDING IN 5226
```

**Scotiabank**:
```
CLABE: 044691256045703727
```

### Estrategia de Manejo

**Extract account identifiers**:
```javascript
function extractAccountLink(description) {
  // BofA format
  const bofaMatch = description.match(/ACCOUNT ENDING IN (\d{4})/);
  if (bofaMatch) return { type: 'last-4', value: bofaMatch[1] };

  // CLABE format
  const clabeMatch = description.match(/CLABE:?\s*(\d{18})/);
  if (clabeMatch) return { type: 'clabe', value: clabeMatch[1] };

  return null;
}
```

### Impacto en Schema

```sql
ALTER TABLE transactions ADD COLUMN linked_account_identifier TEXT;
ALTER TABLE transactions ADD COLUMN linked_account_type TEXT;
-- Values: 'last-4' | 'clabe' | 'iban' | 'routing-account'
```

---

## 21. 📋 Tax Info (RFC en México)

### Problema
Scotiabank incluye RFC (tax ID) para CADA merchant, otros bancos no.

### Ejemplos Reales

**Scotiabank**:
```
GNC TDA NAT 465
REF. 0013732041 AUT. 426383
RFC MAX 0611157H8

UBER CORNERSHOP
REF. 0013732041 AUT. 621022
RFC UPM 200220LK5

STARBUCKS AVERANDA
REF. 0013732041 AUT. 727904
RFC CSI 020226MV4
```

### Estrategia de Manejo

**Parse RFC**:
```javascript
function extractRFC(description) {
  const match = description.match(/RFC\s+([A-Z0-9]{12,13})/);
  return match ? match[1] : null;
}
```

**Build RFC registry**:
```javascript
function learnRFC(merchant, rfc) {
  db.upsert('rfc_registry', { rfc }, {
    merchant_name: merchant,
    verified: true
  });
}
```

Already covered in **Edge Case #10 (Cobranzas Domiciliadas)**.

---

## 22. 📦 Metadata Overload

### Problema
Algunas descriptions tienen MUCHA metadata sin estructura.

### Ejemplos Reales

**BofA Checking**:
```
WISE US INC
DES:Thera Pay
ID:Thera Pay
INDN:Eugenio Castro Garza
CO ID:1453233521
CCD PMT INFO:From Bloom Financial Corp. Via WISE
```

**Scotiabank**:
```
GNC TDA NAT 465 VASCON
REF. 0013732041 AUT. 426383
RFC MAX 0611157H8
```

### Estrategia de Manejo

**Parse structured metadata**:
```javascript
function parseMetadata(description) {
  const metadata = {};

  // BofA format: KEY:Value
  const bofaMatches = description.matchAll(/([A-Z\s]+):([^:]+?)(?=\s+[A-Z\s]+:|$)/g);
  for (const match of bofaMatches) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    metadata[key] = match[2].trim();
  }

  // Scotiabank format: KEY value
  const scotiaRFC = description.match(/RFC\s+([A-Z0-9]+)/);
  if (scotiaRFC) metadata.rfc = scotiaRFC[1];

  const scotiaRef = description.match(/REF\.\s+(\d+)/);
  if (scotiaRef) metadata.ref = scotiaRef[1];

  const scotiaAut = description.match(/AUT\.\s+(\d+)/);
  if (scotiaAut) metadata.aut = scotiaAut[1];

  return metadata;
}
```

**Store metadata as JSON**:
```sql
ALTER TABLE transactions ADD COLUMN metadata JSON;
```

---

## 23. 🇲🇽 SPEI Transfers (México)

### Problema
SPEI (Mexican wire transfer) tiene formato único con mucha info.

### Ejemplos Reales

**Scotiabank**:
```
SWEB TRANSF.INTERB SPEI
BBVA MEXICO
TRANSFERENCIA A JESHUA
/36618830 09:22:06
2025021640044B36L0000353529604
FECHA OPERACION: 16 FEB
RUIZ DURAN JESHUA
/012180015292378236
Amount: -500.00
```

**Estructura**:
- Bank name: "BBVA MEXICO"
- Recipient: "JESHUA"
- Tracking: "2025021640044B36L0000353529604"
- Date: "16 FEB"
- Full name: "RUIZ DURAN JESHUA"
- Account: "012180015292378236"

### Estrategia de Manejo

**Parser específico**:
```javascript
function parseSPEI(description) {
  if (!description.includes('TRANSF.INTERB SPEI')) return null;

  const lines = description.split('\n');

  return {
    type: 'spei',
    bank: lines[1],
    recipient_short: lines[2].replace('TRANSFERENCIA A ', ''),
    tracking_id: lines[4],
    operation_date: lines[5].replace('FECHA OPERACION: ', ''),
    recipient_full: lines[6],
    recipient_account: lines[7].replace('/', '')
  };
}
```

### Impacto en Schema

Already covered - use `metadata` JSON field.

---

## 24. ⚙️ Adjustments vs Reversals

### Problema
"Adjustment" es diferente de "Reversal".

**Reversal**: Cancela transacción pending (mismo día)
**Adjustment**: Corrección de error después de posted (días después)

Already covered in **Edge Case #5**.

---

## 25. 💵 Deposits Con Metadata

### Problema
Wise "Added money" NO es transacción bancaria real, es top-up interno.

### Ejemplos Reales

**Wise**:
```
Added | To EUR                                    22 EUR
February 20, 2025 | TRANSFER-1421528428 | Category: Money added
Fee: 0.13 USD  /  Amount: 23.13 USD
```

**Esto NO debe mezclarse con transacciones reales!**

### Estrategia de Manejo

**Flag internal transfers**:
```javascript
function isInternalWiseTransfer(transaction) {
  return (
    transaction.description.startsWith('Added |') ||
    transaction.category === 'Money added'
  );
}
```

**Opción A**: Skip durante import
**Opción B**: Store con flag `is_internal_transfer = TRUE`

### Impacto en Schema

```sql
ALTER TABLE transactions ADD COLUMN is_internal_transfer BOOLEAN DEFAULT FALSE;
```

---

## 🎯 Resumen de Cambios al Schema

### Campos a Agregar

```sql
-- Multi-currency
ALTER TABLE transactions ADD COLUMN amount_original DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN currency_original VARCHAR(3);
ALTER TABLE transactions ADD COLUMN exchange_rate DECIMAL(12,6);

-- Fees
ALTER TABLE transactions ADD COLUMN foreign_fee_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN is_fee_for_transaction_id TEXT;

-- Reversals/Refunds
ALTER TABLE transactions ADD COLUMN is_reversal BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN is_adjustment BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN is_refund BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN reversal_of_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN refund_of_transaction_id TEXT;

-- Pending
ALTER TABLE transactions ADD COLUMN is_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN transaction_date DATE;
ALTER TABLE transactions ADD COLUMN posted_date DATE;

-- Installments
ALTER TABLE transactions ADD COLUMN installment_current INT;
ALTER TABLE transactions ADD COLUMN installment_total INT;
ALTER TABLE transactions ADD COLUMN installment_group_id TEXT;

-- Interest
ALTER TABLE transactions ADD COLUMN interest_type TEXT;

-- Cash advances
ALTER TABLE transactions ADD COLUMN is_cash_advance BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN cash_advance_fee DECIMAL(12,2);

-- Tax (Mexico)
ALTER TABLE transactions ADD COLUMN rfc TEXT;
ALTER TABLE transactions ADD COLUMN iva_amount DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN folio_rastreo TEXT;
ALTER TABLE transactions ADD COLUMN numero_referencia TEXT;

-- Metadata
ALTER TABLE transactions ADD COLUMN metadata JSON;
ALTER TABLE transactions ADD COLUMN bank_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN bank_provided_category TEXT;
ALTER TABLE transactions ADD COLUMN bank_reported_balance DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN linked_account_identifier TEXT;
ALTER TABLE transactions ADD COLUMN linked_account_type TEXT;
ALTER TABLE transactions ADD COLUMN merchant_raw_full TEXT;

-- Internal
ALTER TABLE transactions ADD COLUMN is_internal_transfer BOOLEAN DEFAULT FALSE;

-- Accounts
ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'checking';
```

---

## 📊 Prioridad de Implementación

### Phase 1 (CRÍTICO - MVP):
1. ✅ Multi-currency detection
2. ✅ Merchant normalization (clustering + rules)
3. ✅ Transfer detection
4. ✅ Reversal detection
5. ✅ Fee linking

### Phase 2 (IMPORTANTE):
6. ✅ Pending → Posted matching
7. ✅ Refund detection
8. ✅ Recurring pattern detection
9. ✅ SPEI parsing (Mexico)
10. ✅ Cobranzas domiciliadas (Mexico)

### Phase 3 (NICE TO HAVE):
11. ✅ Installment tracking
12. ✅ Cash advance flagging
13. ✅ Interest breakdown
14. ✅ RFC registry (Mexico)
15. ✅ Adjustment detection

---

## ✅ Conclusión

Este documento cubre **100% de los edge cases** encontrados en datos reales de 6 bancos diferentes.

**Antes de escribir código**:
1. ✅ Leer este documento completo
2. ✅ Entender cada edge case
3. ✅ Verificar que el schema soporta todos los campos necesarios
4. ✅ Diseñar parsers con estos casos en mente

**Principio guía**: Si no está aquí, no existe. El código debe manejar estos 25 casos.

---

**Próximo paso**: Actualizar schema en `ARCHITECTURE-COMPLETE.md` con todos estos campos.
