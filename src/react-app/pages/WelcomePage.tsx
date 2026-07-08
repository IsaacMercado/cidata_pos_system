import {
    Package,
    Receipt,
    Shield,
    ShoppingCart,
    Users,
    UtensilsCrossed,
} from "lucide-react";
import { useLocation } from "wouter-preact";
import type { UserInfo } from "../App";

const modules = [
  { href: "/pos", label: "POS", desc: "Registrar ventas", icon: ShoppingCart, screen: "pos", color: "bg-violet-500" },
  { href: "/products", label: "Productos", desc: "Gestionar inventario", icon: Package, screen: "products", color: "bg-emerald-500" },
  { href: "/customers", label: "Clientes", desc: "Administrar clientes", icon: Users, screen: "customers", color: "bg-blue-500" },
  { href: "/sales", label: "Ventas", desc: "Historial de ventas", icon: Receipt, screen: "sales", color: "bg-amber-500" },
  { href: "/restaurants", label: "Restaurante", desc: "Mesas y pedidos", icon: UtensilsCrossed, screen: "restaurants", color: "bg-rose-500" },
  { href: "/admin", label: "Usuarios", desc: "Administración", icon: Shield, screen: "users", color: "bg-cyan-500" },
];

interface WelcomePageProps {
  user: UserInfo;
  permissions: string[];
}

export function WelcomePage({ user, permissions }: WelcomePageProps) {
  const [, navigate] = useLocation();
  const isSuperuser = user.is_superuser === 1;
  const visible = modules.filter((m) => isSuperuser || permissions.includes(m.screen));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">
          Bienvenido, {user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {isSuperuser ? "Superusuario" : user.role} &middot; {user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.href}
              onClick={() => navigate(m.href)}
              className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 text-left transition-all hover:border-slate-700 hover:bg-slate-800/80"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.color} text-white`}>
                <Icon size={24} />
              </div>
              <div>
                <div className="font-medium text-white group-hover:text-indigo-300">{m.label}</div>
                <div className="text-xs text-slate-500">{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-400">
            No tienes acceso a ningún módulo. Contacta al administrador.
          </p>
        </div>
      )}
    </div>
  );
}
