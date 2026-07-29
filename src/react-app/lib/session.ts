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

export function saveSession(session: LocalSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalSession) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
