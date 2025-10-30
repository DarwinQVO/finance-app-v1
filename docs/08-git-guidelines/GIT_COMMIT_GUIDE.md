# Git Commit Guidelines

**Descriptive commits = Better project history**

---

## 🎯 Why Descriptive Commits?

1. **Understand history**: Know what changed and why
2. **Debug faster**: Find when bugs were introduced
3. **Review easier**: Reviewers understand changes quickly
4. **Revert safely**: Know what you're reverting

---

## 📝 Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

### Parts

1. **Type**: Category of change (required)
2. **Subject**: Brief description (required)
3. **Body**: Detailed explanation (optional)
4. **Footer**: References and breaking changes (optional)

---

## 🏷️ Types

| Type | When to use | Example |
|------|-------------|---------|
| `UI` | Changes to UI components or design tokens | `UI: add disabled prop to Button` |
| `feat` | New feature | `feat: add CSV import` |
| `fix` | Bug fix | `fix: correct transfer detection` |
| `refactor` | Code restructuring (no behavior change) | `refactor: extract parser logic` |
| `perf` | Performance improvement | `perf: optimize timeline query` |
| `test` | Add or fix tests | `test: add upload flow tests` |
| `docs` | Documentation only | `docs: update ROADMAP` |
| `style` | Code formatting (no logic change) | `style: fix indentation` |
| `chore` | Build, dependencies, tooling | `chore: update dependencies` |

---

## ✍️ Writing Good Subjects

### Rules

1. **Use imperative mood**: "add" not "added" or "adds"
2. **Don't capitalize**: Start with lowercase
3. **No period**: Don't end with `.`
4. **Max 50 characters**: Keep it short
5. **Be specific**: Say WHAT changed

### Examples

✅ **Good**:
```
UI: add loading state to Button component
feat: implement recurring transaction detection
fix: prevent duplicate uploads with same hash
refactor: move normalization rules to database
```

❌ **Bad**:
```
Updated button                    # Too vague
Added new feature.                # What feature?
UI: Added loading state to Button # Capitalized, period
fix bug                           # Which bug?
```

---

## 📄 Body (Optional but Recommended)

Use body to explain:
- **What** changed
- **Why** you made the change
- **Context** for the change

### Format

- Separate from subject with blank line
- Wrap at 72 characters
- Use bullet points for multiple items

### Example

```
feat: add CSV import functionality

Allows users to bulk import transactions from CSV files
exported from Mint, YNAB, or bank statements.

Features:
- Auto-detect column format
- Column mapping wizard
- Duplicate detection
- Batch processing (100 rows at a time)

This addresses the #1 user request from initial feedback.
```

---

## 🔗 Footer (Optional)

Use footer for:
- **Issue references**: Link to issues/PRs
- **Breaking changes**: Warn about compatibility breaks

### Examples

```
Closes #42
Fixes #123, #456
Refs #789

BREAKING CHANGE: Button `onClick` renamed to `onPress`
```

---

## 🎨 UI Component Changes

**Special rules for UI components** (to track design system evolution):

### Adding new prop

```
UI: add disabled prop to Button component

Allows disabling button interaction. When disabled:
- Button is visually dimmed (opacity 0.5)
- Click events are ignored
- Cursor shows 'not-allowed'

Usage:
  <Button disabled={true}>Save</Button>
```

### Changing existing prop

```
UI: change Button size values from pixels to named sizes

BREAKING CHANGE: size prop now uses 'sm' | 'md' | 'lg'
instead of pixel values.

Before: <Button size={32}>
After:  <Button size="sm">

Migration: Replace all pixel sizes with:
  - 32px → 'sm'
  - 40px → 'md'
  - 48px → 'lg'
```

### Changing design tokens

```
UI: update primary color from blue to green

Changed tokens.colors.primary from #007AFF to #34C759
to align with new brand guidelines.

Affects all primary buttons, links, and highlights.
```

### Adding new component

```
UI: add Select component for dropdowns

New base component for dropdown selection with:
- Single and multi-select modes
- Search/filter functionality
- Keyboard navigation
- Disabled options
```

---

## 📊 Examples by Scenario

### Phase 1: Core Features

```
feat: implement PDF upload with deduplication

feat: add merchant normalization engine

fix: timeline scroll performance with 12k transactions

refactor: extract parser configs to database

test: add integration tests for upload flow

UI: create Timeline component with infinite scroll
```

### Phase 2: Organization

```
feat: implement auto-categorization engine

feat: add budget tracking with alerts

fix: recurring detection false positives

refactor: simplify category hierarchy

UI: add CategoryPicker component
```

### Phase 3: Analysis

```
feat: implement report engine with 6 pre-built reports

feat: add custom report builder

fix: export CSV with Excel-compatible UTF-8 BOM

UI: create ReportCard component with Recharts
```

### Phase 4: Scale

```
feat: implement multi-user authentication

feat: add mobile sync with conflict resolution

fix: data isolation query performance

refactor: extract auth logic to separate service

UI: add responsive styles for mobile screens
```

---

## 🚀 Setup Commit Template

Configure git to use the commit template:

```bash
git config commit.template .gitmessage
```

Now every `git commit` opens your editor with the template pre-filled.

---

## 🔍 Reviewing Commits

### Good commit history

```
git log --oneline

a1b2c3d UI: add disabled state to Button
d4e5f6g feat: implement CSV import
g7h8i9j fix: prevent duplicate uploads
j0k1l2m refactor: extract normalization rules
m3n4o5p docs: update ROADMAP with Phase 2 details
```

**Clear, scannable, informative** ✅

### Bad commit history

```
git log --oneline

a1b2c3d wip
d4e5f6g fix stuff
g7h8i9j update
j0k1l2m more changes
m3n4o5p Final version
```

**Vague, unhelpful, confusing** ❌

---

## ✅ Checklist Before Committing

- [ ] Commit does ONE thing (atomic)
- [ ] Type is correct (UI, feat, fix, etc)
- [ ] Subject is descriptive (<50 chars)
- [ ] Subject uses imperative mood
- [ ] Body explains WHY (if needed)
- [ ] References issues (if applicable)
- [ ] Breaking changes documented (if any)

---

## 📚 Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)

---

**Remember**: Future you (and your team) will thank you for clear commit messages! 🙏
