import type { ComponentChildren } from "preact";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  onClick?: () => void;
  children: ComponentChildren;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
  secondary: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  info: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  outline: "bg-transparent border border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-0.5 gap-1.5",
  lg: "text-sm px-2.5 py-1 gap-2",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-primary-500",
  secondary: "bg-neutral-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-cyan-500",
  outline: "bg-neutral-500",
};

export function Badge({
  variant = "default",
  size = "md",
  className = "",
  onClick,
  children,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border border-transparent ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      onClick={onClick}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
