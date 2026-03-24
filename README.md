# Accounting Platform

Multi-tenant SaaS accounting platform with schema-per-client isolation.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TanStack Query, Tailwind CSS
- **Backend**: Hono.js API
- **Database**: PostgreSQL 16 with schema-per-client isolation
- **Auth**: Better Auth with email/password
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Package Manager**: pnpm workspaces

## Architecture

- Each client has their own PostgreSQL schema for complete data isolation
- Users belong to a single client (stored in user metadata as `clientSlug`)
- Admin users can manage all clients (metadata: `{ role: "admin" }`)
- No organizationId columns - isolation via schema switching
- Better Auth handles authentication with custom metadata

## Getting Started (New Environment)

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 16+ (local or remote)

### 1. Clone and Install

```bash
git clone <repository-url>
cd accounting-platform
pnpm install
```

### 2. Configure Environment Variables

Create environment files from examples:

```bash
# Root environment (optional, for Docker Compose)
cp .env.example .env

# API environment (required)
cp apps/api/.env.example apps/api/.env

# Web environment (required)
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/api/.env`:
```env
DATABASE_URL=postgresql://username:password@host:5432/database
WEB_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3001
PORT=3001
NODE_ENV=development
BETTER_AUTH_SECRET=your-secret-key-min-32-chars-long-change-this
```

Edit `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Initialize Database

```bash
# Create Better Auth tables and client_registry
pnpm db:init
```

### 4. Start Development Servers

```bash
# Start both API and Web servers
pnpm dev
```

The servers will start:
- Web: http://localhost:3000
- API: http://localhost:3001

### 5. Create Admin User

**Important**: The dev servers must be running before creating an admin user.

```bash
pnpm create-admin admin@example.com SecurePassword123 "Admin User"
```

### 6. Log In

Go to http://localhost:3000/login and log in with your admin credentials.

## Usage

### Admin Panel

Access at http://localhost:3000/admin (admin users only)

- Create new clients
- Enable/disable clients
- View client status

### Creating a Client

1. Log in as admin
2. Go to Admin panel
3. Click "Add Client"
4. Enter organization slug (e.g., `acme_corp`) and display name
5. Click "Create Client"

### Provisioning a Client Schema

~~After creating a client in the admin panel, provision their database schema:~~

**Provisioning now happens automatically when you create a client!** The schema is created and all accounting tables are set up immediately.

If you need to manually provision a client (for troubleshooting), you can still use:

```bash
pnpm provision-client <client-slug>
```

Example:
```bash
pnpm provision-client acme_corp
```

This creates the client's schema with all accounting tables (accounts, vendors, customers, journal entries, etc.).

### Creating Client Users

After creating and provisioning a client, create users for that client:

```bash
pnpm create-client-user user@acme.com SecurePassword123 acme_corp "John Doe"
```

This will:
- Create a user account with Better Auth
- Associate them with the specified client
- Verify their email automatically (for development)
- Check that the client exists and is provisioned

The user can then log in at http://localhost:3000/login with their credentials.

### Deleting a User

```bash
pnpm delete-user user@example.com
```

## Available Scripts

- `pnpm dev` - Start development servers (API + Web)
- `pnpm build` - Build all packages and apps for production
- `pnpm db:init` - Initialize database with Better Auth tables
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm create-admin <email> <password> [name]` - Create admin user
- `pnpm create-client-user <email> <password> <client-slug> [name]` - Create client user
- `pnpm delete-user <email>` - Delete a user
- `pnpm provision-client <slug>` - Provision client schema

## Project Structure

```
accounting/
├── apps/
│   ├── api/                    # Hono.js API server
│   │   ├── src/
│   │   │   ├── db/            # Database schemas and client
│   │   │   ├── lib/           # Auth and utilities
│   │   │   ├── middleware/    # Auth middleware
│   │   │   ├── routes/        # API routes
│   │   │   └── index.ts       # API entry point
│   │   └── package.json
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/           # App router pages
│       │   ├── components/    # React components
│       │   ├── hooks/         # TanStack Query hooks
│       │   └── lib/           # API client and auth
│       └── package.json
├── packages/
│   └── shared/                 # Shared Zod schemas
├── scripts/                    # Database and admin scripts
├── docker-compose.yml          # Docker services
└── package.json               # Root workspace config
```

## Database Schema

### Public Schema
- `user` - Better Auth users
- `account` - Better Auth accounts (passwords)
- `session` - Better Auth sessions
- `verification` - Better Auth verification tokens
- `client_registry` - Client metadata and schema mapping

### Client Schemas (e.g., `client_acme`)
- `accounts` - Chart of accounts
- `vendors` - Vendor management
- `customers` - Customer management
- `fiscal_periods` - Accounting periods
- `journal_entries` - Journal entry headers
- `journal_lines` - Journal entry lines

## Security

- Schema-per-client isolation (no organizationId filters)
- Better Auth for authentication
- CORS configured for trusted origins
- SQL injection prevention via Drizzle ORM
- Schema name validation for client switching

## Development Notes

- Environment variables must be loaded before importing API modules
- Better Auth uses custom password hashing (not bcrypt)
- Admin users must be created via the API endpoint (not direct DB insert)
- Client schemas must be provisioned before users can access them

## Troubleshooting

### "Invalid password hash" error
- Make sure you created the admin user with `pnpm create-admin` (not direct DB insert)
- The dev server must be running when creating users

### "DATABASE_URL not found" error
- Check that `apps/api/.env` exists and has DATABASE_URL set
- Verify the database connection string is correct

### CORS errors
- Verify WEB_URL in `apps/api/.env` matches your frontend URL
- Check that BETTER_AUTH_URL is set correctly

### Client not found (404)
- Make sure the client is provisioned: `pnpm provision-client <slug>`
- Check that `isProvisioned` and `isActive` are true in `client_registry`

## Production Deployment

See `docker-compose.yml` for containerized deployment. Use Dokploy or similar for SSL/reverse proxy.

Update environment variables for production:
- Set strong `BETTER_AUTH_SECRET`
- Use production database URL
- Set `NODE_ENV=production`
- Configure proper CORS origins
