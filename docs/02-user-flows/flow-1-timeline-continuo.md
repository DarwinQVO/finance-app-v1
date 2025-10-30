# Flow 1: Timeline Continuo ⭐

**El flujo más importante de Finance App**

## Funcionalidad

Timeline continuo que muestra todas las transacciones cronológicamente.

**Características**:
- Sin separación entre "setup" y "uso diario"
- Mismo flujo para subir primer PDF o PDF #100
- Vista unificada de todas las cuentas

---

## Story: el usuario usa la app por primera vez

### Acto 1: El día 1

el usuario acaba de instalar Finance App. Abre la app.

**Ve esto**:
```
┌─────────────────────────────────────────────────┐
│  Finance App                                    │
├─────────────────────────────────────────────────┤
│                                                 │
│         📁 No hay transacciones aún            │
│                                                 │
│         Arrastra un PDF bancario aquí          │
│         o haz click para seleccionar           │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

Simple. Directo. NO dice "Modo setup" ni "Carga histórico". Solo dice: "Arrastra PDF".

el usuario tiene 96 PDFs de 2 años. Empieza con el más reciente: `bofa_2025_09.pdf`

**Arrastra el PDF** → Lo suelta en la zona.

**Ve esto** (5 segundos después):
```
┌─────────────────────────────────────────────────┐
│  Finance App                    [Upload] [⚙️]   │
├─────────────────────────────────────────────────┤
│  Filtros: [Todas las cuentas] [Sep 2025]       │
├─────────────────────────────────────────────────┤
│  Sep 28  Starbucks              -$5.67  USD    │
│  Sep 27  Amazon                 -$89.99 USD    │
│  Sep 26  Salary deposit       +$3,500.00 USD   │
│  Sep 25  Netflix                -$15.99 USD    │
│  ...                                            │
│  [127 transacciones más]                        │
└─────────────────────────────────────────────────┘
```

**¡Boom!** 127 transacciones aparecieron. Limpias. "STARBUCKS STORE #12345" → "Starbucks".

---

### Acto 2: Carga el histórico

el usuario está contento. Ahora quiere cargar más PDFs.

**NO cambia nada en la UI**. Sigue siendo la misma app. Mismo botón "Upload".

Arrastra 10 PDFs juntos (todos de BofA, de Jan-Sep 2025).

**Ve esto**:
```
┌─────────────────────────────────────────────────┐
│  Procesando PDFs...                             │
│  ████████████░░░░░░░░  7/10 completados        │
│                                                 │
│  ✓ bofa_2025_01.pdf  (98 transactions)         │
│  ✓ bofa_2025_02.pdf  (102 transactions)        │
│  ✓ bofa_2025_03.pdf  (87 transactions)         │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

**30 segundos después**, el timeline tiene ~1,000 transacciones más.

el usuario cambia el filtro de fecha a "Todo 2025" y ve:
```
┌─────────────────────────────────────────────────┐
│  Filtros: [BofA] [2025]                         │
├─────────────────────────────────────────────────┤
│  Sep 28  Starbucks              -$5.67  USD    │
│  Sep 27  Amazon                 -$89.99 USD    │
│  ...                                            │
│  Jan 5   Target                 -$45.23 USD    │
│  Jan 3   Costco                -$234.56 USD    │
│                                                 │
│  1,234 transacciones                            │
└─────────────────────────────────────────────────┘
```

**Perfecto**. Timeline cronológico. Todo limpio.

---

### Acto 3: Sigue cargando

el usuario está motivado. Ahora carga Apple Card (12 PDFs), Wise (24 PDFs), Scotia (48 PDFs).

**Mismo flujo**:
1. Arrastra PDFs
2. Barra de progreso
3. Aparecen en timeline

**NO hay "Terminar setup"**. NO hay "Ahora entra al modo diario". Nada.

Después de 2 horas, el usuario tiene:
- 96 PDFs procesados ✓
- ~12,000 transacciones ✓
- 4 cuentas ✓
- 2 años de historia ✓

Y la app se ve EXACTAMENTE igual que cuando empezó.

---

### Acto 4: Un mes después

Es octubre 2025. el usuario recibe los statements del mes pasado.

**Abre la app**. Ve su timeline normal.

**Arrastra 4 PDFs** (uno por cuenta: BofA, Apple Card, Wise, Scotia).

**10 segundos después**: ~400 transacciones nuevas aparecen en el timeline.

**el usuario ni siquiera piensa "estoy usando modo diario"**. Simplemente subió PDFs como siempre.

---

## ¿Por qué funciona?

### 1. Mismo flujo, siempre
No importa si subes 1 PDF o 100. El botón es el mismo. La UX es la misma.

### 2. El pipeline es invisible
el usuario no ve "clustering" ni "normalización". Solo ve: PDF → transacciones limpias.

### 3. El timeline es acumulativo
Cada upload agrega al timeline. No reemplaza. No resetea. Solo crece.

### 4. Mental model simple
```
PDF = source of truth
Timeline = vista acumulativa
Upload = acción única
```

NO hay conceptos de "setup" vs "daily use". Solo hay "la app".

---

## Comparación: App tradicional vs Finance App

### App tradicional
```
User journey:
1. Setup wizard →
2. "Conecta tus bancos" →
3. "Importa histórico" →
4. "Espera 10 minutos" →
5. "Setup completo ✓" →
6. "Ahora usa la app normalmente"

Problemas:
- 2 UX diferentes (setup vs daily)
- Fricción mental
- Si falta algo, ¿vuelves a setup?
```

### Finance App
```
User journey:
1. Arrastra PDF
2. Ve transacciones
3. (Repite cuando quieras)

Beneficios:
- 1 sola UX
- Cero fricción
- Intuitivo
```

---

## Detalles técnicos

### ¿Cómo evitamos duplicados?

**PDF hash**: Cada PDF se hashea (SHA256). Si ya procesaste ese PDF, skip.

```javascript
async function uploadPDF(pdfPath, accountId) {
  const hash = sha256(fs.readFileSync(pdfPath));

  // Check if already processed (1-table architecture)
  const exists = await db.get(
    'SELECT 1 FROM transactions WHERE source_hash = ? LIMIT 1',
    hash
  );

  if (exists) {
    return { status: 'skipped', reason: 'Already processed' };
  }

  // Process PDF → INSERT transactions
  await extractFromPDF({
    file: { path: pdfPath, name: basename(pdfPath) },
    accountId,
    config: { autoDetect: true, skipDuplicates: true }
  });
}
```

**Resultado**: el usuario puede subir el mismo PDF 100 veces. Solo se procesa 1 vez.

---

### ¿Y si subo PDFs en desorden?

**No importa**. El timeline siempre se ordena por `date`, no por orden de upload.

el usuario puede:
1. Subir Sep 2025
2. Subir Jan 2024
3. Subir Jun 2025

El timeline siempre mostrará: Jan → Jun → Sep.

---

### ¿Cómo es el performance con 12,000 transacciones?

**SQLite con índices**. Queries rápidas:

```sql
-- Mostrar último mes
SELECT * FROM transactions
WHERE date >= date('now', '-1 month')
ORDER BY date DESC
LIMIT 100;
-- ⚡ <10ms con 12k rows
```

```sql
-- Filtrar por cuenta
SELECT * FROM transactions
WHERE account = 'bofa'
AND date >= '2025-01-01'
ORDER BY date DESC;
-- ⚡ <15ms
```

**Resultado**: Timeline fluido, incluso con 12,000+ transacciones.

---

## Edge cases

### ¿Qué pasa si subo un PDF corrupto?

**Error graceful**:
```
┌─────────────────────────────────────────────────┐
│  ❌ Error procesando bofa_2025_09.pdf           │
│                                                 │
│  No se pudo extraer texto del PDF.             │
│  ¿El archivo está corrupto?                     │
│                                                 │
│  [Reintentar] [Cancelar]                        │
└─────────────────────────────────────────────────┘
```

**El timeline NO se afecta**. Las otras transacciones siguen ahí.

---

### ¿Qué pasa si subo un PDF de otro banco?

**Error claro**:
```
┌─────────────────────────────────────────────────┐
│  ❌ PDF no reconocido                           │
│                                                 │
│  Este PDF no parece ser de:                    │
│  - Bank of America                             │
│  - Apple Card                                  │
│  - Wise                                        │
│  - Scotiabank                                  │
│                                                 │
│  [Ok]                                          │
└─────────────────────────────────────────────────┘
```

---

### ¿Puedo borrar transacciones?

**Sí, pero con confirmación**:

1. Click derecho en transacción → "Delete"
2. Confirmación: "¿Borrar esta transacción? No se puede deshacer."
3. Si acepta → borra de `transactions` table (1-table architecture)

```javascript
async function deleteTransaction(transactionId) {
  // Single DELETE (1-table architecture)
  await db.run('DELETE FROM transactions WHERE id = ?', transactionId);
}
```

**Resultado**: Desaparece del timeline permanentemente.

**Nota**: Si vuelves a subir el mismo PDF, volverá a aparecer (porque se re-procesa).

---

## UI mockup completo

### Estado inicial (app vacía)
```
┌──────────────────────────────────────────────────────────────┐
│  Finance App                                      [⚙️]        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                          📁                                  │
│                                                              │
│              No hay transacciones aún                        │
│                                                              │
│          Arrastra un PDF bancario aquí                       │
│          o haz click para seleccionar                        │
│                                                              │
│                                                              │
│          Soportamos:                                         │
│          • Bank of America                                   │
│          • Apple Card                                        │
│          • Wise                                              │
│          • Scotiabank                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Después del primer upload
```
┌──────────────────────────────────────────────────────────────┐
│  Finance App                           [Upload] [Filter] [⚙️] │
├──────────────────────────────────────────────────────────────┤
│  Filters: [All accounts ▾] [Last 3 months ▾] [All types ▾]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sep 28, 2025                                                │
│    🏪 Starbucks                          -$5.67  USD  [BofA] │
│    🛒 Target                            -$42.30  USD  [BofA] │
│                                                              │
│  Sep 27, 2025                                                │
│    📦 Amazon                            -$89.99  USD  [Apple]│
│    💰 Salary deposit                 +$3,500.00  USD  [BofA] │
│                                                              │
│  Sep 26, 2025                                                │
│    🎬 Netflix                           -$15.99  USD  [Apple]│
│    ↔️ Transfer to Wise                  -$1,000.00  USD [BofA]│
│                                         +$1,000.00  USD [Wise]│
│                                                              │
│  ...                                                         │
│                                                              │
│  127 transactions • $2,456.78 spent • $3,500.00 income      │
└──────────────────────────────────────────────────────────────┘
```

### Con histórico completo (12k transactions)
```
┌──────────────────────────────────────────────────────────────┐
│  Finance App                           [Upload] [Filter] [⚙️] │
├──────────────────────────────────────────────────────────────┤
│  Filters: [BofA ▾] [2024 ▾] [All types ▾]                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Dec 31, 2024                                                │
│    🏪 Starbucks                          -$5.67  USD         │
│    🍔 McDonald's                         -$12.45  USD        │
│                                                              │
│  Dec 30, 2024                                                │
│    ⛽ Shell Gas                          -$65.00  USD        │
│    🛒 Costco                           -$234.56  USD         │
│                                                              │
│  ...                                                         │
│                                                              │
│  1,234 transactions • $45,678.90 spent • $78,000.00 income  │
│                                                              │
│  [Load more] ⬇️                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Resumen: Timeline Continuo

### Qué ES
- UN flujo para todo (histórico + diario)
- Pipeline invisible (usuario solo ve: PDF → transacciones)
- Timeline acumulativo (nunca se resetea)

### Qué NO es
- NO es "modo setup" + "modo diario"
- NO es wizard de configuración
- NO es "conectar banco" automáticamente

### Por qué importa
- **Simplicidad mental**: Una sola forma de hacer las cosas
- **Cero fricción**: No hay "ahora empieza a usar la app de verdad"
- **Escalable**: Funciona igual con 10 transactions que con 10,000

---

**Próximo flow**: Lee [flow-2-upload-pdf.md](flow-2-upload-pdf.md) para el detalle técnico del upload.
