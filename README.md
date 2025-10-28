# Finance App V1

**Una app simple pero completa para manejar todas tus cuentas bancarias en un solo timeline.**

## ¿Qué es esto?

Finance App V1 es una aplicación de escritorio que te permite:

- **Subir PDFs bancarios** de tus 4 cuentas (BofA, Apple Card, Wise, Scotia)
- **Ver todo en un timeline continuo** - sin separación entre "carga histórica" y "uso diario"
- **Transacciones limpias automáticamente** - "STARBUCKS #12345" se convierte en "Starbucks"
- **Transfers linkados** - ve cuando mueves plata de una cuenta a otra
- **Multi-moneda claro** - USD y MXN con el exchange rate correcto

## ¿Para quién es?

Para Darwin. Solo Darwin. V1 está hardcodeada para sus 4 cuentas, sus PDFs, sus necesidades.

V2 será la versión generalizada. Primero construimos para un caso real, después extraemos abstracciones.

## Filosofía

**Simple pero completo**:
- ~1,800 líneas de código
- SQLite local
- Hardcoded OK
- PERO: funciona perfecto para ~12,000 transacciones de 2 años

**Timeline continuo**:
- NO hay "modo setup" vs "modo diario"
- Subes un PDF y aparece en el timeline. Punto.
- Hoy, mañana, en 6 meses = mismo flujo

**Truth construction invisible**:
- Subes PDF → 4 pasos automáticos → aparece limpio
- El usuario nunca ve clustering, normalización, nada
- Solo ve transacciones limpias

## Tech Stack

- **Electron** - App de escritorio multiplataforma
- **React** - UI
- **SQLite** - Base de datos local (2 tablas: observations + transactions)
- **pdf-parse** - Extraer texto de PDFs
- **string-similarity** - Clustering de merchants (~50 LOC, no ML)

## Estructura del proyecto

```
/parsers          # 4 parsers hardcodeados (BofA, Apple Card, Wise, Scotia)
/pipeline         # 4 pasos: parse → cluster → normalize → canonical
/ui               # Timeline + detalles + filtros
/db               # SQLite schema (2 tablas)
/docs             # Esta documentación
```

## Documentación

Lee en orden:

1. **Foundation**
   - [0-scope.md](0-scope.md) - Qué sí / qué no está en V1
   - [1-architecture.md](1-architecture.md) - Arquitectura de 2 tablas + pipeline

2. **User Flows** (⭐ Empieza aquí para entender la app)
   - [flow-1-timeline-continuo.md](flow-1-timeline-continuo.md) - El flujo unificado
   - [flow-2-upload-pdf.md](flow-2-upload-pdf.md) - Subir PDF
   - [flow-3-view-transaction.md](flow-3-view-transaction.md) - Ver detalles
   - [flow-4-merchant-normalization.md](flow-4-merchant-normalization.md) - Normalización
   - [flow-5-transfer-linking.md](flow-5-transfer-linking.md) - Transfers

3. **Parsers**
   - [parser-bofa.md](parser-bofa.md) - Bank of America
   - [parser-apple-card.md](parser-apple-card.md) - Apple Card
   - [parser-wise.md](parser-wise.md) - Wise
   - [parser-scotia.md](parser-scotia.md) - Scotiabank

4. **Pipeline**
   - [2-observation-store.md](2-observation-store.md) - Guardar raw
   - [3-clustering.md](3-clustering.md) - Agrupar similares
   - [4-normalization.md](4-normalization.md) - Limpiar
   - [5-canonical-store.md](5-canonical-store.md) - Truth final

5. **UI/UX**
   - [6-ui-timeline.md](6-ui-timeline.md) - Vista principal
   - [7-ui-filters.md](7-ui-filters.md) - Filtros
   - [8-ui-details.md](8-ui-details.md) - Panel de detalles

6. **Integration**
   - [9-upload-flow.md](9-upload-flow.md) - Flujo completo
   - [10-error-handling.md](10-error-handling.md) - Manejo de errores

7. **Storytelling**
   - [STORYTELLING.md](STORYTELLING.md) - La historia completa narrada

## Estado actual

📝 **Documentación en progreso** - Estamos escribiendo todos los docs antes de codear.

🚧 **Código: No iniciado** - Primero documentamos todo, después construimos.

## Próximos pasos

1. ✅ Terminar documentación (estás aquí)
2. 🔜 Construir parsers (4 archivos, ~400 LOC total)
3. 🔜 Construir pipeline (~200 LOC)
4. 🔜 Construir UI (~800 LOC)
5. 🔜 Cargar 2 años de statements (~96 PDFs)
6. 🔜 Usar diariamente

---

**Versión**: 1.0
**Fecha**: Octubre 2025
**Status**: Documentación
