import type { ComponentChildren } from "preact";

export function FormField({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <div className={`w-full ${className}`}>{children}</div>;
}

export function FormFieldLabel({ children, htmlFor, required, className = "" }: { children: ComponentChildren; htmlFor?: string; required?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ${className}`}>
      {children}
      {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
    </label>
  );
}

export function FormFieldError({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <p className={`mt-1.5 text-sm text-red-600 dark:text-red-400 ${className}`} role="alert">{children}</p>;
}

export function FormFieldHint({ children, className = "" }: { children: ComponentChildren; className?: string }) {
  return <p className={`mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 ${className}`}>{children}</p>;
}