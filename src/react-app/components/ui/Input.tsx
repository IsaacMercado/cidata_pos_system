import { forwardRef } from "preact/compat";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "preact";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, hint, id, required, ...props }, ref) => {
    const fieldId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint && !error ? `${fieldId}-hint` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={`
            w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900
            border border-neutral-300 dark:border-neutral-600
            rounded-lg
            placeholder:text-neutral-400 dark:placeholder:text-neutral-500
            text-neutral-900 dark:text-neutral-100
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-red-500 focus:ring-red-500" : ""}
            ${className}
          `}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId || hintId}
          {...props}
        />
        {error && <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & { label?: string; error?: string; hint?: string; className?: string }>(
  ({ className = "", label, error, hint, id, required, ...props }, ref) => {
    const fieldId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint && !error ? `${fieldId}-hint` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          className={`
            w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900
            border border-neutral-300 dark:border-neutral-600
            rounded-lg
            placeholder:text-neutral-400 dark:placeholder:text-neutral-500
            text-neutral-900 dark:text-neutral-100
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[80px]
            ${error ? "border-red-500 focus:ring-red-500" : ""}
            ${className}
          `}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId || hintId}
          {...props}
        />
        {error && <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { label?: string; error?: string; hint?: string; className?: string; options?: { value: string; label: string }[] }>(
  ({ className = "", label, error, hint, id, required, options, children, ...props }, ref) => {
    const fieldId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint && !error ? `${fieldId}-hint` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={fieldId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={fieldId}
          className={`
            w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900
            border border-neutral-300 dark:border-neutral-600
            rounded-lg
            text-neutral-900 dark:text-neutral-100
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")] bg-right-3 bg-center bg-no-repeat pr-10
            ${error ? "border-red-500 focus:ring-red-500" : ""}
            ${className}
          `}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId || hintId}
          {...props}
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        {error && <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";