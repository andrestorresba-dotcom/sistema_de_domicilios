import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Users as UsersIcon, Shield, User, CheckCircle2, XCircle, UserPlus, Lock } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth, createStaffUser, authErrorMessage, ROLE_LABEL, type Role, type UserProfile } from '../../lib/auth';
import { Card, Modal, PageHeader, btnPrimary, btnSecondary, inputCls } from './shared';

const PERMISSIONS: Record<Role, { allowed: string[]; denied?: string[] }> = {
  admin: {
    allowed: [
      'Modificar inventario, existencias y precios',
      'Crear, editar y eliminar productos',
      'Anular ventas del POS (devuelve el inventario)',
      'Fijar la base de caja',
      'Cerrar y reabrir la caja; ver cierres anteriores',
      'Eliminar gastos',
      'Editar los datos de la factura',
      'Gestionar usuarios y roles',
    ],
  },
  cajero: {
    allowed: ['Registrar ventas en el POS', 'Imprimir facturas POS', 'Agregar gastos del día', 'Ver existencias de inventario', 'Usar pedidos, mesas y domicilios'],
    denied: ['Modificar inventario o precios', 'Cambiar la base de caja', 'Anular o editar facturas', 'Cerrar la caja'],
  },
};

export function Users() {
  const { isAdmin, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(collection(db, 'usuarios'), snap =>
      setUsers(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }) as UserProfile)
          .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1)),
      ),
    );
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900">Solo el administrador puede gestionar usuarios</h2>
      </div>
    );
  }

  const update = async (u: UserProfile, data: Partial<UserProfile>) => {
    if (u.uid === profile?.uid) return toast.error('No puedes cambiar tu propio rol ni desactivarte.');
    try {
      await updateDoc(doc(db, 'usuarios', u.uid), data);
      toast.success('Usuario actualizado');
    } catch (e) {
      toast.error(authErrorMessage(e));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Gestión de Usuarios"
        subtitle="Control de acceso y roles del sistema"
        actions={
          <button className={btnPrimary} onClick={() => setCreating(true)}>
            <UserPlus className="w-4 h-4" /> Nuevo usuario
          </button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <UsersIcon className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Usuarios del Sistema ({users.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {users.map(u => (
              <li key={u.uid} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${u.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                  {u.role === 'admin' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-[140px]">
                  <div className="font-semibold text-gray-900">
                    {u.name} {u.uid === profile?.uid && <span className="text-xs text-gray-400 font-normal">(tú)</span>}
                  </div>
                  <div className="text-sm text-gray-500">@{u.username}</div>
                </div>
                <select
                  className="rounded-full border-0 bg-amber-50 text-amber-800 text-sm font-medium px-3 py-1.5 disabled:opacity-70"
                  value={u.role}
                  disabled={u.uid === profile?.uid}
                  onChange={e => update(u, { role: e.target.value as Role })}
                  aria-label={`Rol de ${u.name}`}
                >
                  <option value="admin">{ROLE_LABEL.admin}</option>
                  <option value="cajero">{ROLE_LABEL.cajero}</option>
                </select>
                <button
                  disabled={u.uid === profile?.uid}
                  onClick={() => update(u, { active: !u.active })}
                  className={`rounded-full text-sm font-medium px-3 py-1.5 disabled:cursor-default ${u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                  title={u.uid === profile?.uid ? '' : u.active ? 'Clic para desactivar' : 'Clic para activar'}
                >
                  {u.active ? 'Activo' : 'Inactivo'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          {(['admin', 'cajero'] as Role[]).map(role => (
            <Card key={role} title={ROLE_LABEL[role]} icon={role === 'admin' ? <Shield className="w-5 h-5 text-amber-500" /> : <User className="w-5 h-5 text-gray-500" />}>
              <ul className="space-y-2.5">
                {PERMISSIONS[role].allowed.map(p => (
                  <li key={p} className="flex gap-2 text-gray-700">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> {p}
                  </li>
                ))}
                {PERMISSIONS[role].denied?.map(p => (
                  <li key={p} className="flex gap-2 text-gray-400">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      {creating && <CreateUserModal existing={users.map(u => u.username)} onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateUserModal({ existing, onClose }: { existing: string[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [clave, setClave] = useState('');
  const [role, setRole] = useState<Role>('cajero');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const user = username.trim().toLowerCase();
    if (!name.trim() || !user) return toast.error('Escribe el nombre y el usuario.');
    if (!/^[a-z0-9._-]+$/.test(user)) return toast.error('El usuario solo puede tener letras, números, punto o guion.');
    if (existing.includes(user)) return toast.error('Ese usuario ya existe.');
    if (clave.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres.');
    setBusy(true);
    try {
      await createStaffUser({ name, username: user, clave, role });
      toast.success(`Usuario @${user} creado. Entrégale su contraseña en persona.`);
      onClose();
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm text-gray-700">Nombre completo</span>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Juan García" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Usuario</span>
          <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" placeholder="Ej: cajero1" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Contraseña inicial</span>
          <input className={inputCls} type="text" value={clave} onChange={e => setClave(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="off" />
        </label>
        <div>
          <span className="text-sm text-gray-700">Rol</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(['cajero', 'admin'] as Role[]).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-xl border-2 py-2 text-sm font-medium ${role === r ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600'}`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnPrimary + ' flex-1'} onClick={submit} disabled={busy}>
          {busy ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </Modal>
  );
}
