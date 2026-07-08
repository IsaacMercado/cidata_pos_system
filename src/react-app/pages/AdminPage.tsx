import { useEffect, useState } from "preact/hooks";
import { api } from "../lib/api";
import { Button, Input, Modal, Select } from "../components/ui";
import { Shield, ShieldOff, UserPlus } from "lucide-react";

const ALL_SCREENS = [
  { value: "pos", label: "POS" },
  { value: "products", label: "Productos" },
  { value: "customers", label: "Clientes" },
  { value: "sales", label: "Ventas" },
  { value: "restaurants", label: "Restaurante" },
  { value: "purchases", label: "Inventario" },
  { value: "users", label: "Usuarios" },
];

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  is_superuser: number;
  is_active: number;
  created_at: string;
}

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editPerms, setEditPerms] = useState<User | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const usersList = await api.auth.list();
      setUsers(usersList);
      const permPromises = usersList.map((u: User) =>
        api.auth.getPermissions(u.id).then((screens) => ({ id: u.id, screens }))
      );
      const perms = await Promise.all(permPromises);
      const permMap: Record<number, string[]> = {};
      perms.forEach((p) => { permMap[p.id] = p.screens; });
      setPermissionsMap(permMap);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleToggleActive = async (user: User) => {
    try {
      await api.auth.update(user.id, { isActive: user.is_active ? 0 : 1 });
      loadData();
    } catch {}
  };

  const handleToggleSuperuser = async (user: User) => {
    try {
      await api.auth.update(user.id, { isSuperuser: user.is_superuser ? 0 : 1 });
      loadData();
    } catch {}
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`¿Desactivar usuario "${user.username}"?`)) return;
    try {
      await api.auth.deactivate(user.id);
      loadData();
    } catch {}
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Administración de Usuarios</h1>
          <p className="text-sm text-slate-400 mt-1">Gestiona usuarios y sus accesos al sistema</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus size={16} /> Nuevo Usuario
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Usuario</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Rol</th>
              <th className="px-4 py-3 text-center text-slate-400 font-medium">Superuser</th>
              <th className="px-4 py-3 text-center text-slate-400 font-medium">Activo</th>
              <th className="px-4 py-3 text-center text-slate-400 font-medium">Pantallas</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay usuarios</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{u.name}</div>
                  <div className="text-xs text-slate-500">@{u.username}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleSuperuser(u)}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                      u.is_superuser
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {u.is_superuser ? <Shield size={12} /> : <ShieldOff size={12} />}
                    {u.is_superuser ? "Sí" : "No"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      u.is_active
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {u.is_active ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button size="sm" variant="ghost" onClick={() => { setEditPerms(u); setEditPerms(u); }}>
                    {(permissionsMap[u.id]?.length || 0)} pantallas
                  </Button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDelete(u)}>
                      Desactivar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={() => { setEditUser(null); loadData(); }}
        />
      )}

      {editPerms && (
        <PermissionsModal
          user={editPerms}
          currentScreens={permissionsMap[editPerms.id] || []}
          onClose={() => setEditPerms(null)}
          onUpdated={() => { setEditPerms(null); loadData(); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: "", name: "", email: "", password: "", role: "cashier" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.create(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="bg-slate-900 border-slate-700">
      <div className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Nuevo Usuario</h2>
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <Input placeholder="Username" value={form.username} onInput={(e: any) => setForm({ ...form, username: e.target.value })} required />
          <Input placeholder="Nombre completo" value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} required />
          <Input type="email" placeholder="Email" value={form.email} onInput={(e: any) => setForm({ ...form, email: e.target.value })} required />
          <Input type="password" placeholder="Contraseña" value={form.password} onInput={(e: any) => setForm({ ...form, password: e.target.value })} required />
          <Select value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })}>
            <option value="cashier">Cajero</option>
            <option value="admin">Admin</option>
          </Select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "..." : "Crear Usuario"}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.update(user.id, form);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="bg-slate-900 border-slate-700">
      <div className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Editar Usuario: {user.username}</h2>
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <Input placeholder="Nombre completo" value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} required />
          <Input type="email" placeholder="Email" value={form.email} onInput={(e: any) => setForm({ ...form, email: e.target.value })} required />
          <Select value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })}>
            <option value="cashier">Cajero</option>
            <option value="admin">Admin</option>
          </Select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "..." : "Guardar"}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function PermissionsModal({ user, currentScreens, onClose, onUpdated }: { user: User; currentScreens: string[]; onClose: () => void; onUpdated: () => void }) {
  const [selected, setSelected] = useState<string[]>(currentScreens);
  const [loading, setLoading] = useState(false);

  const toggleScreen = (screen: string) => {
    setSelected((prev) =>
      prev.includes(screen) ? prev.filter((s) => s !== screen) : [...prev, screen]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.auth.setPermissions(user.id, selected);
      onUpdated();
    } catch {}
    setLoading(false);
  };

  return (
    <Modal open onClose={onClose} className="bg-slate-900 border-slate-700">
      <div className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Permisos de Pantalla</h2>
        <p className="text-sm text-slate-400 mb-4">@{user.username} — {user.name}</p>

        {user.is_superuser ? (
          <p className="text-sm text-amber-400 mb-4">
            Este usuario es superuser y tiene acceso a todas las pantallas.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {ALL_SCREENS.map((screen) => (
              <label key={screen.value} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={selected.includes(screen.value)}
                  onChange={() => toggleScreen(screen.value)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-violet-600"
                />
                <span className="text-sm text-white">{screen.label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          {!user.is_superuser && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "..." : "Guardar Permisos"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
