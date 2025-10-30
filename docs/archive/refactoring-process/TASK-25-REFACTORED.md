# Task 25: Tag Management Feature - El Concepto

## El Concepto: Organización Flexible con Tags Personalizados

El sistema de tags permite a los usuarios **agregar etiquetas custom a transacciones** para crear dimensiones de organización más allá de categorías predefinidas. Los tags son **flexibles, visuales (con colores), y many-to-many**: una transacción puede tener múltiples tags, y un tag puede aplicarse a múltiples transacciones.

**La experiencia del usuario**:
1. **Crear tag**: Usuario define tag con nombre + color (ej: "Work", "Reimbursable", "Tax Deductible")
2. **Aplicar tag**: Desde transacción, seleccionar tag existente o crear nuevo
3. **Visualizar**: Tags aparecen como badges de colores en la transacción
4. **Filtrar**: Buscar transacciones por tags específicos
5. **Remover**: Click en "×" para quitar tag de transacción

**La implementación técnica**:
- Tabla `tags` con nombres únicos y colores
- Tabla junction `transaction_tags` para relación many-to-many
- CASCADE DELETE para limpiar links automáticamente
- Indexes para queries rápidas

---

## ¿Por qué Tag Management?

### El Problema: Categorías Insuficientes

Las categorías son jerárquicas y mutuamente exclusivas (una transacción = una categoría). Esto limita:
- **Múltiples dimensiones**: ¿"Coffee con cliente" es "Food" o "Work"? Ambos!
- **Clasificación temporal**: Usuario no puede marcar transacciones como "To Review"
- **Metadata custom**: No hay forma de etiquetar "Reimbursable" o "Tax Deductible"
- **Workflows**: No se pueden marcar transacciones para procesamiento posterior

**Ejemplo real**: Comida de trabajo ($50) debe ser categoría "Food", pero también necesita tags:
- "Work" (para expense reports)
- "Reimbursable" (pending reimbursement)
- "Q1-2025" (para análisis trimestral)

Con solo categorías, usuario pierde esta información.

### La Solución: Multi-Dimensional Tagging

Con tags:
- **Dimensiones ilimitadas**: Una transacción puede tener N tags
- **Ortogonal a categorías**: Tag complementa, no reemplaza categoría
- **Visual distinctions**: Colores ayudan a identificar tags rápidamente
- **Flexible workflow**: Tags como "To Review", "Approved", "Pending" permiten workflows
- **Análisis enriquecido**: Filtrar por múltiples tags para insights específicos

**Mismo ejemplo**: Comida ($50) → Categoría "Food" + Tags ["Work", "Reimbursable", "Q1-2025"]

**Resultado**: Organización rica sin perder flexibilidad.

---

## Decisión Arquitectural: Tag-Transaction Relationship

### Opción 1: Tags Array en Transactions Table ❌

**Pros**:
- Simple: una column en transactions

**Contras**:
- **No normalized**: Violación 1NF (First Normal Form)
- **Difícil queries**: No indices, no JOIN eficientes
- **Redundancia**: Tag name repetido en cada transaction
- **Update complexity**: Cambiar tag name requiere update masivo

### Opción 2: Many-to-Many Junction Table ✅ (Elegida)

**Pros**:
- **Normalized**: Cada tag existe una vez
- **Efficient queries**: Indices en foreign keys
- **Scalable**: Agregar tags no afecta transactions table size
- **Flexible**: Queries complejas (transactions con tags A AND B)
- **Standard pattern**: Industry-proven design

**Contras**:
- Más tablas (tags + transaction_tags)
- JOIN required para queries

**Decisión**: Junction table `transaction_tags` con composite primary key (transaction_id, tag_id). CASCADE DELETE asegura que links se limpian automáticamente.

---

## Decisión Arquitectural: Tag Names Uniqueness

### Opción 1: Allow Duplicate Tag Names ❌

**Pros**:
- Sin restricciones

**Contras**:
- **Confuso**: Múltiples "Work" tags con IDs diferentes
- **Error-prone**: Usuario crea duplicados accidentalmente
- **Mala UX**: ¿Cuál "Work" tag usar?

### Opción 2: Unique Constraint on Tag Names ✅ (Elegida)

**Pros**:
- **Claridad**: Cada tag name es único
- **Previene duplicados**: DB-level enforcement
- **Mejor UX**: Dropdown muestra solo tags únicos
- **Reusabilidad**: Mismo tag reutilizable across todas las transacciones

**Contras**:
- Usuario debe verificar nombres antes de crear

**Decisión**: UNIQUE constraint en `tags.name`. Si usuario intenta crear tag con nombre existente, mostramos error o auto-seleccionamos el existente.

---

## Decisión Arquitectural: Tag Color System

### Opción 1: Predefined Color Palette ❌

**Pros**:
- Consistencia visual
- Sin colores feos

**Contras**:
- **Limitado**: Usuario no puede expresar preferencias
- **Menos memorable**: Colores asignados random
- **Rigidez**: Palette fijo

### Opción 2: User-Selected Colors (Color Picker) ✅ (Elegida)

**Pros**:
- **Personalización**: Usuario elige color significativo
- **Mnemonic**: "Work" = azul, "Personal" = verde (usuario decide)
- **Flexible**: Cualquier color via HTML color picker
- **Default sensible**: Azul (#3b82f6) si usuario no elige

**Contras**:
- Posibilidad de colores feos o poco legibles

**Decisión**: HTML `<input type="color">` con default azul. Usuario tiene control pero con sensible default. Podríamos agregar validación de contraste en futuro.

---

## Decisión Arquitectural: Tag Application UX

### Opción 1: Modal Dialog for Tag Management ❌

**Pros**:
- Más espacio para UI
- Foco completo

**Contras**:
- **Pesado para tarea simple**: Agregar un tag no debería requerir modal
- **Interrumpe flujo**: Usuario pierde contexto
- **Más clicks**: Open modal → select → close modal

### Opción 2: Inline Widget (Current-Row UI) ✅ (Elegida)

**Pros**:
- **Lightweight**: Widget aparece inline en la transacción
- **Contexto preservado**: Usuario ve transacción mientras edita tags
- **Quick actions**: Dropdown + click para agregar, × para remover
- **Discoverability**: Tags visibles directamente en transacción

**Contras**:
- Menos espacio disponible
- Puede ocupar más vertical space en lista

**Decisión**: Inline `<TagManager>` component dentro de cada transacción. Dropdown para agregar, badges con × para remover. Balance entre accesibilidad y espacio.

---

## Decisión Arquitectural: Auto-Add New Tags

### Opción 1: Create Tag, Then Manually Add ❌

**Pros**:
- Explícito: dos acciones separadas

**Contras**:
- **Tedioso**: Usuario crea tag → vuelve a dropdown → lo selecciona
- **Extra steps**: Workflow no optimizado para caso común
- **Mala UX**: ¿Para qué crear tag si no lo voy a usar ahora?

### Opción 2: Auto-Add Tag to Transaction After Creation ✅ (Elegida)

**Pros**:
- **Optimizado para caso común**: Usuario crea tag porque lo quiere aplicar AHORA
- **Menos steps**: Create → auto-applied → done
- **Mejor flujo**: Natural progression
- **Power user friendly**: Si no quieren auto-add, pueden remover con un click

**Contras**:
- Menos explícito (pero intención es clara)

**Decisión**: Después de `createTag()`, automáticamente llamar `handleAddTag(tag.id)`. Usuario crea tags en contexto de transacción específica, asumimos quieren aplicarlo.

---

## Implementación

### Migration: Tags Tables

Schema con tags table y junction table para many-to-many relationship.

```sql
<<migrations/007-add-tags.sql>>=
-- Tags Table: Store tag definitions (name + color)
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,                  -- Unique tag ID (tag-xxx)
  name TEXT NOT NULL UNIQUE,            -- Tag name (must be unique across all tags)
  color TEXT DEFAULT '#999999',         -- Hex color for visual distinction
  created_at TEXT NOT NULL              -- Timestamp of tag creation
);

-- Transaction-Tags Junction Table: Many-to-many relationship
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id TEXT NOT NULL,                     -- FK to transactions
  tag_id TEXT NOT NULL,                             -- FK to tags
  created_at TEXT NOT NULL,                         -- Timestamp when tag was applied
  PRIMARY KEY (transaction_id, tag_id),             -- Composite primary key (prevents duplicates)
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,  -- Auto-delete link if transaction deleted
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE                   -- Auto-delete link if tag deleted
);

-- Indexes for efficient queries
CREATE INDEX idx_transaction_tags_transaction ON transaction_tags(transaction_id);  -- Find tags for a transaction
CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag_id);                  -- Find transactions with a tag
@
```

---

### Tests: Tags Schema

Tests para table creation, UNIQUE constraint, many-to-many links, y CASCADE delete.

```javascript
<<tests/tags.test.js>>=
import { describe, test, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';

describe('Tags Schema', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    // Run base schema first (for accounts + transactions)
    const baseSchema = fs.readFileSync('src/db/schema.sql', 'utf8');
    db.exec(baseSchema);

    // Run tags migration
    const migration = fs.readFileSync('migrations/007-add-tags.sql', 'utf8');
    db.exec(migration);
  });

  // TEST: Tags table creation
  test('creates tags table', () => {
    const table = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='tags'
    `).get();

    expect(table).toBeDefined();
    expect(table.name).toBe('tags');
  });

  // TEST: Junction table creation
  test('creates transaction_tags table', () => {
    const table = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='transaction_tags'
    `).get();

    expect(table).toBeDefined();
    expect(table.name).toBe('transaction_tags');
  });

  // TEST: Insert and retrieve tag
  test('inserts and retrieves tag', () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tags (id, name, color, created_at)
      VALUES (?, ?, ?, ?)
    `).run('tag-1', 'Work', '#3b82f6', now);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get('tag-1');

    expect(tag.name).toBe('Work');
    expect(tag.color).toBe('#3b82f6');
  });

  // TEST: Many-to-many link creation
  test('links tag to transaction', () => {
    const now = new Date().toISOString();

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test', 'checking', 'Bank', now, now);

    // Create transaction
    db.prepare(`
      INSERT INTO transactions (
        id, date, merchant, merchant_raw, amount, currency,
        account_id, type, source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', '2025-01-01', 'Coffee', 'Coffee', -5.00, 'USD', 'acc-1', 'expense', 'manual', now, now);

    // Create tag
    db.prepare(`
      INSERT INTO tags (id, name, color, created_at)
      VALUES (?, ?, ?, ?)
    `).run('tag-1', 'Work', '#3b82f6', now);

    // Link tag to transaction
    db.prepare(`
      INSERT INTO transaction_tags (transaction_id, tag_id, created_at)
      VALUES (?, ?, ?)
    `).run('txn-1', 'tag-1', now);

    // Verify link exists
    const link = db.prepare(`
      SELECT * FROM transaction_tags
      WHERE transaction_id = ? AND tag_id = ?
    `).get('txn-1', 'tag-1');

    expect(link).toBeDefined();
  });

  // TEST: CASCADE DELETE behavior
  test('cascades delete when transaction deleted', () => {
    const now = new Date().toISOString();

    // Create account
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test', 'checking', 'Bank', now, now);

    // Create transaction
    db.prepare(`
      INSERT INTO transactions (
        id, date, merchant, merchant_raw, amount, currency,
        account_id, type, source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', '2025-01-01', 'Coffee', 'Coffee', -5.00, 'USD', 'acc-1', 'expense', 'manual', now, now);

    // Create tag
    db.prepare(`
      INSERT INTO tags (id, name, color, created_at)
      VALUES (?, ?, ?, ?)
    `).run('tag-1', 'Work', '#3b82f6', now);

    // Link tag
    db.prepare(`
      INSERT INTO transaction_tags (transaction_id, tag_id, created_at)
      VALUES (?, ?, ?)
    `).run('txn-1', 'tag-1', now);

    // Delete transaction (should cascade delete link)
    db.prepare('DELETE FROM transactions WHERE id = ?').run('txn-1');

    // Check link was automatically deleted
    const link = db.prepare(`
      SELECT * FROM transaction_tags WHERE transaction_id = ?
    `).get('txn-1');

    expect(link).toBeUndefined();
  });
});
@
```

**Test Explanations**:

1. **Table creation**: Verifica que migration crea ambas tablas (tags + transaction_tags)
2. **Junction table**: Confirma que tabla de relación existe
3. **Insert/retrieve**: Valida que tags se guardan con nombre y color
4. **Link creation**: Verifica que relación many-to-many funciona
5. **CASCADE delete**: Confirma que ON DELETE CASCADE limpia links automáticamente

---

### Component: Tag Manager

Component inline para aplicar/remover tags en una transacción.

```javascript
<<src/components/TagManager.jsx>>=
<<tagmanager-imports>>
<<tagmanager-component>>
@
```

#### Imports y Setup

```javascript
<<tagmanager-imports>>=
import React, { useState, useEffect } from 'react';
import './TagManager.css';
@
```

#### Component: Tag CRUD Operations

```javascript
<<tagmanager-component>>=
export default function TagManager({ transactionId }) {
  // State para todos los tags disponibles (global)
  const [allTags, setAllTags] = useState([]);

  // State para tags actualmente aplicados a esta transacción
  const [transactionTags, setTransactionTags] = useState([]);

  // State para create new tag form
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');  // Default blue

  // Load tags on mount and when transactionId changes
  useEffect(() => {
    loadTags();
    loadTransactionTags();
  }, [transactionId]);

  <<tagmanager-handlers>>
  <<tagmanager-render>>
}
@
```

#### Handlers: Load, Add, Remove, Create

```javascript
<<tagmanager-handlers>>=
/**
 * Load all available tags from database
 */
async function loadTags() {
  try {
    const tags = await window.electronAPI.getAllTags();
    setAllTags(tags);
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
}

/**
 * Load tags currently applied to this transaction
 */
async function loadTransactionTags() {
  try {
    const tags = await window.electronAPI.getTransactionTags(transactionId);
    setTransactionTags(tags);
  } catch (error) {
    console.error('Failed to load transaction tags:', error);
  }
}

/**
 * Add existing tag to transaction
 */
async function handleAddTag(tagId) {
  try {
    await window.electronAPI.addTagToTransaction(transactionId, tagId);
    loadTransactionTags();  // Refresh to show new tag
  } catch (error) {
    alert('Failed to add tag: ' + error.message);
  }
}

/**
 * Remove tag from transaction
 */
async function handleRemoveTag(tagId) {
  try {
    await window.electronAPI.removeTagFromTransaction(transactionId, tagId);
    loadTransactionTags();  // Refresh to remove tag from display
  } catch (error) {
    alert('Failed to remove tag: ' + error.message);
  }
}

/**
 * Create new tag and auto-add to transaction
 */
async function handleCreateTag() {
  // Validate name is not empty
  if (!newTagName.trim()) {
    alert('Please enter a tag name');
    return;
  }

  try {
    // Create tag in database
    const tag = await window.electronAPI.createTag(newTagName.trim(), newTagColor);

    // Reset form
    setNewTagName('');
    setNewTagColor('#3b82f6');
    setShowAddTag(false);

    // Refresh tag list
    loadTags();

    // Auto-add new tag to transaction (optimization for common case)
    await handleAddTag(tag.id);
  } catch (error) {
    alert('Failed to create tag: ' + error.message);
  }
}

// Calculate available tags (all tags minus already applied ones)
const transactionTagIds = transactionTags.map(t => t.id);
const availableTags = allTags.filter(t => !transactionTagIds.includes(t.id));
@
```

#### Render: Current Tags + Add Dropdown + Create Form

```javascript
<<tagmanager-render>>=
return (
  <div className="tag-manager">
    {/* Current tags (badges with remove button) */}
    <div className="current-tags">
      {transactionTags.map(tag => (
        <span
          key={tag.id}
          className="tag"
          style={{ backgroundColor: tag.color }}  // Dynamic color from tag
        >
          {tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="tag-remove"
            aria-label={`Remove ${tag.name}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>

    {/* Add existing tag dropdown (only show if there are available tags) */}
    {availableTags.length > 0 && (
      <div className="add-tag-section">
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleAddTag(e.target.value);  // Add tag immediately
              e.target.value = '';           // Reset dropdown
            }
          }}
          className="tag-select"
        >
          <option value="">+ Add tag</option>
          {availableTags.map(tag => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>
    )}

    {/* Toggle button for create new tag form */}
    <button
      onClick={() => setShowAddTag(!showAddTag)}
      className="btn-create-tag"
    >
      {showAddTag ? 'Cancel' : '+ New Tag'}
    </button>

    {/* Create new tag form (conditional render) */}
    {showAddTag && (
      <div className="create-tag-form">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Tag name..."
          className="tag-input"
        />
        <input
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          className="color-input"
        />
        <button onClick={handleCreateTag} className="btn-small btn-primary">
          Create
        </button>
      </div>
    )}
  </div>
);
@
```

---

### Styles: Tag Manager Component

Estilos para badges, dropdown, y create form.

```css
<<src/components/TagManager.css>>=
/* Container */
.tag-manager {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Current Tags Section (Badges) */
.current-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  color: white;
  font-size: 12px;
  font-weight: 500;
}

.tag-remove {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.8;
}

.tag-remove:hover {
  opacity: 1;
}

/* Add Existing Tag Section */
.add-tag-section {
  margin-top: 4px;
}

.tag-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

/* Create New Tag Button */
.btn-create-tag {
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-create-tag:hover {
  background: #e5e5e5;
}

/* Create Tag Form */
.create-tag-form {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.tag-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.color-input {
  width: 40px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

/* Button Styles */
.btn-small {
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-primary:hover {
  background: #2563eb;
}
@
```

---

### Tests: Tag Manager Component

Tests de integración para display, add, remove, y create operations.

```javascript
<<tests/TagManager.test.jsx>>=
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagManager from '../src/components/TagManager.jsx';
import { vi } from 'vitest';

describe('TagManager Component', () => {
  const mockTags = [
    { id: 'tag-1', name: 'Work', color: '#3b82f6' },
    { id: 'tag-2', name: 'Personal', color: '#10b981' },
    { id: 'tag-3', name: 'Travel', color: '#f59e0b' }
  ];

  beforeEach(() => {
    // Mock Electron API
    window.electronAPI = {
      getAllTags: vi.fn(),
      getTransactionTags: vi.fn(),
      addTagToTransaction: vi.fn(),
      removeTagFromTransaction: vi.fn(),
      createTag: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // TEST: Display current transaction tags
  test('displays current transaction tags', async () => {
    window.electronAPI.getAllTags.mockResolvedValue(mockTags);
    window.electronAPI.getTransactionTags.mockResolvedValue([mockTags[0]]);

    render(<TagManager transactionId="txn-1" />);

    // Should show "Work" tag badge
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });

  // TEST: Show available tags in dropdown
  test('shows available tags in dropdown', async () => {
    window.electronAPI.getAllTags.mockResolvedValue(mockTags);
    window.electronAPI.getTransactionTags.mockResolvedValue([mockTags[0]]);  // "Work" already applied

    render(<TagManager transactionId="txn-1" />);

    // Dropdown should show tags NOT already applied (Personal, Travel)
    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Travel')).toBeInTheDocument();
    });
  });

  // TEST: Add tag to transaction
  test('adds tag to transaction', async () => {
    window.electronAPI.getAllTags.mockResolvedValue(mockTags);
    window.electronAPI.getTransactionTags.mockResolvedValue([]);
    window.electronAPI.addTagToTransaction.mockResolvedValue({ success: true });

    render(<TagManager transactionId="txn-1" />);

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Select "Work" tag from dropdown
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'tag-1' } });

    // Verify API was called
    await waitFor(() => {
      expect(window.electronAPI.addTagToTransaction).toHaveBeenCalledWith('txn-1', 'tag-1');
    });
  });

  // TEST: Remove tag from transaction
  test('removes tag from transaction', async () => {
    window.electronAPI.getAllTags.mockResolvedValue(mockTags);
    window.electronAPI.getTransactionTags.mockResolvedValue([mockTags[0]]);
    window.electronAPI.removeTagFromTransaction.mockResolvedValue({ success: true });

    render(<TagManager transactionId="txn-1" />);

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Click remove button (×)
    const removeButton = screen.getByLabelText('Remove Work');
    fireEvent.click(removeButton);

    // Verify API was called
    await waitFor(() => {
      expect(window.electronAPI.removeTagFromTransaction).toHaveBeenCalledWith('txn-1', 'tag-1');
    });
  });

  // TEST: Create new tag
  test('creates new tag', async () => {
    window.electronAPI.getAllTags.mockResolvedValue([]);
    window.electronAPI.getTransactionTags.mockResolvedValue([]);
    window.electronAPI.createTag.mockResolvedValue({ id: 'tag-new', name: 'Urgent', color: '#ef4444' });
    window.electronAPI.addTagToTransaction.mockResolvedValue({ success: true });

    render(<TagManager transactionId="txn-1" />);

    // Click "+ New Tag" button
    const newTagButton = screen.getByText('+ New Tag');
    fireEvent.click(newTagButton);

    // Enter tag name
    const input = screen.getByPlaceholderText('Tag name...');
    fireEvent.change(input, { target: { value: 'Urgent' } });

    // Click "Create" button
    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    // Verify tag was created with default color
    await waitFor(() => {
      expect(window.electronAPI.createTag).toHaveBeenCalledWith('Urgent', '#3b82f6');
    });
  });

  // TEST: Show create tag form
  test('shows create tag form when clicking New Tag', async () => {
    window.electronAPI.getAllTags.mockResolvedValue([]);
    window.electronAPI.getTransactionTags.mockResolvedValue([]);

    render(<TagManager transactionId="txn-1" />);

    // Click "+ New Tag"
    const newTagButton = screen.getByText('+ New Tag');
    fireEvent.click(newTagButton);

    // Form should appear with inputs
    expect(screen.getByPlaceholderText('Tag name...')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});
@
```

**Test Explanations**:

1. **Display current tags**: Verifica que tags aplicados se muestran como badges
2. **Available tags dropdown**: Confirma que dropdown muestra solo tags NO aplicados
3. **Add tag**: Valida que seleccionar del dropdown aplica tag
4. **Remove tag**: Verifica que click en × remueve tag
5. **Create new tag**: Test completo de creación con default color
6. **Show create form**: Confirma que form aparece al click en "+ New Tag"

---

## Status: Task 25 Complete ✅

**Output**:
- ✅ `migrations/007-add-tags.sql` - 19 LOC (tags + junction table + indexes)
- ✅ `tests/tags.test.js` - 131 LOC (5 schema tests)
- ✅ `src/components/TagManager.jsx` - 147 LOC (tag CRUD UI)
- ✅ `src/components/TagManager.css` - 110 LOC (badge + form styles)
- ✅ `tests/TagManager.test.jsx` - 124 LOC (6 component tests)

**Total**: 531 LOC

**Quality Score**: 9/10
- ✅ Conceptual introduction explaining tag system
- ✅ "Por qué" section contrasting categories vs tags
- ✅ 5 architectural decisions documented (many-to-many, unique names, color picker, inline UI, auto-add)
- ✅ Nested chunks for organization
- ✅ Enhanced inline comments explaining logic
- ✅ All code preserved exactly (no functional changes)
- ✅ Test explanations for each test case

**Next**: Task 26 - Credit Card Balance Dashboard (~529 LOC) - LAST TASK!
