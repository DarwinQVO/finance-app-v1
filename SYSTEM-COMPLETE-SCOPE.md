# Finance App - Sistema Completo (Scope Total)

**Documentación de TODAS las features que el sistema necesita**

---

## 🎯 Filosofía

✅ **Simple pero completo** - No over-engineering, pero tampoco limitante
✅ **Arquitectura escalable** - Decisiones de hoy no bloquean mañana
✅ **Build incremental** - Construir en fases, documentar todo ahora
✅ **Config-driven** - No hardcodear, parametrizar

---

## 📊 CORE FEATURES (Phase 1)

### 1. Upload & Import
- ✅ **PDF upload** - Drag & drop, batch processing
- ✅ **CSV import** - Formato estándar + custom mapping
- ✅ **Manual entry** - Crear transactions a mano
- ✅ **Auto-detection** - Detectar banco/formato automáticamente
- ✅ **Deduplication** - No procesar el mismo archivo 2 veces
- ✅ **Progress tracking** - Ver progreso de uploads múltiples

### 2. Data Pipeline
- ✅ **Parsing** - Config-driven parsers (NO hardcoded 4 bancos)
- ✅ **Normalization** - Reglas configurables + machine learning optional
- ✅ **Clustering** - Agrupar merchants similares (threshold configurable)
- ✅ **Type classification** - Expense | Income | Transfer (auto + manual override)
- ✅ **Confidence scoring** - Indicar qué tan seguro está el pipeline
- ✅ **Error handling** - Graceful degradation, reporting claro

### 3. Timeline View
- ✅ **Chronological list** - Todas las transactions ordenadas por fecha
- ✅ **Grouping** - Por día, semana, mes (configurable)
- ✅ **Infinite scroll** - Pagination eficiente para miles de transactions
- ✅ **Quick actions** - Edit, delete, categorize desde el timeline
- ✅ **Visual indicators** - Icons por tipo, colors por status
- ✅ **Multi-currency** - Display claro de USD, MXN, EUR, etc

### 4. Filters & Search
- ✅ **By account** - Ver 1 cuenta o todas
- ✅ **By date range** - Custom ranges, presets (last month, year, etc)
- ✅ **By type** - Expenses, income, transfers
- ✅ **By category** - Filtrar por categorías
- ✅ **By merchant** - Buscar por nombre
- ✅ **By amount range** - Min/max
- ✅ **By tags** - Filtrar por tags
- ✅ **Full-text search** - Buscar en description/notes
- ✅ **Saved filters** - Guardar combinaciones de filtros

### 5. Transaction Details
- ✅ **All metadata** - Ver toda la info de una transaction
- ✅ **Original vs Clean** - Mostrar raw vs normalized
- ✅ **Edit capabilities** - User puede modificar cualquier campo
- ✅ **Attachments** - Link a PDF source, agregar receipts
- ✅ **Notes** - User puede agregar notas
- ✅ **History** - Ver cambios (si fue editado)

---

## 🏷️ CATEGORIZATION (Phase 2)

### 6. Categories System
- ✅ **Hierarchical categories** - Categories + Subcategories
- ✅ **Default taxonomy** - Set de categorías por defecto
- ✅ **Custom categories** - User puede crear/editar
- ✅ **Category rules** - Auto-asignar por merchant/keyword
- ✅ **Bulk categorization** - Categorizar múltiples a la vez
- ✅ **Category colors** - Visual identification
- ✅ **Category icons** - Íconos personalizables

### 7. Tags System
- ✅ **Free-form tags** - User agrega tags como quiera
- ✅ **Tag suggestions** - Auto-suggest basado en historial
- ✅ **Tag colors** - Visual grouping
- ✅ **Multiple tags** - Una transaction puede tener varios tags
- ✅ **Tag management** - Rename, merge, delete tags

---

## 💰 BUDGETS & TRACKING (Phase 2)

### 8. Budget Creation
- ✅ **Budget by category** - Set límites por categoría
- ✅ **Budget by merchant** - Límites por merchant específico
- ✅ **Budget by account** - Límites por cuenta
- ✅ **Time-based budgets** - Monthly, quarterly, yearly
- ✅ **Rollover budgets** - Sobrante pasa al siguiente período
- ✅ **Budget templates** - Crear templates reutilizables

### 9. Budget Tracking
- ✅ **Real-time tracking** - Ver cuánto llevas vs límite
- ✅ **Visual progress** - Barras de progreso, % usado
- ✅ **Alerts** - Notificaciones cuando te acercas al límite
- ✅ **Historical comparison** - Este mes vs meses anteriores
- ✅ **Budget reports** - Qué categorías se pasan, cuáles sobran

---

## 🔄 RECURRING TRANSACTIONS (Phase 2)

### 10. Recurring Detection
- ✅ **Auto-detect patterns** - Identificar pagos recurrentes
- ✅ **Pattern types** - Weekly, monthly, quarterly, yearly
- ✅ **Amount tolerance** - Detectar aunque el monto varíe un poco
- ✅ **Date tolerance** - Detectar aunque la fecha varíe ±3 días
- ✅ **Confidence scoring** - Qué tan seguro está de que es recurrente

### 11. Recurring Management
- ✅ **Group recurring** - Ver todas las instances juntas
- ✅ **Predict next** - Proyectar próximas ocurrencias
- ✅ **Edit group** - Cambiar category de todas las instances
- ✅ **Mark as recurring** - User puede marcar manualmente
- ✅ **Cancel subscription** - Marcar como "ya no recurrente"

---

## 📊 REPORTS & ANALYTICS (Phase 3)

### 12. Pre-built Reports
- ✅ **Spending by category** - Pie chart con breakdown
- ✅ **Spending trends** - Line chart por mes/año
- ✅ **Income vs Expenses** - Bar chart comparativo
- ✅ **Account balances** - Evolución de balances (si trackeas)
- ✅ **Merchant analysis** - Top merchants por gasto
- ✅ **Budget performance** - Qué tan bien sigues tus budgets
- ✅ **Tax summary** - Categorías deducibles (configurable)

### 13. Custom Reports
- ✅ **Report builder** - Drag & drop para crear reports
- ✅ **Custom date ranges** - Cualquier período
- ✅ **Custom groupings** - Por category, tag, merchant, account
- ✅ **Chart types** - Pie, bar, line, scatter
- ✅ **Saved reports** - Guardar configuraciones
- ✅ **Scheduled reports** - Auto-generar semanalmente/mensualmente

### 14. Export
- ✅ **CSV export** - Para Excel
- ✅ **PDF export** - Reports bonitos para imprimir
- ✅ **JSON export** - Para integraciones
- ✅ **Filtered exports** - Exportar solo lo filtrado
- ✅ **Custom columns** - Elegir qué campos exportar
- ✅ **Batch export** - Exportar múltiples períodos

---

## 🔗 TRANSFERS & LINKING (Phase 1)

### 15. Transfer Detection
- ✅ **Auto-detect transfers** - Entre cuentas propias
- ✅ **Heuristics** - Mismo monto, fechas cercanas, cuentas diferentes
- ✅ **Confidence scoring** - Qué tan seguro está del match
- ✅ **Cross-currency** - Detectar transfers USD → MXN (con rate)
- ✅ **Manual linking** - User puede linkear manualmente

### 16. Transfer Management
- ✅ **Visual grouping** - Ver ambos lados del transfer juntos
- ✅ **Unlink** - Separar si fue mal linkeado
- ✅ **Exclude from totals** - No contar como expense/income
- ✅ **Transfer fees** - Trackear fees por separado
- ✅ **Transfer history** - Ver todos los transfers en timeline

---

## 🏦 MULTI-BANK SUPPORT (Phase 1)

### 17. Bank Configuration
- ✅ **Plugin system** - Agregar bancos sin tocar código
- ✅ **Parser configs** - JSON/YAML config por banco
- ✅ **Field mapping** - Mapear campos del PDF a schema
- ✅ **Regex patterns** - Configurar patterns de parsing
- ✅ **Custom rules** - Reglas de normalización por banco
- ✅ **Test suite** - Validar parsers con PDFs de ejemplo

### 18. Account Management
- ✅ **Add accounts** - Agregar nuevas cuentas fácilmente
- ✅ **Account metadata** - Nombre, banco, currency, color
- ✅ **Account grouping** - Agrupar cuentas (e.g., "Personal", "Business")
- ✅ **Archive accounts** - Ocultar cuentas viejas sin borrar data
- ✅ **Account balances** - Trackear balance actual (opcional)

---

## 👥 MULTI-USER (Phase 4)

### 19. User Profiles
- ✅ **User accounts** - Cada persona tiene su profile
- ✅ **User settings** - Preferencias personalizadas
- ✅ **Data isolation** - Cada user ve solo sus transactions
- ✅ **Shared accounts** - Optional: compartir cuentas entre users

### 20. Collaboration
- ✅ **Shared categories** - Taxonomía compartida (opcional)
- ✅ **Shared budgets** - Budgets de household
- ✅ **Activity log** - Ver quién editó qué
- ✅ **Permissions** - Admin vs regular user

---

## 📱 MOBILE APP (Phase 4)

### 21. Mobile Features
- ✅ **Native apps** - iOS + Android
- ✅ **Core features** - Timeline, filters, details
- ✅ **Photo upload** - Tomar foto de receipt → OCR
- ✅ **Quick entry** - Agregar transaction rápido
- ✅ **Sync** - Sync con desktop app
- ✅ **Offline mode** - Ver data sin internet

---

## 🔌 INTEGRATIONS (Phase 3)

### 22. API
- ✅ **REST API** - Para integraciones externas
- ✅ **Webhooks** - Notificar eventos (new transaction, budget alert)
- ✅ **OAuth** - Autenticación segura
- ✅ **Rate limiting** - Protección contra abuse

### 23. Third-party
- ✅ **Plaid integration** - Conectar bancos directamente (opcional)
- ✅ **Zapier/IFTTT** - Automatizaciones
- ✅ **Google Sheets** - Export automático
- ✅ **Slack/Discord** - Notificaciones

---

## ⚙️ SETTINGS & CONFIGURATION (Phase 1)

### 24. App Settings
- ✅ **Currency preferences** - Default currency, exchange rates
- ✅ **Date format** - DD/MM vs MM/DD
- ✅ **Number format** - Decimal separator
- ✅ **Language** - i18n support
- ✅ **Theme** - Light/dark mode
- ✅ **Notifications** - Qué notificaciones recibir

### 25. Data Management
- ✅ **Backup** - Export completo de toda la data
- ✅ **Restore** - Import backup
- ✅ **Clear data** - Borrar todo (con confirmación)
- ✅ **Database vacuum** - Optimizar DB
- ✅ **Audit log** - Ver historial de cambios

---

## 🔒 SECURITY & PRIVACY (All Phases)

### 26. Security
- ✅ **Local-first** - Data nunca sale del dispositivo (a menos que user quiera)
- ✅ **Encryption** - DB encriptada en disk
- ✅ **Password protection** - App lock (opcional)
- ✅ **Biometric unlock** - Face ID / Touch ID
- ✅ **Auto-lock** - Lock después de X minutos inactivo

---

## 🎨 UX ENHANCEMENTS (Phase 2-3)

### 27. Smart Features
- ✅ **Smart suggestions** - Sugerir category basado en merchant
- ✅ **Duplicate detection** - Alert si parece duplicado
- ✅ **Anomaly detection** - Alert de transacciones inusuales
- ✅ **Merchant logos** - Mostrar logos de merchants conocidos
- ✅ **Receipt scanning** - OCR de receipts (Phase 4)

### 28. Onboarding
- ✅ **Setup wizard** - Guiar al user en primer uso
- ✅ **Sample data** - Demo con data falsa para explorar
- ✅ **Tutorials** - Tooltips y walkthroughs
- ✅ **Help center** - Docs integradas

---

## 📈 TOTAL FEATURES: 28 areas × ~6 sub-features = ~168 features

**Organizadas en 4 phases:**
- **Phase 1 (Core)**: 80 features - Upload, Pipeline, Timeline, Filters, Transfers, Settings
- **Phase 2 (Organization)**: 40 features - Categories, Tags, Budgets, Recurring
- **Phase 3 (Analysis)**: 30 features - Reports, Export, API
- **Phase 4 (Scale)**: 18 features - Multi-user, Mobile

---

## ✅ Próximo paso

Ahora documentar la **ARQUITECTURA ESCALABLE** que soporte todas estas features sin over-engineering.

Ver: `ARCHITECTURE-COMPLETE.md`
