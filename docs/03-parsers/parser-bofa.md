# Parser: Bank of America

**Cómo parsear statements de BofA con config-driven approach**

## Overview

Bank of America tiene un formato consistente en sus PDFs. El parser extrae:
- Date
- Description
- Amount
- Balance (opcional, no lo usamos)

**🚀 Current Approach**: Config-driven parser que lee su configuración de la tabla `parser_configs` o archivo YAML.

**No más parsers hardcodeados** - Agregar un nuevo banco solo requiere agregar un config.

---

## Formato del PDF

### Header del statement
```
Bank of America
Statement Date: September 30, 2025
Account Number: ****1234

Account Summary
Beginning Balance:  $5,432.10
Deposits/Credits:   $3,500.00
Withdrawals/Debits: $2,345.67
Ending Balance:     $6,586.43
```

### Sección de transacciones
```
Date        Description                              Amount    Balance
Sep 28      STARBUCKS STORE #12345                    -5.67    6,580.76
Sep 27      AMAZON.COM*M89JF2K3                      -89.99    6,586.43
Sep 26      SALARY DEPOSIT                         3,500.00    6,676.42
Sep 25      TRANSFER TO WISE                      -1,000.00    3,176.42
```

**Patrón**:
- Columna 1: Date (MMM DD)
- Columna 2: Description (longitud variable)
- Columna 3: Amount (con -)
- Columna 4: Balance (ignoramos)

---

## Config-Driven Approach

### Parser Config (YAML)

```yaml
# configs/parsers/bofa.yaml
id: bofa
name: Bank of America
country: US

detection:
  keywords:
    - "Bank of America"
    - "Member FDIC"
  patterns:
    - field: header
      regex: "Statement Date:.*Account Number:"

parsing:
  start_marker: "Date        Description"
  end_marker: "Account Summary"
  date_format: "MMM DD"
  decimal_separator: "."
  thousands_separator: ","

  fields:
    date:
      regex: "^([A-Z][a-z]{2}\\s+\\d{1,2})"
      position: start

    description:
      regex: "^[A-Z][a-z]{2}\\s+\\d{1,2}\\s+(.+?)\\s+[\\-\\+]?[\\d,]+\\.\\d{2}"
      cleanup:
        - remove: "#\\d+"

    amount:
      regex: "([\\-\\+]?[\\d,]+\\.\\d{2})\\s+[\\d,]+\\.\\d{2}$"
      position: -2  # Penúltima columna

classification:
  transfer_keywords:
    - TRANSFER
    - WIRE
    - ACH
    - ZELLE
  income_keywords:
    - SALARY
    - DEPOSIT
    - REFUND
    - PAYMENT RECEIVED
```

### Generic Parser Engine

```javascript
// parsers/generic-parser.js

async function parseWithConfig(pdfText, bankId) {
  // 1. Load config from DB or YAML
  const config = await loadParserConfig(bankId);

  // 2. Detect statement date
  const statementDate = extractStatementDate(pdfText, config);

  // 3. Find transaction section
  const lines = pdfText.split('\n');
  const startIndex = lines.findIndex(line =>
    line.includes(config.parsing.start_marker)
  );

  if (startIndex === -1) {
    throw new Error(`No se encontró "${config.parsing.start_marker}"`);
  }

  // 4. Parse each transaction line
  const transactions = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Check end marker
    if (line.includes(config.parsing.end_marker) || line.trim() === '') {
      break;
    }

    const txn = parseTransactionLine(line, config, statementDate, i);
    if (txn) {
      transactions.push(txn);
    }
  }

  return transactions;
}

function parseTransactionLine(line, config, statementDate, lineNumber) {
  // Extract fields using config regexes
  const date = extractField(line, config.parsing.fields.date);
  const description = extractField(line, config.parsing.fields.description);
  const amount = extractField(line, config.parsing.fields.amount);

  if (!date || !description || !amount) {
    return null;
  }

  // Parse date
  const fullDate = parseDate(date, config.parsing.date_format, statementDate);

  // Parse amount
  const numericAmount = parseAmount(
    amount,
    config.parsing.decimal_separator,
    config.parsing.thousands_separator
  );

  // Cleanup description
  let cleanDescription = description.trim();
  if (config.parsing.fields.description.cleanup) {
    for (const rule of config.parsing.fields.description.cleanup) {
      if (rule.remove) {
        cleanDescription = cleanDescription.replace(new RegExp(rule.remove, 'g'), '');
      }
    }
  }

  // Classify type
  const type = classifyTransaction(cleanDescription, config.classification);

  return {
    date: fullDate,
    description: cleanDescription,
    amount: numericAmount.toString(),
    currency: getCurrency(config.country),
    type,
    lineNumber
  };
}

function classifyTransaction(description, classification) {
  const desc = description.toUpperCase();

  // Check transfer keywords
  if (classification.transfer_keywords.some(kw => desc.includes(kw))) {
    return 'transfer';
  }

  // Check income keywords
  if (classification.income_keywords.some(kw => desc.includes(kw))) {
    return 'income';
  }

  return 'expense';
}

async function loadParserConfig(bankId) {
  // Try DB first
  const config = await db.get(
    'SELECT * FROM parser_configs WHERE id = ? AND is_active = TRUE',
    bankId
  );

  if (config) {
    // Parse JSON config
    return {
      ...config,
      detection_keywords: JSON.parse(config.detection_keywords),
      field_config: JSON.parse(config.field_config),
      transfer_keywords: JSON.parse(config.transfer_keywords),
      income_keywords: JSON.parse(config.income_keywords)
    };
  }

  // Fallback to YAML file
  const yaml = require('js-yaml');
  const fs = require('fs');
  const configPath = `./configs/parsers/${bankId}.yaml`;

  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content);
  }

  throw new Error(`No config found for bank: ${bankId}`);
}

module.exports = { parseWithConfig };
```

---

## BofA-Specific Implementation (Old Approach)

**⚠️ Este código es el approach hardcoded antiguo. En la versión final, este parser específico NO existiría - todo usaría el generic parser con configs.**

```javascript
// parsers/bofa.js (deprecated - solo para referencia)

function parseBofA(text) {
  const lines = text.split('\n');
  const transactions = [];

  // 1. Extraer statement date
  const statementDateLine = lines.find(line => line.includes('Statement Date:'));
  const statementDate = extractDate(statementDateLine);

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

    // Detectar fin de tabla (suele ser "Account Summary" o línea vacía)
    if (
      line.trim() === '' ||
      line.includes('Account Summary') ||
      line.includes('Page')
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
  // Regex para parsear línea:
  // (Date) (Description) (Amount) (Balance opcional)

  const regex = /^([A-Z][a-z]{2}\s+\d{1,2})\s+(.+?)\s+([\-\+]?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})?$/;

  const match = line.match(regex);
  if (!match) return null;

  const [_, dateStr, description, amountStr, balanceStr] = match;

  // Parsear date: "Sep 28" → "2025-09-28"
  const date = parseDate(dateStr, statementDate);

  // Parsear amount: "-5.67" → -5.67
  const amount = parseAmount(amountStr);

  return {
    date,
    description: description.trim(),
    amount: amount.toString(),
    currency: 'USD', // BofA siempre USD
    lineNumber: null // lo agregamos después
  };
}

function parseDate(dateStr, statementDate) {
  // dateStr = "Sep 28"
  // statementDate = "2025-09-30"

  const [monthStr, dayStr] = dateStr.split(/\s+/);
  const day = parseInt(dayStr);

  // Mapear mes
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const month = months[monthStr];

  // Año: tomar del statement date
  const year = statementDate.substring(0, 4);

  return `${year}-${month}-${day.toString().padStart(2, '0')}`;
}

function parseAmount(amountStr) {
  // amountStr = "-5.67" o "3,500.00"
  // Quitar comas
  const cleaned = amountStr.replace(/,/g, '');
  return parseFloat(cleaned);
}

function extractDate(line) {
  // "Statement Date: September 30, 2025"
  const match = line.match(/Statement Date:\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) throw new Error('No se pudo extraer statement date');

  const [_, monthName, day, year] = match;

  const months = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };

  const month = months[monthName];
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

module.exports = { parseBofA };
```

---

## Ejemplo real

### Input: PDF text
```
Bank of America
Statement Date: September 30, 2025
Account Number: ****1234

Date        Description                              Amount    Balance
Sep 28      STARBUCKS STORE #12345                    -5.67    6,580.76
Sep 27      AMAZON.COM*M89JF2K3                      -89.99    6,586.43
Sep 26      SALARY DEPOSIT                         3,500.00    6,676.42
Sep 25      TRANSFER TO WISE                      -1,000.00    3,176.42
```

### Output: Array de transactions
```javascript
[
  {
    date: '2025-09-28',
    description: 'STARBUCKS STORE #12345',
    amount: '-5.67',
    currency: 'USD',
    lineNumber: 47
  },
  {
    date: '2025-09-27',
    description: 'AMAZON.COM*M89JF2K3',
    amount: '-89.99',
    currency: 'USD',
    lineNumber: 48
  },
  {
    date: '2025-09-26',
    description: 'SALARY DEPOSIT',
    amount: '3500.00',
    currency: 'USD',
    lineNumber: 49
  },
  {
    date: '2025-09-25',
    description: 'TRANSFER TO WISE',
    amount: '-1000.00',
    currency: 'USD',
    lineNumber: 50
  }
]
```

---

## Type classification

```javascript
function classifyTypeBofA(description) {
  const desc = description.toUpperCase();

  // Transfers
  if (
    desc.includes('TRANSFER') ||
    desc.includes('WIRE') ||
    desc.includes('ACH') ||
    desc.includes('ZELLE')
  ) {
    return 'transfer';
  }

  // Income
  if (
    desc.includes('SALARY') ||
    desc.includes('DEPOSIT') ||
    desc.includes('REFUND') ||
    desc.includes('PAYMENT RECEIVED')
  ) {
    return 'income';
  }

  // Default: expense
  return 'expense';
}
```

---

## Edge cases

### Edge case 1: Multiline descriptions

Algunas transacciones tienen descriptions que ocupan 2 líneas:

```
Sep 28      AMAZON.COM*M89JF2K3
            AMZN.COM/BILL WA                         -89.99    6,586.43
```

**Solución**: Concatenar líneas.

```javascript
function parseTransactionLine(line, nextLine) {
  // Si la línea actual no tiene amount, es continuación
  if (!line.match(/[\-\+]?[\d,]+\.\d{2}/)) {
    // Concatenar con siguiente línea
    return line.trim() + ' ' + nextLine.trim();
  }

  // Parse normal
  // ...
}
```

---

### Edge case 2: Pending transactions

BofA puede tener "Pending" al final del statement:

```
Pending Transactions
Sep 30      UBER *TRIP                               -25.00    Pending
```

**Solución**: Ignorar pending (no tienen balance).

```javascript
if (line.includes('Pending Transactions')) {
  break; // Stop parsing
}
```

---

### Edge case 3: Fees

```
Sep 15      MONTHLY SERVICE FEE                      -12.00    6,000.00
```

**Solución**: Parse normal. Clasificar como 'expense'.

---

## Testing

### Test 1: Basic parsing

```javascript
const text = `
Bank of America
Statement Date: September 30, 2025

Date        Description                              Amount
Sep 28      STARBUCKS STORE #12345                    -5.67
Sep 27      AMAZON.COM*M89JF2K3                      -89.99
`;

const result = parseBofA(text);

expect(result).toEqual([
  {
    date: '2025-09-28',
    description: 'STARBUCKS STORE #12345',
    amount: '-5.67',
    currency: 'USD'
  },
  {
    date: '2025-09-27',
    description: 'AMAZON.COM*M89JF2K3',
    amount: '-89.99',
    currency: 'USD'
  }
]);
```

### Test 2: Transfer detection

```javascript
const text = `
Date        Description                              Amount
Sep 25      TRANSFER TO WISE                      -1,000.00
`;

const result = parseBofA(text);
const type = classifyTypeBofA(result[0].description);

expect(type).toBe('transfer');
```

---

## LOC estimate

- `parseBofA()`: ~40 LOC
- `parseTransactionLine()`: ~30 LOC
- `parseDate()`: ~15 LOC
- `parseAmount()`: ~5 LOC
- `classifyTypeBofA()`: ~20 LOC

**Total**: ~110 LOC

---

## Notas

- **Currency siempre USD**: BofA es banco estadounidense
- **Formato consistente**: BofA no cambia mucho su formato
- **Account number**: Ignoramos (no lo necesitamos)
- **Balance**: Ignoramos (no lo usamos para nada)

---

**Próximo parser**: Lee [parser-apple-card.md](parser-apple-card.md)
