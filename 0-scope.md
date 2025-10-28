# Scope - Finance App V1

**Qué sí / qué no está en V1**

## ✅ QUÉ SÍ está en V1

### Inputs
- **4 bancos hardcodeados**: BofA, Apple Card, Wise, Scotia
- **PDFs como fuente única**: Solo statements en PDF
- **2 años de historia**: ~96 PDFs, ~12,000 transacciones
- **2 monedas**: USD y MXN

### Core Features
- **Timeline continuo**: Un solo flujo para todo (histórico + diario)
- **Upload drag & drop**: Arrastra PDF → procesa → aparece
- **Merchant normalization**: "STARBUCKS #123" → "Starbucks" (automático)
- **Transfer linking**: Detecta cuando mueves plata entre cuentas
- **Multi-currency**: USD/MXN con exchange rates correctos
- **Filtros básicos**: Por cuenta, fecha, merchant, tipo

### Pipeline
- **4 etapas automáticas**: Parse → Cluster → Normalize → Canonical
- **2 tablas**: observations (raw) + transactions (clean)
- **Clustering simple**: String similarity (~50 LOC, no ML)
- **Reglas hardcodeadas**: Regex para normalización

### UI
- **Vista timeline**: Lista cronológica de transacciones
- **Panel de detalles**: Click → ve toda la info
- **Indicadores visuales**: Transfers, currencies, status
- **Responsive**: Desktop first, pero adaptable

---

## ❌ QUÉ NO está en V1

### Fuera de scope
- ❌ **API bancarias**: Solo PDFs, no conexión directa a bancos
- ❌ **OCR**: Asumimos PDFs con texto extraíble
- ❌ **Budgets**: No hay presupuestos ni categorías
- ❌ **Reports**: No hay gráficas ni analytics avanzados
- ❌ **Multi-user**: Solo Darwin
- ❌ **Sync cloud**: Todo local, no hay servidor
- ❌ **Mobile**: Solo desktop (Electron)
- ❌ **CSV import**: Solo PDFs
- ❌ **Manual transactions**: No puedes crear transacciones a mano
- ❌ **Editar transactions**: No se pueden modificar (solo deletear)
- ❌ **Categories**: No hay categorización de gastos
- ❌ **Tags**: No hay sistema de tags
- ❌ **Recurring transactions**: No detecta pagos recurrentes
- ❌ **Forecasting**: No predice gastos futuros
- ❌ **Crypto**: No soporta criptomonedas
- ❌ **Investments**: No maneja stocks/fondos
- ❌ **Bills**: No rastrea facturas por pagar

### Simplificaciones aceptadas
- **Hardcoded**: 4 cuentas específicas de Darwin
- **SQLite local**: No hay database remota
- **Reglas fijas**: Normalización con regex, no ML
- **Sin undo**: Si borras, se borra (con confirmación)
- **Sin export**: No se puede exportar a CSV/Excel (V2)
- **Sin settings**: No hay configuración avanzada

---

## 🎯 Filosofía V1

### Example-first
Construir para un caso real (Darwin) primero. Extraer abstracciones en V2.

### Simple pero completo
~1,800 LOC, pero cubre TODAS las necesidades de Darwin para 2 años de data.

### Hardcoded is OK
Mejor hardcodear bien que abstraer mal. Las abstracciones correctas emergen de código funcionando.

### Local first
Todo en SQLite local. Rápido, confiable, sin servidor.

---

## 📊 Números de referencia

| Concepto | V1 |
|----------|-----|
| Cuentas | 4 (hardcoded) |
| Parsers | 4 (uno por banco) |
| Tablas DB | 2 (observations + transactions) |
| LOC total | ~1,800 |
| LOC parsers | ~400 |
| LOC pipeline | ~200 |
| LOC UI | ~800 |
| PDFs a procesar | ~96 (2 años) |
| Transacciones | ~12,000 |
| Monedas | 2 (USD, MXN) |

---

## ➡️ Qué viene en V2

- Multi-usuario (config por usuario)
- Más bancos (sistema de plugins)
- CSV import
- Categories & tags
- Budget tracking
- Reports & analytics
- Export a Excel
- Mobile app
- Cloud sync opcional

Pero primero: **Construir V1 que funcione perfecto para Darwin**.

---

**Próximo doc**: Lee [1-architecture.md](1-architecture.md) para entender cómo está construida la app.
