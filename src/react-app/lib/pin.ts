// PBKDF2-SHA256 offline PIN verification (mirrors src/worker/lib/auth.ts format).
// Runs on the device (no Cloudflare CPU limit), so it can be as strong as needed.

const ALGO = { name: "PBKDF2", hash: "SHA-256" } as const;

function toHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToArray(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Verifies a PIN against a stored hash (pbkdf2_sha256$ITER$SALT$HASH).
// Iterations are read from the stored string, so the device can use higher counts
// than the Worker's online budget without breaking compatibility.
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("pbkdf2_sha256$")) return false;
  const [, , iterationsStr, saltHex, hashHex] = stored.split("$");
  const iterations = parseInt(iterationsStr, 10);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    ALGO,
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { ...ALGO, salt: hexToArray(saltHex) as BufferSource, iterations },
    key,
    256,
  );
  return timingSafeEqual(toHex(new Uint8Array(hash)), hashHex);
}
