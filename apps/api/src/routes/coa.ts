import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createAccountSchema, updateAccountSchema } from "@accounting/shared";
import { accounts } from "../db/schema.js";
import { eq } from "drizzle-orm";

const coaRouter = new Hono();

coaRouter.get("/", async (c) => {
  const db = c.get("db");
  const items = await db.query.accounts.findMany({
    where: eq(accounts.isActive, true),
    orderBy: (accounts, { asc }) => [asc(accounts.code)],
  });
  return c.json({ data: items });
});

coaRouter.post("/", zValidator("json", createAccountSchema), async (c) => {
  const db = c.get("db");
  const data = c.req.valid("json");

  const [created] = await db.insert(accounts).values(data).returning();
  return c.json({ data: created }, 201);
});

coaRouter.patch("/:id", zValidator("json", updateAccountSchema), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const [updated] = await db
    .update(accounts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(accounts.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Account not found" }, 404);
  }

  return c.json({ data: updated });
});

coaRouter.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [updated] = await db
    .update(accounts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(accounts.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Account not found" }, 404);
  }

  return c.json({ data: { success: true } });
});

export default coaRouter;
