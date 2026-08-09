import type { ComponentChildren, ComponentType } from "preact";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = ComponentType<any>;

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: IconComponent;
  action?: ComponentChildren;
}

export function PageHeader({ title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <Icon size={14} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h1>
          {description && <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
        </div>
      </div>
      {action && <div className="flex w-full items-center gap-2 sm:w-auto">{action}</div>}
    </div>
  );
}
