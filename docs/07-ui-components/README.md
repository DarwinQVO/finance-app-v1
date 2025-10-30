# UI Components Documentation

**Lightweight component system for Finance App**

---

## 📚 Documentation

### Main Guides

1. **[COMPONENT_GUIDELINES.md](COMPONENT_GUIDELINES.md)** - Complete component development guide
   - Folder structure
   - TypeScript interfaces
   - Design tokens usage
   - Best practices
   - Examples

### Git Guidelines

2. **[../08-git-guidelines/GIT_COMMIT_GUIDE.md](../08-git-guidelines/GIT_COMMIT_GUIDE.md)** - Git commit conventions
   - Commit message format
   - Type prefixes (UI, feat, fix, etc)
   - Examples for each scenario

---

## 🎨 Design Tokens

**Single source of truth**: [src/config/design-tokens.ts](../../src/config/design-tokens.ts)

### What's Included

- **Colors**: Primary, secondary, feedback, neutrals, transaction types
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: 4px scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- **Border Radius**: sm, base, lg, xl, full
- **Shadows**: none, sm, base, md, lg, xl
- **Z-Index**: Layering for overlays, modals, tooltips
- **Transitions**: fast, base, slow
- **Breakpoints**: Responsive design breakpoints

### Usage

```typescript
import { tokens } from '@/config/design-tokens';

<div style={{
  color: tokens.colors.primary,
  padding: tokens.spacing['4'],
  borderRadius: tokens.borderRadius.base,
}}>
```

---

## 🧩 Base Components

Generic, reusable components in `src/components/base/`

### Available Components

| Component | File | Description |
|-----------|------|-------------|
| **Button** | [Button.tsx](../../src/components/base/Button.tsx) | Primary interactive element with variants, sizes, loading state |
| **Input** | [Input.tsx](../../src/components/base/Input.tsx) | Text input with label, validation, icons |
| **Modal** | [Modal.tsx](../../src/components/base/Modal.tsx) | Overlay dialog with header, body, footer |

### Coming Soon (Phase 1)

- Dropdown
- Card
- Table
- Checkbox
- Radio
- Switch
- Badge
- Tooltip

---

## 💰 Finance Components

Domain-specific components in `src/components/finance/`

### Available Components

| Component | File | Description |
|-----------|------|-------------|
| **TransactionCard** | [TransactionCard.tsx](../../src/components/finance/TransactionCard.tsx) | Display single transaction in timeline |

### Coming Soon (Phase 1-2)

- Timeline
- BudgetGauge
- CategoryPicker
- AccountSelector
- RecurringGroup
- TransferPair

---

## 📖 Quick Reference

### Creating a New Base Component

1. **Create file**: `src/components/base/ComponentName.tsx`
2. **Define interface**: TypeScript props with JSDoc
3. **Use tokens**: Import and use design tokens
4. **Export**: `export function ComponentName({ ...props })`
5. **Commit**: `UI: add ComponentName component`

### Creating a New Finance Component

1. **Create file**: `src/components/finance/ComponentName.tsx`
2. **Import base components**: Use existing base components
3. **Add domain logic**: Transaction, budget, category logic
4. **Use tokens**: For any custom styling
5. **Commit**: `UI: add ComponentName component`

---

## 🎯 Principles

### 1. TypeScript Interfaces = Contracts

Every component has a clear TypeScript interface defining its props.

```typescript
export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClick: () => void;
  children: React.ReactNode;
}
```

### 2. Design Tokens = Single Source of Truth

Never hardcode colors, spacing, or typography. Always use tokens.

```typescript
// ❌ Bad
backgroundColor: '#007AFF'

// ✅ Good
backgroundColor: tokens.colors.primary
```

### 3. Organized Folders

- `base/`: Generic components (Button, Input, Modal)
- `finance/`: Domain components (TransactionCard, BudgetGauge)
- `layout/`: Layout components (Sidebar, Header, Page)

### 4. Descriptive Git Commits

Track UI evolution with clear commit messages.

```bash
UI: add disabled prop to Button component
UI: change primary color from blue to green
UI: create TransactionCard component
```

---

## ✅ Component Checklist

Before committing a component:

- [ ] TypeScript interface with JSDoc comments
- [ ] Design tokens used (no hardcoded values)
- [ ] Defaults specified for optional props
- [ ] Example usage in JSDoc comment
- [ ] Correct folder (`base/` or `finance/`)
- [ ] Descriptive git commit (`UI: add X`)

---

## 📚 Examples

### Button Usage

```typescript
import { Button } from '@/components/base/Button';

// Primary button (default)
<Button onClick={handleSave}>
  Save Transaction
</Button>

// Danger button
<Button variant="danger" onClick={handleDelete}>
  Delete
</Button>

// Button with loading
<Button loading={isSaving}>
  Saving...
</Button>

// Button with icon
<Button icon={<Icon />}>
  Export
</Button>
```

### Input Usage

```typescript
import { Input } from '@/components/base/Input';

// Basic input
<Input
  label="Merchant Name"
  value={merchant}
  onChange={setMerchant}
  placeholder="e.g. Starbucks"
/>

// Input with error
<Input
  label="Amount"
  value={amount}
  onChange={setAmount}
  type="number"
  error="Amount is required"
  required
/>

// Input with icon
<Input
  label="Search"
  value={search}
  onChange={setSearch}
  startIcon={<SearchIcon />}
/>
```

### TransactionCard Usage

```typescript
import { TransactionCard } from '@/components/finance/TransactionCard';

// Display transaction
<TransactionCard
  transaction={txn}
  onClick={() => openDetails(txn.id)}
  selected={selectedId === txn.id}
/>

// Compact mode
<TransactionCard
  transaction={txn}
  compact
  showDate={false}
/>
```

---

## 🚀 Getting Started

1. **Read**: [COMPONENT_GUIDELINES.md](COMPONENT_GUIDELINES.md)
2. **Study**: Check existing components in `src/components/`
3. **Use tokens**: Always import `tokens` from `@/config/design-tokens`
4. **Write interfaces**: Document all props with TypeScript
5. **Commit properly**: Follow [GIT_COMMIT_GUIDE.md](../08-git-guidelines/GIT_COMMIT_GUIDE.md)

---

## 🔗 Related Docs

- [ARCHITECTURE-COMPLETE.md](../01-foundation/ARCHITECTURE-COMPLETE.md) - Full system architecture
- [ROADMAP.md](../01-foundation/ROADMAP.md) - Build plan with component order
- [User Flows](../02-user-flows/README.md) - See components in context

---

**Key Takeaway**: Finance App's UI system is lightweight but structured. TypeScript interfaces + design tokens + organized folders + descriptive commits = Maintainable, scalable UI. 🎨
