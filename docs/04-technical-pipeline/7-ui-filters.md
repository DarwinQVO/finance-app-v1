# UI: Filters

**Filtrar transactions por cuenta, fecha, y tipo**

## Overview

Los filtros permiten a el usuario buscar transactions específicas.

```
┌──────────────────────────────────────────────────┐
│  Filters: [All accounts ▾] [Last 3 months ▾] [All ▾] │
└──────────────────────────────────────────────────┘
```

**3 filtros**:
1. **Account**: BofA, Apple Card, Wise, Scotia, All
2. **Date range**: Last 7 days, Last 30 days, Last 3 months, This year, All time
3. **Type**: Expense, Income, Transfer, All

---

## Code: TimelineFilters

```javascript
// renderer/components/TimelineFilters.jsx

function TimelineFilters({ filters, onChange }) {
  const { account, dateRange, type } = filters;

  return (
    <div className="timeline-filters">
      {/* Account filter */}
      <select
        value={account}
        onChange={(e) => onChange({ ...filters, account: e.target.value })}
      >
        <option value="all">All accounts</option>
        <option value="bofa">Bank of America</option>
        <option value="apple-card">Apple Card</option>
        <option value="wise">Wise</option>
        <option value="scotia">Scotiabank</option>
      </select>

      {/* Date range filter */}
      <select
        value={dateRange}
        onChange={(e) => onChange({ ...filters, dateRange: e.target.value })}
      >
        <option value="last-7-days">Last 7 days</option>
        <option value="last-30-days">Last 30 days</option>
        <option value="last-3-months">Last 3 months</option>
        <option value="this-year">This year</option>
        <option value="all-time">All time</option>
      </select>

      {/* Type filter */}
      <select
        value={type}
        onChange={(e) => onChange({ ...filters, type: e.target.value })}
      >
        <option value="all">All types</option>
        <option value="expense">Expenses</option>
        <option value="income">Income</option>
        <option value="transfer">Transfers</option>
      </select>
    </div>
  );
}
```

---

## Search box

Agregar un search box para buscar por merchant.

```javascript
function TimelineFilters({ filters, onChange }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    onChange({ ...filters, search: term });
  };

  return (
    <div className="timeline-filters">
      {/* Search */}
      <input
        type="text"
        placeholder="Search merchants..."
        value={searchTerm}
        onChange={handleSearch}
        className="search-input"
      />

      {/* Otros filtros... */}
    </div>
  );
}
```

**Backend query**:
```javascript
if (search) {
  query += ' AND merchant LIKE ?';
  params.push(`%${search}%`);
}
```

---

## Date picker (opcional)

Para filtros más específicos, agregar date picker.

```javascript
import DatePicker from 'react-datepicker';

function TimelineFilters({ filters, onChange }) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const handleDateChange = ([start, end]) => {
    setStartDate(start);
    setEndDate(end);
    onChange({
      ...filters,
      customDateRange: {
        from: formatDate(start),
        to: formatDate(end)
      }
    });
  };

  return (
    <div className="timeline-filters">
      {/* Otros filtros... */}

      <DatePicker
        selectsRange
        startDate={startDate}
        endDate={endDate}
        onChange={handleDateChange}
        isClearable
        placeholderText="Custom date range"
      />
    </div>
  );
}
```

---

## Filter chips

Mostrar filtros activos como "chips" removibles.

```javascript
function ActiveFilters({ filters, onRemove }) {
  const chips = [];

  if (filters.account !== 'all') {
    chips.push({
      key: 'account',
      label: `Account: ${filters.account}`,
      value: 'all'
    });
  }

  if (filters.type !== 'all') {
    chips.push({
      key: 'type',
      label: `Type: ${filters.type}`,
      value: 'all'
    });
  }

  if (filters.search) {
    chips.push({
      key: 'search',
      label: `Search: "${filters.search}"`,
      value: ''
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="active-filters">
      {chips.map(chip => (
        <div key={chip.key} className="filter-chip">
          <span>{chip.label}</span>
          <button onClick={() => onRemove(chip.key, chip.value)}>×</button>
        </div>
      ))}
    </div>
  );
}
```

---

## LOC estimate

- `TimelineFilters.jsx`: ~60 LOC
- `ActiveFilters.jsx`: ~40 LOC
- Query updates: ~20 LOC

**Total**: ~120 LOC

---

**Próximo doc**: Lee [8-ui-details.md](8-ui-details.md)
