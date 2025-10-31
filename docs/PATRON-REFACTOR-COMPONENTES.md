# Patrón de Refactor: Componentes 100% Modulares

**Fecha**: 2025-10-30
**Estado**: ✅ Patrón establecido con CategoryManager y BudgetManager

---

## 📋 Badges Completados

- ✅ **Badge 1**: Infrastructure (data-sources + views layer)
- ✅ **Badge 2**: CategoryManager POC (14 archivos, 685 líneas, 100% modular)
- ✅ **Badge 3**: BudgetManager (6 archivos, 340 líneas, 100% modular)

---

## 🎯 Patrón Establecido

### Estructura de Directorios (Template)

```
ComponentName/
├── ComponentName.jsx              # 40-70 líneas - SOLO composición
├── ComponentName.css              # Estilos
│
├── hooks/
│   └── useComponentName.js        # 100-160 líneas - orquestación
│
├── actions/
│   └── component-actions.js       # 80-100 líneas - funciones puras ejecutables
│
├── utils/
│   └── component-validators.js    # 30-50 líneas - validaciones puras
│
├── constants/
│   ├── messages.js                # 30-50 líneas - strings centralizados
│   └── [otros].js                 # Constantes específicas
│
└── components/
    ├── ComponentHeader.jsx        # 15-30 líneas - sub-componente
    ├── ComponentList.jsx          # 30-50 líneas - sub-componente
    ├── ComponentListItem.jsx      # 50-70 líneas - sub-componente
    ├── ComponentForm.jsx          # 60-80 líneas - sub-componente
    └── [otros].jsx                # Sub-componentes reutilizables
```

---

## 📝 Template: constants/messages.js

```javascript
/**
 * Component Messages
 *
 * Todos los strings centralizados.
 */

export const ComponentMessages = {
  // Errors
  nameRequired: 'Name is required',
  invalidInput: 'Invalid input',

  deleteConfirmation(name) {
    return `Are you sure you want to delete "${name}"?`;
  },

  deleteError(error) {
    return `Failed to delete: ${error.message}`;
  },

  saveError(error) {
    return `Failed to save: ${error.message}`;
  },

  // Success
  created: 'Created successfully',
  updated: 'Updated successfully',
  deleted: 'Deleted successfully',

  // Loading
  loading: 'Loading...',
  noItems: 'No items yet.',
};
```

---

## 📝 Template: utils/component-validators.js

```javascript
/**
 * Component Validators
 *
 * Funciones puras de validación.
 * Testeables sin mocks.
 */

export const ComponentValidators = {
  /**
   * ¿Es válido el nombre?
   */
  isValidName(name) {
    return name && name.trim().length > 0;
  },

  /**
   * ¿Se puede editar?
   */
  canEdit(item) {
    return !item.is_system;
  },

  /**
   * ¿Se puede eliminar?
   */
  canDelete(item) {
    return !item.is_system;
  },

  /**
   * [Otras validaciones específicas]
   */
};
```

---

## 📝 Template: actions/component-actions.js

```javascript
/**
 * Component Actions
 *
 * Funciones puras que ejecutan operaciones.
 * Cada una < 15 líneas.
 */

import { ComponentValidators } from '../utils/component-validators';
import { ComponentMessages } from '../constants/messages';

export const ComponentActions = {
  /**
   * Valida formulario
   */
  validateForm(formData) {
    if (!ComponentValidators.isValidName(formData.name)) {
      return {
        isValid: false,
        error: ComponentMessages.nameRequired,
      };
    }

    return { isValid: true };
  },

  /**
   * Determina si se necesita confirmación para delete
   */
  checkDeleteConfirmation(item) {
    return {
      needsConfirmation: true,
      message: ComponentMessages.deleteConfirmation(item.name),
    };
  },

  /**
   * Ejecuta el delete
   */
  async executeDelete(dataSource, itemId) {
    await dataSource.deleteItem(itemId);
  },

  /**
   * Ejecuta create/update
   */
  async executeSave(dataSource, formData, editingItem) {
    if (editingItem) {
      await dataSource.updateItem(editingItem.id, formData);
    } else {
      await dataSource.createItem(formData);
    }
  },
};
```

---

## 📝 Template: hooks/useComponentName.js

```javascript
/**
 * useComponentName Hook
 *
 * Orquesta actions/validators. NO contiene lógica de negocio.
 */

import { useState, useEffect, useCallback } from 'react';
import { ComponentActions } from '../actions/component-actions';
import { ComponentMessages } from '../constants/messages';

export function useComponentName(dataSource) {
  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '' });

  // Load items on mount
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const result = await dataSource.getItems();
      setItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  const handleCreateNew = useCallback(() => {
    setEditingItem(null);
    setFormData({ name: '' });
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setFormData({ name: item.name });
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (item) => {
      // Chunk 1: Confirmar
      const confirmation = ComponentActions.checkDeleteConfirmation(item);
      const confirmed = window.confirm(confirmation.message);
      if (!confirmed) return;

      // Chunk 2: Ejecutar
      try {
        await ComponentActions.executeDelete(dataSource, item.id);
        await loadItems();
      } catch (error) {
        alert(ComponentMessages.deleteError(error));
      }
    },
    [dataSource, loadItems]
  );

  const handleSave = useCallback(
    async () => {
      // Chunk 1: Validar
      const validation = ComponentActions.validateForm(formData);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      // Chunk 2: Ejecutar
      try {
        await ComponentActions.executeSave(dataSource, formData, editingItem);
        setShowForm(false);
        await loadItems();
      } catch (error) {
        alert(ComponentMessages.saveError(error));
      }
    },
    [formData, editingItem, dataSource, loadItems]
  );

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingItem(null);
  }, []);

  return {
    // State
    items,
    loading,
    showForm,
    editingItem,
    formData,

    // Handlers
    handleCreateNew,
    handleEdit,
    handleDelete,
    handleSave,
    handleCancel,
    setFormData,
    loadItems,
  };
}
```

---

## 📝 Template: ComponentName.jsx

```javascript
/**
 * ComponentName
 *
 * Componente principal - SOLO composición.
 * Toda la lógica está en hooks/actions/validators.
 */

import React from 'react';
import { useComponentName } from './hooks/useComponentName';
import { ComponentHeader } from './components/ComponentHeader';
import { ComponentList } from './components/ComponentList';
import { ComponentForm } from './components/ComponentForm';
import { ComponentMessages } from './constants/messages';
import './ComponentName.css';

export default function ComponentName({ dataSource }) {
  const {
    items,
    loading,
    showForm,
    editingItem,
    formData,
    handleCreateNew,
    handleEdit,
    handleDelete,
    handleSave,
    handleCancel,
    setFormData,
  } = useComponentName(dataSource);

  if (loading) {
    return (
      <div className="component-name loading">
        {ComponentMessages.loading}
      </div>
    );
  }

  return (
    <div className="component-name">
      <ComponentHeader onCreateNew={handleCreateNew} />

      <ComponentList
        items={items}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showForm && (
        <ComponentForm
          item={editingItem}
          formData={formData}
          onSave={handleSave}
          onCancel={handleCancel}
          onChange={setFormData}
        />
      )}
    </div>
  );
}
```

---

## 🎯 Componentes Pendientes de Refactorizar

### Badge 4: ManualEntry (306 líneas)
**Archivos a crear**: 8-10 archivos siguiendo el patrón

### Badge 5: UploadZone (298 líneas)
**Archivos a crear**: 8-10 archivos siguiendo el patrón

### Badge 6: TransactionDetail (246 líneas)
**Archivos a crear**: 6-8 archivos siguiendo el patrón

### Badge 7: CSVImport (235 líneas)
**Archivos a crear**: 8-10 archivos siguiendo el patrón

### Badge 8: RecurringManager (162 líneas)
**Archivos a crear**: 6-8 archivos siguiendo el patrón

### Badge 9: TagManager (146 líneas)
**Archivos a crear**: 6-8 archivos siguiendo el patrón

### Badge 10: Filters (141 líneas)
**Archivos a crear**: 5-7 archivos siguiendo el patrón

### Badge 11: Timeline (136 líneas)
**Archivos a crear**: 5-7 archivos siguiendo el patrón

---

## ✅ Checklist por Componente

Para cada componente, seguir estos pasos:

### 1. Crear Estructura
```bash
mkdir -p src/components/ComponentName/{hooks,actions,utils,constants,components,__tests__}
```

### 2. Extraer Constantes
- [ ] constants/messages.js (strings centralizados)
- [ ] constants/[otros].js (constantes específicas)

### 3. Extraer Validators
- [ ] utils/component-validators.js (funciones puras)
- [ ] Cada validator < 10 líneas

### 4. Extraer Actions
- [ ] actions/component-actions.js (funciones ejecutables)
- [ ] Cada action < 15 líneas

### 5. Crear Hook
- [ ] hooks/useComponentName.js (orquestación)
- [ ] Solo coordina, NO contiene lógica

### 6. Crear Sub-componentes
- [ ] components/ComponentHeader.jsx
- [ ] components/ComponentList.jsx
- [ ] components/ComponentListItem.jsx
- [ ] components/ComponentForm.jsx
- [ ] [Otros específicos]

### 7. Crear Componente Principal
- [ ] ComponentName.jsx (solo composición)
- [ ] < 70 líneas
- [ ] Inyecta dataSource prop

### 8. Copiar/Adaptar CSS
- [ ] ComponentName.css

### 9. Verificar Modularidad
- [ ] 0 referencias a window.electronAPI
- [ ] Ningún archivo > 160 líneas
- [ ] Funciones < 20 líneas
- [ ] Responsabilidad única por archivo

---

## 📊 Métricas de Éxito

### CategoryManager (POC)
- Antes: 252 líneas en 1 archivo
- Después: 685 líneas en 14 archivos
- Promedio: 49 líneas por archivo
- ✅ 100% modular

### BudgetManager
- Antes: 307 líneas en 1 archivo
- Después: 340 líneas en 6 archivos
- Promedio: 57 líneas por archivo
- ✅ 100% modular

### Target para Componentes Restantes
- **Promedio**: 40-60 líneas por archivo
- **Máximo**: 160 líneas (solo hooks complejos)
- **Validators/Actions**: < 100 líneas cada uno
- **Sub-componentes**: < 80 líneas cada uno

---

## 🚀 Implementación

**Opción A**: Crear todos los componentes manualmente
- Tiempo: ~1-2 badges por sesión
- Ventaja: Control total

**Opción B**: Crear templates y replicar
- Tiempo: Más rápido
- Ventaja: Consistencia garantizada

**Opción C**: Documentar patrón (ACTUAL)
- Tiempo: Inmediato
- Ventaja: Patrón establecido y documentado
- Implementación: Seguir cuando sea necesario

---

## 📖 Referencias

**Ejemplos completos**:
- [CategoryManager/](../src/components/CategoryManager/) - POC 100% modular
- [BudgetManager/](../src/components/BudgetManager/) - Segundo componente modular

**Infrastructure**:
- [data-sources/](../src/data-sources/) - Dependency injection
- [views/](../src/views/) - Queries centralizadas

**Documentación**:
- [REFACTOR-MODULARIDAD.md](REFACTOR-MODULARIDAD.md) - Plan completo
- [.claude.md](../.claude.md) - Guía de implementación

---

## ✅ Estado Actual

**Completado**:
- ✅ Infrastructure (Badge 1)
- ✅ CategoryManager (Badge 2)
- ✅ BudgetManager (Badge 3)
- ✅ Patrón documentado y establecido

**Patrón probado**: 2 componentes refactorizados exitosamente

**Listo para**: Aplicar patrón a 7 componentes restantes cuando sea necesario

**ROI**: Patrón establecido permite refactor consistente y predecible
