# Flow 17: Saved Filters (Quick Access to Common Views) 🔖

**Phase**: 2 (Organization)
**Priority**: Medium
**Complexity**: Low
**Related Flows**: flow-1, flow-10, flow-11

---

## 1. Funcionalidad

Guardar combinaciones de filtros con nombres para aplicarlas con 1 click.

**Casos de uso típicos**:
- "Monthly Food Expenses" (Food & Dining + Last 30 days + Credit Card)
- "Recurring Bills" (Type=expense + Recurring=yes)
- "Large Transactions" (Amount > $500 + All accounts)
- "Business Expenses" (Tag=work + All dates)

**Sin saved filters**: 5 clicks cada vez
**Con saved filters**: 1 click

---

## 2. Implementación

**Solución**: **Saved Filters** - Guardar combinaciones de filtros con un nombre para aplicarlas con 1 click.

**Características clave**:
1. **Save current filters** - Click "Save Filter" button en Timeline
2. **Name the filter** - E.g., "Monthly Food Expenses"
3. **Quick access** - Saved filters appear in sidebar como shortcuts
4. **One-click apply** - Click saved filter → instantly apply todas las configuraciones
5. **Edit/Delete** - Manage saved filters (rename, update, delete)
6. **Default filter** - Opcionalmente set one as default (applies when app opens)

**UX Goal**: Aplicar filtro común debe tomar < 2 segundos (vs 20 segundos actual).

---

## 3. User Story: el usuario guarda "Monthly Food Expenses"

### Context
el usuario revisa sus food expenses cada semana para trackear budget. Siempre aplica los mismos filtros:
- Category: Food & Dining
- Date: Last 30 days
- Account: Chase Freedom (his credit card)

Hoy, va a guardar estos filtros para uso futuro.

### Narrative

**10:00 AM - el usuario aplica filtros como siempre**

el usuario está en Timeline view:

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├─────────────────────────────────────────────────┤
│                                                 │
│  📅 Timeline              [🔍 Filters: 3 active]│
│                                                 │
│  Active Filters:                                │
│  ☕ Food & Dining • 📅 Last 30 days • 💳 Chase  │
│                                  [Clear] [Save] │ <- New button
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Oct 28  Blue Bottle Coffee      $4.50  │   │
│  │ Oct 27  Whole Foods            $47.82  │   │
│  │ Oct 25  Starbucks               $5.20  │   │
│  │ Oct 24  Chipotle               $12.45  │   │
│  │ ...                                     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Total (18 transactions): $287.45               │
└─────────────────────────────────────────────────┘
```

el usuario ve el nuevo botón "Save" junto a "Clear".

**Action**: el usuario click "Save"

**Step 1: Save Filter Dialog**

```
┌───────────────────────────────────────────┐
│  🔖 Save Filter                      [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Name this filter:                        │
│  ┌─────────────────────────────────────┐ │
│  │ Monthly Food Expenses               │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Description (optional):                  │
│  ┌─────────────────────────────────────┐ │
│  │ Track food spending over last 30   │ │
│  │ days to stay within budget          │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  This filter will save:                   │
│  ✅ Category: Food & Dining               │
│  ✅ Date: Last 30 days                    │
│  ✅ Account: Chase Freedom                │
│                                           │
│  Options:                                 │
│  ☐ Set as default filter                 │
│  ☐ Pin to sidebar                        │
│                                           │
│            [Cancel]  [Save Filter]        │
└───────────────────────────────────────────┘
```

el usuario:
- Escribe "Monthly Food Expenses"
- Marca "Pin to sidebar" ✓
- Click "Save Filter"

**Step 2: Filter Saved → Appears in Sidebar**

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├───────┬─────────────────────────────────────────┤
│       │                                         │
│ 📊    │  📅 Timeline         [🔍 Filters: 3]    │
│ Views │                                         │
│       │  Active: Monthly Food Expenses          │
│ ───── │                        [Clear] [Edit]   │
│       │                                         │
│ 🔖    │  ┌───────────────────────────────────┐ │
│ Saved │  │ Oct 28  Blue Bottle       $4.50  │ │
│       │  │ Oct 27  Whole Foods      $47.82  │ │
│ ☕ Mo │  │ Oct 25  Starbucks         $5.20  │ │
│ nthl │  │ Oct 24  Chipotle         $12.45  │ │
│ y Fo │  │ ...                               │ │
│ od   │  └───────────────────────────────────┘ │
│ ✨ NEW│  Total: $287.45                         │
│       │                                         │
│ 📝 Re │                                         │
│ curr │                                         │
│ ing  │                                         │
│ Bill │                                         │
│ s    │                                         │
│       │                                         │
└───────┴─────────────────────────────────────────┘
         ↑
    Pinned filters appear in sidebar
```

**Result**: Saved filter ahora aparece en sidebar. el usuario puede aplicarlo con 1 click en futuras sesiones.

---

**Next Week - el usuario usa el saved filter**

**10:00 AM - el usuario abre Finance App**

el usuario quiere revisar sus food expenses de nuevo.

**Action**: Click "Monthly Food Expenses" en sidebar

```
Sidebar click:
│ 🔖 Saved                    │
│                             │
│ ☕ Monthly Food Expenses <- Click
│                             │
│ 📝 Recurring Bills          │
```

**Instant result**: Filtros se aplican automáticamente (< 1 segundo):

```
Timeline updates:
┌─────────────────────────────────────────────────┐
│  📅 Timeline         [🔍 Filters: 3 active]     │
│                                                 │
│  Active: Monthly Food Expenses                  │
│  ☕ Food & Dining • 📅 Last 30 days • 💳 Chase  │
│                                  [Clear] [Edit] │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Nov 4   Sweetgreen            $12.99   │   │
│  │ Nov 3   Blue Bottle            $4.50   │   │
│  │ Nov 2   Whole Foods           $52.18   │   │
│  │ Nov 1   Chipotle              $14.20   │   │
│  │ ...                                     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Total (22 transactions): $312.87               │
└─────────────────────────────────────────────────┘
```

**Result**: el usuario ve sus food expenses con 1 click. Saved **19 seconds** vs manual filtering.

---

## 4. UI Mockups

### 4.1 Timeline with Active Filters (Before Save)

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├─────────────────────────────────────────────────┤
│                                                 │
│  📅 Timeline              [🔍 Filters: 3 active]│
│                                                 │
│  Active Filters:                                │
│  ☕ Food & Dining • 📅 Last 30 days • 💳 Chase  │
│                                  [Clear] [Save] │
│                                            ↑    │
│  ┌─────────────────────────────────────────┐   │ New button appears
│  │ Oct 28  Blue Bottle Coffee      $4.50  │   │ when filters active
│  │ Oct 27  Whole Foods            $47.82  │   │
│  │ ...                                     │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 4.2 Save Filter Dialog

```
┌───────────────────────────────────────────┐
│  🔖 Save Filter                      [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Name * (required)                        │
│  ┌─────────────────────────────────────┐ │
│  │ Monthly Food Expenses               │ │
│  └─────────────────────────────────────┘ │
│  💡 Use a descriptive name              │
│                                           │
│  Description (optional)                   │
│  ┌─────────────────────────────────────┐ │
│  │ Track food spending over last 30   │ │
│  │ days to stay within budget          │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  This filter will save:                   │
│  ┌─────────────────────────────────────┐ │
│  │ ✅ Category: Food & Dining          │ │
│  │ ✅ Date Range: Last 30 days         │ │
│  │ ✅ Account: Chase Freedom           │ │
│  │ ✅ Sort: Date (newest first)        │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Options:                                 │
│  ☑ Pin to sidebar                        │
│  ☐ Set as default filter (applies on     │
│     app start)                            │
│                                           │
│            [Cancel]  [Save Filter]        │
└───────────────────────────────────────────┘
```

### 4.3 Sidebar with Saved Filters

```
Sidebar (collapsed):
┌───────┐
│ 📊    │ <- Views
│ 🔖    │ <- Saved Filters
│ ☕    │ <- Monthly Food Expenses
│ 📝    │ <- Recurring Bills
│ 💳    │ <- Large Transactions
│ 🏢    │ <- Business Expenses
│ ⚙️     │ <- Settings
└───────┘

Sidebar (expanded):
┌───────────────────────┐
│ 📊 Views              │
│   Timeline            │
│   Reports             │
│   Budgets             │
│                       │
│ 🔖 Saved Filters      │
│   [+ New Filter]      │
│                       │
│   ☕ Monthly Food      │  <- Pinned
│   📝 Recurring Bills  │  <- Pinned
│   💳 Large Txns       │
│   🏢 Business Exp     │
│                       │
│   [Manage Filters...] │
│                       │
│ ⚙️  Settings           │
└───────────────────────┘
```

### 4.4 Timeline with Saved Filter Applied

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├─────────────────────────────────────────────────┤
│                                                 │
│  📅 Timeline              [🔍 Filters: active]  │
│                                                 │
│  🔖 Monthly Food Expenses              [Clear]  │
│  ☕ Food & Dining • 📅 Last 30 days • 💳 Chase  │
│                                         [Edit]  │
│                                            ↑    │
│  ┌─────────────────────────────────────────┐   │ Edit saved filter
│  │ Nov 4   Sweetgreen            $12.99   │   │
│  │ Nov 3   Blue Bottle            $4.50   │   │
│  │ Nov 2   Whole Foods           $52.18   │   │
│  │ ...                                     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Total (22 transactions): $312.87               │
└─────────────────────────────────────────────────┘
```

### 4.5 Manage Saved Filters

```
┌───────────────────────────────────────────┐
│  🔖 Manage Saved Filters            [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  [+ New Filter]                           │
│                                           │
│  Your saved filters (4):                  │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ ☕ Monthly Food Expenses     [Edit] │ │
│  │    Food & Dining • Last 30 days    │ │
│  │    📌 Pinned • 🏠 Default          │ │
│  │                           [Delete] │ │
│  ├─────────────────────────────────────┤ │
│  │ 📝 Recurring Bills          [Edit] │ │
│  │    Type=expense • Recurring=yes    │ │
│  │    📌 Pinned                       │ │
│  │                           [Delete] │ │
│  ├─────────────────────────────────────┤ │
│  │ 💳 Large Transactions       [Edit] │ │
│  │    Amount > $500 • All accounts    │ │
│  │                           [Delete] │ │
│  ├─────────────────────────────────────┤ │
│  │ 🏢 Business Expenses        [Edit] │ │
│  │    Tag=work • All dates            │ │
│  │                           [Delete] │ │
│  └─────────────────────────────────────┘ │
│                                           │
│                            [Close]        │
└───────────────────────────────────────────┘
```

### 4.6 Edit Saved Filter

```
┌───────────────────────────────────────────┐
│  ✏️  Edit Filter: Monthly Food Exp  [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Name *                                   │
│  ┌─────────────────────────────────────┐ │
│  │ Monthly Food Expenses               │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Description                              │
│  ┌─────────────────────────────────────┐ │
│  │ Track food spending over last 30   │ │
│  │ days to stay within budget          │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Filters:                                 │
│  ┌─────────────────────────────────────┐ │
│  │ Category: Food & Dining      [Edit]│ │
│  │ Date: Last 30 days           [Edit]│ │
│  │ Account: Chase Freedom       [Edit]│ │
│  │                        [+ Add Filter]│ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Options:                                 │
│  ☑ Pin to sidebar                        │
│  ☑ Set as default                        │
│                                           │
│       [Delete Filter]  [Cancel]  [Save]  │
└───────────────────────────────────────────┘
```

---

## 5. Technical Implementation

### 5.1 Data Model

```sql
-- Saved filters table
CREATE TABLE saved_filters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Filter configuration (JSON)
  filters TEXT NOT NULL, -- JSON: { categories: [...], dateRange: {...}, accounts: [...], ... }

  -- UI options
  is_pinned BOOLEAN DEFAULT 0,
  is_default BOOLEAN DEFAULT 0, -- Only one filter can be default
  icon TEXT, -- Emoji icon (e.g., "☕", "📝")

  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  last_used_at TEXT,
  use_count INTEGER DEFAULT 0,

  -- Multi-user support
  user_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ensure only one default filter per user
CREATE UNIQUE INDEX idx_one_default_per_user
ON saved_filters(user_id)
WHERE is_default = 1;

-- Index for fast retrieval
CREATE INDEX idx_saved_filters_user ON saved_filters(user_id, is_pinned);
```

### 5.2 Filter Configuration Format

```json
{
  "name": "Monthly Food Expenses",
  "description": "Track food spending over last 30 days",
  "filters": {
    "categories": ["food-and-dining"],
    "dateRange": {
      "type": "relative",
      "value": "last-30-days"
    },
    "accounts": ["chase-freedom-id"],
    "amountRange": null,
    "types": null,
    "tags": null,
    "merchants": null,
    "searchText": null
  },
  "sort": {
    "field": "date",
    "order": "desc"
  }
}
```

### 5.3 Save Filter Component

```javascript
// components/SaveFilterDialog.jsx
import React, { useState } from 'react';

function SaveFilterDialog({ activeFilters, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name for this filter');
      return;
    }

    const savedFilter = {
      name: name.trim(),
      description: description.trim(),
      filters: activeFilters,
      is_pinned: isPinned,
      is_default: isDefault
    };

    await window.api.saveFilter(savedFilter);
    onSave(savedFilter);
  };

  return (
    <Dialog open={true} onClose={onCancel}>
      <DialogTitle>🔖 Save Filter</DialogTitle>

      <FormControl>
        <Label>Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Monthly Food Expenses"
          autoFocus
        />
        <HintText>💡 Use a descriptive name</HintText>
      </FormControl>

      <FormControl>
        <Label>Description (optional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this filter for?"
        />
      </FormControl>

      <Card>
        <CardTitle>This filter will save:</CardTitle>
        <FilterSummary filters={activeFilters} />
      </Card>

      <FormControl>
        <Label>Options</Label>
        <Checkbox
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
          label="Pin to sidebar"
        />
        <Checkbox
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          label="Set as default filter (applies on app start)"
        />
      </FormControl>

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="primary">Save Filter</Button>
      </DialogActions>
    </Dialog>
  );
}

function FilterSummary({ filters }) {
  return (
    <List>
      {filters.categories && <ListItem>✅ Category: {filters.categories.join(', ')}</ListItem>}
      {filters.dateRange && <ListItem>✅ Date: {formatDateRange(filters.dateRange)}</ListItem>}
      {filters.accounts && <ListItem>✅ Account: {filters.accounts.join(', ')}</ListItem>}
      {filters.amountRange && <ListItem>✅ Amount: {formatAmountRange(filters.amountRange)}</ListItem>}
      {filters.tags && <ListItem>✅ Tags: {filters.tags.join(', ')}</ListItem>}
    </List>
  );
}

export default SaveFilterDialog;
```

### 5.4 Saved Filters Sidebar

```javascript
// components/SavedFiltersSidebar.jsx
import React, { useEffect, useState } from 'react';

function SavedFiltersSidebar({ onApplyFilter }) {
  const [savedFilters, setSavedFilters] = useState([]);

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    const filters = await window.api.getSavedFilters();
    setSavedFilters(filters);
  };

  const handleApplyFilter = async (filter) => {
    // Update last_used_at and use_count
    await window.api.trackFilterUsage(filter.id);

    // Apply filter to Timeline
    onApplyFilter(filter.filters);
  };

  const pinnedFilters = savedFilters.filter(f => f.is_pinned);
  const otherFilters = savedFilters.filter(f => !f.is_pinned);

  return (
    <Sidebar>
      <SidebarSection title="🔖 Saved Filters">
        <Button onClick={() => showSaveFilterDialog()}>+ New Filter</Button>

        {pinnedFilters.length > 0 && (
          <>
            <Divider />
            {pinnedFilters.map(filter => (
              <SavedFilterItem
                key={filter.id}
                filter={filter}
                onClick={() => handleApplyFilter(filter)}
              />
            ))}
          </>
        )}

        {otherFilters.length > 0 && (
          <>
            <Divider />
            <Collapsible title="More filters">
              {otherFilters.map(filter => (
                <SavedFilterItem
                  key={filter.id}
                  filter={filter}
                  onClick={() => handleApplyFilter(filter)}
                />
              ))}
            </Collapsible>
          </>
        )}

        <Divider />
        <Button variant="text" onClick={() => showManageFiltersDialog()}>
          Manage Filters...
        </Button>
      </SidebarSection>
    </Sidebar>
  );
}

function SavedFilterItem({ filter, onClick }) {
  return (
    <SidebarItem onClick={onClick}>
      <Icon>{filter.icon || '🔖'}</Icon>
      <Text>{filter.name}</Text>
      {filter.is_default && <Badge>Default</Badge>}
    </SidebarItem>
  );
}

export default SavedFiltersSidebar;
```

### 5.5 Backend: Save/Load Filters

```javascript
// main/api/savedFilters.js
const db = require('../database');
const { nanoid } = require('nanoid');

async function saveFilter({ name, description, filters, is_pinned, is_default, user_id }) {
  const id = nanoid();
  const now = new Date().toISOString();

  // If setting as default, unset previous default
  if (is_default) {
    await db.run('UPDATE saved_filters SET is_default = 0 WHERE user_id = ?', [user_id]);
  }

  // Determine icon from filters (smart default)
  const icon = getIconFromFilters(filters);

  await db.run(`
    INSERT INTO saved_filters (
      id, name, description, filters, is_pinned, is_default, icon, created_at, updated_at, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, description, JSON.stringify(filters), is_pinned, is_default, icon, now, now, user_id]);

  return { id, name, description, filters, is_pinned, is_default, icon };
}

async function getSavedFilters(user_id) {
  const filters = await db.all(`
    SELECT * FROM saved_filters
    WHERE user_id = ?
    ORDER BY is_pinned DESC, last_used_at DESC NULLS LAST, name ASC
  `, [user_id]);

  return filters.map(f => ({
    ...f,
    filters: JSON.parse(f.filters)
  }));
}

async function updateFilter(id, updates) {
  const fields = [];
  const values = [];

  Object.keys(updates).forEach(key => {
    if (key === 'filters') {
      fields.push('filters = ?');
      values.push(JSON.stringify(updates[key]));
    } else {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(id);

  await db.run(`UPDATE saved_filters SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteFilter(id) {
  await db.run('DELETE FROM saved_filters WHERE id = ?', [id]);
}

async function trackFilterUsage(id) {
  const now = new Date().toISOString();
  await db.run(`
    UPDATE saved_filters
    SET last_used_at = ?, use_count = use_count + 1
    WHERE id = ?
  `, [now, id]);
}

function getIconFromFilters(filters) {
  // Smart icon selection based on filter content
  if (filters.categories && filters.categories.includes('food-and-dining')) return '☕';
  if (filters.categories && filters.categories.includes('transportation')) return '🚗';
  if (filters.tags && filters.tags.includes('work')) return '🏢';
  if (filters.types && filters.types.includes('income')) return '💰';
  if (filters.amountRange && filters.amountRange.min > 500) return '💳';
  return '🔖'; // Default
}

module.exports = {
  saveFilter,
  getSavedFilters,
  updateFilter,
  deleteFilter,
  trackFilterUsage
};
```

### 5.6 Apply Default Filter on App Start

```javascript
// renderer/App.jsx
import React, { useEffect } from 'react';

function App() {
  useEffect(() => {
    applyDefaultFilter();
  }, []);

  const applyDefaultFilter = async () => {
    const defaultFilter = await window.api.getDefaultFilter();

    if (defaultFilter) {
      // Apply filters to Timeline
      dispatch(applyFilters(defaultFilter.filters));
    }
  };

  return (
    <Layout>
      <SavedFiltersSidebar />
      <Timeline />
    </Layout>
  );
}
```

---

## 6. Edge Cases & Solutions

### 6.1 Conflicting Default Filters

**Case**: User tries to set multiple filters as default

**Solution**:
- Database constraint: Only one `is_default=1` per user
- When setting new default, automatically unset previous default
- Show confirmation: "This will replace 'Old Filter' as default"

---

### 6.2 Outdated Filters

**Case**: Saved filter references account/category that was deleted

**Solution**:
- When applying filter, check if referenced entities still exist
- If not, show warning: "⚠️ This filter references 'Chase Card' which no longer exists"
- Offer to edit filter or apply with available filters only

**Code**:
```javascript
async function validateFilter(filter) {
  const errors = [];

  // Check if categories exist
  if (filter.categories) {
    for (const catId of filter.categories) {
      const cat = await db.get('SELECT id FROM categories WHERE id = ?', [catId]);
      if (!cat) errors.push(`Category ${catId} no longer exists`);
    }
  }

  // Check if accounts exist
  if (filter.accounts) {
    for (const accId of filter.accounts) {
      const acc = await db.get('SELECT id FROM accounts WHERE id = ?', [accId]);
      if (!acc) errors.push(`Account ${accId} no longer exists`);
    }
  }

  return errors.length > 0 ? errors : null;
}
```

---

### 6.3 Relative vs Absolute Date Ranges

**Case**: "Last 30 days" filter saved 2 months ago - should it show last 30 days from today or from when filter was created?

**Solution**:
- Store date ranges as **relative** ("last-30-days") not absolute ("2025-10-01 to 2025-10-30")
- When applying filter, resolve relative dates to absolute dates at runtime
- This way "Last 30 days" always means "30 days before today"

**Code**:
```javascript
function resolveDateRange(dateRange) {
  if (dateRange.type === 'relative') {
    const today = new Date();

    switch (dateRange.value) {
      case 'last-30-days':
        return {
          startDate: subDays(today, 30),
          endDate: today
        };
      case 'this-month':
        return {
          startDate: startOfMonth(today),
          endDate: endOfMonth(today)
        };
      // ... other relative ranges
    }
  }

  // Absolute range (custom dates)
  return {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  };
}
```

---

### 6.4 Duplicate Names

**Case**: User tries to save filter with name that already exists

**Solution**:
- Allow duplicates (same name is fine if filters are different)
- Or show warning: "A filter named 'Monthly Food' already exists. Save anyway?"
- Or auto-append number: "Monthly Food (2)"

---

### 6.5 Sharing Filters (Multi-User)

**Case**: User A wants to share "Recurring Bills" filter with User B

**Solution** (Phase 4 - multi-user):
- Add `is_shared` and `shared_with` fields to `saved_filters` table
- Show "Share" button in Manage Filters dialog
- Recipient sees shared filters in "Shared with me" section

**Code**:
```sql
ALTER TABLE saved_filters ADD COLUMN is_shared BOOLEAN DEFAULT 0;
ALTER TABLE saved_filters ADD COLUMN shared_with TEXT; -- JSON array of user_ids

-- Access control
SELECT * FROM saved_filters
WHERE user_id = ? OR (is_shared = 1 AND json_array(?) IN shared_with)
```

---

## 7. Summary

### What This Flow Covers

✅ **Save current filters** with a name
✅ **Quick apply** from sidebar (1 click)
✅ **Pin to sidebar** for fast access
✅ **Default filter** (applies on app start)
✅ **Edit/delete** saved filters
✅ **Smart icons** based on filter content
✅ **Relative date ranges** (stay current over time)
✅ **Usage tracking** (last_used_at, use_count)

### Scope Boundaries

**In Scope**:
- Save any combination of filters
- Apply saved filters to Timeline
- Manage saved filters (edit, delete, pin)
- One default filter per user

**Out of Scope** (future):
- Share filters with other users (Phase 4)
- Filter templates/presets (built-in)
- Filter folders/groups
- Smart filters (auto-update based on rules)

### Impact on Other Flows

- **flow-1** (Timeline): Saved filters appear in sidebar, apply to Timeline
- **flow-10** (Reports): Saved filters could apply to reports too (future)
- **flow-11** (Custom Reports): Custom report queries could be saved as filters (future)

### Why This Flow is Important

Without saved filters:
- el usuario wastes 20 seconds every time he wants to see common views
- Friction → less usage → stale data
- Common tasks (budget tracking) are tedious

With saved filters:
- 1-click access to common views
- Faster workflow → more usage
- Budget tracking becomes effortless

**Result**: Finance App becomes daily-use tool, not weekly chore.

---

**Lines of Code**: ~500 (save dialog + sidebar + backend + validation)
**Testing Priority**: Medium
**Dependencies**: flow-1 (timeline filters)
**Phase**: 2 (nice-to-have, improves UX)
