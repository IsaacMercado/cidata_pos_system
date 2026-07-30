import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { comboItems, products } from "../db/schema";
import type { Env } from "../index";
import { validateJson, validationError } from "../lib/zvalidator";

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
  const db = c.get("db");

  let body: z.infer<typeof schema>;
  try { body = await validateJson(c, schema); }
  catch (e) { return c.json(validationError(e), 400); }

  // Verify both products exist and combo is type 'combo'
  const combo = await db
    .select({ productType: products.productType })
    .from(products)
    .where(eq(products.id, body.comboProductId))
    .get();
  if (!combo || combo.productType !== "combo") {
    return c.json({ error: "El producto combo debe ser de tipo 'combo'" }, 400);
  }

  const component = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, body.componentProductId))
    .get();
  if (!component) {
    return c.json({ error: "Producto componente no encontrado" }, 404);
  }

  const result = await db
    .insert(comboItems)
    .values(body)
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  let body: z.infer<typeof schema>;
  try { body = await validateJson(c, schema); }
  catch (e) { return c.json(validationError(e), 400); }

  const result = await db
    .update(comboItems)
    .set(body)
    .where(eq(comboItems.id, id))
    .returning()
    .get();

  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json({ data: result });
});

app.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db.delete(comboItems).where(eq(comboItems.id, id)).run();
  return c.json({ success: true });
});

export default app;
