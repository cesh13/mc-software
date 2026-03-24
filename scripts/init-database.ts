import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: "./apps/api/.env" });

const connectionString = process.env.DATABASE_URL!;

async function initDatabase() {
  const sql = postgres(connectionString);

  try {
    console.log("🔧 Initializing database...");

    // Create Better Auth tables
    console.log("Creating Better Auth tables...");
    
    await sql`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        name TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        image TEXT,
        metadata JSONB
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMP,
        refresh_token_expires_at TIMESTAMP,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(provider_id, account_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create client_registry table
    console.log("Creating client_registry table...");
    
    await sql`
      CREATE TABLE IF NOT EXISTS client_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_slug VARCHAR(100) NOT NULL UNIQUE,
        schema_name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(200) NOT NULL,
        is_provisioned BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    console.log("✅ Database initialized successfully!");
    console.log("\nNext steps:");
    console.log("1. Run: pnpm create-admin <email> <password> [name]");
    console.log("2. Start the dev server: pnpm dev");
    console.log("3. Log in at http://localhost:3000/login");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

initDatabase().catch(console.error);
