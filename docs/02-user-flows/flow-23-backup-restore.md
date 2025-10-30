# Flow 23: Backup & Restore 💾

**Phase**: 1 (Core)
**Priority**: Critical
**Complexity**: Medium
**Related Flows**: flow-12 (export), flow-16 (CSV import)

---

## 1. Funcionalidad

Sistema completo de backup y restore para proteger data contra pérdida.

**Capacidades**:
1. **Full backup** - Export completo de toda la database
2. **Restore** - Import backup en dispositivo nuevo/limpio
3. **Migration** - Transferir data entre dispositivos
4. **Partial backup** - Export solo date range específico
5. **Automated backups** - Backup automático semanal (opcional)
6. **Backup verification** - Validar integridad de backup

**Formatos**:
- **JSON** (human-readable, portable)
- **SQLite DB** (direct database copy)

---

## 2. Implementación

### Backup Schema

```javascript
// Backup file structure
{
  version: '1.0.0',  // Finance App version
  created_at: '2025-10-29T15:30:00Z',
  device: 'MacBook Pro - Darwin',

  metadata: {
    total_transactions: 12340,
    date_range: {
      from: '2023-01-01',
      to: '2025-10-29'
    },
    accounts: 4,
    categories: 23,
    tags: 47
  },

  data: {
    accounts: [...],
    transactions: [...],
    categories: [...],
    tags: [...],
    budgets: [...],
    recurring: [...],
    normalization_rules: [...],
    user_settings: {...},
    balance_checks: [...],
    saved_filters: [...]
  }
}
```

### Full Backup Export

```javascript
async function createFullBackup() {
  const backup = {
    version: APP_VERSION,
    created_at: new Date().toISOString(),
    device: `${os.hostname()} - ${os.userInfo().username}`,
    metadata: await getBackupMetadata(),
    data: {}
  };

  // Export all tables
  const tables = [
    'accounts',
    'transactions',
    'categories',
    'tags',
    'transaction_tags',
    'budgets',
    'recurring_transactions',
    'normalization_rules',
    'balance_checks',
    'saved_filters',
    'user_settings'
  ];

  for (const table of tables) {
    backup.data[table] = await db.all(`SELECT * FROM ${table}`);
  }

  return backup;
}
```

### Metadata Calculation

```javascript
async function getBackupMetadata() {
  const stats = await db.get(`
    SELECT
      COUNT(*) as total_transactions,
      MIN(date) as min_date,
      MAX(date) as max_date
    FROM transactions
  `);

  const accounts = await db.get('SELECT COUNT(*) as count FROM accounts');
  const categories = await db.get('SELECT COUNT(*) as count FROM categories');
  const tags = await db.get('SELECT COUNT(*) as count FROM tags');

  return {
    total_transactions: stats.total_transactions,
    date_range: {
      from: stats.min_date,
      to: stats.max_date
    },
    accounts: accounts.count,
    categories: categories.count,
    tags: tags.count
  };
}
```

### Save to File

```javascript
async function saveBackup(backup, filepath) {
  // Compress JSON for smaller file size
  const json = JSON.stringify(backup, null, 2);
  const compressed = await gzip(json);

  // Save with .finbak extension
  await fs.writeFile(filepath, compressed);

  return {
    path: filepath,
    size: compressed.length,
    checksum: calculateChecksum(compressed)
  };
}
```

---

## 3. User Story: Create backup before migration

### Escena 1: Export backup

Usuario va a Settings → Backup & Restore

```
┌─────────────────────────────────────────────┐
│  💾 Backup & Restore                        │
├─────────────────────────────────────────────┤
│                                             │
│  Last backup: Oct 22, 2025 (7 days ago) ⚠️  │
│                                             │
│  Current data:                              │
│  • 12,340 transactions                      │
│  • 4 accounts                               │
│  • Date range: Jan 2023 - Oct 2025          │
│  • Database size: 8.4 MB                    │
│                                             │
│  [Create Full Backup]                       │
│  [Create Partial Backup...]                 │
│                                             │
│  ────────────────────────────────────────   │
│                                             │
│  Automatic Backups:                         │
│  ○ Disabled                                 │
│  ○ Weekly (recommended)                     │
│  ○ Daily                                    │
│                                             │
│  Backup location:                           │
│  ~/Documents/Finance App Backups/           │
│  [Change...]                                │
└─────────────────────────────────────────────┘
```

Usuario click "Create Full Backup".

### Escena 2: Backup progress

```
┌─────────────────────────────────────────────┐
│  Creating Backup...                         │
├─────────────────────────────────────────────┤
│                                             │
│  ✓ Exporting accounts (4)                   │
│  ✓ Exporting transactions (12,340)          │
│  ✓ Exporting categories (23)                │
│  ⏳ Compressing data...                      │
│                                             │
│  ████████████████░░░░  80%                  │
└─────────────────────────────────────────────┘
```

### Escena 3: Backup created

```
┌─────────────────────────────────────────────┐
│  ✅ Backup Created Successfully             │
├─────────────────────────────────────────────┤
│                                             │
│  File: finance-app-backup-2025-10-29.finbak │
│  Size: 2.1 MB (compressed)                  │
│  Location: ~/Documents/Finance App Backups/ │
│                                             │
│  Contains:                                  │
│  • 12,340 transactions                      │
│  • 4 accounts                               │
│  • 23 categories                            │
│  • 47 tags                                  │
│  • 8 budgets                                │
│  • All settings and rules                   │
│                                             │
│  [Show in Finder]  [Close]                  │
└─────────────────────────────────────────────┘
```

Usuario copia archivo a USB drive.

---

## 4. User Story: Restore on new device

### Escena 1: New installation

Usuario instala Finance App en laptop nueva. App está vacía.

```
┌─────────────────────────────────────────────┐
│  Welcome to Finance App! 👋                 │
├─────────────────────────────────────────────┤
│                                             │
│  Get started:                               │
│                                             │
│  ○ Start fresh                              │
│    Create new database from scratch         │
│                                             │
│  ● Restore from backup                      │
│    Import your existing data                │
│                                             │
│  [Continue →]                               │
└─────────────────────────────────────────────┘
```

Usuario selecciona "Restore from backup" → Click Continue.

### Escena 2: Select backup file

```
┌─────────────────────────────────────────────┐
│  Select Backup File                         │
├─────────────────────────────────────────────┤
│                                             │
│  Choose a .finbak backup file:              │
│                                             │
│  [Browse Files...]                          │
│                                             │
│  Or drag and drop backup file here          │
│                                             │
└─────────────────────────────────────────────┘
```

Usuario selecciona `finance-app-backup-2025-10-29.finbak`.

### Escena 3: Backup validation

```
┌─────────────────────────────────────────────┐
│  Validating Backup...                       │
├─────────────────────────────────────────────┤
│                                             │
│  ✓ File format valid                        │
│  ✓ Checksum verified                        │
│  ✓ Version compatible (1.0.0)               │
│                                             │
│  Backup contains:                           │
│  • 12,340 transactions                      │
│  • 4 accounts (BofA, Apple Card, Wise, ...)│
│  • Date range: Jan 1, 2023 - Oct 29, 2025  │
│  • 23 categories, 47 tags                   │
│                                             │
│  [Restore This Backup]  [Cancel]            │
└─────────────────────────────────────────────┘
```

Usuario click "Restore This Backup".

### Escena 4: Restore progress

```
┌─────────────────────────────────────────────┐
│  Restoring Backup...                        │
├─────────────────────────────────────────────┤
│                                             │
│  ✓ Decompressing data                       │
│  ✓ Creating database                        │
│  ✓ Importing accounts (4/4)                 │
│  ⏳ Importing transactions (8,234/12,340)    │
│                                             │
│  ██████████████░░░░░░  67%                  │
│                                             │
│  Do not close this window...                │
└─────────────────────────────────────────────┘
```

### Escena 5: Restore complete

```
┌─────────────────────────────────────────────┐
│  ✅ Restore Complete!                       │
├─────────────────────────────────────────────┤
│                                             │
│  Successfully restored:                     │
│  ✓ 12,340 transactions                      │
│  ✓ 4 accounts                               │
│  ✓ 23 categories                            │
│  ✓ 47 tags                                  │
│  ✓ 8 budgets                                │
│  ✓ All settings and rules                   │
│                                             │
│  Your Finance App is ready to use!          │
│                                             │
│  [Open Timeline]                            │
└─────────────────────────────────────────────┘
```

**Todo restaurado perfectamente** ✅

---

## 5. Restore Logic

### Database Creation

```javascript
async function restoreFromBackup(backupPath) {
  // 1. Validate backup
  const backup = await validateBackup(backupPath);

  // 2. Create fresh database
  await createDatabase();

  // 3. Restore tables in order (respecting foreign keys)
  const restoreOrder = [
    'accounts',           // No dependencies
    'categories',         // No dependencies
    'tags',              // No dependencies
    'transactions',      // Depends on accounts
    'transaction_tags',  // Depends on transactions + tags
    'budgets',           // Depends on categories
    'recurring_transactions',
    'normalization_rules',
    'balance_checks',
    'saved_filters',
    'user_settings'
  ];

  for (const table of restoreOrder) {
    await restoreTable(table, backup.data[table]);
  }

  // 4. Verify integrity
  await verifyRestore(backup);

  return {
    success: true,
    transactions_restored: backup.data.transactions.length,
    accounts_restored: backup.data.accounts.length
  };
}
```

### Table Restore

```javascript
async function restoreTable(tableName, rows) {
  if (!rows || rows.length === 0) return;

  // Batch insert for performance
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await db.run('BEGIN TRANSACTION');

    for (const row of batch) {
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map(() => '?').join(', ');
      const values = Object.values(row);

      await db.run(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
        values
      );
    }

    await db.run('COMMIT');
  }
}
```

### Integrity Verification

```javascript
async function verifyRestore(backup) {
  const errors = [];

  // Check transaction counts match
  const txnCount = await db.get('SELECT COUNT(*) as count FROM transactions');
  if (txnCount.count !== backup.data.transactions.length) {
    errors.push(`Transaction count mismatch: ${txnCount.count} vs ${backup.data.transactions.length}`);
  }

  // Check account counts
  const accCount = await db.get('SELECT COUNT(*) as count FROM accounts');
  if (accCount.count !== backup.data.accounts.length) {
    errors.push(`Account count mismatch`);
  }

  // Check foreign key integrity
  const fkCheck = await db.all('PRAGMA foreign_key_check');
  if (fkCheck.length > 0) {
    errors.push('Foreign key violations detected');
  }

  if (errors.length > 0) {
    throw new Error(`Restore verification failed: ${errors.join(', ')}`);
  }

  return { valid: true };
}
```

---

## 6. Partial Backup

### Date range selection

```
┌─────────────────────────────────────────────┐
│  Create Partial Backup                      │
├─────────────────────────────────────────────┤
│                                             │
│  Date range:                                │
│  From: [Jan 1, 2025  ▾]                     │
│  To:   [Oct 29, 2025 ▾]                     │
│                                             │
│  Include:                                   │
│  ☑ Transactions (8,234)                     │
│  ☑ Related accounts (3)                     │
│  ☑ Categories used (18)                     │
│  ☑ Tags used (32)                           │
│  ☐ All budgets (may reference older data)  │
│                                             │
│  Estimated size: 1.2 MB                     │
│                                             │
│  [Create Backup]  [Cancel]                  │
└─────────────────────────────────────────────┘
```

### Use case

Tax season: Export solo 2024 transactions para enviar a contador.

```javascript
async function createPartialBackup(fromDate, toDate) {
  const transactions = await db.all(`
    SELECT * FROM transactions
    WHERE date >= ? AND date <= ?
  `, [fromDate, toDate]);

  // Get only referenced accounts
  const accountIds = [...new Set(transactions.map(t => t.account_id))];
  const accounts = await db.all(`
    SELECT * FROM accounts WHERE id IN (${accountIds.map(() => '?').join(',')})
  `, accountIds);

  return {
    version: APP_VERSION,
    type: 'partial',
    date_range: { from: fromDate, to: toDate },
    data: {
      accounts,
      transactions,
      // ... only referenced data
    }
  };
}
```

---

## 7. Automated Backups

### Configuration

```javascript
// User enables weekly backups
const backupConfig = {
  enabled: true,
  frequency: 'weekly',  // 'daily' | 'weekly' | 'monthly'
  location: '~/Documents/Finance App Backups/',
  retention: 4  // Keep last 4 backups
};
```

### Scheduler

```javascript
// Check daily if backup needed
async function checkAutomatedBackup() {
  const lastBackup = await getLastBackupDate();
  const config = await getBackupConfig();

  if (!config.enabled) return;

  const daysSinceBackup = daysBetween(lastBackup, new Date());

  const needsBackup =
    (config.frequency === 'daily' && daysSinceBackup >= 1) ||
    (config.frequency === 'weekly' && daysSinceBackup >= 7) ||
    (config.frequency === 'monthly' && daysSinceBackup >= 30);

  if (needsBackup) {
    await createAutomatedBackup(config);
  }
}
```

### Retention Policy

```javascript
async function cleanOldBackups(config) {
  const backupFiles = await fs.readdir(config.location);
  const sorted = backupFiles
    .filter(f => f.endsWith('.finbak'))
    .sort()
    .reverse();

  // Keep only last N backups
  const toDelete = sorted.slice(config.retention);

  for (const file of toDelete) {
    await fs.unlink(path.join(config.location, file));
  }
}
```

---

## 8. Edge Cases

### Edge case 1: Corrupted backup

**Scenario**: Backup file damaged or incomplete.

**Detection**:
```javascript
async function validateBackup(backupPath) {
  const data = await fs.readFile(backupPath);

  // Check file signature
  if (!data.toString().startsWith('{')) {
    throw new Error('Invalid backup format');
  }

  // Verify checksum
  const backup = JSON.parse(data);
  if (backup.checksum && calculateChecksum(data) !== backup.checksum) {
    throw new Error('Backup checksum mismatch - file may be corrupted');
  }

  return backup;
}
```

**UI**:
```
┌─────────────────────────────────────────────┐
│  ❌ Backup Validation Failed                │
├─────────────────────────────────────────────┤
│  The backup file appears to be corrupted.   │
│                                             │
│  Error: Checksum mismatch                   │
│                                             │
│  Try:                                       │
│  • Use a different backup file              │
│  • Re-download from cloud storage           │
│  • Contact support if issue persists        │
└─────────────────────────────────────────────┘
```

### Edge case 2: Version incompatibility

**Scenario**: Backup from Finance App v2.0, current app is v1.5.

**Solution**: Version migration scripts.

```javascript
function migrateBackup(backup, targetVersion) {
  const migrations = {
    '1.0.0': migrate_1_0_to_1_1,
    '1.1.0': migrate_1_1_to_2_0,
    // ...
  };

  let current = backup.version;
  while (current !== targetVersion) {
    const migrator = migrations[current];
    if (!migrator) {
      throw new Error(`No migration path from ${current} to ${targetVersion}`);
    }
    backup = migrator(backup);
    current = backup.version;
  }

  return backup;
}
```

### Edge case 3: Merge vs Replace

**Scenario**: User has data in app, wants to restore backup.

**Options**:
```
┌─────────────────────────────────────────────┐
│  ⚠️  Existing Data Found                    │
├─────────────────────────────────────────────┤
│  You already have 234 transactions in the   │
│  app. How would you like to restore?        │
│                                             │
│  ○ Replace (delete existing + restore)      │
│    All current data will be lost            │
│                                             │
│  ○ Merge (keep existing + add backup)       │
│    May create duplicates if same data       │
│                                             │
│  [Continue]  [Cancel]                       │
└─────────────────────────────────────────────┘
```

Most users want **Replace**.

### Edge case 4: Insufficient disk space

**Check before restore**:
```javascript
async function checkDiskSpace(backupSize) {
  const free = await getDiskFreeSpace();
  const needed = backupSize * 2; // 2x for safety

  if (free < needed) {
    throw new Error(`Insufficient disk space. Need ${formatBytes(needed)}, have ${formatBytes(free)}`);
  }
}
```

---

## 9. Cloud Sync (Optional Phase 5)

### Dropbox/Google Drive integration

```javascript
// Save backup to cloud
async function saveToCloud(backup, provider) {
  const filename = `finance-app-backup-${formatDate(new Date())}.finbak`;

  switch (provider) {
    case 'dropbox':
      await dropbox.upload(filename, backup);
      break;
    case 'google-drive':
      await googleDrive.upload(filename, backup);
      break;
    case 'icloud':
      await icloud.upload(filename, backup);
      break;
  }
}
```

Not in Phase 1 scope, but architecture supports it.

---

## 10. Resumen

### Qué hace
- Full backup de toda la data (JSON + compressed)
- Restore en dispositivo nuevo
- Partial backups por date range
- Automated backups (weekly/daily)
- Backup validation y verification
- Retention policy (keep last N)

### Formato
- **.finbak** file (JSON comprimido con gzip)
- Human-readable cuando descomprimido
- Includes metadata + all tables
- Checksum para integrity verification

### Restore process
1. Select backup file
2. Validate format + checksum
3. Create fresh database
4. Import tables en orden (foreign keys)
5. Verify integrity
6. Done ✅

### Benefits
- **Data protection** - No perder años de transactions
- **Easy migration** - Cambiar de dispositivo sin friction
- **Peace of mind** - Automated backups en background
- **Portable** - Backup file es un JSON estándar

### Phase 1 scope
- ✅ Full backup export
- ✅ Restore from backup
- ✅ Partial backup by date
- ✅ Automated backups (weekly)
- ✅ Retention policy
- ✅ Checksum verification
- ⏭️ Cloud sync (Dropbox/Drive) (Phase 5)
- ⏭️ Incremental backups (Phase 5)
- ⏭️ Encrypted backups (Phase 5)

---

**LOC estimate**: ~300 líneas (export + import + validation + UI + scheduler)

**Esto completa los 23 flows esenciales del sistema** ✅
