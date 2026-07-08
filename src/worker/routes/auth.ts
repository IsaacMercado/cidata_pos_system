import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { userPermissions, users } from "../db/schema";
import type { Env } from "../index";
import { getJwtPayload, passwordHash } from "../lib/auth";

const auth = new Hono<Env>();

async function requireSuperuser(c: any, next: any) {
  const { error, payload } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error: "No autorizado" }, 401);

  const db = c.get("db");
  const user = await db
    .select({ id: users.id, isSuperuser: users.isSuperuser })
    .from(users)
    .where(eq(users.username, payload.sub as string))
    .get();

  if (!user || !user.isSuperuser) {
    return c.json(
      { error: "Acceso denegado: se requieren permisos de administrador" },
      403,
    );
  }

  c.set("jwtPayload", payload);
  await next();
}

auth.post("/login", async (c) => {
  const db = c.get("db");
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      role: users.role,
      isSuperuser: users.isSuperuser,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.passwordHash, await passwordHash(password)),
      ),
    )
    .get();

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const WEEK = 7 * 24 * 60 * 60;
  const payload = {
    sub: user.username,
    exp: Math.floor(Date.now() / 1000) + WEEK,
  };
  const token = await sign(payload, c.env.JWT_SECRET);

  setCookie(c, "auth_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: WEEK,
  });

  return c.json({ user, token, success: true });
});

auth.get("/users", async (c) => {
  const db = c.get("db");
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      role: users.role,
      isSuperuser: users.isSuperuser,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);
  return c.json(result);
});

auth.get("/users/me", async (c) => {
  const { payload, error } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error }, 401);

  const db = c.get("db");
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      role: users.role,
      isSuperuser: users.isSuperuser,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, payload.sub as string))
    .get();

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

auth.post("/logout", (c) => {
  setCookie(c, "auth_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
  return c.json({ success: true });
});

auth.post("/users", requireSuperuser, async (c) => {
  const db = c.get("db");
  const { username, name, email, password, role } = await c.req.json<{
    username: string;
    name: string;
    email: string;
    password: string;
    role?: string;
  }>();

  if (!username || !name || !email || !password) {
    return c.json(
      { error: "username, name, email, and password are required" },
      400,
    );
  }

  try {
    const result = await db
      .insert(users)
      .values({
        username,
        name,
        email,
        pin: "",
        passwordHash: await passwordHash(password),
        role: role || "cashier",
      })
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
      })
      .get();

    return c.json(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("UNIQUE constraint")) {
      return c.json({ error: "Username or email already exists" }, 409);
    }
    return c.json({ error: message }, 500);
  }
});

auth.patch("/users/:id", requireSuperuser, async (c) => {
  const db = c.get("db");
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<{
    name?: string;
    email?: string;
    role?: string;
    isActive?: number;
    isSuperuser?: number;
  }>();

  const values: Record<string, any> = {};
  if (body.name !== undefined) values.name = body.name;
  if (body.email !== undefined) values.email = body.email;
  if (body.role !== undefined) values.role = body.role;
  if (body.isActive !== undefined) values.isActive = body.isActive;
  if (body.isSuperuser !== undefined) values.isSuperuser = body.isSuperuser;

  if (Object.keys(values).length === 0)
    return c.json({ error: "No fields to update" }, 400);

  try {
    await db.update(users).set(values).where(eq(users.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

auth.delete("/users/:id", requireSuperuser, async (c) => {
  const db = c.get("db");
  const id = parseInt(c.req.param("id"), 10);
  try {
    await db.update(users).set({ isActive: 0 }).where(eq(users.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

auth.post("/users/change-password", async (c) => {
  const { error, payload } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error }, 401);

  const db = c.get("db");
  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  if (!currentPassword || !newPassword) {
    return c.json(
      { error: "currentPassword and newPassword are required" },
      400,
    );
  }

  if (newPassword.length < 4) {
    return c.json({ error: "New password must be at least 4 characters" }, 400);
  }

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.username, payload.sub as string),
        eq(users.passwordHash, (await passwordHash(currentPassword)) as string),
      ),
    )
    .get();

  if (!user) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  await db
    .update(users)
    .set({ passwordHash: await passwordHash(newPassword) })
    .where(eq(users.id, user.id))
    .run();

  return c.json({ success: true });
});

auth.get("/users/permissions/:userId", async (c) => {
  const db = c.get("db");
  const userId = parseInt(c.req.param("userId"), 10);
  const rows = await db
    .select({ screen: userPermissions.screen })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))
    .all();

  return c.json(rows.map((r) => r.screen));
});

auth.put("/users/permissions/:userId", requireSuperuser, async (c) => {
  const db = c.get("db");
  const userId = parseInt(c.req.param("userId"), 10);
  const { screens } = await c.req.json<{ screens: string[] }>();

  await db.delete(userPermissions).where(eq(userPermissions.userId, userId)).run();

  if (screens && screens.length > 0) {
    await db
      .insert(userPermissions)
      .values(screens.map((screen) => ({ userId, screen }))).run();
  }

  return c.json({ success: true, screens });
});

export default auth;
