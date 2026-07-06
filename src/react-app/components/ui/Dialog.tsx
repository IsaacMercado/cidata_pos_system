import type { JSX } from "preact";

interface DialogProps extends JSX.HTMLAttributes<HTMLDialogElement> {
  open?: boolean;
}

export function Dialog({ className = "", children, ...props }: DialogProps) {
  return (
    <dialog
      className={`rounded-2xl shadow-2xl border border-zinc-200 p-0 backdrop:bg-black/30 w-[calc(100%-2rem)] max-w-md bg-white max-h-[90dvh] overflow-y-auto ${className}`}
      {...props}
    >
      {children}
    </dialog>
  );
}
