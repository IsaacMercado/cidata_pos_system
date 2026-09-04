import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { comboItems } from "../db/schema";
import type { Env } from "../index";

const app = new Hono<Env>();

const schema = z.object({
  comboProductId: z.number(),
  componentProductId: z.number(),
  quantity: z.number().min(0.01).default(1),
});

app.get("/:productId", async (c) => {
  const db = c.get("db");
  const productId = Number(c.req.param("productId"));

  const items = await db
    .select()
    .from(comboItems)
    .where(eq(comboItems.comboProductId, productId))
    .all();

  return c.json({ data: items });
});

app.post("/", async (c) => {
  return c.json({ error: "Los combos se administran en Odoo" }, 403);
});

app.patch("/:id", async (c) => {
  return c.json({ error: "Los combos se administran en Odoo" }, 403);
});

app.delete("/:id", async (c) => {
  return c.json({ error: "Los combos se administran en Odoo" }, 403);
});

export default app;
