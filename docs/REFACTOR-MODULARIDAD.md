# Plan de Refactor: Modularidad Verdadera

**Fecha**: 2025-10-30
**Prioridad**: 🔴 CRÍTICA
**Feedback**: "Necesitas descomponerlo al límite"

---

## 📋 Problemas Identificados

### 🔴 Problema 1: UI Components Acoplados a Electron

**Evidencia**:
- 27 referencias a `window.electronAPI` en `src/components/`
- CategoryManager.jsx: líneas 24, 60, 72, 81, 96
- BudgetManager.jsx: múltiples llamadas directas
- Imposible reutilizar en web, mobile, Chrome extensions

**Impacto**:
- ❌ No reutilizable
- ❌ Difícil de testear (mocking Electron API)
- ❌ Acoplamiento fuerte

---

### 🔴 Problema 2: Falta Capa de Views (Representation Layer)

**Evidencia**:
- Cada componente escribe sus propias queries SQL
- No hay abstracción de queries
- Lógica de datos duplicada

**Impacto**:
- ❌ Duplicación de queries
- ❌ Difícil cambiar data model
- ❌ No hay caching centralizado

---

### 🔴 Problema 3: Componentes Monolíticos (No Chunked)

**Evidencia**:
```
BudgetManager.jsx:      307 líneas (monolítico)
ManualEntry.jsx:        306 líneas (monolítico)
UploadZone.jsx:         298 líneas (monolítico)
CategoryManager.jsx:    252 líneas (monolítico)
TransactionDetail.jsx:  246 líneas (monolítico)
```

**Impacto**:
- ❌ Difícil de entender
- ❌ Difícil de testear
- ❌ Difícil de reutilizar
- ❌ Responsabilidades mezcladas

---

## ✅ Solución 1: Dependency Injection

### Estado Actual

```jsx
// src/components/CategoryManager.jsx (ACTUAL - MALO)
export default function CategoryManager() {
  async function loadCategories() {
    const result = await window.electronAPI.getCategories(); // ❌ Hardcoded!
    setCategories(result);
  }

  async function handleDelete(category) {
    await window.electronAPI.deleteCategory(category.id); // ❌ Hardcoded!
    loadCategories();
  }
}
```

**Problemas**:
1. Solo funciona en Electron
2. Imposible testear sin Electron
3. No reutilizable

---

### Estado Deseado

```jsx
// src/components/CategoryManager.jsx (REFACTORIZADO - BUENO)
export default function CategoryManager({ dataSource }) { // ✅ Injectable!
  async function loadCategories() {
    const result = await dataSource.getCategories(); // ✅ Cualquier data source!
    setCategories(result);
  }

  async function handleDelete(category) {
    await dataSource.deleteCategory(category.id); // ✅ Inyectado!
    loadCategories();
  }
}
```

### Implementaciones del DataSource

**Para Electron App**:
```js
// src/data-sources/electron-data-source.js
export const electronDataSource = {
  // Categories
  getCategories: () => window.electronAPI.getCategories(),
  createCategory: (data) => window.electronAPI.createCategory(data),
  updateCategory: (id, data) => window.electronAPI.updateCategory(id, data),
  deleteCategory: (id) => window.electronAPI.deleteCategory(id),
  getCategoryUsageCount: (id) => window.electronAPI.getCategoryUsageCount(id),

  // Transactions
  getTransactions: (filters) => window.electronAPI.getTransactions(filters),
  updateTransaction: (id, data) => window.electronAPI.updateTransaction(id, data),

  // Budgets
  getBudgets: () => window.electronAPI.getBudgets(),
  createBudget: (data) => window.electronAPI.createBudget(data),

  // Tags
  getTags: () => window.electronAPI.getTags(),
  createTag: (data) => window.electronAPI.createTag(data),
};
```

**Para Web App** (futuro):
```js
// src/data-sources/web-data-source.js
export const webDataSource = {
  // Categories
  getCategories: async () => {
    const response = await fetch('/api/categories');
    return response.json();
  },
  createCategory: async (data) => {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  deleteCategory: async (id) => {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
  },

  // ... mismo interface, diferente implementación
};
```

**Para Tests** (mocking):
```js
// tests/mocks/mock-data-source.js
export const mockDataSource = {
  getCategories: jest.fn(() => Promise.resolve([
    { id: '1', name: 'Food', icon: '🍔', color: '#FF6B6B' },
    { id: '2', name: 'Transport', icon: '🚗', color: '#4ECDC4' }
  ])),
  createCategory: jest.fn((data) => Promise.resolve({ id: '3', ...data })),
  deleteCategory: jest.fn(() => Promise.resolve()),
  getCategoryUsageCount: jest.fn(() => Promise.resolve(0)),
};
```

### Uso en App

```jsx
// src/App.jsx
import { electronDataSource } from './data-sources/electron-data-source';

function App() {
  return (
    <div>
      <CategoryManager dataSource={electronDataSource} />
      <BudgetManager dataSource={electronDataSource} />
      <TagManager dataSource={electronDataSource} />
    </div>
  );
}
```

### Uso en Tests

```jsx
// tests/CategoryManager.test.jsx
import { mockDataSource } from './mocks/mock-data-source';

test('loads categories on mount', async () => {
  render(<CategoryManager dataSource={mockDataSource} />);

  await waitFor(() => {
    expect(mockDataSource.getCategories).toHaveBeenCalled();
  });
});
```

### Beneficios

✅ **Reutilizable**: Mismo componente funciona en Electron, web, mobile
✅ **Testeable**: Easy mocking con jest.fn()
✅ **Desacoplado**: Componente no sabe de Electron
✅ **Extensible**: Agregar Redis cache, GraphQL, etc. sin tocar UI

---

## ✅ Solución 2: Capa de Views (Representation Layer)

### Estado Actual

**Problema**: Cada componente escribe sus propias queries

```jsx
// CategoryManager.jsx
const categories = await window.electronAPI.getCategories();

// BudgetManager.jsx
const budgets = await window.electronAPI.getBudgets();

// Timeline.jsx
const transactions = await window.electronAPI.getTransactions({ limit: 50, offset: 0 });
```

Cada uno habla directo con el backend. No hay abstracción.

---

### Estado Deseado

**Crear capa de Views** - Queries reutilizables con lógica de negocio

```js
// src/views/category-views.js
export const CategoryViews = {
  /**
   * Get all active categories with usage counts
   */
  async getActiveCategoriesWithUsage(dataSource) {
    const categories = await dataSource.getCategories();

    const withUsage = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        usageCount: await dataSource.getCategoryUsageCount(cat.id)
      }))
    );

    return withUsage.filter(c => c.is_active);
  },

  /**
   * Get category hierarchy (parent-child relationships)
   */
  async getCategoryHierarchy(dataSource) {
    const categories = await dataSource.getCategories();

    const topLevel = categories.filter(c => !c.parent_id);

    return topLevel.map(parent => ({
      ...parent,
      children: categories.filter(c => c.parent_id === parent.id)
    }));
  },

  /**
   * Get category with recent transactions
   */
  async getCategoryWithTransactions(dataSource, categoryId, limit = 10) {
    const category = await dataSource.getCategory(categoryId);
    const transactions = await dataSource.getTransactions({
      category_id: categoryId,
      limit
    });

    return {
      ...category,
      recentTransactions: transactions
    };
  }
};
```

### Uso en Componentes

**Antes**:
```jsx
// CategoryManager.jsx (ANTES - queries inline)
async function loadCategories() {
  const categories = await dataSource.getCategories();

  // Lógica duplicada en cada componente
  const withUsage = await Promise.all(
    categories.map(async (cat) => ({
      ...cat,
      usageCount: await dataSource.getCategoryUsageCount(cat.id)
    }))
  );

  setCategories(withUsage.filter(c => c.is_active));
}
```

**Después**:
```jsx
// CategoryManager.jsx (DESPUÉS - usa View)
import { CategoryViews } from '../views/category-views';

async function loadCategories() {
  const categories = await CategoryViews.getActiveCategoriesWithUsage(dataSource);
  setCategories(categories);
}
```

### Views para Budgets

```js
// src/views/budget-views.js
export const BudgetViews = {
  /**
   * Get budget with spending progress
   */
  async getBudgetWithProgress(dataSource, budgetId) {
    const budget = await dataSource.getBudget(budgetId);

    // Calculate spending this period
    const spending = await dataSource.getTransactions({
      category_id: budget.category_id,
      start_date: budget.period_start,
      end_date: budget.period_end
    });

    const totalSpent = spending.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
    const percentUsed = (totalSpent / budget.amount) * 100;

    return {
      ...budget,
      totalSpent,
      percentUsed,
      remaining: budget.amount - totalSpent,
      isOverBudget: totalSpent > budget.amount
    };
  },

  /**
   * Get all budgets with current period progress
   */
  async getAllBudgetsWithProgress(dataSource) {
    const budgets = await dataSource.getBudgets();

    return Promise.all(
      budgets.map(b => this.getBudgetWithProgress(dataSource, b.id))
    );
  }
};
```

### Views para Timeline

```js
// src/views/transaction-views.js
export const TransactionViews = {
  /**
   * Get transactions grouped by date
   */
  async getTimelineGroupedByDate(dataSource, filters = {}) {
    const transactions = await dataSource.getTransactions({
      ...filters,
      order_by: 'date DESC'
    });

    // Group by date
    const grouped = {};
    transactions.forEach(txn => {
      const date = txn.date.split('T')[0]; // YYYY-MM-DD
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(txn);
    });

    return Object.entries(grouped).map(([date, transactions]) => ({
      date,
      transactions,
      totalExpenses: transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalIncome: transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0)
    }));
  },

  /**
   * Get transaction with full details (category, tags, etc.)
   */
  async getTransactionDetail(dataSource, transactionId) {
    const transaction = await dataSource.getTransaction(transactionId);

    const [category, tags, account] = await Promise.all([
      transaction.category_id
        ? dataSource.getCategory(transaction.category_id)
        : null,
      dataSource.getTransactionTags(transactionId),
      dataSource.getAccount(transaction.account_id)
    ]);

    return {
      ...transaction,
      category,
      tags,
      account
    };
  }
};
```

### Beneficios

✅ **Reutilizable**: Queries compartidas entre componentes
✅ **Cacheable**: Fácil agregar caching en la capa de Views
✅ **Testeable**: Lógica de queries aislada
✅ **Mantenible**: Cambios en data model solo afectan Views
✅ **Optimizable**: Fácil identificar queries lentas

---

## ✅ Solución 3: Descomposición (Chunking)

### Estado Actual

```jsx
// CategoryManager.jsx - 252 líneas monolíticas ❌
export default function CategoryManager() {
  // 10 líneas de state
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // ...

  // Effect hooks inline
  useEffect(() => {
    loadCategories();
  }, []);

  // 15 funciones handler inline
  async function loadCategories() { /* ... */ }
  function handleCreateNew() { /* ... */ }
  function handleEdit(category) { /* ... */ }
  async function handleDelete(category) { /* ... */ }
  // ...

  // 150 líneas de JSX inline
  return (
    <div className="category-manager">
      {/* Render logic todo inline */}
    </div>
  );
}
```

**Problemas**:
- Todo en un archivo gigante
- Difícil de entender
- Imposible reutilizar partes
- Difícil de testear piezas individuales

---

### Estado Deseado: Decomposed Component

**Archivo principal** - Solo composición:
```jsx
// src/components/CategoryManager/CategoryManager.jsx
import React from 'react';
import { useCategoryManager } from './hooks/useCategoryManager';
import { CategoryList } from './components/CategoryList';
import { CategoryForm } from './components/CategoryForm';
import { CategoryHeader } from './components/CategoryHeader';
import './CategoryManager.css';

export default function CategoryManager({ dataSource }) {
  const {
    // State
    categories,
    loading,
    showForm,
    editingCategory,
    formData,

    // Handlers
    handleCreateNew,
    handleEdit,
    handleDelete,
    handleToggleActive,
    handleSave,
    handleCancel,
    setFormData
  } = useCategoryManager(dataSource);

  if (loading) {
    return <div className="category-manager loading">Loading categories...</div>;
  }

  return (
    <div className="category-manager">
      <CategoryHeader onCreateNew={handleCreateNew} />

      <CategoryList
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      {showForm && (
        <CategoryForm
          category={editingCategory}
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

**Custom Hook** - Lógica de negocio:
```jsx
// src/components/CategoryManager/hooks/useCategoryManager.js
import { useState, useEffect, useCallback } from 'react';
import { CategoryViews } from '../../../views/category-views';

export function useCategoryManager(dataSource) {
  // State
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '🏷️',
    color: '#999999'
  });

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const result = await CategoryViews.getActiveCategoriesWithUsage(dataSource);
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  const handleCreateNew = useCallback(() => {
    setEditingCategory(null);
    setFormData({ name: '', icon: '🏷️', color: '#999999' });
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((category) => {
    if (category.is_system) {
      alert('System categories cannot be edited');
      return;
    }
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || '🏷️',
      color: category.color || '#999999'
    });
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (category) => {
    if (category.is_system) {
      alert('System categories cannot be deleted');
      return;
    }

    const usageCount = category.usageCount || 0;

    if (usageCount > 0) {
      const confirmed = window.confirm(
        `⚠️ Warning: ${usageCount} transactions are using this category.\n\n` +
        `Deleting will set those to "Uncategorized".\n\nContinue?`
      );
      if (!confirmed) return;
    }

    try {
      await dataSource.deleteCategory(category.id);
      await loadCategories();
    } catch (error) {
      alert('Failed to delete category: ' + error.message);
    }
  }, [dataSource, loadCategories]);

  const handleToggleActive = useCallback(async (category) => {
    try {
      await dataSource.updateCategory(category.id, {
        is_active: !category.is_active
      });
      await loadCategories();
    } catch (error) {
      alert('Failed to update category: ' + error.message);
    }
  }, [dataSource, loadCategories]);

  const handleSave = useCallback(async () => {
    try {
      if (editingCategory) {
        await dataSource.updateCategory(editingCategory.id, formData);
      } else {
        await dataSource.createCategory(formData);
      }
      setShowForm(false);
      await loadCategories();
    } catch (error) {
      alert('Failed to save category: ' + error.message);
    }
  }, [editingCategory, formData, dataSource, loadCategories]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingCategory(null);
  }, []);

  return {
    // State
    categories,
    loading,
    showForm,
    editingCategory,
    formData,

    // Handlers
    handleCreateNew,
    handleEdit,
    handleDelete,
    handleToggleActive,
    handleSave,
    handleCancel,
    setFormData,
    loadCategories
  };
}
```

**Sub-componente: CategoryList**:
```jsx
// src/components/CategoryManager/components/CategoryList.jsx
import React from 'react';
import { CategoryListItem } from './CategoryListItem';

export function CategoryList({ categories, onEdit, onDelete, onToggleActive }) {
  if (categories.length === 0) {
    return (
      <div className="category-list-empty">
        <p>No categories yet. Click "New Category" to create one.</p>
      </div>
    );
  }

  return (
    <div className="category-list">
      {categories.map(category => (
        <CategoryListItem
          key={category.id}
          category={category}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
        />
      ))}
    </div>
  );
}
```

**Sub-componente: CategoryListItem**:
```jsx
// src/components/CategoryManager/components/CategoryListItem.jsx
import React from 'react';

export function CategoryListItem({ category, onEdit, onDelete, onToggleActive }) {
  return (
    <div
      className={`category-item ${!category.is_active ? 'inactive' : ''}`}
      style={{ borderLeft: `4px solid ${category.color}` }}
    >
      <div className="category-info">
        <span className="category-icon">{category.icon}</span>
        <span className="category-name">{category.name}</span>
        {category.usageCount > 0 && (
          <span className="category-usage">({category.usageCount} transactions)</span>
        )}
        {category.is_system && (
          <span className="category-badge system">System</span>
        )}
      </div>

      <div className="category-actions">
        <button
          className="btn-icon"
          onClick={() => onToggleActive(category)}
          title={category.is_active ? 'Deactivate' : 'Activate'}
        >
          {category.is_active ? '👁️' : '🚫'}
        </button>

        {!category.is_system && (
          <>
            <button
              className="btn-icon"
              onClick={() => onEdit(category)}
              title="Edit"
            >
              ✏️
            </button>

            <button
              className="btn-icon danger"
              onClick={() => onDelete(category)}
              title="Delete"
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Sub-componente: CategoryForm**:
```jsx
// src/components/CategoryManager/components/CategoryForm.jsx
import React from 'react';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';

export function CategoryForm({ category, formData, onSave, onCancel, onChange }) {
  const isEditing = !!category;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Category name is required');
      return;
    }
    onSave();
  };

  return (
    <div className="category-form-overlay">
      <div className="category-form">
        <h3>{isEditing ? 'Edit Category' : 'New Category'}</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="e.g., Groceries"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Icon</label>
            <IconPicker
              selected={formData.icon}
              onSelect={(icon) => onChange({ ...formData, icon })}
            />
          </div>

          <div className="form-group">
            <label>Color</label>
            <ColorPicker
              selected={formData.color}
              onSelect={(color) => onChange({ ...formData, color })}
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary">
              {isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Estructura de Archivos

```
src/components/CategoryManager/
├── CategoryManager.jsx           # Main component (composición)
├── CategoryManager.css
│
├── hooks/
│   └── useCategoryManager.js     # Business logic hook
│
├── components/
│   ├── CategoryHeader.jsx        # Header con botón "New"
│   ├── CategoryList.jsx          # Lista de categorías
│   ├── CategoryListItem.jsx      # Item individual
│   ├── CategoryForm.jsx          # Formulario create/edit
│   ├── IconPicker.jsx            # Selector de iconos
│   └── ColorPicker.jsx           # Selector de colores
│
└── __tests__/
    ├── CategoryManager.test.jsx
    ├── useCategoryManager.test.js
    ├── CategoryList.test.jsx
    └── CategoryForm.test.jsx
```

### Beneficios

✅ **Entendible**: Cada archivo < 100 líneas, responsabilidad única
✅ **Testeable**: Cada pieza se testea independiente
✅ **Reutilizable**: IconPicker, ColorPicker usables en otros componentes
✅ **Mantenible**: Cambios aislados, fácil de modificar
✅ **Escalable**: Fácil agregar features sin tocar código existente

---

## 📊 Comparación: Antes vs Después

| Métrica | Antes (Monolítico) | Después (Modular) |
|---------|-------------------|-------------------|
| **Líneas por archivo** | 252 (CategoryManager.jsx) | 40-80 (8 archivos) |
| **Testeable** | Difícil (mock Electron API) | Fácil (dependency injection) |
| **Reutilizable** | No (solo Electron) | Sí (web, mobile, tests) |
| **Entendible** | Bajo (todo mezclado) | Alto (responsabilidad única) |
| **Acoplamiento** | Alto (hardcoded Electron) | Bajo (interfaces inyectados) |
| **Query Logic** | Duplicada (cada componente) | Centralizada (Views layer) |
| **Sub-componentes** | 0 | 6 (reutilizables) |
| **Custom Hooks** | 0 | 1 (lógica aislada) |

---

## 🎯 Plan de Implementación

### Phase 1: Crear Infraestructura (1-2 días)

**Paso 1**: Crear data sources
```bash
mkdir -p src/data-sources
# Crear electron-data-source.js
# Crear mock-data-source.js (para tests)
```

**Paso 2**: Crear Views layer
```bash
mkdir -p src/views
# Crear category-views.js
# Crear budget-views.js
# Crear transaction-views.js
# Crear tag-views.js
```

### Phase 2: Refactor CategoryManager (2-3 días)

**Paso 1**: Crear estructura modular
```bash
mkdir -p src/components/CategoryManager/{hooks,components,__tests__}
```

**Paso 2**: Extraer custom hook
- Crear `useCategoryManager.js`
- Mover toda la lógica de estado + handlers

**Paso 3**: Extraer sub-componentes
- CategoryHeader.jsx
- CategoryList.jsx
- CategoryListItem.jsx
- CategoryForm.jsx
- IconPicker.jsx
- ColorPicker.jsx

**Paso 4**: Actualizar componente principal
- Solo composición
- Inyectar dataSource

**Paso 5**: Tests unitarios
- Test hook independiente
- Test cada sub-componente
- Test integración

### Phase 3: Refactor Otros Componentes (1-2 semanas)

Aplicar mismo patrón a:
1. BudgetManager (307 líneas) → Modular
2. ManualEntry (306 líneas) → Modular
3. UploadZone (298 líneas) → Modular
4. TransactionDetail (246 líneas) → Modular
5. CSVImport (235 líneas) → Modular
6. RecurringManager (162 líneas) → Modular
7. TagManager (146 líneas) → Modular
8. Filters (141 líneas) → Modular
9. Timeline (136 líneas) → Modular

### Phase 4: Update Literate Programming (3-4 días)

Actualizar documentación para reflejar nueva arquitectura modular:
- Documentar data sources pattern
- Documentar Views layer
- Documentar component decomposition
- Ejemplos de chunking en .lit.md

---

## ✅ Criterios de Éxito

**Modularidad**:
- [ ] Ningún archivo > 150 líneas
- [ ] Cada componente tiene sub-componentes
- [ ] Custom hooks para lógica compleja
- [ ] Responsabilidad única por archivo

**Desacoplamiento**:
- [ ] 0 referencias a `window.electronAPI` en componentes
- [ ] Dependency injection en todos los componentes
- [ ] Data sources inyectados vía props

**Views Layer**:
- [ ] Queries centralizadas en `src/views/`
- [ ] Lógica de negocio en Views, no en componentes
- [ ] Queries reutilizables

**Testeabilidad**:
- [ ] Mock data source funcional
- [ ] Tests unitarios para cada sub-componente
- [ ] Tests unitarios para cada custom hook
- [ ] Tests unitarios para cada View

**Reutilizabilidad**:
- [ ] Componentes funcionan con cualquier data source
- [ ] Sub-componentes reutilizables (IconPicker, ColorPicker, etc.)
- [ ] Custom hooks reutilizables

---

## 📈 Beneficios Esperados

**A corto plazo**:
- ✅ Código más fácil de entender
- ✅ Tests más fáciles de escribir
- ✅ Menos bugs (responsabilidad única)

**A mediano plazo**:
- ✅ Agregar features más rápido
- ✅ Refactor más seguro
- ✅ Onboarding más rápido

**A largo plazo**:
- ✅ Portabilidad (web, mobile)
- ✅ Escalabilidad (agregar data sources)
- ✅ Mantenibilidad (código limpio)

---

## 🚀 Próximo Paso

**Acción inmediata**: Empezar con CategoryManager como POC

**Timeline**: 2-3 días para CategoryManager completo

**Resultado**: Patrón establecido para replicar en otros componentes

**¿Empezamos con el refactor de CategoryManager?**
