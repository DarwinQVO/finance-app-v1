# Finance App: The Complete Story

**Una narración de cómo Darwin usa Finance App desde el día 1 hasta su vida diaria**

> **⚠️ NOTA**: Este storytelling se enfoca en las features core que se construyen primero (timeline, upload, normalization, transfers). El sistema completo incluye muchas más capacidades descritas en [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md).

---

## Prólogo: El problema

Es octubre 2025. Darwin tiene 4 cuentas bancarias:
- **Bank of America** (USD) - Main checking account
- **Apple Card** (USD) - Credit card para gastos diarios
- **Wise** (USD/EUR) - International transfers y pagos en Europa
- **Scotiabank** (MXN) - Cuenta en México para gastos locales

Cada mes, recibe **4 PDFs** con sus statements. En 2 años, ha acumulado **96 PDFs** y aproximadamente **12,000 transacciones**.

**El problema**: No tiene una vista unificada de todas sus finanzas. Cada banco tiene su propio dashboard, pero ninguno muestra el big picture.

**La solución**: Finance App.

---

## Capítulo 1: El Primer Día

### 9:00 AM - Instalación

Darwin descarga Finance App desde su Mac. Doble-click. La app se abre.

**Ve esto**:
```
┌──────────────────────────────────────────────────┐
│  Finance App                             [⚙️]    │
├──────────────────────────────────────────────────┤
│                                                  │
│                      📁                          │
│                                                  │
│           No hay transacciones aún               │
│                                                  │
│       Arrastra un PDF bancario aquí              │
│       o haz click para seleccionar               │
│                                                  │
│       Soportamos:                                │
│       • Bank of America                          │
│       • Apple Card                               │
│       • Wise                                     │
│       • Scotiabank                               │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Simple. Directo. Sin setup wizard. Sin "Conecta tus bancos". Solo: "Arrastra PDF".**

---

### 9:05 AM - Primer PDF

Darwin tiene su carpeta de statements abierta. Ve `bofa_2025_09.pdf` (el statement más reciente de BofA).

**Arrastra el archivo** y lo suelta en la app.

**Inmediatamente**:
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

**3 segundos después**:
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

Darwin hace click en "Ver timeline".

---

### 9:06 AM - El Timeline

**¡Wow!**

```
┌──────────────────────────────────────────────────┐
│  Finance App              [Upload] [Filter] [⚙️]  │
├──────────────────────────────────────────────────┤
│  Filters: [BofA] [Sep 2025]                      │
├──────────────────────────────────────────────────┤
│                                                  │
│  Sep 30, 2025                                    │
│    ☕ Starbucks              -$5.67  USD         │
│    🛒 Target                -$42.30  USD         │
│                                                  │
│  Sep 29, 2025                                    │
│    📦 Amazon                -$89.99  USD         │
│    ⛽ Shell                 -$65.00  USD         │
│                                                  │
│  Sep 28, 2025                                    │
│    💰 Salary deposit      +$3,500.00  USD        │
│    ↔️ Transfer to Wise    -$1,000.00  USD        │
│                                                  │
│  Sep 27, 2025                                    │
│    🎬 Netflix               -$15.99  USD         │
│    🚗 Uber                  -$25.45  USD         │
│                                                  │
│  ...                                             │
│                                                  │
│  127 transactions • $2,456.78 spent              │
└──────────────────────────────────────────────────┘
```

**Darwin sonríe**.

Los merchants están **limpios**. No ve "STARBUCKS STORE #12345 SANTA MONICA CA". Ve "Starbucks" con un emoji de café.

"AMAZON.COM*M89JF2K3 AMZN.COM/BILL WA" → "Amazon 📦"

"UBER *TRIP HLP.UBER.COM CA" → "Uber 🚗"

**La app hizo todo el trabajo de normalización automáticamente**.

---

### 9:10 AM - Exploración

Darwin hace click en "Starbucks -$5.67".

Un **panel aparece desde la derecha**:

```
┌──────────────┬────────────────────────┐
│  Timeline    │  Transaction Details   │
│              │                        │
│  Sep 30      │  Starbucks             │
│  Starbucks ◄─┤  Sep 30, 2025          │
│  -$5.67      │  ──────────────────    │
│              │  💰 Amount: -$5.67 USD │
│              │  🏦 Account: BofA      │
│              │                        │
│              │  📄 Original:          │
│              │  STARBUCKS STORE #12345│
│              │  SANTA MONICA CA       │
│              │                        │
│              │  📁 Source:            │
│              │  bofa_2025_09.pdf      │
│              │  Line 47               │
│              │                        │
│              │  🎯 Confidence: 95%    │
│              │                        │
│              │  [Delete] [Close]      │
└──────────────┴────────────────────────┘
```

**Darwin puede ver**:
- El merchant normalizado: "Starbucks"
- El merchant original del PDF: "STARBUCKS STORE #12345 SANTA MONICA CA"
- De qué PDF vino: `bofa_2025_09.pdf`, línea 47
- Qué tan segura está la normalización: 95%

**Transparencia total**.

---

### 9:15 AM - Carga el histórico

Darwin está emocionado. Ahora quiere cargar **todo su histórico**.

Tiene 96 PDFs en su carpeta de statements:
- 24 PDFs de BofA (2 años)
- 24 PDFs de Apple Card
- 24 PDFs de Wise
- 24 PDFs de Scotia

**Selecciona los 24 PDFs de BofA** y los arrastra todos juntos a la app.

```
┌──────────────────────────────────────────────────┐
│  Procesando 24 PDFs...                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  ✓ bofa_2023_10.pdf   (102 transactions)        │
│  ✓ bofa_2023_11.pdf   (98 transactions)         │
│  ✓ bofa_2023_12.pdf   (87 transactions)         │
│  ✓ bofa_2024_01.pdf   (95 transactions)         │
│  ⏳ bofa_2024_02.pdf   Procesando...             │
│  ⏺ bofa_2024_03.pdf                              │
│  ⏺ bofa_2024_04.pdf                              │
│  ...                                             │
│                                                  │
│  ████░░░░░░░░░░░░░░  20% (5/24)                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

**1 minuto después**: Los 24 PDFs están procesados. ~2,400 transacciones agregadas.

Darwin cambia el filtro de fecha a "All time" y ve:

```
┌──────────────────────────────────────────────────┐
│  Filters: [BofA] [All time]                      │
├──────────────────────────────────────────────────┤
│                                                  │
│  Sep 30, 2025                                    │
│    ☕ Starbucks              -$5.67  USD         │
│    ...                                           │
│                                                  │
│  Oct 1, 2023                                     │
│    🛒 Costco               -$234.56  USD         │
│    ...                                           │
│                                                  │
│  2,400 transactions • $45,678.90 spent           │
└──────────────────────────────────────────────────┘
```

**Perfecto**. 2 años de BofA en el timeline.

---

### 9:30 AM - Los otros bancos

Darwin repite el proceso con los otros bancos:

**Apple Card** (24 PDFs) → 5 min → 3,000 transacciones
**Wise** (24 PDFs) → 5 min → 4,200 transacciones
**Scotia** (24 PDFs) → 5 min → 2,400 transacciones

**Total**: 40 minutos después, Darwin tiene:
- 96 PDFs procesados ✓
- ~12,000 transacciones ✓
- 4 cuentas ✓
- 2 años de historia ✓

---

### 10:15 AM - Exploración de datos

Darwin cambia los filtros para explorar:

**Ver solo gastos**:
```
Filters: [All accounts] [All time] [Expenses]

5,678 transactions • $78,234.56 spent
```

**Ver solo transfers**:
```
Filters: [All accounts] [All time] [Transfers]

Sep 26  ↔️ BofA → Wise        -$1,000.00 USD  [BofA]
                              +$1,000.00 USD  [Wise]

Aug 15  ↔️ Wise → Scotia      -$500.00 USD    [Wise]
                              +$9,925.00 MXN  [Scotia]

...

324 transfers (162 pairs)
```

**Buscar "Starbucks"**:
```
Search: "Starbucks"

45 transactions • $234.56 spent at Starbucks
```

**Darwin está impresionado**. La app le da insights que nunca tuvo antes.

---

## Capítulo 2: Un Mes Después

### Noviembre 2025 - Uso diario

Es el 1 de noviembre. Darwin recibe los statements de octubre.

**Abre la app**. Ve su timeline normal con las 12k transacciones.

**Arrastra 4 PDFs** (uno por cuenta).

**15 segundos después**: ~400 transacciones nuevas aparecen en el timeline.

**Darwin ni siquiera pensó "estoy en modo diario"**. Simplemente subió PDFs como siempre. El flujo es **idéntico** al día 1.

**Eso es timeline continuo**.

---

### Una transacción interesante

Darwin ve algo raro en el timeline:

```
Oct 15  Random Coffee Shop XYZ    -$12.45  USD  [BofA]
        🎯 Confidence: 35%
```

**Hace click** para ver detalles:

```
┌────────────────────────────────────────┐
│  Random Coffee Shop Xyz                │
│  Oct 15, 2025                          │
├────────────────────────────────────────┤
│  📄 Original:                          │
│  RANDOM COFFEE SHOP XYZ #789           │
│                                        │
│  🔗 Cluster: cluster_abc (1 member)    │
│                                        │
│  🎯 Confidence: 35%                    │
│  ⚠️ Low confidence                     │
│  ⚠️ Single-member cluster              │
│  ⚠️ No matching rule                   │
└────────────────────────────────────────┘
```

**Darwin entiende**: Es un merchant nuevo que la app nunca vio antes. Por eso el confidence es bajo.

**Nota para futuras expansiones**: Agregar feature para editar merchant manualmente.

---

## Capítulo 3: Insights

### Diciembre 2025 - Análisis de fin de año

Darwin quiere ver cuánto gastó en 2025.

**Filtra**:
```
Filters: [All accounts] [2025] [Expenses]

8,234 transactions • $89,456.78 spent
```

**Busca "Starbucks"**:
```
Search: "Starbucks"
Date: 2025

67 transactions • $345.67 spent at Starbucks

Average: $5.16 per visit
```

**"¿$345 en café este año? 😱"**

Darwin decide reducir su consumo de Starbucks en 2026.

---

### Ver todos los merchants

Darwin quiere saber dónde más gasta mucho.

Abre la consola dev (Cmd+Opt+I) y corre:

```sql
SELECT
  merchant,
  COUNT(*) as count,
  SUM(amount) as total
FROM transactions
WHERE type = 'expense'
AND date >= '2025-01-01'
GROUP BY merchant
ORDER BY total ASC
LIMIT 20;
```

**Resultado**:
```
Starbucks        67    -$345.67
Amazon          234  -$2,345.67
Uber             89    -$890.45
Netflix          12    -$191.88
Costco           24  -$2,456.78
...
```

**"Ah, gasto mucho más en Amazon que en Starbucks"**.

---

## Capítulo 4: Transfers

### El flujo multi-país de Darwin

Darwin tiene un flujo optimizado para vivir en USA y México:

1. **Salary** → BofA (USD)
2. **Gastos USA** → BofA + Apple Card (USD)
3. **Gastos internacionales** → Transfer de BofA a Wise (USD)
4. **Gastos México** → Transfer de Wise a Scotia (USD → MXN)

**La app detecta todos estos transfers automáticamente**.

### Ver transfers del año

```
Filters: [All accounts] [2025] [Transfers]

Jan 15  ↔️ BofA → Wise       -$2,000 USD [BofA]
                             +$2,000 USD [Wise]

Jan 18  ↔️ Wise → Scotia     -$1,000 USD [Wise]
                            +$19,850 MXN [Scotia]

Feb 12  ↔️ BofA → Apple Card -$1,500 USD [BofA]
                             +$1,500 USD [Apple]

...

86 transfers (43 pairs)
Total transferred: $45,000 USD
```

**Darwin puede rastrear exactamente cómo fluyó su dinero durante el año**.

---

## Capítulo 5: Edge Cases

### Un PDF problemático

Darwin intenta subir `wise_2025_03.pdf` pero falla:

```
┌──────────────────────────────────────────┐
│  ❌ Parsing Failed                       │
├──────────────────────────────────────────┤
│  No transactions found in PDF.          │
│                                          │
│  The PDF format may have changed.       │
│                                          │
│  [Ok]                                    │
└──────────────────────────────────────────┘
```

**Darwin recuerda**: Ese mes no tuvo transacciones en Wise. El PDF está vacío.

**La app manejó el error gracefully**. No crasheó. Solo mostró un mensaje claro.

---

### Un transfer que no linkeó

Darwin ve:

```
Oct 20  Transfer to Wise     -$1,000 USD [BofA]  (no link)
```

No tiene el icono ⛓️. **¿Por qué?**

Hace click para ver detalles:

```
┌────────────────────────────────────────┐
│  ⚠️ Transfer pair not found            │
│                                        │
│  This transfer does not have a         │
│  matching pair. Possible causes:       │
│  • The other PDF hasn't been uploaded  │
│  • The dates are >3 days apart         │
│  • The amounts don't match             │
└────────────────────────────────────────┘
```

**Darwin se da cuenta**: Olvidó subir el statement de Wise de octubre.

**Arrastra `wise_2025_10.pdf`**.

**La app re-procesa automáticamente y linkea el transfer** ✓

Ahora ve:

```
Oct 20  ↔️ Transfer: BofA → Wise
        -$1,000.00 USD [BofA] ⛓️
Oct 21  +$1,000.00 USD [Wise] ⛓️
```

**Perfecto**.

---

## Capítulo 6: Regeneración

### Enero 2026 - Nuevas reglas

Darwin nota que "TRADER JOE'S" no está normalizando bien. A veces aparece como "Trader Joes" (sin apostrophe).

**Abre el código** y agrega una regla:

```javascript
// main/pipeline/normalize.js

NORMALIZATION_RULES.push({
  pattern: /TRADER\s*JOE'?S/,
  normalized: "Trader Joe's"
});
```

**Regenera el canonical**:

```bash
node scripts/regenerate-canonical.js
```

**15 segundos después**:

```
Regenerating canonical store...
✓ Deleted 12,000 transactions
✓ Clustering... (5s)
✓ Normalization... (3s)
✓ Creating canonical... (5s)
✓ Linking transfers... (2s)
Regeneration complete!
```

**Abre la app**. Ahora todas las transacciones de Trader Joe's están correctas: "Trader Joe's" con apostrophe ✓

**Eso es reproducibilidad**. Las observations nunca cambiaron. Solo regeneró el canonical con las nuevas reglas.

---

## Epílogo: Un Año Después

### Octubre 2026 - Darwin mira atrás

Darwin ha usado Finance App durante un año entero.

**Stats**:
- 144 PDFs procesados (12 por mes × 12 meses)
- ~18,000 transacciones
- 4 cuentas
- 2 currencies principales (USD, MXN)
- 0 crashes
- 0 data loss

**Lo que funciona perfecto**:
- Timeline continuo (mismo flujo desde día 1)
- Merchant normalization (~95% accuracy)
- Transfer linking (detecta el 90% automáticamente)
- Performance (18k transacciones, queries <50ms)
- Simplicidad (1,800 LOC, todo local, sin servidor)

**Siguientes features planeadas**:
- Edit merchants manualmente
- Categories & tags
- Budget tracking
- Export a Excel
- Mobile app

**Pero por ahora, Finance App hace exactamente lo que necesita**.

---

## Apéndice: ¿Por qué funciona?

### Principio 1: Timeline Continuo

**NO hay separación** entre "setup" y "daily use". El flujo es idéntico siempre.

**Resultado**: Cero fricción cognitiva. Darwin nunca piensa "ahora estoy en modo X". Solo sube PDFs.

---

### Principio 2: Truth Construction Invisible

Darwin nunca ve:
- Clustering
- Normalization rules
- Confidence scores (a menos que quiera)

**Solo ve**: Transacciones limpias.

**Resultado**: La complejidad está escondida. La UX es simple.

---

### Principio 3: Two-Store Architecture

**Observations** (raw) + **Transactions** (clean).

**Resultado**:
- Auditoría: Siempre puedes ver el original
- Reproducibilidad: Puedes regenerar canonical
- Debug: Si algo sale mal, el raw está ahí

---

### Principio 4: Local First

Todo en SQLite. Sin servidor. Sin API calls. Sin network needed.

**Resultado**:
- Rápido (~10ms queries)
- Confiable (no dependency on servers)
- Privado (data never leaves computer)

---

### Principio 5: Simple Over Clever

- No ML, solo string similarity
- No abstracciones fancy, solo 2 tablas
- No async complexity, todo síncrono
- ~1,800 LOC total

**Resultado**: Easy to understand, easy to debug, easy to maintain.

---

## Conclusión

Finance App es **simple pero completo**.

Hace una cosa: **mostrar todas tus transacciones bancarias en un timeline unificado**.

Lo hace **bien**: Merchants limpios, transfers detectados, performance rápido, UX simple.

No hace **más**: No es budgeting app, no es investment tracker, no es financial advisor.

**Y eso está perfecto**.

Futuras expansiones agregarán más features. Pero ya resuelve el problema principal de Darwin: **tener visibilidad completa de sus finanzas en un solo lugar**.

**Fin de la historia** ✓

---

**Fecha**: Octubre 2025
**Version**: 1.0
**Status**: Documentación completa
**LOC Total**: ~1,800
**Líneas de documentación**: ~5,000+

**Próximo paso**: Construir la app 🚀
