import type { ComponentChildren } from "preact";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ComponentChildren;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "text-emerald-700 bg-emerald-50 border border-emerald-200",
  warning: "text-amber-600 bg-amber-50 border border-amber-200",
  danger: "text-red-600 bg-red-50 border border-red-200",
  info: "bg-indigo-100 text-indigo-700",
  neutral: "bg-zinc-100 text-zinc-600",
  accent: "bg-amber-100 text-amber-700",
};

export function Badge({ variant = "neutral", className = "", children }: BadgeProps) {
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
