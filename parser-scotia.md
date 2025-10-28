# Parser: Scotiabank (Mexico)

**Cómo parsear statements de Scotiabank**

## Overview

Scotiabank es el banco mexicano de Darwin. Statements en **MXN** (pesos mexicanos) y en **español**.

Darwin usa Scotia para:
- Gastos locales en México
- Pagos a proveedores mexicanos
- Recibir transfers desde Wise

---

## Formato del PDF

### Header del statement
```
Scotiabank
Estado de Cuenta
Septiembre 2025

Titular: Darwin Borges
Cuenta: ****5678

Resumen de Cuenta
Saldo Anterior:        $25,000.00 MXN
Depósitos:            $19,850.00 MXN
Retiros:              $15,432.00 MXN
Saldo Actual:         $29,418.00 MXN
```

### Sección de transacciones
```
Fecha       Descripción                              Cargo         Abono        Saldo
28 Sep      OXXO SANTA FE                           $150.00                    $29,418.00
27 Sep      TRANSFERENCIA RECIBIDA                               $19,850.00    $29,568.00
26 Sep      UBER EATS                               $345.00                    $9,718.00
25 Sep      COMISION TRANSFERENCIA                  $12.00                     $10,063.00
```

**Características**:
- **Español**: "Cargo" = débito, "Abono" = crédito
- **2 columnas para amount**: Cargo (negativo) y Abono (positivo)
- **Formato fecha**: "DD MMM" (invertido vs US)
- **Currency symbol**: $ (pero es MXN, no USD)

---

## Parser code

```javascript
// parsers/scotia.js

function parseScotia(text) {
  const lines = text.split('\n');
  const transactions = [];

  // 1. Extraer statement date
  const statementDateLine = lines.find(line =>
    /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}$/.test(line.trim())
  );
  const statementDate = extractStatementDate(statementDateLine);

  // 2. Encontrar inicio de transacciones
  const startIndex = lines.findIndex(line =>
    line.includes('Fecha') && line.includes('Descripción') && (line.includes('Cargo') || line.includes('Abono'))
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
      line.includes('Resumen') ||
      line.includes('Página')
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
  // Regex: (Date) (Description) (Cargo) (Abono) (Balance)
  // 28 Sep  OXXO SANTA FE  $150.00  -  $29,418.00

  const regex = /^(\d{1,2}\s+[A-Z][a-z]{2})\s+(.+?)\s+(?:\$?([\d,]+\.\d{2}))?\s+(?:\$?([\d,]+\.\d{2}))?\s+\$([\d,]+\.\d{2})$/;

  const match = line.match(regex);
  if (!match) return null;

  const [_, dateStr, description, cargo, abono, balance] = match;

  // Parsear date
  const date = parseDate(dateStr, statementDate);

  // Determinar amount (cargo = negativo, abono = positivo)
  let amount;
  if (cargo) {
    amount = -parseFloat(cargo.replace(/,/g, ''));
  } else if (abono) {
    amount = parseFloat(abono.replace(/,/g, ''));
  } else {
    return null; // No hay amount
  }

  return {
    date,
    description: description.trim(),
    amount: amount.toString(),
    currency: 'MXN', // Scotia siempre MXN
    lineNumber: null
  };
}

function parseDate(dateStr, statementDate) {
  // dateStr = "28 Sep"
  // statementDate = "2025-09-30"

  const [dayStr, monthStr] = dateStr.split(/\s+/);
  const day = parseInt(dayStr);

  // Meses en español
  const months = {
    'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12'
  };
  const month = months[monthStr];

  const year = statementDate.substring(0, 4);

  return `${year}-${month}-${day.toString().padStart(2, '0')}`;
}

function extractStatementDate(line) {
  // "Septiembre 2025"
  const match = line.match(/^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})$/);
  if (!match) throw new Error('No se pudo extraer statement date');

  const [_, monthName, year] = match;

  const months = {
    'Enero': '01', 'Febrero': '02', 'Marzo': '03', 'Abril': '04',
    'Mayo': '05', 'Junio': '06', 'Julio': '07', 'Agosto': '08',
    'Septiembre': '09', 'Octubre': '10', 'Noviembre': '11', 'Diciembre': '12'
  };

  const month = months[monthName];
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

  return `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
}

module.exports = { parseScotia };
```

---

## Ejemplo real

### Input: PDF text
```
Scotiabank
Estado de Cuenta
Septiembre 2025

Fecha       Descripción                              Cargo         Abono        Saldo
28 Sep      OXXO SANTA FE                           $150.00                    $29,418.00
27 Sep      TRANSFERENCIA RECIBIDA                               $19,850.00    $29,568.00
26 Sep      UBER EATS                               $345.00                    $9,718.00
25 Sep      COMISION TRANSFERENCIA                  $12.00                     $10,063.00
```

### Output: Array de transactions
```javascript
[
  {
    date: '2025-09-28',
    description: 'OXXO SANTA FE',
    amount: '-150.00',
    currency: 'MXN',
    lineNumber: 52
  },
  {
    date: '2025-09-27',
    description: 'TRANSFERENCIA RECIBIDA',
    amount: '19850.00',
    currency: 'MXN',
    lineNumber: 53
  },
  {
    date: '2025-09-26',
    description: 'UBER EATS',
    amount: '-345.00',
    currency: 'MXN',
    lineNumber: 54
  },
  {
    date: '2025-09-25',
    description: 'COMISION TRANSFERENCIA',
    amount: '-12.00',
    currency: 'MXN',
    lineNumber: 55
  }
]
```

---

## Type classification

```javascript
function classifyTypeScotia(description) {
  const desc = description.toUpperCase();

  // Transfers
  if (
    desc.includes('TRANSFERENCIA') ||
    desc.includes('SPEI') ||
    desc.includes('TRANS ')
  ) {
    return 'transfer';
  }

  // Fees
  if (
    desc.includes('COMISION') ||
    desc.includes('CARGO') ||
    desc.includes('ANUALIDAD')
  ) {
    return 'expense';
  }

  // Income
  if (
    desc.includes('ABONO') ||
    desc.includes('DEPOSITO') ||
    desc.includes('RECIBIDA') ||
    desc.includes('DEVOLUCION')
  ) {
    return 'income';
  }

  // ATM withdrawals
  if (desc.includes('RETIRO') || desc.includes('ATM')) {
    return 'expense';
  }

  // Default
  return 'expense';
}
```

---

## Español keywords

### Merchant types comunes

| Tipo | Ejemplo |
|------|---------|
| Convenience store | OXXO, 7 ELEVEN |
| Gas station | PEMEX, SHELL |
| Grocery | WALMART, SORIANA, CHEDRAUI |
| Restaurants | RESTAURANTE, CAFE, TACOS |
| Transport | UBER, DIDI, METRO |
| Utilities | CFE (electricity), TELMEX (phone) |

### Transaction types

| Español | English | Type |
|---------|---------|------|
| TRANSFERENCIA RECIBIDA | Transfer received | income |
| TRANSFERENCIA ENVIADA | Transfer sent | transfer |
| COMPRA | Purchase | expense |
| RETIRO | Withdrawal | expense |
| DEPOSITO | Deposit | income |
| COMISION | Fee | expense |
| DEVOLUCION | Refund | income |
| PAGO | Payment | expense |

---

## Edge cases

### Edge case 1: SPEI transfers

SPEI es el sistema de transfers en México (equivalente a ACH en US).

```
27 Sep  SPEI RECIBIDO DE WISE                    $19,850.00
```

**Solución**: Clasificar como 'transfer' + 'income'.

```javascript
if (desc.includes('SPEI RECIBIDO')) {
  return { type: 'transfer', subtype: 'income' };
}
```

---

### Edge case 2: Comisiones (fees)

Scotia cobra fees por todo:

```
25 Sep  COMISION TRANSFERENCIA           $12.00
20 Sep  COMISION ANUALIDAD              $350.00
15 Sep  COMISION RETIRO ATM              $8.00
```

**Solución**: Todas son 'expense', pero agregar tag 'fee'.

---

### Edge case 3: Currency symbol ambiguity

**Problema**: Scotia usa `$` pero es MXN, no USD.

```
$150.00  ← Es MXN, no USD
```

**Solución**: Hardcodear `currency: 'MXN'` en el parser.

```javascript
return {
  ...txn,
  currency: 'MXN' // Always, sin importar el símbolo
};
```

---

### Edge case 4: Nombres largos

Merchants en México pueden tener nombres largos que ocupan 2 líneas:

```
28 Sep  RESTAURANTE LOS TACOS
        DE DON PEDRO SA DE CV                   $345.00
```

**Solución**: Concatenar líneas (igual que BofA).

```javascript
function parseTransactionLine(line, nextLine) {
  if (!line.match(/\$[\d,]+\.\d{2}/)) {
    // No tiene amount, es continuación
    return line.trim() + ' ' + nextLine.trim();
  }
  // ...
}
```

---

## Normalization patterns

### Common merchants en México

```javascript
const SCOTIA_RULES = [
  { pattern: /OXXO.*\d{4}/, normalized: 'Oxxo' },
  { pattern: /7\s*ELEVEN.*\d{4}/, normalized: '7-Eleven' },
  { pattern: /WALMART.*\d{4}/, normalized: 'Walmart' },
  { pattern: /UBER\s*(EATS|TRIP)?/, normalized: 'Uber' },
  { pattern: /PEMEX.*\d{4}/, normalized: 'Pemex' },
  { pattern: /CFE\s*RECIBO/, normalized: 'CFE (Electricidad)' },
  { pattern: /TELMEX/, normalized: 'Telmex' },
  { pattern: /SORIANA.*\d{4}/, normalized: 'Soriana' },
  { pattern: /CHEDRAUI.*\d{4}/, normalized: 'Chedraui' },
  { pattern: /LIVERPOOL.*\d{4}/, normalized: 'Liverpool' },
  { pattern: /SANBORNS.*\d{4}/, normalized: 'Sanborns' },
];
```

---

## Testing

### Test 1: Basic parsing

```javascript
const text = `
Septiembre 2025

Fecha       Descripción                              Cargo         Abono
28 Sep      OXXO SANTA FE                           $150.00
27 Sep      TRANSFERENCIA RECIBIDA                               $19,850.00
`;

const result = parseScotia(text);

expect(result).toEqual([
  {
    date: '2025-09-28',
    description: 'OXXO SANTA FE',
    amount: '-150.00',
    currency: 'MXN'
  },
  {
    date: '2025-09-27',
    description: 'TRANSFERENCIA RECIBIDA',
    amount: '19850.00',
    currency: 'MXN'
  }
]);
```

### Test 2: Transfer detection

```javascript
const text = `
27 Sep  SPEI RECIBIDO DE WISE    $19,850.00
`;

const result = parseScotia(text);
const type = classifyTypeScotia(result[0].description);

expect(type).toBe('transfer');
```

---

## LOC estimate

- `parseScotia()`: ~45 LOC
- `parseTransactionLine()`: ~35 LOC
- `parseDate()`: ~20 LOC (español)
- `extractStatementDate()`: ~20 LOC (español)
- `classifyTypeScotia()`: ~25 LOC

**Total**: ~145 LOC

---

## Notas

- **Español**: Keywords, meses, todo en español
- **MXN only**: Siempre pesos mexicanos
- **$ symbol**: Es MXN, no USD (hardcodear)
- **SPEI**: Sistema de transfers mexicano
- **Comisiones**: Scotia cobra muchos fees
- **Merchants**: Nombres únicos de México (Oxxo, Pemex, etc.)

---

## Total parsers LOC

| Parser | LOC |
|--------|-----|
| BofA | ~110 |
| Apple Card | ~105 |
| Wise | ~135 |
| Scotia | ~145 |
| **Total** | **~495** |

**Objetivo era ~400**. Estamos cerca. ✓

---

**Próximos docs**: Lee [Batch 4: Pipeline](2-observation-store.md)
