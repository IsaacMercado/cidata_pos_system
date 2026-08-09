import { createContext, useContext, useState, useCallback, useEffect } from "preact/compat";
import type { ComponentChildren } from "preact";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
  action?: ToastAction;
  duration?: number;
}

const ToastContext = createContext<{
  toast: (
    message: string,
    type?: "success" | "error",
    action?: ToastAction,
    duration?: number,
  ) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;
let toastListener: ((item: Omit<ToastItem, "id">) => void) | null = null;
const pendingToasts: Omit<ToastItem, "id">[] = [];

// Lets code outside the React tree (e.g. the RxDB replication layer) trigger
// a toast without having access to the ToastContext.
export function emitToast(
  message: string,
  type: "success" | "error" = "success",
  action?: ToastAction,
  duration?: number,
) {
  const item = { message, type, action, duration };
  if (toastListener) {
    toastListener(item);
  } else {
    pendingToasts.push(item);
  }
}

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { ...item, id }]);
    const duration = item.duration ?? 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    toastListener = addToast;
    for (const item of pendingToasts.splice(0)) addToast(item);
    return () => {
      toastListener = null;
    };
  }, [addToast]);

  const toast = useCallback(
    (
      message: string,
      type: "success" | "error" = "success",
      action?: ToastAction,
      duration?: number,
    ) => {
      addToast({ message, type, action, duration });
    },
    [addToast],
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
