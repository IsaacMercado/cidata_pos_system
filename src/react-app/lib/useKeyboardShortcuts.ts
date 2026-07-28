import { useEffect } from "preact/hooks";

export interface ShortcutConfig {
  key: string;
  action: () => void;
  description: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcuts.find((s) => {
        const key = s.key.toLowerCase();
        const eventKey = event.key.toLowerCase();

        // Handle function keys (F1-F12)
        if (key.startsWith("f")) {
          return eventKey === key;
        }

        // Handle special keys
        const specialKeys: Record<string, string> = {
          escape: "escape",
          esc: "escape",
          delete: "delete",
          backspace: "backspace",
          enter: "enter",
          tab: "tab",
          " ": "space",
          space: "space",
          arrowup: "arrowup",
          arrowdown: "arrowdown",
          arrowleft: "arrowleft",
          arrowright: "arrowright",
        };

        const normalizedKey = specialKeys[key] || key;
        const normalizedEventKey = specialKeys[eventKey] || eventKey;

        return normalizedKey === normalizedEventKey;
      });

      if (shortcut) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        if (shortcut.stopPropagation) {
          event.stopPropagation();
        }
        shortcut.action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
