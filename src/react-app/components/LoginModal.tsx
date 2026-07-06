import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { api } from "../lib/api";

type AuthMode = "login" | "register";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (user: { id: number; email: string; username: string }) => void;
}

interface FormData {
  email: string;
  username: string;
  password: string;
}

export function LoginModal({ open, onClose, onLogin }: LoginModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      email: "",
      username: "",
      password: "",
    },
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError("");
  };

  const onSubmit: SubmitHandler<FormData> = async ({ email, username, password }) => {
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const data = await api.auth.login({ email, password });
        onLogin(data.user);
      } else {
        await api.auth.register({ email, username, password });
        const data = await api.auth.login({ email, password });
        onLogin(data.user);
      }
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
          <div className="flex gap-2">
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>
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
          {mode === "register" && (
            <input
              type="text"
              placeholder="Username"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...register("username", { required: true })}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
            {...register("password", { required: true })}
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
