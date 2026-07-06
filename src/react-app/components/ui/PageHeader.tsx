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
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-400 to-zinc-500 flex items-center justify-center text-white flex-shrink-0">
            <Icon size={14} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold text-zinc-800">{title}</h1>
          {description && <p className="text-sm text-zinc-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
