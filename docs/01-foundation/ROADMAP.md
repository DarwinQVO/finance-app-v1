# Finance App - Roadmap de Construcción

**Plan de desarrollo por fases - Build incremental, documentación completa**

---

## 🎯 Filosofía del Roadmap

✅ **Documentado TODO** - Todas las features están especificadas
✅ **Build incremental** - Construir en orden lógico
✅ **No rehacerse** - Arquitectura correcta desde Phase 1
✅ **Usable en cada phase** - Cada phase entrega valor

---

## 📊 PHASE 1: CORE (MVP Funcional)

**Objetivo**: App básica pero usable. Darwin puede subir PDFs y ver su timeline.

**Duración estimada**: 3-4 semanas

### Database Setup
- ✅ Tabla `transactions` (con TODOS los campos, aunque muchos NULL)
- ✅ Tabla `accounts`
- ✅ Tabla `parser_configs`
- ✅ Tabla `normalization_rules`
- ✅ Índices optimizados

### Backend Core (~1,000 LOC)
- ✅ **Parser engine** - Lee `parser_configs` y parsea PDFs dinámicamente
- ✅ **Normalization** - Lee `normalization_rules` DB y aplica
- ✅ **Clustering** - String similarity básico (threshold configurable)
- ✅ **Transfer detection** - Heurística de matching
- ✅ **Deduplication** - Por `source_hash`
- ✅ **Type classification** - Expense | Income | Transfer

### Initial Configs
- ✅ 4 parser configs: BofA, Apple Card, Wise, Scotia (en DB o YAML)
- ✅ ~30 normalization rules (Starbucks, Amazon, Uber, etc)

### UI Core (~800 LOC)
- ✅ **Upload zone** - Drag & drop, batch, progress
- ✅ **Timeline** - Lista cronológica, grouping por día
- ✅ **Filters** - Account, date range, type
- ✅ **Transaction details** - Panel lateral con toda la info
- ✅ **Search** - Por merchant name
- ✅ **Settings básico** - Theme, language, currency

### Features Trabajando
- ✅ Upload PDFs (4 bancos)
- ✅ Ver timeline limpio
- ✅ Filtrar por cuenta/fecha/tipo
- ✅ Ver detalles
- ✅ Detectar transfers
- ✅ Editar transaction (merchant, notes)
- ✅ Borrar transaction

### LOC: ~1,800

---

## 📊 PHASE 2: ORGANIZATION (Categories & Budgets)

**Objetivo**: Darwin puede categorizar gastos y trackear budgets.

**Duración estimada**: 2-3 semanas

### Database
- ✅ Tabla `categories` (ya definida, crear ahora)
- ✅ Tabla `budgets`
- ✅ Tabla `recurring_groups`
- ✅ Pre-populate 20-30 categorías default

### Backend (~600 LOC)
- ✅ **Auto-categorization** - Basado en `normalization_rules.suggested_category_id`
- ✅ **Recurring detection** - Identificar patterns (monthly Netflix, etc)
- ✅ **Budget tracking** - Calcular spent vs límite
- ✅ **Budget alerts** - Notificar cuando te acercas al límite
- ✅ **Category rules** - User define "Starbucks siempre en Food"

### UI (~400 LOC)
- ✅ **Categories panel** - Ver/editar categories
- ✅ **Quick categorize** - Desde timeline, assign category
- ✅ **Bulk categorize** - Categorizar múltiples transactions
- ✅ **Budgets view** - Ver budgets con progress bars
- ✅ **Budget creation** - Wizard para crear budgets
- ✅ **Recurring view** - Ver todos los recurring groups
- ✅ **Tags UI** - Agregar/editar tags

### Features Trabajando
- ✅ Categorizar transactions (manual + auto)
- ✅ Crear budgets por categoría/merchant
- ✅ Ver progreso de budgets en real-time
- ✅ Detectar y agrupar recurring transactions
- ✅ Tags en transactions
- ✅ Filtrar por category/tag

### LOC Acumulado: ~2,800

---

## 📊 PHASE 3: ANALYSIS (Reports & Export)

**Objetivo**: Darwin puede analizar sus gastos y exportar data.

**Duración estimada**: 2 semanas

### Backend (~400 LOC)
- ✅ **Report engine** - Aggregate data por category/merchant/time
- ✅ **Export engine** - CSV, PDF, JSON generators
- ✅ **Chart data generator** - Preparar data para charts
- ✅ **Tax calculations** - Suma de categorías deducibles

### UI (~400 LOC)
- ✅ **Reports dashboard** - 5-6 reports pre-built
  - Spending by category (pie chart)
  - Spending trends (line chart)
  - Income vs Expenses (bar chart)
  - Top merchants (table)
  - Budget performance (gauge charts)
  - Monthly comparison (bar chart)
- ✅ **Custom report builder** - Drag & drop interface
- ✅ **Export modal** - Seleccionar formato, date range, fields
- ✅ **PDF reports** - Bonitos para imprimir
- ✅ **Scheduled reports** - Auto-generar y email (opcional)

### Features Trabajando
- ✅ Ver 6 reports pre-built
- ✅ Crear custom reports
- ✅ Exportar a CSV/PDF/JSON
- ✅ Filters en reports
- ✅ Save/load report configs

### LOC Acumulado: ~3,600

---

## 📊 PHASE 4: SCALE (Multi-user & Mobile)

**Objetivo**: Múltiples usuarios y app móvil.

**Duración estimada**: 3-4 semanas

### Database
- ✅ Tabla `users`
- ✅ Tabla `audit_log` (opcional)
- ✅ Agregar `user_id` a todas las queries (ya existe el campo)

### Backend (~300 LOC)
- ✅ **Auth system** - Login/logout, sessions
- ✅ **User management** - CRUD users
- ✅ **Permissions** - Admin vs regular user
- ✅ **Data isolation** - User solo ve sus transactions
- ✅ **Shared accounts** - Optional: compartir cuentas
- ✅ **API REST** - Para mobile app
- ✅ **Sync engine** - Desktop ↔ Mobile

### Mobile App (~1,000 LOC - separate repo)
- ✅ **React Native** - iOS + Android
- ✅ **Core features** - Timeline, filters, details
- ✅ **Photo upload** - Tomar foto → OCR → transaction
- ✅ **Quick entry** - Add transaction rápido
- ✅ **Offline mode** - Ver data cached
- ✅ **Push notifications** - Budget alerts

### Features Trabajando
- ✅ Multiple users en mismo dispositivo
- ✅ User profiles y settings
- ✅ Shared budgets (household)
- ✅ Mobile app nativa
- ✅ Sync entre devices
- ✅ Photo receipts con OCR

### LOC Acumulado Desktop: ~3,900
### LOC Mobile: ~1,000

---

## 🚀 Optional Enhancements (Post-Phase 4)

### Advanced Features
- ✅ **Plaid integration** - Conectar bancos directamente
- ✅ **Investment tracking** - Stocks, crypto
- ✅ **Receipt OCR advanced** - Itemized receipts
- ✅ **ML categorization** - Mejorar auto-categorization
- ✅ **Forecasting** - Predecir gastos futuros
- ✅ **Multi-currency advanced** - Exchange rates automáticos
- ✅ **Webhooks** - Para integraciones
- ✅ **Zapier/IFTTT** - Conectar con otros apps

---

## 📅 Timeline Total

| Phase | Duración | LOC | Features |
|-------|----------|-----|----------|
| Phase 1 (Core) | 3-4 weeks | ~1,800 | Upload, Timeline, Filters, Transfers |
| Phase 2 (Organization) | 2-3 weeks | +1,000 | Categories, Budgets, Recurring, Tags |
| Phase 3 (Analysis) | 2 weeks | +800 | Reports, Export, Charts |
| Phase 4 (Scale) | 3-4 weeks | +300 + 1,000 mobile | Multi-user, Mobile app |
| **Total** | **10-13 weeks** | **~3,900 + mobile** | **Sistema completo** |

---

## 🎯 Milestones

### Milestone 1: Phase 1 Done (Week 4)
**Darwin puede usar la app diariamente**
- ✅ Sube PDFs
- ✅ Ve timeline limpio
- ✅ Filtra y busca
- ✅ Edita transactions

### Milestone 2: Phase 2 Done (Week 7)
**Darwin tiene control financiero**
- ✅ Todo de Phase 1
- ✅ Categoriza gastos
- ✅ Trackea budgets
- ✅ Ve recurring

### Milestone 3: Phase 3 Done (Week 9)
**Darwin analiza sus finanzas**
- ✅ Todo de Phase 1-2
- ✅ Reports visuales
- ✅ Exporta a Excel/PDF
- ✅ Insights históricos

### Milestone 4: Phase 4 Done (Week 13)
**Sistema completo y escalable**
- ✅ Todo de Phase 1-3
- ✅ Multi-user
- ✅ Mobile app
- ✅ Listo para otros usuarios

---

## 🔧 Tech Stack por Phase

### Phase 1-3 (Desktop)
- **Frontend**: Electron + React + TailwindCSS
- **Backend**: Node.js
- **Database**: SQLite (better-sqlite3)
- **Parsing**: pdf-parse
- **Charts**: Recharts (Phase 3)

### Phase 4 (Mobile)
- **Framework**: React Native
- **State**: Redux
- **API**: REST (Express)
- **Auth**: JWT
- **Storage**: AsyncStorage + API

---

## 📝 Por qué este orden

### Phase 1 primero porque:
- ✅ MVP usable
- ✅ Valida la arquitectura core
- ✅ Darwin lo puede usar YA

### Phase 2 después porque:
- ✅ Necesita Phase 1 funcionando
- ✅ Categories dependen de transactions limpias
- ✅ Budgets dependen de categories

### Phase 3 después porque:
- ✅ Reports necesitan categories
- ✅ Analysis es útil después de 1-2 meses de data

### Phase 4 al final porque:
- ✅ Multi-user es scaling, no core
- ✅ Mobile es nice-to-have, no crítico
- ✅ Puedes usar desktop perfectamente sin mobile

---

## ✅ Cómo usar este roadmap

### Durante desarrollo:
1. **Focus en 1 phase a la vez**
2. **No adelantarse** - No construir Phase 2 antes de terminar Phase 1
3. **Test en cada milestone** - Asegurar que funciona antes de seguir
4. **Iterar** - Si algo no funciona, fix antes de avanzar

### Después de cada phase:
1. **Release** - Publicar versión usable
2. **Dog-fooding** - Darwin lo usa por 1-2 semanas
3. **Feedback** - Ajustar según uso real
4. **Next phase** - Empezar siguiente con aprendizajes

---

## 🎯 Success Metrics

### Phase 1 Success:
- Darwin sube 96 PDFs sin crashes
- Timeline muestra 12k transactions en <3 seg
- Merchants normalizados correctamente (>90%)
- Transfers detectados (>80%)

### Phase 2 Success:
- Darwin categoriza 80% de transactions
- Budgets alertan correctamente
- Recurring detecta Netflix, Spotify, etc (>90%)

### Phase 3 Success:
- Reports se generan en <2 seg
- Export CSV funciona con 12k transactions
- PDF reports se ven bonitos

### Phase 4 Success:
- 2+ users pueden usar sin conflictos
- Mobile app sync funciona offline
- No data loss en sync

---

**Próximos docs**: Documentación detallada de cada feature
- `CATEGORIES-BUDGETS.md`
- `REPORTS-EXPORT.md`
- `MULTI-USER.md`
- `MOBILE-APP.md`
