import { JSX } from "preact/compat";
import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface TabsProps {
  children: ComponentChildren;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  variant?: "line" | "enclosed" | "soft";
}

interface TabsListProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: ComponentChildren;
}

interface TabsTriggerProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
  children: ComponentChildren;
}

interface TabsContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ComponentChildren;
}

const variantClasses = {
  line: "border-b border-neutral-200 dark:border-neutral-700",
  enclosed: "bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1",
  soft: "bg-transparent",
};

const triggerVariants = {
  line: "border-b-2 border-transparent hover:border-primary-300 dark:hover:border-primary-600",
  enclosed: "rounded-lg bg-transparent hover:bg-white dark:hover:bg-neutral-700",
  soft: "rounded-lg bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800",
};

export function Tabs({
  children,
  defaultValue,
  value,
  onChange,
  className = "",
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  const handleChange = (newValue: string) => {
    if (!controlled) setInternalValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className={className} data-tabs-value={currentValue}>
      {typeof children === "function"
        ? children({ value: currentValue, onChange: handleChange })
        : children}
    </div>
  );
}

export function TabsList({ children, className = "", ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={`flex gap-1 ${variantClasses.line} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

TabsList.displayName = "TabsList";

export function TabsTrigger({
  value,
  disabled,
  children,
  className = "",
  onClick,
  ...props
}: TabsTriggerProps) {
  const context = (props as unknown as { __tabsContext?: { value: string; onChange: (v: string) => void; variant: string } }).__tabsContext;
  const currentValue = context?.value;
  const onChange = context?.onChange;
  const variant = context?.variant || "line";

  const isActive = currentValue === value;

  const handleClick = () => {
    if (!disabled) {
      onChange?.(value);
      onClick?.(new MouseEvent("click", { bubbles: true }) as any);
    }
  };

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        isActive
          ? "text-primary-600 dark:text-primary-400"
          : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      } ${triggerVariants[variant as keyof typeof triggerVariants]} ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

TabsTrigger.displayName = "TabsTrigger";

export function TabsContent({ value, children, className = "", ...props }: TabsContentProps) {
  const context = (props as unknown as { __tabsContext?: { value: string } }).__tabsContext;
  const currentValue = context?.value;

  if (currentValue !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-4 animate-fade-in ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

TabsContent.displayName = "TabsContent";

export function createTabsContext(value: string, onChange: (v: string) => void, variant: TabsProps["variant"]) {
  return { value, onChange, variant };
}