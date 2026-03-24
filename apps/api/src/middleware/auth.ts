import { Context, Next } from "hono";
import { auth } from "../lib/auth.js";
import { getSchemaForClient, getClientDb, publicDb } from "../db/client.js";

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is banned
  if (session.user.banned) {
    return c.json({ error: "Account has been disabled" }, 403);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
}

export async function requireClientSchema(c: Context, next: Next) {
  const clientSlug = c.req.header("X-Client-Slug");

  if (!clientSlug) {
    return c.json({ error: "X-Client-Slug header required" }, 400);
  }

  const schemaName = await getSchemaForClient(clientSlug);

  if (!schemaName) {
    return c.json({ error: "Client not found or not provisioned" }, 404);
  }

  // Verify user belongs to this client
  const user = c.get("user");
  
  // Parse metadata if it's a string
  let userMeta: { role?: string; clientSlug?: string } | undefined;
  
  if (typeof user.metadata === "string") {
    try {
      userMeta = JSON.parse(user.metadata);
    } catch {
      userMeta = undefined;
    }
  } else {
    userMeta = user.metadata as { role?: string; clientSlug?: string } | undefined;
  }
  
  if (userMeta?.clientSlug !== clientSlug && userMeta?.role !== "admin") {
    return c.json({ error: "Access denied to this client" }, 403);
  }

  const db = await getClientDb(schemaName);
  c.set("db", db);
  c.set("schemaName", schemaName);
  c.set("clientSlug", clientSlug);

  await next();
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user");
  
  console.log("requireAdmin - user:", user);
  console.log("requireAdmin - metadata type:", typeof user.metadata);
  console.log("requireAdmin - metadata value:", user.metadata);
  
  // Parse metadata if it's a string
  let userMeta: { role?: string; clientSlug?: string } | undefined;
  
  if (typeof user.metadata === "string") {
    try {
      userMeta = JSON.parse(user.metadata);
      console.log("requireAdmin - parsed metadata:", userMeta);
    } catch (e) {
      console.log("requireAdmin - failed to parse metadata:", e);
      userMeta = undefined;
    }
  } else {
    userMeta = user.metadata as { role?: string; clientSlug?: string } | undefined;
  }

  console.log("requireAdmin - final userMeta:", userMeta);
  console.log("requireAdmin - role check:", userMeta?.role, "=== 'admin'?", userMeta?.role === "admin");

  if (userMeta?.role !== "admin") {
    return c.json({ error: "Admin access required", metadata: user.metadata, parsed: userMeta }, 403);
  }

  await next();
}
