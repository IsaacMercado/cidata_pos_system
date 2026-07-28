import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface DialogProps extends JSX.HTMLAttributes<HTMLDialogElement> {
  open?: boolean;
  onClose?: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: ComponentChildren;
  titleId?: string;
  descriptionId?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
  full: "max-w-full",
};

const focusableSelectors = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
    .filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
}

export function Dialog({
  open,
  onClose,
  size = "md",
  className = "",
  children,
  titleId,
  descriptionId,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      dialog.showModal();

      // Focus first focusable element after render
      setTimeout(() => {
        const focusable = getFocusableElements(dialog);
        if (focusable.length > 0) {
          firstFocusableRef.current = focusable[0];
          lastFocusableRef.current = focusable[focusable.length - 1];
          focusable[0].focus();
        } else {
          dialog.focus();
        }
      }, 0);
    } else {
      dialog.close();
      previousActiveElement.current?.focus();
    }

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && onClose) {
      onClose();
      return;
    }

    // Focus trap with Tab/Shift+Tab
    if (e.key === "Tab") {
      const focusable = getFocusableElements(dialogRef.current!);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    const dialog = dialogRef.current;
    if (dialog && e.target === dialog && onClose) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`bg-white dark:bg-neutral-900 rounded-2xl shadow-[var(--shadow-popover)] border border-neutral-200 dark:border-neutral-700 ${sizeClasses[size]} max-h-[90dvh] ${className}`}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      {...props}
    >
      <div className="flex flex-col max-h-[90dvh]">
        <div className="overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </dialog>
  );
}

export function DialogTrigger({
  children,
  onOpen,
}: {
  children: ComponentChildren;
  onOpen: () => void;
}) {
  return (
    <span onClick={onOpen} className="inline-block" role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      {children}
    </span>
  );
}

export function DialogClose({
  children,
  onClose,
  className = "",
}: {
  children: ComponentChildren;
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={`text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-lg p-1 ${className}`}
      aria-label="Cerrar"
    >
      {children}
    </button>
  );
}