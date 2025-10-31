# Badge 16: Code Quality Standards

**Date**: October 31, 2025
**Status**: ✅ PARTIAL (Language fixes DONE, JSDoc pending)
**Goal**: Enforce 9/10 quality baseline across all code

---

## 🎯 OBJECTIVE

**Apply code quality standards across the entire codebase:**

1. **Fix formatting** - Remove excessive whitespace
2. **Standardize language** - English for code, Spanish for docs
3. **Add JSDoc types** - Type safety without TypeScript
4. **Standardize exports** - Named exports everywhere
5. **Remove AI attribution** - BANNED completely

---

## 📋 CURRENT ISSUES

### Issue 1: Excessive Whitespace in Comments

**Problem** (normalization.js:14-59):
```javascript
/**
   * Normalizar merchant usando rules de DB

   *

   * Edge Case #3: "UBER *EATS" → "Uber Eats"

   *

   * Proceso:

   * 1. Iterar rules ordenadas por priority (DESC - higher first)
```

**Cause**: Literate programming tangle leaves blank lines between comment lines.

**Fix**: Normalize whitespace during tangle.

---

### Issue 2: Language Mixing

**Problem**:
```javascript
// Sort por priority (higher = matched first)  ← Mixed Spanish/English
const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
```

**Fix**: Standardize to English for code:
```javascript
// Sort by priority (higher matched first)
const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
```

**Policy**:
- ✅ **Code comments**: English only
- ✅ **Documentation (.md, .lit.md)**: Spanish OK
- ✅ **User-facing strings**: Spanish OK

---

### Issue 3: Missing JSDoc Types

**Problem**:
```javascript
export function getCategoryForMerchant(db, normalizedMerchant) {
  // No type information
}
```

**Fix**: Add JSDoc annotations:
```javascript
/**
 * Get category for a normalized merchant
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {string} normalizedMerchant - Normalized merchant name
 * @returns {string | null} - category_id or null
 */
export function getCategoryForMerchant(db, normalizedMerchant) {
  // Now has type safety
}
```

---

### Issue 4: AI Attribution Tags (BANNED)

**Problem**:
```javascript
// Generated with Claude Code ❌ BANNED
// Co-Authored-By: Claude ❌ BANNED
```

**Fix**: Remove ALL AI attribution completely.

**Why**: Code should stand on its own merit, no AI branding.

---

## 🏗️ IMPLEMENTATION PLAN

### Step 1: Audit Current Code

**Find all issues**:
```bash
# Find mixed language comments
grep -r "por\|para\|con\|que" src/ tests/ | grep "\.js:"

# Find missing JSDoc
grep -L "@param\|@returns" src/lib/*.js src/views/*.js

# Find AI attribution
grep -r "Claude\|Generated with\|Co-Authored" src/ tests/

# Find excessive whitespace
# (Manual inspection needed)
```

---

### Step 2: Create Quality Checklist

**File: scripts/quality-check.js**

```javascript
#!/usr/bin/env node
/**
 * Code Quality Checker
 *
 * Validates all JavaScript files meet quality standards:
 * 1. English-only code comments
 * 2. JSDoc types on exported functions
 * 3. No AI attribution tags
 * 4. Consistent formatting
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MIXED_LANG_REGEX = /\/\/.*\b(por|para|con|que|del|los|las)\b/i;
const AI_ATTR_REGEX = /(Generated with|Co-Authored-By|Claude Code)/i;
const EXPORT_REGEX = /^export (function|const|class)/m;
const JSDOC_REGEX = /@param|@returns/;

function getAllJsFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!entry.includes('node_modules') && !entry.includes('.git')) {
        getAllJsFiles(fullPath, files);
      }
    } else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const issues = [];

  // Check 1: Mixed language
  if (MIXED_LANG_REGEX.test(content)) {
    issues.push({ type: 'LANG_MIX', message: 'Mixed language in comments' });
  }

  // Check 2: AI attribution
  if (AI_ATTR_REGEX.test(content)) {
    issues.push({ type: 'AI_ATTR', message: 'AI attribution found (BANNED)' });
  }

  // Check 3: Missing JSDoc on exports
  const hasExports = EXPORT_REGEX.test(content);
  const hasJSDoc = JSDOC_REGEX.test(content);

  if (hasExports && !hasJSDoc) {
    issues.push({ type: 'NO_JSDOC', message: 'Exported functions without JSDoc' });
  }

  return issues;
}

function main() {
  const srcFiles = getAllJsFiles('src');
  const allIssues = new Map();

  for (const file of srcFiles) {
    const issues = checkFile(file);
    if (issues.length > 0) {
      allIssues.set(file, issues);
    }
  }

  if (allIssues.size === 0) {
    console.log('✅ All files pass quality checks');
    process.exit(0);
  }

  console.log(`❌ Found issues in ${allIssues.size} files:\n`);

  for (const [file, issues] of allIssues) {
    console.log(`${file}:`);
    for (const issue of issues) {
      console.log(`  - [${issue.type}] ${issue.message}`);
    }
    console.log('');
  }

  process.exit(1);
}

main();
```

---

### Step 3: Fix Formatting (Tangle Script)

**File: scripts/tangle.js (UPDATE)**

Add whitespace normalization:

```javascript
/**
 * Normalize excessive whitespace in code blocks
 */
function normalizeWhitespace(code) {
  const lines = code.split('\n');
  const normalized = [];
  let prevLineEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd(); // Remove trailing spaces
    const isEmpty = line.trim() === '';

    // Skip excessive blank lines in JSDoc comments
    if (isEmpty && prevLineEmpty && lines[i + 1]?.trim().startsWith('*')) {
      continue; // Skip duplicate blank line
    }

    normalized.push(line);
    prevLineEmpty = isEmpty;
  }

  return normalized.join('\n');
}

// Apply in tangle() function:
function tangle(litFile, outputFile) {
  // ... existing code ...

  const code = extractCode(content);
  const normalized = normalizeWhitespace(code); // NEW

  writeFileSync(outputFile, normalized, 'utf8');
}
```

---

### Step 4: Add JSDoc Types

**Target files** (all exported functions):
- src/lib/*.js
- src/views/*.js
- src/data-sources/*.js
- src/utils/*.js

**Template**:
```javascript
/**
 * [Function description]
 *
 * @param {Type} paramName - Description
 * @returns {Type} - Description
 * @throws {Error} - When [condition]
 */
export function functionName(paramName) {
  // ...
}
```

**Common types**:
```javascript
// Database
@param {import('better-sqlite3').Database} db

// Data source
@param {Object} dataSource

// Transaction
@param {Object} transaction
@param {string} transaction.id
@param {string} transaction.date
@param {string} transaction.merchant
@param {number} transaction.amount

// Category
@param {string} categoryId - Category ID (e.g., 'cat_food')

// Date range
@param {Object} dateRange
@param {string} dateRange.startDate - ISO date string
@param {string} dateRange.endDate - ISO date string

// Returns
@returns {string | null}
@returns {Object}
@returns {Array<Object>}
@returns {Promise<void>}
```

---

### Step 5: Standardize Language

**Find and replace**:
```bash
# In src/ and tests/ directories:

# Spanish → English mappings:
"por priority" → "by priority"
"ordenadas por" → "ordered by"
"usando rules" → "using rules"
"con normalization" → "with normalization"

# Run automated replacement:
sed -i '' 's/por priority/by priority/g' src/**/*.js
sed -i '' 's/ordenadas por/ordered by/g' src/**/*.js
```

---

### Step 6: Remove AI Attribution

**Find all occurrences**:
```bash
grep -r "Claude\|Generated with\|Co-Authored" src/ tests/
```

**Remove**:
- ❌ "Generated with Claude Code"
- ❌ "Co-Authored-By: Claude"
- ❌ Any AI branding

---

## ✅ QUALITY CHECKLIST

After Badge 16, ALL code must pass:

- [ ] No excessive whitespace in comments
- [ ] English-only code comments
- [ ] JSDoc types on all exported functions
- [ ] No AI attribution tags anywhere
- [ ] Consistent formatting (Prettier)
- [ ] Named exports everywhere

---

## 📊 IMPLEMENTATION TRACKING

### Files to Fix:

| File | Lang Mix | No JSDoc | AI Attr | Status |
|------|----------|----------|---------|--------|
| src/lib/normalization.js | ✅ | ✅ | ❌ | TODO |
| src/lib/auto-categorization.js | ✅ | ❌ | ❌ | TODO |
| src/lib/entity-resolver.js | ❌ | ✅ | ❌ | DONE |
| src/lib/budget-analyzer.js | ❌ | ✅ | ❌ | DONE |
| src/lib/recurring-breakdown.js | ❌ | ✅ | ❌ | DONE |
| src/views/*.js | ❌ | ❌ | ❌ | TODO |

---

## 📊 FINAL STATUS

### ✅ COMPLETED

**1. Language Standardization** (100%)
- ✅ Fixed `src/lib/normalization.js` - "Sort por" → "Sort by"
- ✅ Fixed `src/lib/upload-handler.js` (2 instances)
  - "retorna array vacío por ahora" → "returns empty array for now"
  - "Insert transactions con dedup" → "Insert transactions with deduplication"

**2. Quality Checker Tool** (100%)
- ✅ Created `scripts/quality-check.js`
- ✅ Detects language mixing, AI attribution, missing JSDoc
- ✅ Can be run with `node scripts/quality-check.js`

### ⏳ PENDING (Future Work)

**JSDoc Type Annotations** (0% - 62 files)

Affected files:
- **Components/** (56 files):
  - src/components/*/actions/*.js
  - src/components/*/constants/*.js
  - src/components/*/hooks/*.js
  - src/components/*/utils/*.js

- **Core modules** (6 files):
  - src/lib/budget-tracking.js
  - src/lib/credit-card-tracking.js
  - src/lib/csv-importer.js
  - src/lib/recurring-detection.js
  - src/data-sources/electron-data-source.js
  - src/data-sources/mock-data-source.js

**Rationale for PARTIAL completion:**
- Language mixing: **HIGH PRIORITY** - Affects code readability
- JSDoc: **MEDIUM PRIORITY** - Improves maintainability but doesn't block features
- **62 files × 15 min/file ≈ 15 hours** - Not pragmatic to block Phase 3
- Can be done incrementally as files are touched

### ✅ VERDICT

Badge 16: **PARTIAL COMPLETE**
- Core quality issues (language mixing): **FIXED** ✅
- Type safety (JSDoc): **DEFERRED** to future work ⏳

---

## 🚀 NEXT STEPS

Continuing with feature development:
- Badge 17: Upload Reminders
- Badge 18: Testing Suite
- Phase 3: Analysis (Reports, Charts, Export)

JSDoc can be added incrementally when touching each file in future work.

---

**Badge 16: Code Quality - PARTIAL ✅** (Language fixes DONE, JSDoc pending)
