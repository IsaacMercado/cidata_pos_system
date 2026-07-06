

interface InputProps {
  label?: string;
  type?: string;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  value?: string | number;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  autoComplete?: string;
  checked?: boolean;
  onInput?: (e: Event) => void;
  onChange?: (e: Event) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  ref?: any;
}

export function Input({ className = "", label, id, ...props }: InputProps) {
  const input = (
    <input
      id={id}
      className={`w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500 ${className}`}
      {...props}
    />
  );

  if (label) {
    return (
      <label className="block">
        <span className="text-sm text-zinc-500">{label}</span>
        {input}
      </label>
    );
  }

  return input;
}
