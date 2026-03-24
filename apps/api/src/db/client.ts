import "../env.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";
import * as publicSchema from "./public-schema.js";
import { env, validateEnv } from "../env.js";

validateEnv();

const connectionString = env.DATABASE_URL;

// Public DB connection (for auth tables and client_registry)
const publicClient = postgres(connectionString, { 
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const publicDb = drizzle(publicClient, { schema: { ...publicSchema } });

// Cache for schema lookups (5 min TTL)
const schemaCache = new Map<string, { schemaName: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getSchemaForClient(clientSlug: string): Promise<string | null> {
  const cached = schemaCache.get(clientSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.schemaName;
  }

  const client = await publicDb.query.clientRegistry.findFirst({
    where: (registry, { eq, and }) => 
      and(
        eq(registry.organizationSlug, clientSlug),
        eq(registry.isProvisioned, true),
        eq(registry.isActive, true)
      ),
  });

  if (!client) return null;

  schemaCache.set(clientSlug, {
    schemaName: client.schemaName,
    timestamp: Date.now(),
  });

  return client.schemaName;
}

export async function getClientDb(schemaName: string) {
  // Validate schema name to prevent SQL injection
  if (!/^client_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error("Invalid schema name");
  }

  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });

  // Set search_path for this connection
  await db.execute(sql`SET search_path TO ${sql.identifier(schemaName)}, public`);

  return db;
}

export async function withClientTransaction<T>(
  schemaName: string,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const db = await getClientDb(schemaName);
  return await db.transaction(fn);
}
