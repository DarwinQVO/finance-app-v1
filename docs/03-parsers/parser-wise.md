# Parser: Wise (formerly TransferWise)

**Cómo parsear statements de Wise**

## Overview

Wise es un banco digital internacional. Sus statements son limpios pero tienen **multi-currency**.

el usuario usa Wise para:
- Transfers internacionales (USD → EUR, USD → MXN)
- Pagos en diferentes monedas
- Recibir pagos de clientes internacionales

---

## Formato del PDF

### Header del statement
```
Your statement for September 2025

Account holder: el usuario Borges
Account balance: $1,234.56 USD

Transactions

Date        Description                      Amount         Balance
Sep 28      Transfer from Bank              +$1,000.00 USD  $1,234.56 USD
Sep 27      Payment to Amazon               -$89.99 USD     $234.56 USD
Sep 26      Currency exchange: USD → EUR    -$500.00 USD    $324.55 USD
Sep 26      Currency received               +€456.78 EUR    €456.78 EUR
```

**Características únicas**:
- **Multi-currency**: USD, EUR, MXN, etc. en el mismo statement
- **Currency exchanges**: Aparecen como 2 transacciones (out + in)
- **International transfers**: Con fees separados

---

## Parser code

```javascript
// parsers/wise.js

function parseWise(text) {
  const lines = text.split('\n');
  const transactions = [];

  // 1. Extraer statement date
  const statementDateLine = lines.find(line =>
    line.includes('Your statement for')
  );
  const statementDate = extractStatementDate(statementDateLine);

  // 2. Encontrar inicio de transacciones
  const startIndex = lines.findIndex(line =>
    line.includes('Date') && line.includes('Description') && line.includes('Amount')
  );

  if (startIndex === -1) {
    throw new Error('No se encontró la tabla de transacciones');
  }

  // 3. Parsear cada línea
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Detectar fin de tabla
    if (
      line.trim() === '' ||
      line.includes('Total') ||
      line.includes('Summary')
    ) {
      break;
    }

    const txn = parseTransactionLine(line, statementDate);
    if (txn) {
      transactions.push(txn);
    }
  }

  return transactions;
}

function parseTransactionLine(line, statementDate) {
  // Regex: (Date) (Description) (Amount + Currency) (Balance)
  // Sep 28  Transfer from Bank  +$1,000.00 USD  $1,234.56 USD

  const regex = /^([A-Z][a-z]{2}\s+\d{1,2})\s+(.+?)\s+([\-\+]?)([€$£¥])?([\d,]+\.\d{2})\s+([A-Z]{3})\s+/;

  const match = line.match(regex);
  if (!match) return null;

  const [_, dateStr, description, sign, currencySymbol, amountStr, currency] = match;

  // Parsear date
  const date = parseDate(dateStr, statementDate);

  // Parsear amount
  const amount = parseAmount(amountStr, sign);

  return {
    date,
    description: description.trim(),
    amount: amount.toString(),
    currency, // USD, EUR, MXN, etc.
    lineNumber: null
  };
}

function parseAmount(amountStr, sign) {
  // amountStr = "1,000.00"
  // sign = "+" o "-" o ""

  const cleaned = amountStr.replace(/,/g, '');
  let amount = parseFloat(cleaned);

  // Si no hay signo explícito, inferir del contexto (no debería pasar)
  if (sign === '-') {
    amount = -Math.abs(amount);
  } else if (sign === '+') {
    amount = Math.abs(amount);
  }

  return amount;
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

  const year = statementDate.substring(0, 4);

  return `${year}-${month}-${day.toString().padStart(2, '0')}`;
}

function extractStatementDate(line) {
  // "Your statement for September 2025"
  const match = line.match(/Your statement for ([A-Z][a-z]+)\s+(\d{4})/);
  if (!match) throw new Error('No se pudo extraer statement date');

  const [_, monthName, year] = match;

  const months = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };

  const month = months[monthName];
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

  return `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
}

module.exports = { parseWise };
```

---

## Ejemplo real

### Input: PDF text
```
Your statement for September 2025

Date        Description                      Amount         Balance
Sep 28      Transfer from Bank              +$1,000.00 USD  $1,234.56 USD
Sep 27      Payment to Amazon               -$89.99 USD     $234.56 USD
Sep 26      Currency exchange: USD → EUR    -$500.00 USD    $324.55 USD
Sep 26      Currency received               +€456.78 EUR    €456.78 EUR
```

### Output: Array de transactions
```javascript
[
  {
    date: '2025-09-28',
    description: 'Transfer from Bank',
    amount: '1000.00',
    currency: 'USD',
    lineNumber: 45
  },
  {
    date: '2025-09-27',
    description: 'Payment to Amazon',
    amount: '-89.99',
    currency: 'USD',
    lineNumber: 46
  },
  {
    date: '2025-09-26',
    description: 'Currency exchange: USD → EUR',
    amount: '-500.00',
    currency: 'USD',
    lineNumber: 47
  },
  {
    date: '2025-09-26',
    description: 'Currency received',
    amount: '456.78',
    currency: 'EUR',
    lineNumber: 48
  }
]
```

---

## Type classification

```javascript
function classifyTypeWise(description) {
  const desc = description.toUpperCase();

  // Transfers
  if (
    desc.includes('TRANSFER FROM') ||
    desc.includes('TRANSFER TO') ||
    desc.includes('WIRE')
  ) {
    return 'transfer';
  }

  // Currency exchange (también transfer)
  if (desc.includes('CURRENCY EXCHANGE')) {
    return 'transfer';
  }

  // Fees
  if (desc.includes('FEE')) {
    return 'expense';
  }

  // Income
  if (
    desc.includes('RECEIVED') ||
    desc.includes('DEPOSIT') ||
    desc.includes('REFUND')
  ) {
    return 'income';
  }

  // Default
  return 'expense';
}
```

---

## Multi-currency handling

### Challenge: Currency exchanges

Cuando el usuario convierte USD a EUR, Wise crea **2 transacciones**:

```
Sep 26  Currency exchange: USD → EUR    -$500.00 USD
Sep 26  Currency received               +€456.78 EUR
```

**Problema**: Son la misma operación, pero en 2 currencies.

**Solución inicial**: Tratarlos como 2 transfers separados. NO linkear.

**Solución futura**: Detectar y linkear con exchange rate.

```javascript
function linkCurrencyExchange(txn1, txn2) {
  // txn1: -$500.00 USD
  // txn2: +€456.78 EUR

  if (
    txn1.description.includes('Currency exchange') &&
    txn2.description.includes('Currency received') &&
    txn1.date === txn2.date
  ) {
    // Calculate exchange rate
    const rate = Math.abs(txn2.amount / txn1.amount);
    // rate = 456.78 / 500 = 0.91356 (EUR/USD)

    // Link them
    linkPair(txn1, txn2, { exchangeRate: rate });
  }
}
```

**Para Phase 1**: No implementar. Demasiado complejo.

---

## Transfer fees

Wise cobra fees por algunos transfers:

```
Sep 28  Transfer to Bank                -$1,000.00 USD
Sep 28  Transfer fee                    -$5.00 USD
```

**Solución**: Tratarlos como 2 transacciones separadas.

- Transfer: `type = 'transfer'`
- Fee: `type = 'expense'`

**NO linkearlos** (el fee es un expense real).

---

## Edge cases

### Edge case 1: International payments

```
Sep 25  Payment to Freelancer (India)   -$300.00 USD
Sep 25  International payment fee       -$2.50 USD
```

**Solución**: 2 transacciones separadas (payment + fee).

---

### Edge case 2: Refunds

```
Sep 20  Refund from Amazon              +$12.99 USD
```

**Solución**: Parse normal. `type = 'income'`.

---

### Edge case 3: Multiple currencies en mismo día

```
Sep 26  Payment in EUR                  -€50.00 EUR
Sep 26  Payment in USD                  -$75.00 USD
Sep 26  Payment in MXN                  -$1,250.00 MXN
```

**Solución**: Parse cada uno independientemente. La currency está en cada línea.

---

## Currency symbols

Wise usa símbolos de moneda:

| Symbol | Currency |
|--------|----------|
| $ | USD |
| € | EUR |
| £ | GBP |
| ¥ | JPY/CNY |
| MXN$ | MXN |

**Parsing**:
```javascript
function parseCurrency(symbol, code) {
  // Priorizar código explícito (USD, EUR, etc.)
  if (code) return code;

  // Fallback a símbolo
  const map = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY'
  };

  return map[symbol] || 'USD';
}
```

---

## Testing

### Test 1: Basic parsing

```javascript
const text = `
Your statement for September 2025

Date        Description                      Amount         Balance
Sep 28      Transfer from Bank              +$1,000.00 USD  $1,234.56 USD
Sep 27      Payment to Amazon               -$89.99 USD     $234.56 USD
`;

const result = parseWise(text);

expect(result).toEqual([
  {
    date: '2025-09-28',
    description: 'Transfer from Bank',
    amount: '1000.00',
    currency: 'USD'
  },
  {
    date: '2025-09-27',
    description: 'Payment to Amazon',
    amount: '-89.99',
    currency: 'USD'
  }
]);
```

### Test 2: Multi-currency

```javascript
const text = `
Sep 26  Payment in EUR    -€50.00 EUR    €100.00 EUR
Sep 26  Payment in USD    -$75.00 USD    $200.00 USD
`;

const result = parseWise(text);

expect(result[0].currency).toBe('EUR');
expect(result[1].currency).toBe('USD');
```

---

## LOC estimate

- `parseWise()`: ~40 LOC
- `parseTransactionLine()`: ~35 LOC
- `parseAmount()`: ~10 LOC
- `parseDate()`: ~15 LOC
- `extractStatementDate()`: ~15 LOC
- `classifyTypeWise()`: ~20 LOC

**Total**: ~135 LOC

---

## Notas

- **Multi-currency**: Cada transacción tiene su currency
- **Currency exchanges**: 2 transacciones, NO linkear en Phase 1
- **Transfer fees**: Separados como expense
- **International**: Wise es global, muchos tipos de transactions

---

**Próximo parser**: Lee [parser-scotia.md](parser-scotia.md)
