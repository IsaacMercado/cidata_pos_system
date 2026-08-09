import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { api } from "../lib/api";
import { Button, CardTitle, Input } from "./ui";

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
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
           <CardTitle>Cambiar contraseña</CardTitle>
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
           <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
             <Input label="Contraseña actual" type="password" {...register("currentPassword", { required: true })} />
             <Input label="Nueva contraseña" type="password" {...register("newPassword", { required: true })} />
             <Input label="Confirmar nueva contraseña" type="password" {...register("confirmPassword", { required: true })} />
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
