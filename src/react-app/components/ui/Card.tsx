import type { ComponentChildren } from "preact";

interface CardProps {
  children: ComponentChildren;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = "", padding = true }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white/90 shadow-[0_20px_45px_rgba(15,23,42,0.08)] ${padding ? "p-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
