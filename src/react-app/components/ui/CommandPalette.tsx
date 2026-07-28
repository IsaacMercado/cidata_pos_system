import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "preact/compat";
import type { ComponentChildren } from "preact";
import { Dialog, Input, Button } from "./index";
import { Search, X, Keyboard } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ComponentChildren;
  shortcut?: string;
  action: () => void;
  section?: string;
  keywords?: string[];
}

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  registerCommands: (commands: CommandItem[]) => () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
  registerCommands: () => () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

export function CommandPaletteProvider({ children }: { children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setSearch("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const registerCommands = useCallback((newCommands: CommandItem[]) => {
    setCommands((prev) => [...prev, ...newCommands]);
    return () => {
      setCommands((prev) => prev.filter((c) => !newCommands.includes(c)));
    };
  }, []);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const query = search.toLowerCase();
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 20);
  }, [commands, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
      setOpen(false);
      setSearch("");
      setSelectedIndex(0);
    }
  };

  const executeCommand = (cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
    setSearch("");
    setSelectedIndex(0);
  };

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen, registerCommands }}>
      {children}
      <Dialog open={open} onClose={() => { setOpen(false); setSearch(""); setSelectedIndex(0); }} size="lg" className="max-w-2xl">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="w-5 h-5 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-500">Presiona</span>
            <kbd className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 font-mono">⌘K</kbd>
            <span className="text-sm font-medium text-neutral-500">para abrir la paleta de comandos</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input
              placeholder="Escribe un comando o busca..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); }
                if (e.key === "ArrowUp") { e.preventDefault(); }
              }}
              autoFocus
              className="pl-10 pr-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </Button>
            )}
          </div>

          {filteredCommands.length === 0 && search && (
            <div className="mt-4 text-center text-neutral-400 py-8">
              No se encontraron comandos para "{search}"
            </div>
          )}

          <div className="mt-4 max-h-96 overflow-y-auto">
            {filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); setOpen(false); setSearch(""); setSelectedIndex(0); }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors flex items-center gap-3 ${
                  index === 0
                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                }`}
              >
                {cmd.icon && <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">{cmd.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cmd.label}</div>
                  {cmd.description && <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{cmd.description}</div>}
                </div>
                {cmd.shortcut && (
                  <kbd className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-500 dark:text-neutral-400">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </div>

          {filteredCommands.length === 0 && !search && (
            <div className="mt-4 text-center text-neutral-400 py-8">
              Presiona <kbd className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 font-mono">⌘K</kbd> en cualquier momento para abrir la paleta de comandos
            </div>
          )}
        </div>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}

export function CommandRegistration({ commands }: { commands: CommandItem[] }) {
  const { registerCommands } = useCommandPalette();
  useEffect(() => {
    const cleanup = registerCommands(commands);
    return cleanup;
  }, [registerCommands, commands]);
  return null;
}