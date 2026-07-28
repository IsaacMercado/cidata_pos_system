import { forwardRef } from "preact/compat";
import type { ComponentChildren, SelectHTMLAttributes } from "preact";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
  children?: ComponentChildren;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, hint, placeholder, id, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint ? `${selectId}-hint` : undefined;

    const select = (
      <>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </>
    );

    const selectElement = (
      <select
        id={selectId}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={`${errorId || ""} ${hintId || ""}`.trim() || undefined}
        className={`w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg outline-none transition-colors appearance-none
          focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
          hover:border-neutral-400 dark:hover:border-neutral-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}
          ${className}`}
        {...props}
      >
        {select}
      </select>
    );

    if (label || error || hint) {
      return (
        <div className="w-full">
          {label && (
            <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              {label}
            </label>
          )}
          {selectElement}
          {error && (
            <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {hint && !error && (
            <p id={hintId} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              {hint}
            </p>
          )}
        </div>
      );
    }

    return selectElement;
  }
);

Select.displayName = "Select";