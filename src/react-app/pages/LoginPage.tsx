import { useEffect, useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useLocation } from "wouter-preact";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "../components/ui";
import { api } from "../lib/api";
import { getDatabase } from "../lib/database";
import { verifyPin } from "../lib/pin";
import { loadSession } from "../lib/session";

interface EmailForm {
  email: string;
  password: string;
}

interface PinForm {
  username: string;
  pin: string;
}

export interface LoginResult {
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
  success: boolean;
  offline?: boolean;
}

export function LoginPage({ onLogin }: { onLogin: (result: LoginResult) => Promise<void> }) {
  const [tab, setTab] = useState<"email" | "pin">("pin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const session = loadSession();
    if (session) navigate("/");
  }, [navigate]);

  const emailForm = useForm<EmailForm>({ defaultValues: { email: "", password: "" } });
  const pinForm = useForm<PinForm>({ defaultValues: { username: "", pin: "" } });

  const submitEmail: SubmitHandler<EmailForm> = async ({ email, password }) => {
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.login({ email, password });
      await onLogin({
        user: data.user,
        token: data.token,
        success: true,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  const submitPin: SubmitHandler<PinForm> = async ({ username, pin }) => {
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.loginPin({ username, pin });
      await onLogin({
        user: { ...data.user, isSuperuser: data.user.isSuperuser ?? data.user.isSuperuser ?? 0 },
        token: data.token,
        success: true,
      });
      navigate("/");
      return;
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error && /Failed to fetch|network/i.test(err.message));
      if (!isNetworkError) {
        setError(err instanceof Error ? err.message : "PIN inválido");
        return;
      }
    }

    try {
      const db = await getDatabase();
      const op = await db.operators.findOne({ selector: { username } }).exec();
      if (!op) {
        setError("Sin conexión y operador no sincronizado. Conéctate a internet.");
        return;
      }

      const cached = op.toJSON();
      const ok = await verifyPin(pin, cached.pinHash);
      if (!ok) {
        setError("PIN incorrecto");
        return;
      }

      await onLogin({
        user: {
          id: cached.id,
          email: "",
          username: cached.username,
          name: cached.name,
          role: cached.role,
          permissions: (cached as any).permissions ?? [],
          isSuperuser: cached.isSuperuser,
        },
        token: null,
        success: true,
        offline: true,
      });
      navigate("/");
    } catch {
      setError("No se pudo verificar el PIN localmente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-2xl font-bold text-white">
            P
          </div>
          <CardTitle className="text-2xl font-bold">Punto de Venta</CardTitle>
          <CardDescription>Inicia sesión para continuar</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1 text-sm" role="tablist" aria-label="Método de inicio de sesión">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "pin"}
              onClick={() => setTab("pin")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === "pin" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              Operador (PIN)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "email"}
              onClick={() => setTab("email")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                tab === "email" ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              Admin (Email)
            </button>
          </div>

          {tab === "email" ? (
            <form onSubmit={emailForm.handleSubmit(submitEmail)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="Email"
                autoFocus
                error={error}
                {...emailForm.register("email", { required: true })}
              />
              <Input
                label="Contraseña"
                type="password"
                placeholder="Contraseña"
                error={error}
                {...emailForm.register("password", { required: true })}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Entrando..." : "Iniciar Sesión"}
              </Button>
            </form>
          ) : (
            <form onSubmit={pinForm.handleSubmit(submitPin)} className="space-y-4">
              <Input
                label="Usuario"
                placeholder="Usuario"
                autoFocus
                error={error}
                {...pinForm.register("username", { required: true })}
              />
              <Input
                label="PIN"
                type="password"
                placeholder="PIN"
                error={error}
                {...pinForm.register("pin", { required: true })}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Entrando..." : "Abrir Turno"}
              </Button>
              <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                Funciona sin internet si ya iniciaste sesión antes.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
