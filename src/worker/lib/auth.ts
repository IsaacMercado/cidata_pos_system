import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";

// Iteraciones ajustadas al límite de CPU del free tier de Cloudflare (~10ms/req).
// El login online es un evento raro; el resto de requests solo verifica el JWT (microsegundos).
// El PIN offline se verifica en el dispositivo (sin límite de CPU), reutilizando este mismo formato.
export const PBKDF2_ITERATIONS = 10_000;
const PBKDF2_ALGO = { name: "PBKDF2", hash: "SHA-256" } as const;

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToArray(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

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

export const passwordHash = async (password: string, salt?: string): Promise<string> => {
  const encoder = new TextEncoder();
  const saltBytes = salt ? hexToArray(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), PBKDF2_ALGO, false, [
    "deriveBits",
  ]);
  const hash = await crypto.subtle.deriveBits(
    { ...PBKDF2_ALGO, salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${arrayToHex(saltBytes)}$${arrayToHex(new Uint8Array(hash))}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  if (!stored.startsWith("pbkdf2_sha256$")) return false;
  const parts = stored.split("$");
  const iterationsStr = parts[1];
  const saltHex = parts[2];
  const hashHex = parts[3];
  const iterations = parseInt(iterationsStr, 10);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), PBKDF2_ALGO, false, [
    "deriveBits",
  ]);
  const hash = await crypto.subtle.deriveBits(
    { ...PBKDF2_ALGO, salt: hexToArray(saltHex), iterations },
    key,
    256,
  );
  const computed = arrayToHex(new Uint8Array(hash));
  return timingSafeEqual(computed, hashHex);
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
