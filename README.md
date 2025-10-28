# Finance App V1 - Complete Documentation

**Sistema completo de finanzas personales - Documentado primero, construido incremental**

---

## 🎯 ¿Qué es esto?

Finance App es una aplicación completa de finanzas personales que te permite:

### Phase 1: Core (MVP)
- **Subir PDFs bancarios** con config-driven parsers (no hardcoding)
- **Ver todo en un timeline continuo** - sin separación entre carga histórica y uso diario
- **Transacciones limpias automáticamente** - "STARBUCKS #12345" → "Starbucks"
- **Transfers linkados** - detecta automáticamente transfers entre cuentas
- **Multi-moneda** - USD, MXN, EUR con clarity total

### Phase 2: Organization
- **Categorías** - Jerárquicas, auto-categorization, custom categories
- **Budgets** - Trackear por categoría/merchant/account con alertas
- **Recurring** - Detecta subscripciones y pagos recurrentes
- **Tags** - Sistema flexible de etiquetas

### Phase 3: Analysis
- **Reports** - 6 reports pre-built + custom report builder
- **Export** - CSV, PDF, JSON con full metadata
- **Charts** - Visualizaciones interactivas

### Phase 4: Scale
- **Multi-user** - Sistema de auth y data isolation
- **Mobile app** - React Native con OCR y offline mode
- **Sync** - Desktop ↔ Mobile con conflict resolution

---

## 🏗️ Arquitectura

**Diseño simple pero escalable**:
- ✅ **1 tabla core** (`transactions`) con campos estratégicos para todas las features
- ✅ **Tablas auxiliares** solo cuando necesario (accounts, categories, budgets, etc.)
- ✅ **Config-driven** - Parsers y rules en DB/YAML, NO hardcoded
- ✅ **Modular** - Features independientes que no requieren cambios en core
- ✅ **No over-engineering** - Sin abstracciones innecesarias
- ✅ **No limitante** - Decisiones de hoy no bloquean mañana

**Tech Stack**:
- **Desktop**: Electron + React + SQLite + TailwindCSS
- **Mobile**: React Native + Redux + AsyncStorage
- **Backend**: Node.js + Express (REST API para mobile)
- **Parsing**: pdf-parse + config-driven engine
- **Charts**: Recharts

---

## 📊 Sistema Completo

### Total Features: 168 features en 28 áreas

| Phase | Duración | LOC | Features |
|-------|----------|-----|----------|
| **Phase 1** (Core) | 3-4 weeks | ~1,800 | Upload, Timeline, Filters, Transfers, Dedup |
| **Phase 2** (Organization) | 2-3 weeks | +1,000 | Categories, Budgets, Recurring, Tags |
| **Phase 3** (Analysis) | 2 weeks | +800 | Reports, Export, Charts, Tax calculations |
| **Phase 4** (Scale) | 3-4 weeks | +300 | Multi-user, Mobile app, Sync |
| **Total** | **10-13 weeks** | **~3,900** | **Sistema completo** |

---

## 📚 Documentación Completa

### 🎯 Foundation (Lee primero)
- **[SYSTEM-COMPLETE-SCOPE.md](SYSTEM-COMPLETE-SCOPE.md)** - 168 features organizadas
- **[ARCHITECTURE-COMPLETE.md](ARCHITECTURE-COMPLETE.md)** - Arquitectura de 1 tabla + auxiliares
- **[ROADMAP.md](ROADMAP.md)** - Plan de construcción por fases
- **[EXTENSIBILITY.md](EXTENSIBILITY.md)** - Cómo extender: nueva cuenta, banco, categoría, etc.

### 📖 Core Documentation (Phase 1)
1. [0-scope.md](0-scope.md) - Qué está en Phase 1
2. [1-architecture.md](1-architecture.md) - Arquitectura detallada

### 👤 User Flows (⭐ Empieza aquí)
- [flow-1-timeline-continuo.md](flow-1-timeline-continuo.md) - El flujo unificado
- [flow-2-upload-pdf.md](flow-2-upload-pdf.md) - Subir PDFs
- [flow-3-view-transaction.md](flow-3-view-transaction.md) - Ver detalles
- [flow-4-merchant-normalization.md](flow-4-merchant-normalization.md) - Normalización
- [flow-5-transfer-linking.md](flow-5-transfer-linking.md) - Transfers

### 🏦 Parsers (Config-Driven)
- [parser-bofa.md](parser-bofa.md) - Bank of America (con config approach)
- [parser-apple-card.md](parser-apple-card.md) - Apple Card
- [parser-wise.md](parser-wise.md) - Wise
- [parser-scotia.md](parser-scotia.md) - Scotiabank

### ⚙️ Pipeline
- [2-observation-store.md](2-observation-store.md) - Raw data inmutable
- [3-clustering.md](3-clustering.md) - String similarity grouping
- [4-normalization.md](4-normalization.md) - Config-driven rules
- [5-canonical-store.md](5-canonical-store.md) - Clean truth

### 🎨 UI/UX (Phase 1)
- [6-ui-timeline.md](6-ui-timeline.md) - Vista principal con infinite scroll
- [7-ui-filters.md](7-ui-filters.md) - Account, date, type filters
- [8-ui-details.md](8-ui-details.md) - Transaction detail panel

### 🔧 Integration
- [9-upload-flow.md](9-upload-flow.md) - Flujo completo end-to-end
- [10-error-handling.md](10-error-handling.md) - Error handling graceful

### 📊 Advanced Features
- **[CATEGORIES-BUDGETS.md](CATEGORIES-BUDGETS.md)** - Phase 2 features completas
- **[REPORTS-EXPORT.md](REPORTS-EXPORT.md)** - Phase 3 analytics y export
- **[MULTI-USER.md](MULTI-USER.md)** - Phase 4 multi-user system
- **[MOBILE-APP.md](MOBILE-APP.md)** - Phase 4 React Native app

### 📖 Storytelling
- [STORYTELLING.md](STORYTELLING.md) - La historia completa narrada

---

## 🚀 Filosofía del Proyecto

### ✅ Documentar TODO Primero
- Sistema completo especificado ANTES de codear
- Arquitectura correcta desde Phase 1
- No rehacerse - cada feature se construye una sola vez

### ✅ Build Incremental
- Construir en orden: Phase 1 → 2 → 3 → 4
- Cada phase entrega valor usable
- Dog-fooding en cada phase

### ✅ Simple pero No Limitante
- **Simple NOW**: No over-engineering, sin abstracciones innecesarias
- **Escalable LATER**: Arquitectura permite agregar features sin refactors
- **Config-driven**: Parametrizar, no hardcodear

### ✅ Local-First
- SQLite local, no servidor necesario
- Sync opcional (Phase 4)
- Privacy total

---

## 📈 Success Metrics

### Phase 1 (MVP)
- ✅ Sube 96 PDFs sin crashes
- ✅ Timeline muestra 12k transactions en <3 seg
- ✅ Merchants normalizados correctamente (>90%)
- ✅ Transfers detectados (>80%)

### Phase 2 (Organization)
- ✅ Auto-categoriza 80% de transactions
- ✅ Budgets alertan correctamente
- ✅ Recurring detecta Netflix, Spotify (>90%)

### Phase 3 (Analysis)
- ✅ Reports se generan en <2 seg
- ✅ Export CSV funciona con 12k transactions
- ✅ PDF reports bonitos

### Phase 4 (Scale)
- ✅ 2+ users sin conflictos
- ✅ Mobile sync funciona offline
- ✅ No data loss en sync

---

## 🎯 Estado Actual

📝 **Documentación**: ✅ COMPLETA
- ✅ Sistema completo documentado (168 features)
- ✅ Arquitectura diseñada (1 tabla core + auxiliares)
- ✅ Roadmap por fases (10-13 semanas)
- ✅ Todas las features especificadas

🔨 **Código**: 🔜 PRÓXIMO
- 🔜 Phase 1: Core features (3-4 weeks)
- 🔜 Phase 2: Categories & Budgets (2-3 weeks)
- 🔜 Phase 3: Reports & Export (2 weeks)
- 🔜 Phase 4: Multi-user & Mobile (3-4 weeks)

---

## 📖 Cómo Usar Esta Documentación

### Si eres Developer:
1. Lee [ARCHITECTURE-COMPLETE.md](ARCHITECTURE-COMPLETE.md) - Entiende la arquitectura
2. Lee [ROADMAP.md](ROADMAP.md) - Entiende el plan de construcción
3. Lee los docs específicos de la feature que vas a construir

### Si eres Product:
1. Lee [SYSTEM-COMPLETE-SCOPE.md](SYSTEM-COMPLETE-SCOPE.md) - Todas las features
2. Lee [STORYTELLING.md](STORYTELLING.md) - La experiencia del usuario
3. Lee los User Flows para entender cada interacción

### Si eres Designer:
1. Lee los User Flows (flow-*.md) - Entiende las interacciones
2. Lee los UI docs (6-ui-*.md, 7-ui-*.md, 8-ui-*.md)
3. Consulta [ARCHITECTURE-COMPLETE.md](ARCHITECTURE-COMPLETE.md) para data disponible

---

## 🔗 Links Útiles

- **GitHub**: https://github.com/DarwinQVO/finance-app-v1
- **GitHub Pages**: https://darwinqvo.github.io/finance-app-v1/
- **Issues**: https://github.com/DarwinQVO/finance-app-v1/issues

---

## 📝 Notas

### ¿Por qué documentar TODO primero?

**Problema previo**: "V1 simple → V2 rewrite" = trabajo duplicado, arquitectura limitante

**Solución actual**:
- Documentar sistema COMPLETO ahora
- Arquitectura soporta TODAS las features desde Phase 1
- Construir incremental pero sin rehacerse

### ¿Por qué 1 tabla en vez de 2?

- **Antes**: 2 tablas (observations + transactions) para regenerar
- **Análisis**: Regeneración masiva es caso raro, no justifica complejidad
- **Decisión**: 1 tabla con campos estratégicos (`original_description`, `is_edited`, `edited_fields`)
- **Resultado**: Simple, auditable, suficiente para 99% de casos

### ¿Por qué config-driven parsers?

- **Antes**: 4 parsers hardcodeados (parser-bofa.js, parser-apple.js, etc)
- **Problema**: Agregar banco = escribir código
- **Solución**: Config-driven parser que lee de `parser_configs` tabla o YAML
- **Resultado**: Agregar banco = agregar config, no código

---

**Versión**: 1.0 (Sistema Completo Documentado)
**Fecha**: Octubre 2025
**Status**: Documentación Completa ✅ | Código Próximo 🔜
**LOC Estimado**: ~3,900 (desktop) + ~1,000 (mobile)
**Timeline**: 10-13 semanas de construcción
