import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";
import { customers } from "../db/schema";
import { eq, like, and } from "drizzle-orm";

const app = new Hono<Env>();

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  documentType: z.string().default("CI"),
  documentNumber: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
});

const updateSchema = createSchema.partial();

app.get("/", async (c) => {
  const db = c.get("db");
  const search = c.req.query("search");
  const active = c.req.query("active");

  const conditions = [];
  if (search) {
    conditions.push(
      like(customers.name, `%${search}%`),
    );
  }
  if (active !== undefined) conditions.push(eq(customers.isActive, Number(active)));

  const result = await db
    .select()
    .from(customers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(customers.name)
    .all();

  return c.json({ data: result });
});

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const customer = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .get();

  if (!customer) return c.json({ error: "Customer not found" }, 404);
  return c.json({ data: customer });
});

app.post("/", async (c) => {
  const db = c.get("db");
  let body: z.infer<typeof createSchema>;
  try {
    body = await validateJson(c, createSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.code, body.code))
    .get();

  if (existing) return c.json({ error: "Customer code already exists" }, 409);

  const result = await db
    .insert(customers)
    .values(body)
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  let body: z.infer<typeof updateSchema>;
  try {
    body = await validateJson(c, updateSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .get();

  if (!existing) return c.json({ error: "Customer not found" }, 404);

  const result = await db
    .update(customers)
    .set(body)
    .where(eq(customers.id, id))
    .returning()
    .get();

  return c.json({ data: result });
});

export default app;
