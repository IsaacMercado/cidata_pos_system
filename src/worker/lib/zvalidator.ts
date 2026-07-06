import { z } from "zod";
import type { Context } from "hono";
import type { Env } from "../index";

type AppContext = Context<Env>;

export async function validateJson<T extends z.ZodType>(
  c: AppContext,
  schema: T,
): Promise<z.infer<T>> {
  const data = await c.req.json();
  return schema.parse(data);
}

export function validationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return { error: "Invalid request", details: error.issues };
  }
  return { error: "Invalid request body" };
}
