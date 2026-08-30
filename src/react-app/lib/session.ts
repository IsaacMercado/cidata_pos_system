// Local session persistence so the POS can open its shift without internet.
// When offline, token is null and operations are queued as pending_ops.

export interface LocalSession {
  user: {
    id: number;
    email: string;
    username: string;
    name: string;
    role: string;
    permissions: string[];
    isSuperuser: number;
  };
  token: string | null;
  offline: boolean;
  permissions: string[];
  cachedAt: string;
}

const KEY = "pos_session";
const configuredMaxAge = Number(import.meta.env.VITE_OFFLINE_SESSION_MAX_AGE_MS);
export const OFFLINE_SESSION_MAX_AGE_MS = Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
  ? configuredMaxAge
  : 12 * 60 * 60 * 1000;

export function saveSession(session: LocalSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as LocalSession;
    const cachedAt = Date.parse(session.cachedAt);
    if (!session.user || !Number.isFinite(cachedAt) || Date.now() - cachedAt > OFFLINE_SESSION_MAX_AGE_MS) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
