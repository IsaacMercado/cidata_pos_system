import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useLocation } from "wouter-preact";
import { Button, Input } from "../components/ui";
import { api } from "../lib/api";

interface FormData {
  email: string;
  password: string;
}

export function LoginPage({ onLogin }: { onLogin: (user: any) => Promise<void> }) {
  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: { email: "", password: "" },
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const onSubmit: SubmitHandler<FormData> = async ({ email, password }) => {
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.login({ email, password });
      await onLogin(data.user);
      reset();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500 text-2xl font-bold text-white">
            P
          </div>
          <h1 className="text-2xl font-bold text-white">Punto de Venta</h1>
          <p className="mt-1 text-sm text-slate-400">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            type="email"
            placeholder="Email"
            autoFocus
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
            {...register("email", { required: true })}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
            {...register("password", { required: true })}
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium hover:bg-violet-500"
          >
            {loading ? "Entrando..." : "Iniciar Sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}
