import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { api } from "../lib/api";
import { Button } from "./ui";

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { register, handleSubmit, reset } = useForm<FormData>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const onSubmit: SubmitHandler<FormData> = async ({ currentPassword, newPassword, confirmPassword }) => {
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    if (newPassword.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres");
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setSuccess(true);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar contraseña");
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
          <h2 className="text-lg font-semibold text-white">Cambiar Contraseña</h2>
          <button
            className="text-2xl leading-none text-slate-400 hover:text-white"
            onClick={onClose}
            aria-label="close"
          >
            &times;
          </button>
        </div>

        {success ? (
          <div className="text-center">
            <p className="text-green-400 mb-4">Contraseña cambiada exitosamente</p>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} class="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Contraseña actual"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...register("currentPassword", { required: true })}
            />
            <input
              type="password"
              placeholder="Nueva contraseña"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...register("newPassword", { required: true })}
            />
            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
              {...register("confirmPassword", { required: true })}
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
              {loading ? "..." : "Cambiar Contraseña"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
