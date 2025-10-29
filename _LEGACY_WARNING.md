# ⚠️ LEGACY REFERENCE DOCUMENT

**Este documento contiene implementación de referencia que usa arquitectura ANTIGUA.**

## ⚠️ NO USAR para construcción actual

**Arquitectura antigua** (en este doc):
- ❌ 2 tablas: `observations` + `transactions`
- ❌ Hardcoded parsers
- ❌ Hardcoded normalization rules

**Arquitectura CORRECTA** (usar esta):
- ✅ 1 tabla: `transactions` con todos los campos
- ✅ Config-driven parsers (`parser_configs` table)
- ✅ Config-driven rules (`normalization_rules` table)

## 📖 Docs correctos a usar:

1. **[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)** - Qué ES el sistema completo
2. **[ARCHITECTURE-COMPLETE.md](ARCHITECTURE-COMPLETE.md)** - Arquitectura correcta
3. **[ROADMAP.md](ROADMAP.md)** - Cómo construir incremental

---

**Razón de existencia de este doc**: Storytelling y referencia de UX flows. La lógica de negocio y flows de usuario siguen siendo válidos, pero la implementación técnica debe usar la arquitectura correcta.

---
