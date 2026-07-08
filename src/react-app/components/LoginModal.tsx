import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { api } from "../lib/api";
import { Button } from "./ui";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (user: any) => void;
}

interface FormData {
  email: string;
  password: string;
}

export function LoginModal({ open, onClose, onLogin }: LoginModalProps) {
  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const onSubmit: SubmitHandler<FormData> = async ({ email, password }) => {
    setError("");
    setLoading(true);

    try {
      const data = await api.auth.login({ email, password });
      onLogin(data.user);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Iniciar Sesión</h2>
          <button
            className="text-2xl leading-none text-slate-400 hover:text-white"
            onClick={onClose}
            aria-label="close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} class="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
            {...register("email", { required: true })}
          />
          <input
            type="password"
            placeholder="Password"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
            {...register("password", { required: true })}
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            className="rounded-lg bg-violet-600 hover:bg-violet-500"
          >
            {loading ? "..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}
