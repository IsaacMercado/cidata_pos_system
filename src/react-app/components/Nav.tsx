import { useLocation, useRoute } from "wouter-preact";

const links = [
  { href: "/", label: "POS", icon: "M3 3h18v18H3V3zm2 2v14h14V5H5zm4 4h6v6H9V9z" },
  { href: "/products", label: "Productos", icon: "M4 7V4h16v3M4 7v13h16V7M4 7h16M9 11h6" },
  { href: "/customers", label: "Clientes", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 10a8 8 0 0116 0" },
  { href: "/sales", label: "Ventas", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/restaurants", label: "Rest.", icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" },
];

interface NavProps {
  user: { id: number; email: string; username: string } | null;
  onLoginClick: () => void;
}

function UserIcon({ loggedIn }: { loggedIn: boolean }) {
  if (loggedIn) {
    return (
      <>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    );
  }
  return (
    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13 12H3" />
  );
}

export function Nav({ user, onLoginClick }: NavProps) {
  const [, navigate] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-7xl items-center gap-1 border-t border-white/10 bg-slate-950/88 px-3 py-2 shadow-[0_-18px_45px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:left-3 sm:right-3 sm:bottom-3 sm:rounded-2xl sm:border">
      {links.map((l) => {
        const [isActive] = useRoute(l.href === "/" ? "/" : l.href);
        return (
          <a
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.65rem] leading-tight no-underline transition-colors duration-150 ${
              isActive ? "bg-white/12 text-cyan-200" : "text-slate-400 hover:text-slate-100"
            }`}
            onClick={(e) => { e.preventDefault(); navigate(l.href); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5.5 h-5.5">
              <path d={l.icon} />
            </svg>
            {l.label}
          </a>
        );
      })}
      <button
        onClick={onLoginClick}
        className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[0.65rem] leading-tight text-slate-400 transition-colors hover:text-slate-100"
        title={user ? `Logged in as ${user.username}` : "Login / Register"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5.5 h-5.5">
          <UserIcon loggedIn={user !== null} />
        </svg>
        {user ? user.username : "Login"}
      </button>
    </nav>
  );
}
