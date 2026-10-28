import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useAuth, authErrorMessage } from '../../lib/auth';
import { btnPrimary, inputCls } from './shared';

export function LoginScreen() {
  const { login, needsSetup, setupFirstAdmin } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSetup = needsSetup;
  let autoCompleteMode = 'current-password';
  if (isSetup) autoCompleteMode = 'new-password';
  const inputType = show ? 'text' : 'password';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSetup) {
      if (!name.trim() || !username.trim()) return setError('Escribe tu nombre y un usuario.');
      if (!/^[a-z0-9._-]+$/i.test(username.trim())) return setError('El usuario solo puede tener letras, números, punto o guion.');
      if (clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
      if (clave !== clave2) return setError('Las contraseñas no coinciden.');
    }
    setBusy(true);
    try {
      if (isSetup) await setupFirstAdmin(name, username, clave);
      else await login(username, clave);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm p-7">
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logoasadero copy.png" alt="" className="h-16 w-auto mb-3" />
          <h1 className="font-bold text-gray-900">ASADERO DE POLLO VENTILADOR</h1>
          <p className="text-sm text-gray-500">Sistema de Gestión Integral</p>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
            {isSetup ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{isSetup ? 'Crear administrador' : 'Iniciar sesión'}</div>
            <div className="text-sm text-gray-500">
              {isSetup ? 'Primera vez: esta cuenta controla todo el sistema' : 'Ingresa con tu usuario'}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isSetup && (
            <label className="block">
              <span className="text-sm text-gray-700">Nombre</span>
              <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Andrés Torres" />
            </label>
          )}
          <label className="block">
            <span className="text-sm text-gray-700">Usuario</span>
            <input
              className={inputCls}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="Ej: admin"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Contraseña</span>
            <div className="relative">
              <input
                className={inputCls + ' pr-11'}
                type={inputType}
                value={clave}
                onChange={e => setClave(e.target.value)}
                autoComplete={autoCompleteMode}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </label>
          {isSetup && (
            <label className="block">
              <span className="text-sm text-gray-700">Repite la contraseña</span>
              <input className={inputCls} type={inputType} value={clave2} onChange={e => setClave2(e.target.value)} autoComplete={autoCompleteMode} />
            </label>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={busy} className={btnPrimary + ' w-full mt-5'}>
          {busy ? 'Un momento…' : isSetup ? 'Crear administrador' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

export function NoAccessScreen({ onLogout, inactive }: { onLogout: () => void; inactive: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm p-7 text-center">
        <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h1 className="font-semibold text-gray-900 mb-1">{inactive ? 'Usuario desactivado' : 'Usuario sin permisos'}</h1>
        <p className="text-sm text-gray-500 mb-5">
          {inactive
            ? 'Tu cuenta fue desactivada. Habla con el administrador.'
            : 'Esta cuenta no está registrada en el sistema. Pide al administrador que te cree un usuario.'}
        </p>
        <button onClick={onLogout} className={btnPrimary + ' w-full'}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
