import { sqliteTable, text, integer, customType } from 'drizzle-orm/sqlite-core'

// ── Custom column: ISO timestamp ─────────────────────────────────────────────
// Better Auth's drizzle adapter passes raw Date objects with no pre-serialization.
// better-sqlite3 only accepts string | number | Buffer | bigint | null, so a
// plain text() column rejects Date objects at runtime with "unsupported value".
// This custom type converts Date → ISO string in toDriver() before the value
// reaches better-sqlite3. The underlying SQL column type is still TEXT, so
// existing migrations are unaffected.
const isoTimestamp = customType<{ data: string | Date; driverData: string }>({
  dataType() {
    return 'text'
  },
  toDriver(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : value
  },
})

// ── Better Auth tables ──────────────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: isoTimestamp('created_at').notNull(),
  updatedAt: isoTimestamp('updated_at').notNull(),
  role: text('role').notNull().default('member'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: isoTimestamp('ban_expires'),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: isoTimestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: isoTimestamp('created_at').notNull(),
  updatedAt: isoTimestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: text('impersonated_by'),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: isoTimestamp('access_token_expires_at'),
  refreshTokenExpiresAt: isoTimestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: isoTimestamp('created_at').notNull(),
  updatedAt: isoTimestamp('updated_at').notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: isoTimestamp('expires_at').notNull(),
  createdAt: isoTimestamp('created_at'),
  updatedAt: isoTimestamp('updated_at'),
})

// ── Platform tables ─────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  isAlwaysOn: integer('is_always_on', { mode: 'boolean' }).notNull().default(false),
  enabledAt: text('enabled_at'),
  installedAt: text('installed_at').notNull(),
})
