import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createClientSchema, updateClientSchema } from "@accounting/shared";
import { publicDb } from "../db/client.js";
import { clientRegistry, user, account } from "../db/public-schema.js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { env } from "../env.js";

const adminRouter = new Hono();

// List all clients
adminRouter.get("/clients", async (c) => {
  const clients = await publicDb.query.clientRegistry.findMany({
    orderBy: (registry, { asc }) => [asc(registry.displayName)],
  });
  return c.json({ data: clients });
});

// Provision client schema
async function provisionClientSchema(schemaName: string): Promise<void> {
  const pg = postgres(env.DATABASE_URL);

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
  } finally {
    await pg.end();
  }
}

// Create new client
adminRouter.post("/clients", zValidator("json", createClientSchema), async (c) => {
  const data = c.req.valid("json");
  const schemaName = `client_${data.organizationSlug}`;

  try {
    // Create client record
    const [created] = await publicDb
      .insert(clientRegistry)
      .values({
        organizationSlug: data.organizationSlug,
        schemaName,
        displayName: data.displayName,
        isProvisioned: false,
      })
      .returning();

    // Automatically provision the schema
    await provisionClientSchema(schemaName);

    // Mark as provisioned
    const [provisioned] = await publicDb
      .update(clientRegistry)
      .set({ isProvisioned: true, updatedAt: new Date() })
      .where(eq(clientRegistry.id, created.id))
      .returning();

    return c.json({ data: provisioned }, 201);
  } catch (error: any) {
    console.error("Error creating client:", error);
    
    // If provisioning failed, try to clean up
    try {
      await publicDb
        .delete(clientRegistry)
        .where(eq(clientRegistry.organizationSlug, data.organizationSlug));
    } catch (cleanupError) {
      console.error("Error cleaning up after failed provisioning:", cleanupError);
    }
    
    return c.json({ error: "Failed to create and provision client", details: error.message }, 500);
  }
});

// Update client
adminRouter.patch("/clients/:id", zValidator("json", updateClientSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const [updated] = await publicDb
    .update(clientRegistry)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clientRegistry.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Client not found" }, 404);
  }

  return c.json({ data: updated });
});

// Get client by ID
adminRouter.get("/clients/:id", async (c) => {
  const id = c.req.param("id");
  const client = await publicDb.query.clientRegistry.findFirst({
    where: (registry, { eq }) => eq(registry.id, id),
  });

  if (!client) {
    return c.json({ error: "Client not found" }, 404);
  }

  return c.json({ data: client });
});

// User management routes

// List all users
adminRouter.get("/users", async (c) => {
  const users = await publicDb.query.user.findMany({
    orderBy: (user, { asc }) => [asc(user.email)],
  });
  return c.json({ data: users });
});

// Create user
adminRouter.post("/users", async (c) => {
  const body = await c.req.json();
  const { email, password, name, clientSlug } = body;

  if (!email || !password || !name || !clientSlug) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  try {
    // Verify client exists and is provisioned
    const client = await publicDb.query.clientRegistry.findFirst({
      where: (registry, { eq }) => eq(registry.organizationSlug, clientSlug),
    });

    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    if (!client.isProvisioned || !client.isActive) {
      return c.json({ error: "Client is not active or not provisioned" }, 400);
    }

    // Create user via Better Auth signup endpoint
    const signupResponse = await fetch(`${env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": env.WEB_URL,
      },
      body: JSON.stringify({ email, password, name }),
    });

    const signupData = await signupResponse.json();

    if (!signupResponse.ok) {
      return c.json({ error: signupData.message || "Failed to create user" }, signupResponse.status);
    }

    const userId = signupData.user?.id;
    if (!userId) {
      return c.json({ error: "User ID not found" }, 500);
    }

    // Update user metadata
    await publicDb
      .update(user)
      .set({
        metadata: JSON.stringify({ clientSlug }),
        emailVerified: true,
      })
      .where(eq(user.id, userId));

    const createdUser = await publicDb.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    return c.json({ data: createdUser }, 201);
  } catch (error: any) {
    console.error("Error creating user:", error);
    return c.json({ error: "Failed to create user", details: error.message }, 500);
  }
});

// Delete user
adminRouter.delete("/users/:email", async (c) => {
  const email = decodeURIComponent(c.req.param("email"));

  try {
    // Delete account first (foreign key)
    await publicDb.delete(account).where(eq(account.accountId, email));

    // Delete user
    const deleted = await publicDb.delete(user).where(eq(user.email, email)).returning();

    if (deleted.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ data: { success: true } });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Failed to delete user", details: error.message }, 500);
  }
});

// Disable user (soft delete + ban)
adminRouter.post("/users/:userId/disable", async (c) => {
  const userId = c.req.param("userId");

  try {
    const [updated] = await publicDb
      .update(user)
      .set({
        banned: true,
        bannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();

    if (!updated) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ data: updated });
  } catch (error: any) {
    console.error("Error disabling user:", error);
    return c.json({ error: "Failed to disable user", details: error.message }, 500);
  }
});

// Enable user
adminRouter.post("/users/:userId/enable", async (c) => {
  const userId = c.req.param("userId");

  try {
    const [updated] = await publicDb
      .update(user)
      .set({
        banned: false,
        bannedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();

    if (!updated) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ data: updated });
  } catch (error: any) {
    console.error("Error enabling user:", error);
    return c.json({ error: "Failed to enable user", details: error.message }, 500);
  }
});

export default adminRouter;
