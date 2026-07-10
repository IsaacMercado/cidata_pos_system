import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useLocation } from "wouter-preact";
import { Button, Input } from "../components/ui";
import { api } from "../lib/api";
import { verifyPin } from "../lib/pin";
import { getCachedOperator } from "../lib/db";

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
    is_superuser: number;
  };
  token: string | null;
  success: boolean;
  offline?: boolean;
}

export function LoginPage({
  onLogin,
}: {
  onLogin: (result: LoginResult) => Promise<void>;
}) {
  const [tab, setTab] = useState<"email" | "pin">("pin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const emailForm = useForm<EmailForm>({ defaultValues: { email: "", password: "" } });
  const pinForm = useForm<PinForm>({ defaultValues: { username: "", pin: "" } });

  const submitEmail: SubmitHandler<EmailForm> = async ({ email, password }) => {
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.login({ email, password });
      await onLogin({
        user: { ...data.user, is_superuser: data.user.isSuperuser ?? data.user.is_superuser ?? 0 },
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
      // Try online first (works on any network client: Android, PC script, browser).
      const data = await api.auth.loginPin({ username, pin });
      await onLogin({
        user: { ...data.user, is_superuser: data.user.isSuperuser ?? data.user.is_superuser ?? 0 },
        token: data.token,
        success: true,
      });
      navigate("/");
      return;
    } catch (err) {
      // Network failure → attempt offline PIN verification against cached operators.
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error && /Failed to fetch|network/i.test(err.message));
      if (!isNetworkError) {
        setError(err instanceof Error ? err.message : "PIN inválido");
        return;
      }
    }

    try {
      const cached = await getCachedOperator(username);
      if (!cached) {
        setError("Sin conexión y operador no sincronizado. Conéctate a internet.");
        return;
      }
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
          is_superuser: cached.isSuperuser,
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
    <div class="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500 text-2xl font-bold text-white">
            P
          </div>
          <h1 class="text-2xl font-bold text-white">Punto de Venta</h1>
          <p class="mt-1 text-sm text-slate-400">Inicia sesión para continuar</p>
        </div>

        <div class="mb-4 flex rounded-lg bg-slate-800 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("pin")}
            class={`flex-1 rounded-md py-1.5 font-medium ${tab === "pin" ? "bg-violet-600 text-white" : "text-slate-400"}`}
          >
            Operador (PIN)
          </button>
          <button
            type="button"
            onClick={() => setTab("email")}
            class={`flex-1 rounded-md py-1.5 font-medium ${tab === "email" ? "bg-violet-600 text-white" : "text-slate-400"}`}
          >
            Admin (Email)
          </button>
        </div>

        {tab === "email" ? (
          <form onSubmit={emailForm.handleSubmit(submitEmail)} class="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="Email"
              autoFocus
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...emailForm.register("email", { required: true })}
            />
            <Input
              type="password"
              placeholder="Contraseña"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...emailForm.register("password", { required: true })}
            />
            {error && <p class="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium hover:bg-violet-500">
              {loading ? "Entrando..." : "Iniciar Sesión"}
            </Button>
          </form>
        ) : (
          <form onSubmit={pinForm.handleSubmit(submitPin)} class="flex flex-col gap-4">
            <Input
              placeholder="Usuario"
              autoFocus
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...pinForm.register("username", { required: true })}
            />
            <Input
              type="password"
              placeholder="PIN"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...pinForm.register("pin", { required: true })}
            />
            {error && <p class="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium hover:bg-violet-500">
              {loading ? "Entrando..." : "Abrir Turno"}
            </Button>
            <p class="text-center text-xs text-slate-500">
              Funciona sin internet si ya iniciaste sesión antes.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
