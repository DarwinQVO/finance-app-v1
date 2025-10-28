# Parser: Apple Card

**Cómo parsear statements de Apple Card**

## Overview

Apple Card tiene un formato limpio y minimalista (típico de Apple). El parser extrae:
- Date
- Description (merchant name)
- Amount
- Category (optional, lo ignoramos en V1)

---

## Formato del PDF

### Header del statement
```
Apple Card Monthly Statement
September 2025

Card Member: DARWIN BORGES
Account ending in: 4567

Statement Summary
Previous Balance:        $1,234.56
Payments and Credits:    $1,234.56
Purchases:              $567.89
Cash Advances:          $0.00
Fees:                   $0.00
Interest:               $0.00
New Balance:            $567.89
```

### Sección de transacciones
```
Transactions

Sep 28  Starbucks              $5.67
Sep 27  Amazon.com             $89.99
Sep 26  Netflix                $15.99
Sep 25  Uber                   $25.45
```

**Patrón**:
- Columna 1: Date (MMM DD)
- Columna 2: Merchant name (ya normalizado!)
- Columna 3: Amount (sin -, todo positivo)

**Nota importante**: Apple Card muestra merchants ya limpios. "STARBUCKS STORE #12345" aparece como "Starbucks".

---

## Parser code

```javascript
// parsers/apple-card.js

function parseAppleCard(text) {
  const lines = text.split('\n');
  const transactions = [];

  // 1. Extraer statement date
  const statementDateLine = lines.find(line =>
    /^[A-Z][a-z]+\s+\d{4}$/.test(line.trim())
  );
  const statementDate = parseStatementDate(statementDateLine);

  // 2. Encontrar inicio de transacciones
  const startIndex = lines.findIndex(line =>
    line.trim() === 'Transactions'
  );

  if (startIndex === -1) {
    throw new Error('No se encontró la sección de transacciones');
  }

  // 3. Parsear cada línea
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Detectar fin de sección
    if (
      line.trim() === '' ||
      line.includes('Total') ||
      line.includes('Payments and Credits') ||
      line.includes('Statement')
    ) {
      continue;
    }

    const txn = parseTransactionLine(line, statementDate);
    if (txn) {
      transactions.push(txn);
    }
  }

  return transactions;
}

function parseTransactionLine(line, statementDate) {
  // Regex: (Date) (Merchant) (Amount)
  const regex = /^([A-Z][a-z]{2}\s+\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/;

  const match = line.match(regex);
  if (!match) return null;

  const [_, dateStr, merchant, amountStr] = match;

  // Parsear date: "Sep 28" → "2025-09-28"
  const date = parseDate(dateStr, statementDate);

  // Parsear amount: "5.67" → -5.67 (IMPORTANTE: Apple Card no muestra -, son gastos)
  const amount = -parseFloat(amountStr.replace(/,/g, ''));

  return {
    date,
    description: merchant.trim(),
    amount: amount.toString(),
    currency: 'USD', // Apple Card siempre USD
    lineNumber: null
  };
}

function parseStatementDate(line) {
  // "September 2025" → "2025-09-30" (último día del mes)
  const match = line.match(/^([A-Z][a-z]+)\s+(\d{4})$/);
  if (!match) throw new Error('No se pudo extraer statement date');

  const [_, monthName, year] = match;

  const months = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };

  const month = months[monthName];

  // Último día del mes
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

  return `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
}

function parseDate(dateStr, statementDate) {
  // dateStr = "Sep 28"
  // statementDate = "2025-09-30"

  const [monthStr, dayStr] = dateStr.split(/\s+/);
  const day = parseInt(dayStr);

  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const month = months[monthStr];

  // Año del statement
  const year = statementDate.substring(0, 4);

  return `${year}-${month}-${day.toString().padStart(2, '0')}`;
}

module.exports = { parseAppleCard };
```

---

## Ejemplo real

### Input: PDF text
```
Apple Card Monthly Statement
September 2025

Transactions

Sep 28  Starbucks              $5.67
Sep 27  Amazon.com             $89.99
Sep 26  Netflix                $15.99
Sep 25  Uber                   $25.45
```

### Output: Array de transactions
```javascript
[
  {
    date: '2025-09-28',
    description: 'Starbucks',
    amount: '-5.67',
    currency: 'USD',
    lineNumber: 23
  },
  {
    date: '2025-09-27',
    description: 'Amazon.com',
    amount: '-89.99',
    currency: 'USD',
    lineNumber: 24
  },
  {
    date: '2025-09-26',
    description: 'Netflix',
    amount: '-15.99',
    currency: 'USD',
    lineNumber: 25
  },
  {
    date: '2025-09-25',
    description: 'Uber',
    amount: '-25.45',
    currency: 'USD',
    lineNumber: 26
  }
]
```

**Nota**: Todos los amounts son negativos (gastos).

---

## Type classification

```javascript
function classifyTypeAppleCard(description) {
  const desc = description.toUpperCase();

  // Apple Card rara vez tiene transfers, pero por si acaso
  if (
    desc.includes('TRANSFER') ||
    desc.includes('PAYMENT') ||
    desc.includes('CREDIT')
  ) {
    return 'income'; // Payment to Apple Card
  }

  // Default: expense (es tarjeta de crédito)
  return 'expense';
}
```

---

## Diferencias vs BofA

### 1. Merchants ya normalizados

**BofA**:
```
STARBUCKS STORE #12345 SANTA MONICA CA
```

**Apple Card**:
```
Starbucks
```

**Resultado**: El clustering será menos útil para Apple Card (ya está limpio).

---

### 2. Sin signo negativo

**BofA**:
```
-5.67
```

**Apple Card**:
```
$5.67
```

**Importante**: Hay que agregar el `-` manualmente en el parser.

```javascript
const amount = -parseFloat(amountStr); // Forzar negativo
```

---

### 3. Payments como transacciones

Apple Card incluye payments (pagos de la tarjeta) como transacciones positivas:

```
Sep 15  Payment - Bank Transfer    $1,234.56
```

**Solución**: Detectar y clasificar como 'income'.

```javascript
if (merchant.includes('Payment')) {
  amount = Math.abs(amount); // Positivo
  type = 'income';
}
```

---

## Edge cases

### Edge case 1: Refunds

```
Sep 20  Amazon.com - Refund        $12.99
```

**Solución**: Es positivo (income).

```javascript
if (merchant.includes('Refund')) {
  return {
    ...txn,
    amount: Math.abs(parseFloat(amountStr)).toString(),
    type: 'income'
  };
}
```

---

### Edge case 2: Annual fee

```
Sep 1   Apple Card Annual Fee      $0.00
```

**Nota**: Apple Card no tiene annual fee, pero por consistencia:

```javascript
if (amount === 0) {
  return null; // Skip transacciones de $0
}
```

---

### Edge case 3: Daily Cash (cashback)

```
Sep 28  Daily Cash (Starbucks)     $0.17
```

**Solución**: Es income (cashback).

```javascript
if (merchant.includes('Daily Cash')) {
  return {
    ...txn,
    amount: amountStr, // Ya es positivo
    type: 'income'
  };
}
```

---

## Merchant normalization

Como Apple Card ya normaliza merchants, nuestro pipeline tendrá menos trabajo:

**BofA raw**:
```
STARBUCKS STORE #12345
STARBUCKS STORE #67890
STARBUCKS #11111
```
→ Clustering → "Starbucks"

**Apple Card raw**:
```
Starbucks
Starbucks
Starbucks
```
→ No clustering needed, ya está limpio

**Ventaja**: Menos errores de normalización.

---

## Testing

### Test 1: Basic parsing

```javascript
const text = `
Apple Card Monthly Statement
September 2025

Transactions

Sep 28  Starbucks              $5.67
Sep 27  Amazon.com             $89.99
`;

const result = parseAppleCard(text);

expect(result).toEqual([
  {
    date: '2025-09-28',
    description: 'Starbucks',
    amount: '-5.67',
    currency: 'USD'
  },
  {
    date: '2025-09-27',
    description: 'Amazon.com',
    amount: '-89.99',
    currency: 'USD'
  }
]);
```

### Test 2: Payment detection

```javascript
const text = `
Sep 15  Payment - Bank Transfer    $1,234.56
`;

const result = parseAppleCard(text);

expect(result[0].amount).toBe('1234.56'); // Positivo
expect(classifyTypeAppleCard(result[0].description)).toBe('income');
```

---

## LOC estimate

- `parseAppleCard()`: ~35 LOC
- `parseTransactionLine()`: ~25 LOC
- `parseDate()`: ~15 LOC
- `parseStatementDate()`: ~15 LOC
- `classifyTypeAppleCard()`: ~15 LOC

**Total**: ~105 LOC

---

## Notas

- **Merchants limpios**: Apple Card hace el trabajo de normalización
- **Sin negativo en amounts**: Hay que agregarlo manualmente
- **Payments importantes**: Detectar y clasificar como income
- **Cashback (Daily Cash)**: También income

---

**Próximo parser**: Lee [parser-wise.md](parser-wise.md)
