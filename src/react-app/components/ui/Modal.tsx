import type { ComponentChildren } from "preact";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

export function Modal({ open, onClose, children, size = "md", className = "" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeClasses[size]} rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
