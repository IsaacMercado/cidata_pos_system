import type { ComponentChildren } from "preact";

type Variant = "primary" | "accent" | "success" | "outline" | "ghost" | "danger" | "dark" | "light";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  children?: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onChange?: (e: Event) => void;
  onMouseDown?: (e: MouseEvent) => void;
  onMouseUp?: (e: MouseEvent) => void;
  name?: string;
  value?: string | number;
  id?: string;
  title?: string;
  ref?: any;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm",
  accent: "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-sm",
  success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-zinc-600 hover:bg-zinc-100",
  danger: "text-red-500 hover:bg-red-50",
  dark: "bg-zinc-900 text-white hover:bg-zinc-800",
  light: "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-1.5 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
