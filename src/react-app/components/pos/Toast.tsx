import { createContext, useContext, useState, useCallback } from "preact/compat";
import type { ComponentChildren } from "preact";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

type ToastItem = {
  id: number;
  message: string;
  type: "success" | "error";
  action?: ToastAction;
};

const ToastContext = createContext<{
  toast: (message: string, type?: "success" | "error", action?: ToastAction) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (message: string, type: "success" | "error" = "success", action?: ToastAction) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type, action }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all animate-slide-up ${
              t.type === "success" ? "bg-emerald-600" : "bg-red-500"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{t.message}</span>
              {t.action && (
                <button
                  onClick={t.action.onClick}
                  className="shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
