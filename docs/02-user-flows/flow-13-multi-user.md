# Flow 13: Multi-User & Sharing 👥

**Comparte la app con tu pareja o familia**

## Funcionalidad

Sistema multi-user con data isolation y shared accounts para collaboration.

**Características**:
- User accounts separados con email/password
- Data isolation por default (cada user ve solo su data)
- Shared accounts con permissions granulares
- Session management con 24h expiry
- Password hashing con bcrypt

**Permissions**:
- **View only** - Solo ver transactions
- **View & Edit** - Ver y modificar transactions, upload PDFs
- **Admin** - Todo + compartir con otros

---

## Implementación: Authentication & Data isolation

**User accounts separados**:
- el usuario tiene su login
- Sarah tiene su login
- Cada uno ve solo SU data por default

**Shared accounts (opcional)**:
- el usuario puede "share" su joint account con Sarah
- Sarah puede ver/edit transacciones del joint account
- Pero NO puede ver cuentas personales de el usuario (a menos que él comparta)

---

## Story: el usuario comparte la app con Sarah

### Escena 1: el usuario crea user account

**Primera vez usando la app**:

el usuario abre Finance App. Ve login screen:

```
┌─────────────────────────────────────────┐
│  Welcome to Finance App                 │
├─────────────────────────────────────────┤
│  Email                                  │
│  [                          ]           │
│                                         │
│  Password                               │
│  [                          ]           │
│                                         │
│  [Log In]                               │
│                                         │
│  Don't have an account? [Sign Up]       │
└─────────────────────────────────────────┘
```

el usuario hace click en "Sign Up":

```
┌─────────────────────────────────────────┐
│  Create Account                 [×]     │
├─────────────────────────────────────────┤
│  Display Name                           │
│  [el usuario                 ]              │
│                                         │
│  Email *                                │
│  [darwin@example.com     ]              │
│                                         │
│  Password *                             │
│  [••••••••••             ]              │
│                                         │
│  Confirm Password *                     │
│  [••••••••••             ]              │
│                                         │
│  [Cancel]  [Create Account]             │
└─────────────────────────────────────────┘
```

el usuario crea su account. Ahora puede usar la app normalmente.

---

### Escena 2: Sarah crea su account

Sarah quiere empezar a usar Finance App.

el usuario le dice: "Descarga la app y crea tu account".

Sarah crea account:
- Email: `sarah@example.com`
- Password: `••••••••••`

**Sarah now has su propia data**: Zero transactions. Empty timeline.

---

### Escena 3: el usuario comparte joint account

el usuario y Sarah tienen un joint checking account (BofA Joint).

el usuario quiere que Sarah pueda ver/editar transactions de ese account.

**Hace esto**:
1. Settings → Accounts
2. Click en "BofA Joint"

**Ve esto**:
```
┌─────────────────────────────────────────┐
│  Account: BofA Joint            [×]     │
├─────────────────────────────────────────┤
│  Name: BofA Joint Checking              │
│  Type: Checking                         │
│  Currency: USD                          │
│                                         │
│  Owner: el usuario                          │
│                                         │
│  Shared with:                           │
│  (No one)                               │
│                                         │
│  [Share Account...]                     │
│                                         │
│  [Save] [Delete] [Close]                │
└─────────────────────────────────────────┘
```

3. Click "Share Account..."

**Ve dialog**:
```
┌─────────────────────────────────────────┐
│  Share Account                  [×]     │
├─────────────────────────────────────────┤
│  Share "BofA Joint" with:               │
│                                         │
│  Email                                  │
│  [sarah@example.com      ]              │
│                                         │
│  Permission                             │
│  ○ View only                            │
│  ● View & Edit                          │
│  ○ Admin (can share with others)        │
│                                         │
│  [Cancel]  [Share]                      │
└─────────────────────────────────────────┘
```

4. Escribe `sarah@example.com`
5. Selecciona "View & Edit"
6. Click "Share"

**el usuario ve confirmación**:
```
Account shared with sarah@example.com ✓
```

---

### Escena 4: Sarah acepta y ve shared account

Sarah abre Finance App. Ve notificación:

```
┌─────────────────────────────────────────┐
│  🔔 Account Shared                      │
├─────────────────────────────────────────┤
│  el usuario shared "BofA Joint" with you    │
│                                         │
│  Permission: View & Edit                │
│                                         │
│  [Accept] [Decline]                     │
└─────────────────────────────────────────┘
```

Sarah hace click "Accept".

**Ahora Sarah ve**:
```
┌──────────────────────────────────────────────────────┐
│  Finance App                    [Upload] [Filter] [⚙️]│
├──────────────────────────────────────────────────────┤
│  Accounts: [BofA Joint (shared) ▾]                   │
├──────────────────────────────────────────────────────┤
│  Sep 28  Costco                 -$234.56 USD         │
│  Sep 27  Shell Gas              -$65.00  USD         │
│  Sep 26  Electric Company       -$120.45 USD         │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

**Perfecto**: Sarah ve transactions del joint account. Puede edit y upload PDFs a ese account.

---

### Escena 5: Data isolation

Sarah tiene su personal Apple Card. el usuario NO puede verla (no está compartida).

**el usuario ve**:
```
Accounts:
- BofA Joint (owner)
- BofA Personal (owner)
- Wise (owner)
```

**Sarah ve**:
```
Accounts:
- BofA Joint (shared by el usuario)
- Apple Card (owner)
```

**Perfecto**: Cada uno ve solo sus accounts (+ shared accounts).

---

## Cómo funciona: Authentication & Data isolation

### Database: Users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
```

### Password hashing (bcrypt)

```javascript
const bcrypt = require('bcrypt');

async function createUser(email, password, displayName) {
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const userId = generateId();

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
    displayName: user.display_name
  };
}
```

---

### Session management

```javascript
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

function requireAuth(sessionId) {
  const session = getSession(sessionId);

  if (!session) {
    throw new Error('Not authenticated');
  }

  return session.userId;
}
```

---

### Data isolation: Add user_id to queries

```javascript
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
    query += ' AND date >= ? AND date <= ?';
    params.push(filters.dateRange.from, filters.dateRange.to);
  }

  query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 100, filters.offset || 0);

  return await db.all(query, params);
}
```

---

## Shared accounts

### Database: account_shares

```sql
CREATE TABLE account_shares (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,        -- 'view' | 'edit' | 'admin'
  shared_by TEXT NOT NULL,
  created_at TEXT NOT NULL,

  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shared_by) REFERENCES users(id),

  UNIQUE(account_id, user_id)
);
```

### Share account

```javascript
async function shareAccount(sessionId, accountId, targetUserEmail, permission) {
  const userId = requireAuth(sessionId);

  // Check if user owns account
  const account = await db.get(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
    accountId,
    userId
  );

  if (!account) {
    throw new Error('Account not found or not owned by you');
  }

  // Get target user
  const targetUser = await db.get(
    'SELECT id FROM users WHERE email = ?',
    targetUserEmail.toLowerCase()
  );

  if (!targetUser) {
    throw new Error('User not found');
  }

  // Create share
  await db.run(
    `INSERT OR REPLACE INTO account_shares
     (id, account_id, user_id, permission, shared_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    generateId(),
    accountId,
    targetUser.id,
    permission,
    userId,
    new Date().toISOString()
  );

  return { success: true };
}
```

---

### Get accessible accounts

```javascript
async function getAccessibleAccounts(sessionId) {
  const userId = requireAuth(sessionId);

  // Get owned accounts
  const ownedAccounts = await db.all(
    'SELECT *, "owner" as access_type FROM accounts WHERE user_id = ?',
    userId
  );

  // Get shared accounts
  const sharedAccounts = await db.all(
    `SELECT a.*, s.permission as access_type
     FROM accounts a
     JOIN account_shares s ON a.id = s.account_id
     WHERE s.user_id = ?`,
    userId
  );

  return [...ownedAccounts, ...sharedAccounts];
}
```

---

## Permissions

### View only

```javascript
if (accountShare.permission === 'view') {
  // Can see transactions
  // Cannot upload PDFs
  // Cannot edit transactions
  // Cannot delete transactions
}
```

### View & Edit

```javascript
if (accountShare.permission === 'edit') {
  // Can see transactions ✓
  // Can upload PDFs ✓
  // Can edit transactions ✓
  // Can delete transactions ✓
  // Cannot share with others ✗
}
```

### Admin

```javascript
if (accountShare.permission === 'admin') {
  // Can see transactions ✓
  // Can upload PDFs ✓
  // Can edit transactions ✓
  // Can delete transactions ✓
  // Can share with others ✓
}
```

---

## Edge cases

### Edge case 1: Revoke access

**Escenario**: el usuario ya no quiere que Sarah vea el joint account.

**UI**:
```
Settings → Accounts → BofA Joint

Shared with:
- sarah@example.com (View & Edit) [Revoke Access]
```

Click "Revoke Access" → Sarah loses access inmediatamente.

---

### Edge case 2: Change permission

**Escenario**: el usuario quiere cambiar Sarah de "View & Edit" a "View only".

**UI**:
```
Settings → Accounts → BofA Joint

Shared with:
- sarah@example.com [View & Edit ▾]
  → View only
  → View & Edit
  → Admin
```

---

### Edge case 3: Transfer ownership

**Escenario**: el usuario quiere que Sarah sea la owner del joint account (él ya no lo usa).

**UI**:
```
Settings → Accounts → BofA Joint

[Transfer Ownership to...]
→ Select user: sarah@example.com
→ Confirmation dialog
→ Sarah becomes owner, el usuario becomes "shared" (or removed)
```

---

## Resumen: Multi-User & Sharing

### Qué hace
- **User accounts** separados con email/password
- **Data isolation** por default (cada user ve solo su data)
- **Shared accounts** con permissions granulares
- **Session management** con 24h expiry
- **Password hashing** con bcrypt

### Permissions
- **View only** - Solo ver transactions
- **View & Edit** - Ver y modificar transactions
- **Admin** - Todo + compartir con otros

### Benefits
- **Privacy**: Cada user tiene su data privada
- **Collaboration**: Shared accounts para household expenses
- **Flexible**: Permissions granulares
- **Secure**: Password hashing, session expiry

### Phase 4 scope
- ✅ User registration/login
- ✅ Password hashing (bcrypt)
- ✅ Session management
- ✅ Data isolation by user_id
- ✅ Shared accounts
- ✅ Permissions (view/edit/admin)
- ❌ 2FA (Phase 5)
- ❌ OAuth (Google/Apple login) (Phase 5)
- ❌ Activity log (quien hizo qué) (Phase 5)

---

**Fin de Phase 4**: Multi-user y collaboration features documentados.

**Acceso desde móvil**: Finance App es una aplicación de escritorio (Electron). Para acceso móvil, usa el navegador web (Chrome/Safari) - la interfaz es responsive y se adapta a pantallas pequeñas.
