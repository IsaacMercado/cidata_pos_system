import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema, logger: false });
}

export type Db = ReturnType<typeof createDb>;
