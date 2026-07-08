import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { setCookie, getCookie } from "hono/cookie";
import { getJwtPayload, passwordHash } from "../lib/auth";
import type { Env } from "../index";

const auth = new Hono<Env>();

async function requireSuperuser(c: any, next: any) {
  const { error, payload } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error: "No autorizado" }, 401);

  const user = await c.env.DB.prepare(
    "SELECT id, is_superuser FROM users WHERE username = ?",
  )
    .bind(payload.sub)
    .first() as { id: number; is_superuser: number } | null;

  if (!user || !user.is_superuser) {
    return c.json({ error: "Acceso denegado: se requieren permisos de administrador" }, 403);
  }

  c.set("jwtPayload", payload);
  await next();
}

auth.post("/login", async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, username, name, role, is_superuser, created_at FROM users WHERE email = ? AND password_hash = ?",
  )
    .bind(email, await passwordHash(password))
    .first<{
      id: number;
      email: string;
      username: string;
      name: string;
      role: string;
      is_superuser: number;
      created_at: string;
    }>();

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const payload = {
    sub: user.username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const token = await sign(payload, c.env.JWT_SECRET);

  setCookie(c, "auth_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  return c.json({ user, token, success: true });
});

auth.get("/users", async (c) => {
  const users = await c.env.DB.prepare(
    "SELECT id, email, username, name, role, is_superuser, is_active, created_at FROM users ORDER BY created_at DESC",
  ).all();
  return c.json(users.results);
});

auth.get("/users/me", async (c) => {
  const { payload, error } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error }, 401);

  const user = await c.env.DB.prepare(
    "SELECT id, email, username, name, role, is_superuser, created_at FROM users WHERE username = ?",
  )
    .bind(payload.sub)
    .first<{
      id: number;
      email: string;
      username: string;
      name: string;
      role: string;
      is_superuser: number;
      created_at: string;
    }>();

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
  const { username, name, email, password, role } = await c.req.json<{
    username: string;
    name: string;
    email: string;
    password: string;
    role?: string;
  }>();

  if (!username || !name || !email || !password) {
    return c.json({ error: "username, name, email, and password are required" }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      "INSERT INTO users (username, name, email, pin, password_hash, role) VALUES (?, ?, ?, '', ?, ?)",
    )
      .bind(username, name, email, await passwordHash(password), role || "cashier")
      .run();
    return c.json({ id: result.meta.last_row_id, username, name, email }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("UNIQUE constraint")) {
      return c.json({ error: "Username or email already exists" }, 409);
    }
    return c.json({ error: message }, 500);
  }
});

auth.patch("/users/:id", requireSuperuser, async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<{
    name?: string;
    email?: string;
    role?: string;
    isActive?: number;
    isSuperuser?: number;
  }>();

  const sets: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) { sets.push("name = ?"); values.push(body.name); }
  if (body.email !== undefined) { sets.push("email = ?"); values.push(body.email); }
  if (body.role !== undefined) { sets.push("role = ?"); values.push(body.role); }
  if (body.isActive !== undefined) { sets.push("is_active = ?"); values.push(body.isActive); }
  if (body.isSuperuser !== undefined) { sets.push("is_superuser = ?"); values.push(body.isSuperuser); }

  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);

  values.push(id);
  try {
    await c.env.DB.prepare(
      `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
    ).bind(...values).run();
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

auth.delete("/users/:id", requireSuperuser, async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  try {
    await c.env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

auth.post("/users/change-password", async (c) => {
  const { error, payload } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error }, 401);

  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  if (!currentPassword || !newPassword) {
    return c.json({ error: "currentPassword and newPassword are required" }, 400);
  }

  if (newPassword.length < 4) {
    return c.json({ error: "New password must be at least 4 characters" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE username = ? AND password_hash = ?",
  )
    .bind(payload.sub, await passwordHash(currentPassword))
    .first<{ id: number }>();

  if (!user) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(await passwordHash(newPassword), user.id)
    .run();

  return c.json({ success: true });
});

auth.get("/users/permissions/:userId", async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  const screens = await c.env.DB.prepare(
    "SELECT screen FROM user_permissions WHERE user_id = ?",
  ).bind(userId).all();

  return c.json(screens.results.map((r: any) => r.screen));
});

auth.put("/users/permissions/:userId", requireSuperuser, async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  const { screens } = await c.req.json<{ screens: string[] }>();

  const db = c.env.DB;
  await db.prepare("DELETE FROM user_permissions WHERE user_id = ?").bind(userId).run();

  if (screens && screens.length > 0) {
    const stmt = db.prepare("INSERT INTO user_permissions (user_id, screen) VALUES (?, ?)");
    for (const screen of screens) {
      await stmt.bind(userId, screen).run();
    }
  }

  return c.json({ success: true, screens });
});

export default auth;
