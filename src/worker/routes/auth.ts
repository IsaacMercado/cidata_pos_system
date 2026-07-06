import { Hono } from "hono";
import { sign } from "hono/jwt";
import { setCookie } from "hono/cookie";
import { getJwtPayload, passwordHash } from "../lib/auth";
import type { Env } from "../index";

const auth = new Hono<Env>();

auth.post("/register", async (c) => {
  const { email, username, password } = await c.req.json<{
    email: string;
    username: string;
    password: string;
  }>();

  if (!email || !username || !password) {
    return c.json({ error: "email, username, and password are required" }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      "INSERT INTO users (email, username, name, pin, password_hash) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(email, username, username, "", await passwordHash(password))
      .run();

    return c.json({ id: result.meta.last_row_id, email, username }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("UNIQUE constraint")) {
      return c.json({ error: "Email or username already exists" }, 409);
    }
    return c.json({ error: message }, 500);
  }
});

auth.post("/login", async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, username, name, role, created_at FROM users WHERE email = ? AND password_hash = ?",
  )
    .bind(email, await passwordHash(password))
    .first<{
      id: number;
      email: string;
      username: string;
      name: string;
      role: string;
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
    "SELECT id, email, username, name, role, created_at FROM users ORDER BY created_at DESC",
  ).all();
  return c.json(users.results);
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

auth.get("/users/me", async (c) => {
  const { payload, error } = await getJwtPayload(c);
  if (error || !payload) return c.json({ error }, 401);

  const user = await c.env.DB.prepare(
    "SELECT id, email, username, name, role, created_at FROM users WHERE username = ?",
  )
    .bind(payload.sub)
    .first<{
      id: number;
      email: string;
      username: string;
      name: string;
      role: string;
      created_at: string;
    }>();

  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json(user);
});

export default auth;
