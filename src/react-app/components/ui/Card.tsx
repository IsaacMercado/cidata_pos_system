import type { ComponentChildren } from "preact";

interface CardProps {
  children: ComponentChildren;
  className?: string;
  padding?: boolean;
  hover?: boolean;
  bordered?: boolean;
  style?: Record<string, string | number>;
}

export function Card({ children, className = "", padding = true, hover = false, bordered = true, style }: CardProps) {
  return (
    <div
      className={`
        rounded-xl bg-white dark:bg-neutral-900
        ${bordered ? "border border-neutral-200 dark:border-neutral-700" : ""}
        ${padding ? "p-4 sm:p-5" : ""}
        ${hover ? "transition-shadow hover:shadow-lg" : ""}
        ${className}
      `}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <h3 className={`text-lg font-semibold text-neutral-900 dark:text-neutral-100 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <p className={`text-sm text-neutral-500 dark:text-neutral-400 mt-1 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <div className={`mt-4 flex items-center gap-2 ${className}`}>{children}</div>;
}