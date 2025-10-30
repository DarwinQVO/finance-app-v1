# UI Component Guidelines

**Building consistent, maintainable UI for Finance App**

---

## 🎯 Philosophy

Finance App uses a **lightweight component system**:

✅ **TypeScript interfaces** = Props contracts
✅ **Design tokens** = Single source of truth for styling
✅ **Component folder** = Organized by purpose
✅ **Git commits** = Track UI evolution

❌ **NO SemVer versioning** (single app, not library)
❌ **NO JSON contracts** (TypeScript is enough)
❌ **NO automated CI checks** (manual review is fine)

---

## 📁 Folder Structure

```
src/
  components/
    base/                 # Generic, reusable components
      Button.tsx
      Input.tsx
      Modal.tsx
      Dropdown.tsx
      Card.tsx
      Table.tsx

    finance/              # Domain-specific components
      TransactionCard.tsx
      BudgetGauge.tsx
      Timeline.tsx
      CategoryPicker.tsx
      AccountSelector.tsx

    layout/               # Layout components
      Sidebar.tsx
      Header.tsx
      Page.tsx

  config/
    design-tokens.ts      # All design values centralized
```

### Rules

1. **base/**: Components that could be used in ANY app
   - No Finance App business logic
   - Fully generic and reusable
   - Example: Button, Input, Modal

2. **finance/**: Components specific to Finance App
   - Use base components internally
   - Contain domain logic
   - Example: TransactionCard, BudgetGauge

3. **layout/**: Page structure components
   - App shell, sidebars, headers
   - Responsive layout logic

---

## 🎨 Design Tokens

**ALWAYS use design tokens, NEVER hardcode values**

### ❌ Bad

```typescript
<button style={{
  backgroundColor: '#007AFF',
  padding: '8px 16px',
  borderRadius: '8px',
}}>
  Save
</button>
```

### ✅ Good

```typescript
import { tokens } from '@/config/design-tokens';

<button style={{
  backgroundColor: tokens.colors.primary,
  padding: `${tokens.spacing['2']} ${tokens.spacing['4']}`,
  borderRadius: tokens.borderRadius.base,
}}>
  Save
</button>
```

### Why?

1. **Consistency**: All buttons use same blue
2. **Themeable**: Change one value, updates everywhere
3. **Maintainable**: No magic numbers scattered in code

---

## 📝 TypeScript Interfaces

**Every component MUST have a TypeScript interface defining its props**

### Structure

```typescript
/**
 * Component description
 */
export interface ComponentProps {
  /**
   * Prop description
   * @default defaultValue
   */
  propName: PropType;

  /**
   * Required prop (no ?)
   */
  requiredProp: string;

  /**
   * Optional prop (with ?)
   * @default 'default'
   */
  optionalProp?: string;

  /**
   * Callback prop
   */
  onClick?: () => void;

  /**
   * Children (React elements)
   */
  children?: React.ReactNode;
}
```

### Rules

1. **Document every prop** with JSDoc comment
2. **Specify defaults** with `@default` tag
3. **Use union types** for variants: `'sm' | 'md' | 'lg'`
4. **Optional props** use `?`
5. **Required props** don't use `?`

### Example

```typescript
/**
 * Button Props Interface
 *
 * This is the contract. Changes here affect all consumers.
 */
export interface ButtonProps {
  /**
   * Visual style variant
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';

  /**
   * Button size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Click handler (required)
   */
  onClick: () => void;

  /**
   * Button content
   */
  children: React.ReactNode;
}
```

---

## 🧩 Component Patterns

### 1. Base Component Pattern

```typescript
/**
 * Generic reusable component
 */

import React from 'react';
import { tokens } from '@/config/design-tokens';

export interface ComponentProps {
  // Props definition
}

export function Component({
  prop1 = 'default',
  prop2,
  ...props
}: ComponentProps) {
  // Implementation using design tokens
  const style = {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.base,
    // ...
  };

  return <div style={style}>...</div>;
}
```

### 2. Finance Component Pattern

```typescript
/**
 * Domain-specific component
 */

import React from 'react';
import { tokens } from '@/config/design-tokens';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';

export interface DomainComponentProps {
  // Domain-specific props
  transaction: Transaction;
  onEdit: () => void;
}

export function DomainComponent({
  transaction,
  onEdit,
}: DomainComponentProps) {
  // Use base components + domain logic
  return (
    <Card>
      <h3>{transaction.merchant}</h3>
      <Button onClick={onEdit}>Edit</Button>
    </Card>
  );
}
```

---

## 🎨 Styling Approach

Finance App uses **inline styles with design tokens**

### Why Inline Styles?

1. **Simple**: No CSS files to manage
2. **Scoped**: Styles live with component
3. **Type-safe**: TypeScript checks style properties
4. **Fast**: No CSS parsing at runtime

### Pattern

```typescript
const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: tokens.spacing['4'],
  padding: tokens.spacing['6'],
  backgroundColor: tokens.colors.background.primary,
  borderRadius: tokens.borderRadius.base,
};

return <div style={containerStyle}>...</div>;
```

### When to Use CSS Classes?

Only for:
- **Animations** (keyframes)
- **Pseudo-classes** (:hover, :focus)
- **Media queries** (responsive)

```typescript
// CSS file (rare)
.button:hover {
  opacity: 0.8;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## ✅ Props Best Practices

### 1. Sensible Defaults

```typescript
// ✅ Good: Optional props with defaults
variant?: 'primary' | 'secondary' = 'primary';
size?: 'sm' | 'md' | 'lg' = 'md';

// Usage: <Button>Save</Button>  ← Uses defaults
// Usage: <Button variant="danger">Delete</Button>  ← Explicit
```

### 2. Boolean Props

```typescript
// ✅ Good: Boolean with default false
disabled?: boolean = false;

// Usage: <Button disabled>Save</Button>
```

### 3. Callback Props

```typescript
// ✅ Good: Optional callbacks
onClick?: () => void;
onChange?: (value: string) => void;

// Always check before calling
if (onClick) {
  onClick();
}
```

### 4. Children Prop

```typescript
// ✅ Good: Accept any React content
children: React.ReactNode;

// Usage: <Button>Save</Button>
// Usage: <Button><Icon /> Save</Button>
```

---

## 🚫 What NOT to Do

### 1. Don't Hardcode Values

```typescript
// ❌ Bad
backgroundColor: '#007AFF'
padding: '16px'
fontSize: '14px'

// ✅ Good
backgroundColor: tokens.colors.primary
padding: tokens.spacing['4']
fontSize: tokens.typography.fontSize.base
```

### 2. Don't Break Props Contract

```typescript
// ❌ Bad: Changing prop name (breaking change)
// Before: onClick: () => void
// After:  onPress: () => void

// ✅ Good: Add new prop, deprecate old
onClick?: () => void; // @deprecated Use onPress
onPress?: () => void;
```

### 3. Don't Skip TypeScript

```typescript
// ❌ Bad: Using 'any'
props: any

// ✅ Good: Explicit interface
props: ButtonProps
```

### 4. Don't Mix Concerns

```typescript
// ❌ Bad: Base component with domain logic
export function Button({ transaction, onEdit }) {
  // This is domain-specific, should be in finance/

// ✅ Good: Keep base components generic
export function Button({ onClick, children }) {
  // Generic, reusable anywhere
```

---

## 📦 Component Checklist

Before committing a new component:

- [ ] **Props interface** defined with JSDoc comments
- [ ] **Design tokens** used (no hardcoded values)
- [ ] **Defaults** specified for optional props
- [ ] **TypeScript** strict typing (no `any`)
- [ ] **Folder** correct (`base/` vs `finance/`)
- [ ] **Example** usage in JSDoc comment
- [ ] **Git commit** descriptive (`UI: add X component`)

---

## 🎓 Examples

### Base Component: Button

See [src/components/base/Button.tsx](../../src/components/base/Button.tsx)

**Features**:
- 4 variants: primary, secondary, danger, ghost
- 3 sizes: sm, md, lg
- Loading state with spinner
- Disabled state
- Full TypeScript interface

### Base Component: Input

See [src/components/base/Input.tsx](../../src/components/base/Input.tsx)

**Features**:
- Label + helper text + error message
- Icons (start/end)
- Multiple types (text, email, number, etc)
- Disabled and read-only states

### Finance Component: TransactionCard

See [src/components/finance/TransactionCard.tsx](../../src/components/finance/TransactionCard.tsx)

**Features**:
- Domain-specific (displays transaction)
- Uses base components internally
- Type-specific colors (expense/income/transfer)
- Compact mode
- Selected state

---

## 🔄 Making Changes

### Adding New Prop (Safe)

```typescript
// ✅ Safe: New optional prop
export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode; // ← NEW, optional
}

// Git commit:
// UI: add icon prop to Button component
```

### Changing Prop Type (Breaking)

```typescript
// ❌ Breaking: Changing type
// Before: size?: 'sm' | 'md' | 'lg'
// After:  size?: number

// If you MUST do this:
// 1. Add new prop with new type
// 2. Keep old prop, mark @deprecated
// 3. Update all usages
// 4. Remove old prop in next major release

// Git commit:
// UI: change Button size to pixel values
//
// BREAKING CHANGE: size prop now accepts numbers
// Migration: 'sm' → 32, 'md' → 40, 'lg' → 48
```

### Changing Design Token (Visual Change)

```typescript
// Changes appearance but not behavior

// config/design-tokens.ts
colors: {
  primary: '#34C759', // Was '#007AFF'
}

// Git commit:
// UI: update primary color from blue to green
//
// Changed tokens.colors.primary to align with
// new brand guidelines. Affects all primary buttons.
```

---

## 🚀 Next Steps

1. **Read examples**: Check `/src/components/base/` for patterns
2. **Use tokens**: Import `tokens` in every component
3. **Write interfaces**: Document all props
4. **Follow folder structure**: `base/` vs `finance/`
5. **Commit descriptively**: Use `UI:` prefix for component changes

---

**Key Takeaway**: Finance App's component system is **lightweight but structured**. TypeScript + design tokens + good commits = Maintainable UI. 🎨
