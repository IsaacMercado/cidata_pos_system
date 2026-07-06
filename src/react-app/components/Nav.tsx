import {
    LogIn,
    Package,
    Receipt,
    ShoppingCart,
    User,
    Users,
    UtensilsCrossed,
} from "lucide-react";
import { useLocation, useRoute } from "wouter-preact";

const links = [
  { href: "/", label: "POS", icon: ShoppingCart },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/sales", label: "Ventas", icon: Receipt },
  { href: "/restaurants", label: "Rest.", icon: UtensilsCrossed },
];

interface NavProps {
  user: { id: number; email: string; username: string } | null;
  onLoginClick: () => void;
}

export function Nav({ user, onLoginClick }: NavProps) {
  const [, navigate] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-7xl items-center gap-1 border-t border-white/10 bg-slate-950/88 px-3 py-2 shadow-[0_-18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:left-3 sm:right-3 sm:bottom-3 sm:rounded-2xl sm:border">
      {links.map((l) => {
        const [isActive] = useRoute(l.href === "/" ? "/" : l.href);
        const Icon = l.icon;
        return (
          <a
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] leading-tight no-underline transition-colors duration-150 ${
              isActive ? "bg-white/12 text-cyan-200" : "text-slate-400 hover:text-slate-100"
            }`}
            onClick={(e) => { e.preventDefault(); navigate(l.href); }}
          >
            <Icon size={20} />
            {l.label}
          </a>
        );
      })}
      <button
        onClick={onLoginClick}
        className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[0.65rem] leading-tight text-slate-400 transition-colors hover:text-slate-100"
        title={user ? `Logged in as ${user.username}` : "Login / Register"}
      >
        {user ? <User size={20} /> : <LogIn size={20} />}
        {user ? user.username : "Login"}
      </button>
    </nav>
  );
}
