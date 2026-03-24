import { publicDb } from "../apps/api/src/db/client.js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: "./apps/api/.env" });

async function provisionClient(clientSlug: string) {
  const client = await publicDb.query.clientRegistry.findFirst({
    where: (registry, { eq }) => eq(registry.organizationSlug, clientSlug),
  });

  if (!client) {
    console.error(`Client ${clientSlug} not found`);
    process.exit(1);
  }

  if (client.isProvisioned) {
    console.log(`Client ${clientSlug} is already provisioned`);
    return;
  }

  const schemaName = client.schemaName;
  console.log(`Provisioning schema: ${schemaName}`);

  const connectionString = process.env.DATABASE_URL!;
  const pg = postgres(connectionString);

  try {
    // Create schema
    await pg.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // Create tables in the new schema
    await pg.unsafe(`
      CREATE TABLE ${schemaName}.accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(20) NOT NULL,
        normal_balance VARCHAR(10) NOT NULL,
        parent_id UUID,
        description VARCHAR(500),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pg.unsafe(`
      CREATE TABLE ${schemaName}.vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200),
        phone VARCHAR(50),
        address VARCHAR(500),
        ap_account_id UUID NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pg.unsafe(`
      CREATE TABLE ${schemaName}.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200),
        phone VARCHAR(50),
        address VARCHAR(500),
        ar_account_id UUID NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pg.unsafe(`
      CREATE TABLE ${schemaName}.fiscal_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_closed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pg.unsafe(`
      CREATE TABLE ${schemaName}.journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entry_number VARCHAR(50) NOT NULL UNIQUE,
        entry_date TIMESTAMP NOT NULL,
        description VARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        fiscal_period_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pg.unsafe(`
      CREATE TABLE ${schemaName}.journal_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_entry_id UUID NOT NULL,
        account_id UUID NOT NULL,
        debit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
        credit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
        description VARCHAR(500),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Mark as provisioned
    await publicDb
      .update(publicDb._.fullSchema.clientRegistry)
      .set({ isProvisioned: true, updatedAt: new Date() })
      .where(sql`organization_slug = ${clientSlug}`);

    console.log(`✅ Client ${clientSlug} provisioned successfully`);
  } catch (error) {
    console.error("Provisioning failed:", error);
    throw error;
  } finally {
    await pg.end();
  }
}

const clientSlug = process.argv[2];
if (!clientSlug) {
  console.error("Usage: pnpm provision-client <client-slug>");
  process.exit(1);
}

provisionClient(clientSlug).catch(console.error);
