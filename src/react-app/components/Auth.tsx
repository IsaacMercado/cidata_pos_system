import {
  createContext,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "wouter-preact";
import { api } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/session";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { type LoginResult } from "../pages/LoginPage";
import { Loading } from "./ui";

export type UserInfo = {
  id: number;
  email: string;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  isSuperuser: number;
};

type AuthContextType = {
  user: UserInfo | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean | undefined;
  handleLogin: (result: LoginResult) => Promise<void>;
  handleLogout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ALL_SCREENS = [
  "pos",
  "products",
  "customers",
  "sales",
  "restaurants",
  "purchases",
];

function offlinePermissions(u: UserInfo): string[] {
  return u.isSuperuser
    ? [...ALL_SCREENS, "users"]
    : ["pos", "customers", "sales"];
}

export const AuthProvider = ({ children }: { children: ReactElement }) => {
  const online = useOnlineStatus();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [restoring, setRestoring] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setUser(session.user);
      setPermissions(
        session.permissions?.length
          ? session.permissions
          : offlinePermissions(session.user),
      );
      setRestoring(false);
      return;
    }

    if (!online) {
      setRestoring(false);
      return;
    }

    api.auth
      .me()
      .then(async (user: any) => {
        if (user) {
          setUser(user);
          setPermissions(user.permissions);
        }
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, [online]);

  useEffect(() => {
    if (!restoring && !user) {
      navigate("/login");
    }
  }, [navigate, restoring, user]);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  const handleLogin = async (result: LoginResult) => {
    setUser(result.user);

    const perms = result.offline
      ? offlinePermissions(result.user)
      : result.user.permissions;
    setPermissions(perms);

    saveSession({
      user: result.user,
      token: result.token,
      offline: !!result.offline,
      permissions: perms,
      cachedAt: new Date().toISOString(),
    });
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    clearSession();
    setUser(null);
    setPermissions([]);
    navigate("/login");
  };

  if (restoring) return <Loading fullPage text="Restaurando sesión..." />;

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        hasPermission,
        handleLogin,
        handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
};
