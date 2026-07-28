import type { ComponentChildren, ButtonHTMLAttributes } from "preact";

type Variant = "primary" | "secondary" | "success" | "warning" | "danger" | "outline" | "ghost" | "link" | "accent" | "dark" | "light";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: ComponentChildren;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm dark:bg-primary-500 dark:hover:bg-primary-600",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 shadow-sm dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm dark:bg-emerald-500 dark:hover:bg-emerald-600",
  warning: "bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm dark:bg-red-500 dark:hover:bg-red-600",
  outline: "border border-neutral-300 bg-transparent hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-600 dark:hover:bg-neutral-800",
  ghost: "bg-transparent hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-800",
  link: "bg-transparent text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline dark:text-primary-400 dark:hover:text-primary-300",
  accent: "bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-sm",
  dark: "bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm dark:bg-neutral-900 dark:hover:bg-neutral-800",
  light: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 shadow-sm dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
  icon: "p-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        active:scale-[0.98] rounded-lg
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
      disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function ButtonGroup({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <div className={`inline-flex rounded-lg ${className}`}>{children}</div>;
}