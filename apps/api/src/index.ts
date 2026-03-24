import "./env.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { auth } from "./lib/auth.js";
import { requireAuth, requireClientSchema, requireAdmin } from "./middleware/auth.js";
import coaRouter from "./routes/coa.js";
import adminRouter from "./routes/admin.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.WEB_URL,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Client-Slug"],
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth routes (public)
app.on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// Admin routes (require auth + admin role)
app.use("/api/admin/*", requireAuth);
app.use("/api/admin/*", requireAdmin);
app.route("/api/admin", adminRouter);

// Client routes (require auth + client schema)
app.use("/api/*", requireAuth);
app.use("/api/*", requireClientSchema);
app.route("/api/coa", coaRouter);

console.log(`🚀 API server starting on port ${env.PORT}`);

serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`✅ API server running at http://localhost:${env.PORT}`);
