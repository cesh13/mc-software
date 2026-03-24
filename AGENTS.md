# Project spec — Accounting platform
# For AI agents: read this entire document before writing any code.

---

## What you are building

A multitenant web-based accounting platform for a small accounting firm.
Each client is fully isolated in their own Postgres schema. The firm owner
logs in once and switches between clients from a sidebar dropdown.

Modules: Chart of Accounts, Accounts Payable, Accounts Receivable,
General Ledger (double-entry), Reports (trial balance, P&L, aging).

---

## Principles

1. Simplicity first. Pick the simpler approach when two options work.
2. Security by architecture. Isolation via Postgres schemas, NOT organizationId filters.
3. Easy to deploy. Docker Compose on a single VPS. Dokploy manages SSL.
4. Clean code. One file = one concern. No file over ~200 lines.

---

## Stack

| Concern            | Choice                            |
|--------------------|-----------------------------------|
| Frontend           | Next.js 15 (App Router)           |
| UI components      | shadcn/ui + Tailwind CSS          |
| Data fetching      | TanStack Query v5                 |
| API                | Hono.js                           |
| ORM                | Drizzle ORM                       |
| Validation         | Zod                               |
| Auth               | Better Auth + organizations plugin|
| Database           | PostgreSQL 16                     |
| Package manager    | pnpm workspaces                   |
| Containers         | Docker Compose                    |
| Decimal arithmetic | decimal.js                        |

---

## Directory structure

accounting/
├── apps/
│   ├── api/src/
│   │   ├── db/
│   │   │   ├── schema.ts          (client tables — NO organizationId)
│   │   │   ├── public-schema.ts   (client_registry)
│   │   │   ├── client.ts          (schema-switching DB client)
│   │   │   └── migrations/        (generated — do not edit)
│   │   ├── lib/
│   │   │   ├── auth.ts            (Better Auth config)
│   │   │   └── accounting.ts      (validateDoubleEntry, formatCurrency)
│   │   ├── middleware/auth.ts     (requireAuth, requireSchema, requireRole)
│   │   ├── routes/
│   │   │   ├── coa.ts
│   │   │   ├── vendors.ts
│   │   │   ├── customers.ts
│   │   │   ├── invoices.ts
│   │   │   ├── payments.ts
│   │   │   └── reports.ts
│   │   └── index.ts
│   └── web/src/
│       ├── app/
│       │   ├── (auth)/login/page.tsx
│       │   └── (dashboard)/
│       │       ├── layout.tsx     (sidebar + OrgSwitcher)
│       │       ├── page.tsx
│       │       ├── coa/
│       │       ├── vendors/
│       │       ├── customers/
│       │       ├── invoices/
│       │       └── reports/
│       ├── components/auth/OrgSwitcher.tsx
│       ├── hooks/                 (TanStack Query hooks, one per domain)
│       ├── lib/
│       │   ├── auth-client.ts
│       │   └── api.ts             (typed fetch, injects X-Organization-Id)
│       └── middleware.ts
├── packages/shared/src/schemas.ts (Zod schemas used by both api + web)
├── scripts/
│   ├── provision-client.ts
│   └── migrate-all-clients.ts
├── migration/migrate_coa.py
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json

---

## Database

### Schema-per-client layout

public schema
  users, sessions, organizations, members   (Better Auth auto-generated)
  client_registry                           (org_id → schema_name mapping)

client_acme schema
  accounts, vendors, customers,
  fiscal_periods, journal_entries, journal_lines

client_globex schema
  (identical tables, completely separate data)

### client_registry table

organizationId  varchar(36)   unique   (Better Auth org ID)
organizationSlug varchar(100) unique
schemaName      varchar(100)  unique   (e.g. "client_acme")
displayName     varchar(200)
isProvisioned   boolean       default false

### Schema switching (db/client.ts)

export async function getClientDb(schemaName: string) {
  // Validate: only allow client_[a-z0-9_]+ to prevent injection
  const db = drizzle(pool, { schema });
  await db.execute(
    sql`SET LOCAL search_path TO ${sql.identifier(schemaName)}, public`
  );
  return db;
}

Also export:
  publicDb                          — always hits public schema
  getSchemaForOrg(orgId: string)    — cached lookup, 5min TTL
  withClientTransaction(schema, fn) — atomic multi-query operations

### Per-client tables (db/schema.ts)

accounts         (code unique, parentId self-ref, type enum, normalBalance enum)
vendors          (code unique, apAccountId FK to accounts)
customers        (code unique, arAccountId FK to accounts)
fiscal_periods   (isClosed boolean)
journal_entries  (entryNumber unique, status enum: draft|posted|void)
journal_lines    (journalEntryId FK, accountId FK, debit NUMERIC(18,2), credit NUMERIC(18,2))

All money: NUMERIC(18,2). Never FLOAT.
No organizationId column on any of these tables.

---

## Authentication

### Better Auth config (lib/auth.ts)

betterAuth({
  database: drizzleAdapter(publicDb, { provider: "pg" }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  plugins: [organization({ allowUserToCreateOrganization: false })],
  trustedOrigins: [process.env.WEB_URL],
})

Better Auth auto-mounts at /api/auth/*

### Middleware chain (every protected request)

1. requireAuth
   reads session cookie → 401 if missing
   sets c.get("user"), c.get("session")

2. requireSchema
   reads X-Organization-Id header → 400 if missing
   verifies user is org member → 403 if not
   looks up schemaName in client_registry → 404 if not provisioned
   calls getClientDb(schemaName)
   sets c.get("db"), c.get("schemaName"), c.get("orgId")

3. Route handler
   const db = c.get("db")
   query freely — search_path already set

### API index.ts registration

// Public
app.on(["GET","POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
app.get("/health", ...)

// Protected — requireAuth + requireSchema applied globally
app.use("/api/*", requireAuth)
app.use("/api/*", requireSchema)

app.route("/api/coa",       coaRouter)
app.route("/api/vendors",   vendorsRouter)
app.route("/api/customers", customersRouter)
app.route("/api/invoices",  invoicesRouter)
app.route("/api/payments",  paymentsRouter)
app.route("/api/reports",   reportsRouter)

---

## API conventions

### Route pattern (copy for every domain)

xRouter.get("/", async (c) => {
  const db = c.get("db")
  const items = await db.query.table.findMany({
    where: eq(table.isActive, true),
    orderBy: asc(table.name),
  })
  return c.json({ data: items })
})

xRouter.post("/", zValidator("json", CreateXSchema), async (c) => {
  const db = c.get("db")
  const [created] = await db.insert(table).values(c.req.valid("json")).returning()
  return c.json({ data: created }, 201)
})

xRouter.patch("/:id", zValidator("json", UpdateXSchema), async (c) => {
  const db = c.get("db")
  const [updated] = await db
    .update(table).set({ ...c.req.valid("json"), updatedAt: new Date() })
    .where(eq(table.id, c.req.param("id"))).returning()
  if (!updated) return c.json({ error: "Not found" }, 404)
  return c.json({ data: updated })
})

xRouter.delete("/:id", async (c) => {
  const db = c.get("db")
  const [updated] = await db
    .update(table).set({ isActive: false, updatedAt: new Date() })
    .where(eq(table.id, c.req.param("id"))).returning()
  if (!updated) return c.json({ error: "Not found" }, 404)
  return c.json({ data: { success: true } })
})

### Response envelope

{ data: T }
{ data: T[], meta: { total, page, pageSize } }
{ error: string }

Status codes: 200 ok, 201 created, 400 validation, 401 unauth, 403 forbidden,
404 not found, 500 server error.

---

## Accounting rules — enforce in code

### 1. Double-entry validation

export function validateDoubleEntry(lines) {
  const debits  = lines.reduce((s, l) => s.plus(l.debit  || 0), new Decimal(0))
  const credits = lines.reduce((s, l) => s.plus(l.credit || 0), new Decimal(0))
  if (!debits.equals(credits)) throw new Error(`Unbalanced: ${debits} != ${credits}`)
}

Call before every journal entry insert.
Also enforce via Zod .refine() on CreateJournalEntrySchema.

### 2. Balances are computed, never stored

No balance column on accounts. Compute from journal_lines:

SELECT a.code, a.name,
  COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0) AS balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
GROUP BY a.id

### 3. Posted entries are immutable

Never UPDATE or DELETE a posted journal entry.
Corrections: create reversing entry (lines swapped) + new corrected entry.

### 4. Soft deletes only

Never DELETE from accounts, vendors, customers.
Set is_active = false. All list queries filter WHERE is_active = true.

### 5. Fiscal period check before posting

const period = await db.query.fiscalPeriods.findFirst(...)
if (period?.isClosed) throw new Error("Cannot post to a closed fiscal period")

### 6. Money

Always Decimal for arithmetic:
  const total = new Decimal(line.debit).plus(line.credit)

Display helper:
  export function formatCurrency(amount: string, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency })
      .format(new Decimal(amount).toNumber())
  }

---

## Frontend conventions

### TanStack Query hooks (one file per domain)

export function useVendors() {
  return useQuery({ queryKey: ["vendors"], queryFn: () => api.vendors.list() })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.vendors.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  })
}

### API client (lib/api.ts)

Reads activeOrgId from localStorage.
Injects X-Organization-Id on every request.
Includes credentials: "include" for session cookie.
On org switch: localStorage.setItem("activeOrgId", id) + window.location.reload()

### Route protection

src/middleware.ts uses Better Auth getSessionCookie() for a fast
cookie-only check (no DB hit). Redirects to /login?redirect=<path>.

---

## Docker Compose — three services only

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: accounting
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      retries: 5

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/accounting
      WEB_URL: ${WEB_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      NODE_ENV: production
      PORT: 3001
    depends_on:
      db:
        condition: service_healthy

  web:
    build: ./apps/web
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
      NODE_ENV: production
    depends_on:
      - api

volumes:
  postgres_data:

Do NOT add Nginx. Dokploy/Traefik handles SSL and reverse proxy.

---

## Environment variables

apps/api/.env:
  DATABASE_URL=postgresql://postgres:changeme@localhost:5432/accounting
  WEB_URL=http://localhost:3000
  PORT=3001
  NODE_ENV=development
  BETTER_AUTH_SECRET=<random 32+ chars>

apps/web/.env.local:
  NEXT_PUBLIC_API_URL=http://localhost:3001

---

## Build phases — execute in order

Phase 1 — Monorepo skeleton
  pnpm-workspace.yaml
  Root package.json with scripts: dev, build, db:generate, provision-client, migrate-all-clients
  packages/shared/package.json + src/schemas.ts
  apps/api/package.json
  apps/web/package.json
  docker-compose.yml
  .env.example files

Phase 2 — Database
  apps/api/src/db/schema.ts
  apps/api/src/db/public-schema.ts
  apps/api/src/db/client.ts
  apps/api/drizzle.config.ts
  Run: pnpm db:generate

Phase 3 — Auth
  apps/api/src/lib/auth.ts
  apps/api/src/middleware/auth.ts
  apps/web/src/lib/auth-client.ts
  apps/web/src/middleware.ts
  apps/web/src/app/(auth)/login/page.tsx

Phase 4 — API layer
  apps/api/src/lib/accounting.ts
  apps/api/src/index.ts
  routes/coa.ts
  routes/vendors.ts
  routes/customers.ts
  routes/invoices.ts
  routes/payments.ts
  routes/reports.ts

Phase 5 — Frontend
  Dashboard layout + sidebar + OrgSwitcher
  Chart of Accounts page (tree view + CRUD)
  Vendors page
  Customers page
  AP + AR Invoices pages
  Payments
  Reports

Phase 6 — Infrastructure
  apps/api/Dockerfile
  apps/web/Dockerfile
  scripts/provision-client.ts
  scripts/migrate-all-clients.ts
  migration/migrate_coa.py

---

## DO NOT

- Add organizationId to any table in db/schema.ts
- Add org filters to route handlers
- Use FLOAT for money — NUMERIC(18,2) only
- DELETE accounting records — soft delete only
- UPDATE posted journal entries
- Add a balance column to accounts
- Let any file exceed ~200 lines
- Add services to docker-compose beyond db, api, web
- Add Nginx to docker-compose
- Hardcode secrets
- Use mkdir with brace expansion — it creates literal folder names with braces
