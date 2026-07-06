import type { ComponentChildren } from "preact";

interface SelectProps {
  label?: string;
  className?: string;
  id?: string;
  name?: string;
  value?: string | number;
  disabled?: boolean;
  required?: boolean;
  children?: ComponentChildren;
  onChange?: (e: Event) => void;
  onBlur?: (e: FocusEvent) => void;
  ref?: any;
}

export function Select({ className = "", label, id, children, ...props }: SelectProps) {
  const select = (
    <select
      id={id}
      className={`w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );

  if (label) {
    return (
      <label className="block">
        <span className="text-sm text-zinc-500">{label}</span>
        {select}
      </label>
    );
  }

  return select;
}
