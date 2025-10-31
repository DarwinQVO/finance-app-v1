# Badge 17: Upload Reminders

**Date**: October 31, 2025
**Status**: ✅ COMPLETE
**Tests**: 14/14 passing (250 total project tests)
**Goal**: Remind users to upload monthly statements

---

## 🎯 OBJECTIVE

**Implement upload reminder system for retroactive finance app.**

### The Problem

**Finance App is RETROACTIVE** (not real-time):
- User uploads PDFs/CSVs manually
- Transactions only appear when user uploads
- If user forgets to upload → data is incomplete

**Without reminders:**
- User might forget to upload October statement
- Budget tracking becomes stale
- Insights are outdated

### The Solution

**Upload Tracker & Reminder:**
```javascript
// Detect last upload
const lastUpload = getLastUploadDate(db);
const daysSince = differenceInDays(new Date(), lastUpload);

if (daysSince > 30) {
  // Show reminder: "It's been 32 days since your last upload"
  showUploadReminder(daysSince);
}
```

**Benefits:**
- ✅ Keeps data up-to-date
- ✅ Improves user engagement
- ✅ Makes retroactive workflow sustainable

---

## 🏗️ IMPLEMENTATION

### File: src/lib/upload-tracker.js

```javascript
/**
 * Upload Tracker
 *
 * Tracks user uploads and provides reminder logic.
 * Designed for retroactive finance app workflow.
 *
 * Badge 17: Upload Reminders
 */

/**
 * Get the date of the last upload
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {string | null} - ISO date string of last upload, or null if no uploads
 */
export function getLastUploadDate(db) {
  const result = db.prepare(`
    SELECT MAX(uploaded_at) as last_upload
    FROM uploaded_files
  `).get();

  return result?.last_upload || null;
}

/**
 * Calculate days since last upload
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {number | null} - Days since last upload, or null if no uploads
 */
export function getDaysSinceLastUpload(db) {
  const lastUpload = getLastUploadDate(db);
  if (!lastUpload) return null;

  const lastDate = new Date(lastUpload);
  const now = new Date();
  const diffMs = now - lastDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if user should be reminded to upload
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {number} threshold - Days before showing reminder (default: 30)
 * @returns {boolean} - True if reminder should be shown
 */
export function shouldRemindUpload(db, threshold = 30) {
  const daysSince = getDaysSinceLastUpload(db);

  // No uploads yet → don't remind (new user)
  if (daysSince === null) return false;

  // Over threshold → remind
  return daysSince > threshold;
}

/**
 * Get upload statistics
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {Object} - Upload stats
 */
export function getUploadStats(db) {
  const lastUpload = getLastUploadDate(db);
  const daysSince = getDaysSinceLastUpload(db);

  const totalUploads = db.prepare(`
    SELECT COUNT(*) as count
    FROM uploaded_files
  `).get().count;

  const totalTransactions = db.prepare(`
    SELECT COUNT(*) as count
    FROM transactions
  `).get().count;

  const uploadsThisMonth = db.prepare(`
    SELECT COUNT(*) as count
    FROM uploaded_files
    WHERE uploaded_at >= date('now', 'start of month')
  `).get().count;

  return {
    lastUpload,
    daysSince,
    totalUploads,
    totalTransactions,
    uploadsThisMonth,
    needsReminder: shouldRemindUpload(db)
  };
}

/**
 * Get reminder message
 *
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {string | null} - Reminder message, or null if no reminder needed
 */
export function getReminderMessage(db) {
  const daysSince = getDaysSinceLastUpload(db);

  if (daysSince === null) {
    return null; // No uploads yet
  }

  if (daysSince <= 30) {
    return null; // Recent upload, no reminder
  }

  if (daysSince <= 45) {
    return `It's been ${daysSince} days since your last upload. Upload your latest statements to keep your data current.`;
  }

  if (daysSince <= 60) {
    return `It's been ${daysSince} days since your last upload! Your data may be outdated. Upload your statements now.`;
  }

  // Over 60 days
  return `It's been over ${daysSince} days since your last upload. Your financial data is significantly outdated. Please upload your latest statements.`;
}
```

---

## 🧪 TESTS

### File: tests/upload-tracker.test.js

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import {
  getLastUploadDate,
  getDaysSinceLastUpload,
  shouldRemindUpload,
  getUploadStats,
  getReminderMessage
} from '../src/lib/upload-tracker.js';

describe('Upload Tracker (Badge 17)', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');

    // Run Phase 1 schema
    const phase1Schema = readFileSync('src/db/schema.sql', 'utf8');
    db.exec(phase1Schema);

    // Create test account
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, name, type, institution, currency, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('acc-1', 'Test Account', 'checking', 'Test Bank', 'USD', 1, now, now);
  });

  afterEach(() => {
    db.close();
  });

  test('getLastUploadDate returns null when no uploads', () => {
    const lastUpload = getLastUploadDate(db);
    expect(lastUpload).toBeNull();
  });

  test('getLastUploadDate returns most recent upload', () => {
    // Add uploads
    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', '2024-10-01T10:00:00.000Z', 10);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash2', '/path/2.pdf', '2024-10-15T10:00:00.000Z', 15);

    const lastUpload = getLastUploadDate(db);
    expect(lastUpload).toBe('2024-10-15T10:00:00.000Z');
  });

  test('getDaysSinceLastUpload returns null when no uploads', () => {
    const daysSince = getDaysSinceLastUpload(db);
    expect(daysSince).toBeNull();
  });

  test('getDaysSinceLastUpload calculates correctly', () => {
    // Upload from 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', tenDaysAgo.toISOString(), 10);

    const daysSince = getDaysSinceLastUpload(db);
    expect(daysSince).toBe(10);
  });

  test('shouldRemindUpload returns false when no uploads', () => {
    const shouldRemind = shouldRemindUpload(db);
    expect(shouldRemind).toBe(false);
  });

  test('shouldRemindUpload returns false when recent upload', () => {
    // Upload from 20 days ago (under 30 threshold)
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', twentyDaysAgo.toISOString(), 10);

    const shouldRemind = shouldRemindUpload(db);
    expect(shouldRemind).toBe(false);
  });

  test('shouldRemindUpload returns true when over threshold', () => {
    // Upload from 35 days ago (over 30 threshold)
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', thirtyFiveDaysAgo.toISOString(), 10);

    const shouldRemind = shouldRemindUpload(db);
    expect(shouldRemind).toBe(true);
  });

  test('shouldRemindUpload respects custom threshold', () => {
    // Upload from 20 days ago
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', twentyDaysAgo.toISOString(), 10);

    // With default threshold (30) → no reminder
    expect(shouldRemindUpload(db, 30)).toBe(false);

    // With custom threshold (15) → remind
    expect(shouldRemindUpload(db, 15)).toBe(true);
  });

  test('getUploadStats returns complete statistics', () => {
    const now = new Date().toISOString();

    // Add upload from 35 days ago
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', thirtyFiveDaysAgo.toISOString(), 10);

    // Add a transaction
    db.prepare(`
      INSERT INTO transactions (id, account_id, date, merchant_raw, merchant, amount, currency, type, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('txn-1', 'acc-1', '2024-10-01', 'TEST', 'Test', -10, 'USD', 'expense', 'manual', now, now);

    const stats = getUploadStats(db);

    expect(stats.lastUpload).toBe(thirtyFiveDaysAgo.toISOString());
    expect(stats.daysSince).toBe(35);
    expect(stats.totalUploads).toBe(1);
    expect(stats.totalTransactions).toBe(1);
    expect(stats.needsReminder).toBe(true);
  });

  test('getReminderMessage returns null when no uploads', () => {
    const message = getReminderMessage(db);
    expect(message).toBeNull();
  });

  test('getReminderMessage returns null when recent upload', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', tenDaysAgo.toISOString(), 10);

    const message = getReminderMessage(db);
    expect(message).toBeNull();
  });

  test('getReminderMessage returns gentle reminder (31-45 days)', () => {
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', thirtyFiveDaysAgo.toISOString(), 10);

    const message = getReminderMessage(db);
    expect(message).toContain('35 days');
    expect(message).toContain('keep your data current');
  });

  test('getReminderMessage returns urgent reminder (46-60 days)', () => {
    const fiftyDaysAgo = new Date();
    fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', fiftyDaysAgo.toISOString(), 10);

    const message = getReminderMessage(db);
    expect(message).toContain('50 days');
    expect(message).toContain('may be outdated');
  });

  test('getReminderMessage returns critical reminder (over 60 days)', () => {
    const seventyDaysAgo = new Date();
    seventyDaysAgo.setDate(seventyDaysAgo.getDate() - 70);

    db.prepare(`
      INSERT INTO uploaded_files (file_hash, file_path, uploaded_at, transaction_count)
      VALUES (?, ?, ?, ?)
    `).run('hash1', '/path/1.pdf', seventyDaysAgo.toISOString(), 10);

    const message = getReminderMessage(db);
    expect(message).toContain('over 70 days');
    expect(message).toContain('significantly outdated');
  });
});
```

---

## ✅ VERIFICATION CHECKLIST

- [x] getLastUploadDate() implemented
- [x] getDaysSinceLastUpload() implemented
- [x] shouldRemindUpload() implemented
- [x] getUploadStats() implemented
- [x] getReminderMessage() implemented
- [x] All 14 tests passing (100%)
- [x] No breaking changes
- [x] Follows Badge 12 modular pattern

---

## 🚀 NEXT STEPS

After Badge 17:
- Badge 18: Testing Suite
- Phase 3: Analysis (Reports, Charts, Export)

**Integration with UI (future):**
```javascript
// src/components/UploadReminder/UploadReminder.jsx
function UploadReminder({ dataSource }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      const data = await dataSource.getUploadStats();
      setStats(data);
    };
    loadStats();
  }, []);

  if (!stats?.needsReminder) return null;

  return (
    <div className="upload-reminder banner">
      <span className="icon">📅</span>
      <span className="message">{getReminderMessage(dataSource)}</span>
      <button onClick={handleUpload}>Upload Now</button>
    </div>
  );
}
```

---

## 📊 FINAL STATS

**Badge 17 Summary:**
- **Files created**: 2 files
  - [src/lib/upload-tracker.js](src/lib/upload-tracker.js) - 123 lines
  - [tests/upload-tracker.test.js](tests/upload-tracker.test.js) - 236 lines
- **Tests**: 14/14 passing (100%)
- **Functions**: 5 core functions
  - `getLastUploadDate()` - Get most recent upload
  - `getDaysSinceLastUpload()` - Calculate days since upload
  - `shouldRemindUpload()` - Check if reminder needed
  - `getUploadStats()` - Complete upload statistics
  - `getReminderMessage()` - Contextual reminder messages

**Project totals:**
- Badge 12: ✅ Modular Architecture
- Badge 13: ✅ Entity Linking (46 tests)
- Badge 14: ✅ Budget ↔ Recurring Analysis (17 tests)
- Badge 15: ✅ Auto-Categorization Fix (10 tests)
- Badge 16: ✅ Code Quality (PARTIAL)
- Badge 17: ✅ Upload Reminders (14 tests)
- **Total: 250 tests passing**

---

**Badge 17: Upload Reminders - COMPLETE** ✅
