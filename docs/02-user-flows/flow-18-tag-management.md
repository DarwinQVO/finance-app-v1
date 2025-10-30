# Flow 18: Tag Management (Organize & Clean Tags) 🏷️

**Phase**: 2 (Organization)
**Priority**: Low
**Complexity**: Low
**Related Flows**: flow-6, flow-7, flow-15

---

## 1. Funcionalidad

Tag management UI para organizar y limpiar tags con bulk operations.

**Problemas comunes después de 6 meses**:
- "work", "Work", "work-expense" → 3 tags, mismo significado
- "coffee", "coffee-shop", "café" → 3 tags, mismo significado
- Tags de un solo uso que ya no se necesitan
- Variaciones tipográficas ("trip-nyc", "trip-NYC")

**Operaciones disponibles**:
- Rename tags (updates all transactions)
- Merge tags (combine similar tags)
- Delete unused tags
- Bulk operations (select multiple)
- Smart merge suggestions

---

## 2. Implementación

**Solución**: **Tag Management Screen** - Dedicated UI for managing tags with bulk operations.

**Características clave**:
1. **View all tags** - List with usage count, last used date
2. **Rename tags** - Change "work" → "Work" (updates all transactions)
3. **Merge tags** - Combine "coffee" + "coffee-shop" → "coffee"
4. **Delete tags** - Remove unused/test tags
5. **Tag suggestions** - Smart suggestions for merging similar tags
6. **Bulk operations** - Select multiple tags and merge/delete

**UX Goal**: Cleaning up 47 tags → 20 organized tags should take < 5 minutes.

---

## 3. User Story: el usuario limpia sus tags

### Context
el usuario has been using Finance App for 6 months. He's added tags to ~400 transactions. Looking at his tag list, he realizes it's messy. Today he wants to clean it up.

### Narrative

**10:00 AM - el usuario abre Tag Management**

el usuario navega a Settings → Tags → **Manage Tags**.

```
┌─────────────────────────────────────────────────┐
│  Finance App                        [🔍] [⚙️] [+]│
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚙️  Settings                                    │
│                                                 │
│  🏷️  Tags                                        │
│  ├─ Manage Tags                 <- Selected     │
│  └─ Tag Rules (auto-tagging)                    │
│                                                 │
│  📤 Import / Export                             │
│  🔧 Preferences                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Tag Management Screen**

```
┌─────────────────────────────────────────────────┐
│  🏷️  Manage Tags                   [+ New Tag]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Total: 47 tags • 412 transactions tagged       │
│                                                 │
│  [🔍 Search tags...]            Sort: Usage ▼   │
│                                                 │
│  ⚠️  Suggestions (3):                           │
│  • Merge "work", "Work", "work-expense"         │
│  • Merge "coffee", "coffee-shop", "café"        │
│  • Delete 5 unused tags (0 transactions)        │
│                                   [Review All]  │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ Tag Name          Used  Last Used    Actions││
│  ├─────────────────────────────────────────────┤│
│  │ 🏢 work            89   Today        [•••]  ││
│  │ 🏢 Work            12   Oct 15       [•••]  ││ <- Duplicate!
│  │ 🏢 work-expense     8   Sep 20       [•••]  ││ <- Duplicate!
│  │                                             ││
│  │ ☕ coffee          24   Today        [•••]  ││
│  │ ☕ coffee-shop      7   Oct 10       [•••]  ││ <- Similar
│  │ ☕ café             3   Aug 5        [•••]  ││ <- Similar
│  │                                             ││
│  │ ✈️ travel          42   Oct 28       [•••]  ││
│  │ ✈️ trip-nyc         8   Sep 1        [•••]  ││
│  │ ✈️ trip-sf          5   Jul 15       [•••]  ││
│  │                                             ││
│  │ 🍔 food            18   Oct 29       [•••]  ││
│  │ 🎁 gift             9   Oct 20       [•••]  ││
│  │ 🏥 health           6   Oct 10       [•••]  ││
│  │                                             ││
│  │ ⚠️  test             1   May 2        [•••]  ││ <- Unused
│  │ ⚠️  temp             0   Never        [•••]  ││ <- Unused
│  │                                             ││
│  │ ... (34 more)                               ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

el usuario ve las sugerencias en la parte superior. Decide empezar con el merge de "work" tags.

**Step 1: Merge "work" tags**

el usuario click "Review All" en sugerencias, ve el primer suggestion:

```
┌───────────────────────────────────────────┐
│  🔧 Merge Similar Tags               [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Suggestion: Merge work-related tags      │
│                                           │
│  These tags appear to be duplicates:      │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ Tag            Used  Last Used      │ │
│  ├─────────────────────────────────────┤ │
│  │ ☑ work          89   Today          │ │ <- Keep this (most used)
│  │ ☑ Work          12   Oct 15         │ │
│  │ ☑ work-expense   8   Sep 20         │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Merge into:                              │
│  ┌─────────────────────────────────────┐ │
│  │ work                              ▼ │ │ <- Auto-selected (most used)
│  └─────────────────────────────────────┘ │
│  ↳ or create new: ┌──────────────────┐  │
│                    │                  │  │
│                    └──────────────────┘  │
│                                           │
│  This will:                               │
│  • Update 109 transactions                │
│  • Change all "Work" → "work"             │
│  • Change all "work-expense" → "work"     │
│  • Delete tags "Work" and "work-expense"  │
│                                           │
│  ⚠️  This action cannot be undone.        │
│                                           │
│         [Skip]  [Cancel]  [Merge Tags]    │
└───────────────────────────────────────────┘
```

el usuario click "Merge Tags".

**Result**: 3 tags → 1 tag, 109 transactions updated.

```
Success toast:
┌────────────────────────────────────┐
│ ✅ Merged 3 tags into "work"       │
│ Updated 109 transactions           │
└────────────────────────────────────┘
```

**Step 2: Merge "coffee" tags**

Next suggestion appears automatically:

```
┌───────────────────────────────────────────┐
│  🔧 Merge Similar Tags               [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Suggestion: Merge coffee-related tags    │
│                                           │
│  These tags appear to be similar:         │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ Tag            Used  Last Used      │ │
│  ├─────────────────────────────────────┤ │
│  │ ☑ coffee        24   Today          │ │ <- Most used
│  │ ☑ coffee-shop    7   Oct 10         │ │
│  │ ☑ café           3   Aug 5          │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Merge into:                              │
│  ┌─────────────────────────────────────┐ │
│  │ coffee                            ▼ │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  This will update 34 transactions.        │
│                                           │
│         [Skip]  [Cancel]  [Merge Tags]    │
└───────────────────────────────────────────┘
```

el usuario click "Merge Tags" again.

**Step 3: Delete unused tags**

```
┌───────────────────────────────────────────┐
│  🗑️  Delete Unused Tags              [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  5 tags have never been used or were used │
│  only once and not recently:              │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ Tag         Used  Last Used         │ │
│  ├─────────────────────────────────────┤ │
│  │ ☑ test       1    May 2 (6 mo ago) │ │
│  │ ☑ temp       0    Never             │ │
│  │ ☑ delete-me  0    Never             │ │
│  │ ☑ asdf       1    Jan 15 (9 mo ago)│ │
│  │ ☑ zzz        0    Never             │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Delete these tags?                       │
│  (2 transactions will lose their tags)    │
│                                           │
│  ⚠️  This action cannot be undone.        │
│                                           │
│       [Keep All]  [Cancel]  [Delete Tags] │
└───────────────────────────────────────────┘
```

el usuario click "Delete Tags".

**Result**: Tag list is now clean. 47 tags → 39 tags.

```
┌─────────────────────────────────────────────────┐
│  🏷️  Manage Tags                   [+ New Tag]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Total: 39 tags • 412 transactions tagged       │
│                                                 │
│  ✅ All suggestions resolved!                   │
│                                                 │
│  [🔍 Search tags...]            Sort: Usage ▼   │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ Tag Name          Used  Last Used    Actions││
│  ├─────────────────────────────────────────────┤│
│  │ 🏢 work           109   Today        [•••]  ││ <- Cleaned!
│  │ ☕ coffee          34   Today        [•••]  ││ <- Cleaned!
│  │ ✈️ travel          42   Oct 28       [•••]  ││
│  │ 🍔 food            18   Oct 29       [•••]  ││
│  │ 🎁 gift             9   Oct 20       [•••]  ││
│  │ 🏥 health           6   Oct 10       [•••]  ││
│  │ ... (33 more)                               ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

**Total time**: 3 minutes. el usuario's tags are now organized and consistent.

---

## 4. UI Mockups

### 4.1 Tag Management Screen (Initial State)

```
┌─────────────────────────────────────────────────┐
│  🏷️  Manage Tags                   [+ New Tag]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Total: 47 tags • 412 transactions tagged       │
│                                                 │
│  [🔍 Search tags...]            Sort: Usage ▼   │
│  ☐ Select All                                   │
│                                                 │
│  ⚠️  Suggestions (3):                           │
│  • Merge "work", "Work", "work-expense" (109 txns)│
│  • Merge "coffee", "coffee-shop", "café" (34 txns)│
│  • Delete 5 unused tags                         │
│                             [Review All]  [Dismiss]│
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ ☐  Tag Name       Used  Last Used   Actions ││
│  ├─────────────────────────────────────────────┤│
│  │ ☐  🏢 work         89   Today        [•••]  ││
│  │ ☐  🏢 Work         12   Oct 15       [•••]  ││
│  │ ☐  🏢 work-exp...   8   Sep 20       [•••]  ││
│  │    ⚠️  Similar to "work"                     ││
│  │                                             ││
│  │ ☐  ☕ coffee       24   Today        [•••]  ││
│  │ ☐  ☕ coffee-s...   7   Oct 10       [•••]  ││
│  │    ⚠️  Similar to "coffee"                   ││
│  │                                             ││
│  │ ☐  ✈️ travel       42   Oct 28       [•••]  ││
│  │ ☐  🍔 food         18   Oct 29       [•••]  ││
│  │ ☐  🎁 gift          9   Oct 20       [•••]  ││
│  │                                             ││
│  │ ... (38 more)                               ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Bulk Actions (0 selected):                     │
│  [Merge Selected]  [Delete Selected]            │
└─────────────────────────────────────────────────┘
```

### 4.2 Tag Actions Menu

```
Click [...] menu:
┌─────────────────────┐
│ ✏️  Rename           │
│ 🔗 Merge with...     │
│ 🗑️  Delete           │
│ ───────────────────│
│ 📊 View Transactions│ <- Shows all txns with this tag
│ 📋 Copy Name        │
└─────────────────────┘
```

### 4.3 Rename Tag Dialog

```
┌───────────────────────────────────────────┐
│  ✏️  Rename Tag                      [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Rename "Work" to:                        │
│  ┌─────────────────────────────────────┐ │
│  │ work                                │ │ <- Auto-lowercased
│  └─────────────────────────────────────┘ │
│                                           │
│  💡 Tip: Use lowercase for consistency    │
│                                           │
│  This will update 12 transactions.        │
│                                           │
│  ⚠️  Another tag named "work" already     │
│     exists (89 transactions).             │
│                                           │
│  Options:                                 │
│  ○ Rename to "work" (merge with existing) │
│  ○ Choose different name                  │
│                                           │
│            [Cancel]  [Rename & Merge]     │
└───────────────────────────────────────────┘
```

### 4.4 Merge Tags Dialog (Manual)

```
┌───────────────────────────────────────────┐
│  🔗 Merge Tags                       [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Select tags to merge:                    │
│  ┌─────────────────────────────────────┐ │
│  │ ☑ work          (89 transactions)   │ │
│  │ ☑ Work          (12 transactions)   │ │
│  │ ☑ work-expense  (8 transactions)    │ │
│  └─────────────────────────────────────┘ │
│                         [+ Add More Tags] │
│                                           │
│  Merge into:                              │
│  ┌─────────────────────────────────────┐ │
│  │ work                              ▼ │ │
│  └─────────────────────────────────────┘ │
│  ↳ or create new: ┌──────────────────┐  │
│                    │ work-related     │  │
│                    └──────────────────┘  │
│                                           │
│  Preview:                                 │
│  • 109 transactions will be updated       │
│  • Tags "Work" and "work-expense" will be │
│    deleted                                │
│  • All references will point to "work"    │
│                                           │
│  ⚠️  This action cannot be undone.        │
│                                           │
│            [Cancel]  [Merge Tags]         │
└───────────────────────────────────────────┘
```

### 4.5 Delete Tag Confirmation

```
┌───────────────────────────────────────────┐
│  🗑️  Delete Tag                      [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Are you sure you want to delete "test"?  │
│                                           │
│  This tag is used in 1 transaction:       │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ May 2   Test Transaction   $10.00  │ │
│  │         ☕ Coffee • 💳 Chase • test  │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Options:                                 │
│  ○ Remove tag from transaction            │
│  ○ Replace with: ┌──────────────────┐    │
│                   │ Select tag...  ▼│    │
│                   └──────────────────┘    │
│                                           │
│  ⚠️  This action cannot be undone.        │
│                                           │
│            [Cancel]  [Delete Tag]         │
└───────────────────────────────────────────┘
```

### 4.6 Bulk Merge (Multiple Tags Selected)

```
3 tags selected:
┌─────────────────────────────────────────────────┐
│  Bulk Actions (3 selected):                     │
│  [Merge Selected]  [Delete Selected]            │
└─────────────────────────────────────────────────┘

Click "Merge Selected":
┌───────────────────────────────────────────┐
│  🔗 Merge 3 Tags                     [×]  │
│  ─────────────────────────────────────────│
│                                           │
│  Merging:                                 │
│  • work (89 txns)                         │
│  • Work (12 txns)                         │
│  • work-expense (8 txns)                  │
│                                           │
│  Merge into:                              │
│  ┌─────────────────────────────────────┐ │
│  │ work                              ▼ │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Total transactions affected: 109         │
│                                           │
│            [Cancel]  [Merge Tags]         │
└───────────────────────────────────────────┘
```

---

## 5. Technical Implementation

### 5.1 Data Model

Tags are stored as JSON arrays in the `transactions` table:

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  -- ... other fields ...
  tags TEXT, -- JSON array: ["work", "coffee", "important"]
  -- ... other fields ...
);

-- No separate tags table (LEGO principle - simple storage)

-- Full-text search index for tags
CREATE INDEX idx_tags_fts ON transactions(tags);
```

### 5.2 Tag Statistics Query

```javascript
// main/api/getTagStatistics.js
const db = require('../database');

async function getTagStatistics() {
  // Get all tags from all transactions
  const txns = await db.all('SELECT tags, date FROM transactions WHERE tags IS NOT NULL AND tags != "[]"');

  const tagStats = new Map();

  txns.forEach(txn => {
    const tags = JSON.parse(txn.tags);
    tags.forEach(tag => {
      if (!tagStats.has(tag)) {
        tagStats.set(tag, {
          name: tag,
          count: 0,
          lastUsed: null
        });
      }

      const stats = tagStats.get(tag);
      stats.count++;

      if (!stats.lastUsed || txn.date > stats.lastUsed) {
        stats.lastUsed = txn.date;
      }
    });
  });

  // Convert to array and sort by usage
  return Array.from(tagStats.values()).sort((a, b) => b.count - a.count);
}

module.exports = { getTagStatistics };
```

### 5.3 Smart Tag Suggestions

```javascript
// main/api/getSuggestedMerges.js
const stringSimilarity = require('string-similarity');

async function getSuggestedMerges() {
  const tags = await getTagStatistics();
  const suggestions = [];

  // Group similar tags
  const tagNames = tags.map(t => t.name);

  for (let i = 0; i < tagNames.length; i++) {
    const tag1 = tagNames[i];
    const similarTags = [];

    for (let j = i + 1; j < tagNames.length; j++) {
      const tag2 = tagNames[j];

      // Check similarity
      const similarity = stringSimilarity.compareTwoStrings(
        tag1.toLowerCase(),
        tag2.toLowerCase()
      );

      // Threshold: 0.7 = similar (e.g., "coffee" vs "coffee-shop")
      if (similarity >= 0.7) {
        similarTags.push(tag2);
      }
    }

    if (similarTags.length > 0) {
      suggestions.push({
        type: 'merge',
        tags: [tag1, ...similarTags],
        reason: 'Similar names detected'
      });
    }
  }

  // Suggest deleting unused tags
  const unusedTags = tags.filter(t => t.count === 0 || (t.count === 1 && isOld(t.lastUsed)));

  if (unusedTags.length > 0) {
    suggestions.push({
      type: 'delete',
      tags: unusedTags.map(t => t.name),
      reason: 'Never or rarely used'
    });
  }

  return suggestions;
}

function isOld(date) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return new Date(date) < sixMonthsAgo;
}

module.exports = { getSuggestedMerges };
```

### 5.4 Merge Tags

```javascript
// main/api/mergeTags.js
async function mergeTags({ sourceTags, targetTag }) {
  // Get all transactions with any of the source tags
  const txns = await db.all(`
    SELECT id, tags FROM transactions
    WHERE tags IS NOT NULL AND tags != "[]"
  `);

  let updatedCount = 0;

  for (const txn of txns) {
    const tags = JSON.parse(txn.tags);
    let modified = false;

    // Replace any source tag with target tag
    const newTags = tags.map(tag => {
      if (sourceTags.includes(tag)) {
        modified = true;
        return targetTag;
      }
      return tag;
    });

    // Remove duplicates (if target tag already existed)
    const uniqueTags = [...new Set(newTags)];

    if (modified) {
      await db.run(
        'UPDATE transactions SET tags = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(uniqueTags), new Date().toISOString(), txn.id]
      );
      updatedCount++;
    }
  }

  return { updatedCount };
}

module.exports = { mergeTags };
```

### 5.5 Rename Tag

```javascript
// main/api/renameTag.js
async function renameTag({ oldName, newName }) {
  // Check if newName already exists
  const existingTags = await getTagStatistics();
  const nameExists = existingTags.some(t => t.name === newName);

  if (nameExists && oldName !== newName) {
    // Merge instead of rename
    return mergeTags({ sourceTags: [oldName], targetTag: newName });
  }

  // Simple rename (no conflicts)
  const txns = await db.all('SELECT id, tags FROM transactions WHERE tags IS NOT NULL');

  let updatedCount = 0;

  for (const txn of txns) {
    const tags = JSON.parse(txn.tags);

    if (tags.includes(oldName)) {
      const newTags = tags.map(t => (t === oldName ? newName : t));

      await db.run(
        'UPDATE transactions SET tags = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(newTags), new Date().toISOString(), txn.id]
      );
      updatedCount++;
    }
  }

  return { updatedCount };
}

module.exports = { renameTag };
```

### 5.6 Delete Tag

```javascript
// main/api/deleteTag.js
async function deleteTag({ tagName, replaceWith = null }) {
  const txns = await db.all('SELECT id, tags FROM transactions WHERE tags IS NOT NULL');

  let updatedCount = 0;

  for (const txn of txns) {
    const tags = JSON.parse(txn.tags);

    if (tags.includes(tagName)) {
      let newTags;

      if (replaceWith) {
        // Replace with another tag
        newTags = tags.map(t => (t === tagName ? replaceWith : t));
      } else {
        // Remove tag
        newTags = tags.filter(t => t !== tagName);
      }

      await db.run(
        'UPDATE transactions SET tags = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(newTags), new Date().toISOString(), txn.id]
      );
      updatedCount++;
    }
  }

  return { updatedCount };
}

module.exports = { deleteTag };
```

---

## 6. Edge Cases & Solutions

### 6.1 Merging Tags with Same Name (Case Sensitivity)

**Case**: "work" and "Work" should be merged

**Solution**:
- Detect case-only differences as merge candidates
- Auto-suggest merge with lowercase version as target
- Show warning: "Merging 'Work' → 'work' for consistency"

---

### 6.2 Tag Still in Use (Delete Protection)

**Case**: User tries to delete "work" tag used in 89 transactions

**Solution**:
- Show confirmation dialog with transaction count
- Offer options: "Remove tag" or "Replace with another tag"
- Require explicit confirmation (can't accidentally delete high-usage tags)

---

### 6.3 Circular Merge

**Case**: User tries to merge "A" → "B", then "B" → "A"

**Solution**:
- Not possible because first merge deletes tag "A"
- No special handling needed (can't happen)

---

### 6.4 Performance with Large Transaction Count

**Case**: User has 50,000 transactions, merging tags takes 30 seconds

**Solution**:
- Show progress bar during bulk operations
- Process in batches of 1,000 transactions
- Allow cancel during operation

**Code**:
```javascript
async function mergeTags({ sourceTags, targetTag, onProgress }) {
  const txns = await db.all('SELECT id, tags FROM transactions WHERE tags IS NOT NULL');
  const batchSize = 1000;

  for (let i = 0; i < txns.length; i += batchSize) {
    const batch = txns.slice(i, i + batchSize);

    // Process batch...

    onProgress({ current: i + batch.length, total: txns.length });
  }
}
```

---

### 6.5 Tag Name Conflicts

**Case**: User renames "Work" → "work", but "work" already exists

**Solution**:
- Detect conflict automatically
- Show dialog: "Tag 'work' already exists. Merge instead?"
- Auto-switch to merge flow

---

### 6.6 Undo Tag Operations

**Case**: User accidentally merged wrong tags, wants to undo

**Solution** (Phase 5 - future):
- Keep operation history in `tag_operations` table
- Show "Undo" button for last 5 operations
- Undo reverts changes to transactions

**Code**:
```sql
CREATE TABLE tag_operations (
  id TEXT PRIMARY KEY,
  operation TEXT, -- 'merge', 'rename', 'delete'
  source_tags TEXT, -- JSON
  target_tag TEXT,
  affected_txn_ids TEXT, -- JSON array of affected transaction IDs
  created_at TEXT,
  can_undo BOOLEAN DEFAULT 1
);
```

---

## 7. Summary

### What This Flow Covers

✅ **View all tags** with usage statistics
✅ **Rename tags** (updates all transactions)
✅ **Merge tags** (combine similar tags)
✅ **Delete tags** (with safety checks)
✅ **Smart suggestions** for merging/deleting
✅ **Bulk operations** (select multiple tags)
✅ **Conflict detection** (duplicate names, case sensitivity)

### Scope Boundaries

**In Scope**:
- Manage tags across all transactions
- Merge/rename/delete operations
- Smart suggestions for cleanup
- Bulk operations

**Out of Scope** (future):
- Undo tag operations (Phase 5)
- Tag hierarchies (parent/child tags)
- Tag colors/icons
- Auto-tagging rules (see flow-7)

### Impact on Other Flows

- **flow-6** (Edit Transaction): Tag management affects which tags appear in tag picker
- **flow-7** (Categories): Tags are orthogonal to categories (both can be used)
- **flow-15** (Manual Entry): Cleaner tags → easier to select correct tag

### Why This Flow is Important

Without tag management:
- Tags proliferate and become messy
- Inconsistencies reduce usefulness
- el usuario stops using tags → loses metadata

With tag management:
- Tags stay clean and organized
- Easy to find and use correct tags
- Tags remain valuable metadata layer

**Result**: Tags remain useful organizational tool over time, not just initial experiment.

---

**Lines of Code**: ~450 (statistics + suggestions + merge/rename/delete)
**Testing Priority**: Low (nice-to-have, not critical)
**Dependencies**: flow-6 (transaction editing), flow-7 (tag usage)
**Phase**: 2 (nice-to-have, improves long-term UX)
