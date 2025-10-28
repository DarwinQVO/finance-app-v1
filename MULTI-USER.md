# Phase 4: Multi-User System

**Scaling para múltiples usuarios**

---

## 🎯 Overview

Phase 4 agrega:
- Sistema de autenticación
- User management
- Data isolation (cada user ve solo su data)
- Shared accounts (opcional)
- REST API para mobile

**LOC estimate**: ~300 LOC

---

## 👥 Database: Users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,

  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  display_name TEXT,
  avatar_url TEXT,

  -- Preferences (JSON)
  preferences TEXT,                 -- {theme, language, currency, dateFormat}

  -- Permissions
  role TEXT DEFAULT 'user',         -- admin | user

  created_at TEXT NOT NULL,
  last_login_at TEXT
);
```

---

## 🔐 Authentication

### Password Hashing

```javascript
const bcrypt = require('bcrypt');

async function createUser(email, password, displayName) {
  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Generate ID
  const userId = generateId();

  // Insert user
  await db.run(
    `INSERT INTO users (id, email, password_hash, display_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    userId,
    email.toLowerCase(),
    passwordHash,
    displayName,
    new Date().toISOString()
  );

  return userId;
}

async function authenticateUser(email, password) {
  const user = await db.get(
    'SELECT * FROM users WHERE email = ?',
    email.toLowerCase()
  );

  if (!user) {
    throw new Error('User not found');
  }

  // Verify password
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    throw new Error('Invalid password');
  }

  // Update last login
  await db.run(
    'UPDATE users SET last_login_at = ? WHERE id = ?',
    new Date().toISOString(),
    user.id
  );

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role
  };
}
```

---

## 🔒 Session Management

```javascript
// main/session.js

const activeSessions = new Map();

function createSession(userId) {
  const sessionId = generateId();
  const session = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };

  activeSessions.set(sessionId, session);

  return sessionId;
}

function getSession(sessionId) {
  const session = activeSessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if expired
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(sessionId);
    return null;
  }

  return session;
}

function destroySession(sessionId) {
  activeSessions.delete(sessionId);
}

// Middleware para verificar sesión
function requireAuth(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error('Not authenticated');
  }

  return session.userId;
}
```

---

## 🔐 Data Isolation

### Agregar user_id a todas las queries

```javascript
// main/queries.js

async function getTransactions(sessionId, filters) {
  // Verificar sesión
  const userId = requireAuth(sessionId);

  // Query con user_id filter
  let query = `
    SELECT * FROM transactions
    WHERE user_id = ?
  `;

  const params = [userId];

  // Apply other filters
  if (filters.account && filters.account !== 'all') {
    query += ' AND account_id = ?';
    params.push(filters.account);
  }

  if (filters.dateRange) {
    const { from, to } = parseDateRange(filters.dateRange);
    query += ' AND date >= ? AND date <= ?';
    params.push(from, to);
  }

  query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 100, filters.offset || 0);

  return await db.all(query, params);
}

async function getAccounts(sessionId) {
  const userId = requireAuth(sessionId);

  return await db.all(
    'SELECT * FROM accounts WHERE user_id = ? AND is_active = TRUE',
    userId
  );
}

async function getCategories(sessionId) {
  const userId = requireAuth(sessionId);

  // Get both system categories and user-created categories
  return await db.all(
    `SELECT * FROM categories
     WHERE (is_system = TRUE OR user_id = ?)
     AND is_active = TRUE
     ORDER BY name`,
    userId
  );
}
```

### Auto-agregar user_id en INSERT

```javascript
async function createTransaction(sessionId, txnData) {
  const userId = requireAuth(sessionId);

  // Auto-add user_id
  txnData.user_id = userId;

  const id = generateId();

  await db.run(
    `INSERT INTO transactions
     (id, user_id, account_id, date, merchant, amount, currency, type,
      source_type, source_hash, original_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    txnData.user_id,
    txnData.account_id,
    txnData.date,
    txnData.merchant,
    txnData.amount,
    txnData.currency,
    txnData.type,
    txnData.source_type,
    txnData.source_hash,
    txnData.original_description,
    new Date().toISOString(),
    new Date().toISOString()
  );

  return id;
}
```

---

## 👥 Shared Accounts (Optional)

### Database

```sql
CREATE TABLE account_shares (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,        -- view | edit | admin
  created_at TEXT NOT NULL,

  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),

  UNIQUE(account_id, user_id)
);
```

### Check permissions

```javascript
async function canAccessAccount(userId, accountId) {
  // Check if user owns account
  const account = await db.get(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
    accountId,
    userId
  );

  if (account) {
    return { canAccess: true, permission: 'admin' };
  }

  // Check if account is shared with user
  const share = await db.get(
    'SELECT * FROM account_shares WHERE account_id = ? AND user_id = ?',
    accountId,
    userId
  );

  if (share) {
    return { canAccess: true, permission: share.permission };
  }

  return { canAccess: false, permission: null };
}

async function getTransactionsWithShared(sessionId, filters) {
  const userId = requireAuth(sessionId);

  // Get all account IDs user has access to
  const ownedAccounts = await db.all(
    'SELECT id FROM accounts WHERE user_id = ?',
    userId
  );

  const sharedAccounts = await db.all(
    'SELECT account_id FROM account_shares WHERE user_id = ?',
    userId
  );

  const accountIds = [
    ...ownedAccounts.map(a => a.id),
    ...sharedAccounts.map(a => a.account_id)
  ];

  if (accountIds.length === 0) {
    return [];
  }

  // Query transactions from accessible accounts
  const placeholders = accountIds.map(() => '?').join(',');
  const query = `
    SELECT * FROM transactions
    WHERE account_id IN (${placeholders})
    AND date >= ? AND date <= ?
    ORDER BY date DESC
    LIMIT ? OFFSET ?
  `;

  return await db.all(
    query,
    ...accountIds,
    filters.dateRange.from,
    filters.dateRange.to,
    filters.limit || 100,
    filters.offset || 0
  );
}
```

---

## 🌐 REST API para Mobile

### Setup Express

```javascript
// main/api/server.js

const express = require('express');
const app = express();

app.use(express.json());

// Auth middleware
function authMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ error: 'No session ID' });
  }

  const session = getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  req.userId = session.userId;
  next();
}

// Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authenticateUser(email, password);
    const sessionId = createSession(user.id);

    res.json({ sessionId, user });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const sessionId = req.headers['x-session-id'];
  destroySession(sessionId);
  res.json({ success: true });
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const filters = {
      account: req.query.account || 'all',
      dateRange: {
        from: req.query.from,
        to: req.query.to
      },
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const transactions = await getTransactions(sessionId, filters);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const id = await createTransaction(sessionId, req.body);
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const accounts = await getAccounts(sessionId);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/budgets', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const budgets = await db.all(
      'SELECT * FROM budgets WHERE user_id = ? AND is_active = TRUE',
      userId
    );

    // Get status for each budget
    const budgetsWithStatus = await Promise.all(
      budgets.map(async (budget) => {
        const status = await getBudgetStatus(budget.id);
        return { ...budget, status };
      })
    );

    res.json(budgetsWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

---

## 📱 Sync Engine (Desktop ↔ Mobile)

### Sync Strategy: Last Write Wins

```javascript
// main/sync.js

async function syncUp(sessionId, changes) {
  const userId = requireAuth(sessionId);

  // changes = [{ type: 'create|update|delete', table: 'transactions', id: '...', data: {...} }]

  for (const change of changes) {
    if (change.type === 'create') {
      await handleCreate(userId, change);
    } else if (change.type === 'update') {
      await handleUpdate(userId, change);
    } else if (change.type === 'delete') {
      await handleDelete(userId, change);
    }
  }

  return { success: true, synced: changes.length };
}

async function handleUpdate(userId, change) {
  // Get current version from server
  const current = await db.get(
    `SELECT updated_at FROM ${change.table} WHERE id = ? AND user_id = ?`,
    change.id,
    userId
  );

  if (!current) {
    throw new Error('Record not found');
  }

  // Compare timestamps (Last Write Wins)
  const serverTime = new Date(current.updated_at).getTime();
  const clientTime = new Date(change.data.updated_at).getTime();

  if (clientTime >= serverTime) {
    // Client version is newer, apply update
    const fields = Object.keys(change.data).filter(k => k !== 'id' && k !== 'user_id');
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => change.data[f]);

    await db.run(
      `UPDATE ${change.table} SET ${setClause} WHERE id = ? AND user_id = ?`,
      ...values,
      change.id,
      userId
    );
  }
  // else: server version is newer, skip update
}

async function syncDown(sessionId, lastSyncTime) {
  const userId = requireAuth(sessionId);

  // Get all changes since last sync
  const transactions = await db.all(
    `SELECT * FROM transactions
     WHERE user_id = ?
     AND updated_at > ?`,
    userId,
    lastSyncTime
  );

  const accounts = await db.all(
    `SELECT * FROM accounts
     WHERE user_id = ?
     AND updated_at > ?`,
    userId,
    lastSyncTime
  );

  const categories = await db.all(
    `SELECT * FROM categories
     WHERE (user_id = ? OR is_system = TRUE)
     AND updated_at > ?`,
    userId,
    lastSyncTime
  );

  return {
    transactions,
    accounts,
    categories,
    serverTime: new Date().toISOString()
  };
}
```

---

## 🔧 User Preferences

```javascript
// main/users.js

async function getUserPreferences(userId) {
  const user = await db.get('SELECT preferences FROM users WHERE id = ?', userId);

  return user.preferences ? JSON.parse(user.preferences) : getDefaultPreferences();
}

function getDefaultPreferences() {
  return {
    theme: 'light',
    language: 'en',
    currency: 'USD',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'en-US',
    notifications: {
      budgetAlerts: true,
      recurringReminders: true
    }
  };
}

async function updateUserPreferences(userId, preferences) {
  await db.run(
    'UPDATE users SET preferences = ? WHERE id = ?',
    JSON.stringify(preferences),
    userId
  );
}
```

---

## 📊 LOC Estimate

| Component | LOC |
|-----------|-----|
| Auth system (bcrypt, sessions) | ~80 |
| User management | ~40 |
| Data isolation (updated queries) | ~60 |
| Shared accounts (optional) | ~50 |
| REST API | ~120 |
| Sync engine | ~100 |
| User preferences | ~30 |
| **Total** | **~480** |

*(Slightly over 300, but REST API + Sync adds complexity)*

---

## 🔐 Security Best Practices

1. ✅ **Password hashing** - bcrypt con salt rounds
2. ✅ **Session expiration** - 24 horas, renovable
3. ✅ **Data isolation** - user_id en TODAS las queries
4. ✅ **Input validation** - Validar todos los inputs del user
5. ✅ **Rate limiting** - Limitar requests por IP (optional)
6. ✅ **HTTPS only** - Si usas API externa
7. ✅ **SQL injection protection** - Usar prepared statements

---

**Próximo doc**: Lee [MOBILE-APP.md](MOBILE-APP.md)
