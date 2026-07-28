import { Edit, Shield, ShieldOff, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { Badge, Button, Card, CardDescription, CardFooter, CardTitle, Dialog, Input, PageHeader, Select, SkeletonTable, Table } from "../components/ui";
import { api } from "../lib/api";

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
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editPermsUser, setEditPermsUser] = useState<User | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const usersList = await api.auth.list();
      setUsers(usersList);
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Administración de Usuarios"
        icon={Shield}
        description="Gestiona usuarios y sus accesos al sistema"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Nuevo Usuario
          </Button>
        }
      />

      <Card>
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Header>Usuario</Table.Header>
              <Table.Header className="hidden sm:table-cell">Email</Table.Header>
              <Table.Header className="hidden md:table-cell">Rol</Table.Header>
              <Table.Header className="text-center">Superuser</Table.Header>
              <Table.Header className="text-center">Activo</Table.Header>
              <Table.Header className="text-center">Pantallas</Table.Header>
              <Table.Header className="text-right">Acciones</Table.Header>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {loading ? (
              <SkeletonTable rows={5} cols={7} />
            ) : users.length === 0 ? (
              <Table.Empty colSpan={7}>No hay usuarios registrados</Table.Empty>
            ) : users.map((u) => (
              <Table.Row key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <Table.Cell className="font-medium text-neutral-900 dark:text-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <UserCheck size={16} className="text-primary-600 dark:text-primary-400" />
                    </span>
                    <div>
                      <div>{u.name}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">@{u.username}</div>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-neutral-500 text-sm hidden sm:table-cell">{u.email}</Table.Cell>
                <Table.Cell className="hidden md:table-cell">
                  <Badge variant="secondary">{u.role}</Badge>
                </Table.Cell>
                <Table.Cell className="text-center">
                  <button
                    onClick={() => handleToggleSuperuser(u)}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                      u.is_superuser
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {u.is_superuser ? <Shield size={12} /> : <ShieldOff size={12} />}
                    {u.is_superuser ? "Sí" : "No"}
                  </button>
                </Table.Cell>
                <Table.Cell className="text-center">
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      u.is_active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {u.is_active ? "Activo" : "Inactivo"}
                  </button>
                </Table.Cell>
                <Table.Cell className="text-center">
                  <Button size="sm" variant="ghost" onClick={() => setEditPermsUser(u)} aria-label={`Permisos de ${u.username}`}>
                    {u.userPermissions.length} pantallas
                  </Button>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditUser(u)} aria-label={`Editar ${u.username}`}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(u)} aria-label={`Eliminar ${u.username}`}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>

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

      {editPermsUser && (
        <PermissionsModal
          user={editPermsUser}
          currentScreens={permissionsMap[editPermsUser.id] || []}
          onClose={() => setEditPermsUser(null)}
          onUpdated={() => { setEditPermsUser(null); loadData(); }}
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
    <Dialog open onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Nuevo Usuario</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">✕</Button>
        </div>

        <Input label="Username" value={form.username} onInput={(e: any) => setForm({ ...form, username: e.target.value })} required />
        <Input label="Nombre completo" value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} required />
        <Input label="Email" type="email" value={form.email} onInput={(e: any) => setForm({ ...form, email: e.target.value })} required />
        <Input label="Contraseña" type="password" value={form.password} onInput={(e: any) => setForm({ ...form, password: e.target.value })} required />
        <Select
          label="Rol"
          value={form.role}
          onChange={(e: any) => setForm({ ...form, role: e.target.value })}
          options={[
            { value: "cashier", label: "Cajero" },
            { value: "admin", label: "Admin" },
          ]}
        />

        {error && <div className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</div>}

        <CardFooter className="justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Crear Usuario"}</Button>
        </CardFooter>
      </form>
    </Dialog>
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
    <Dialog open onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Editar Usuario: {user.username}</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">✕</Button>
        </div>

        <Input label="Nombre completo" value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} required />
        <Input label="Email" type="email" value={form.email} onInput={(e: any) => setForm({ ...form, email: e.target.value })} required />
        <Select
          label="Rol"
          value={form.role}
          onChange={(e: any) => setForm({ ...form, role: e.target.value })}
          options={[
            { value: "cashier", label: "Cajero" },
            { value: "admin", label: "Admin" },
          ]}
        />

        {error && <div className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</div>}

        <CardFooter className="justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
        </CardFooter>
      </form>
    </Dialog>
  );
}

function PermissionsModal({ user, currentScreens, onClose, onUpdated }: { user: User; currentScreens: string[]; onClose: () => void; onUpdated: () => void }) {
  const [selected, setSelected] = useState<string[]>(currentScreens);
  const [loading, setLoading] = useState(false);

  const toggleScreen = (screen: string) => {
    setSelected((prev) => prev.includes(screen) ? prev.filter((s) => s !== screen) : [...prev, screen]);
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
    <Dialog open onClose={onClose} size="md">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>Permisos de Pantalla</CardTitle>
            <CardDescription>@{user.username} — {user.name}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">✕</Button>
        </div>

        {user.is_superuser ? (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
            Este usuario es superuser y tiene acceso a todas las pantallas.
          </div>
        ) : (
          <div className="space-y-2">
            {ALL_SCREENS.map((screen) => (
              <label key={screen.value} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <input
                  type="checkbox"
                  checked={selected.includes(screen.value)}
                  onChange={() => toggleScreen(screen.value)}
                  className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{screen.label}</span>
              </label>
            ))}
          </div>
        )}

        <CardFooter className="justify-end pt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {!user.is_superuser && <Button onClick={handleSave} disabled={loading}>{loading ? "..." : "Guardar Permisos"}</Button>}
        </CardFooter>
      </div>
    </Dialog>
  );
}
