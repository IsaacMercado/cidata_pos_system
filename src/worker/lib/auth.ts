import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import type { Context, Next } from "hono";

export const getJwtPayload = async (c: Context) => {
  let token: string | undefined;

  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  if (!token) {
    token = getCookie(c, "auth_token");
  }

  if (!token) {
    return { error: "No autorizado", payload: undefined as Record<string, unknown> | undefined };
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    return { error: undefined, payload };
  } catch {
    return { error: "Token inválido o expirado", payload: undefined };
  }
};

export const middlewareJwtPayload = async (c: Context, next: Next) => {
  const { error, payload } = await getJwtPayload(c);
  if (error) return c.json({ error }, 401);
  c.set("jwtPayload", payload);
  await next();
};

export const passwordHash = async (password: string) => {
  const hash = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(password))
    .then((hash) => {
      const hex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hex;
    });
  return hash;
};
