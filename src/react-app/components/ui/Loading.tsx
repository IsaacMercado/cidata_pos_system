interface LoadingProps {
  text?: string;
  fullPage?: boolean;
  /** Shows a spinner + text in column layout */
  spinner?: boolean;
}

export function Loading({ text = "Cargando...", fullPage = false, spinner = false }: LoadingProps) {
  if (fullPage) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
          <span className="text-sm text-slate-400">{text}</span>
        </div>
      </div>
    );
  }

  if (spinner) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-indigo-500 animate-spin" />
          <span className="text-sm">{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-zinc-400 py-12">
      <div className="animate-pulse text-sm">{text}</div>
    </div>
  );
}
