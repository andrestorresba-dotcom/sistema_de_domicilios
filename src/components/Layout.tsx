import { Outlet, Link, useLocation } from 'react-router';
import {
  Home,
  PlusCircle,
  ChefHat,
  Truck,
  ScanLine,
  BarChart3,
  FileText,
  Table,
  Package,
  ShoppingCart,
  Landmark,
  Users,
  LogOut,
  Shield,
  User,
} from 'lucide-react';
import { useAuth, ROLE_LABEL } from '../lib/auth';

const NAV = [
  { to: '/', label: 'Panel', icon: Home },
  { to: '/new-order', label: 'Pedido', icon: PlusCircle },
  { to: '/tables', label: 'Mesas', icon: Table },
  { to: '/statistics', label: 'Estadísticas', icon: BarChart3 },
  { to: '/kitchen', label: 'Cocina', icon: ChefHat },
  { to: '/delivery', label: 'Domicilios', icon: Truck },
  { to: '/scan', label: 'Escanear', icon: ScanLine },
  { to: '/reports', label: 'Reportes', icon: FileText },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/cierre-caja', label: 'Cierre Caja', icon: Landmark },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
];

export function Layout() {
  const location = useLocation();
  const { profile, isAdmin, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src="/logoasadero copy.png"
                alt="Logo Asadero"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="font-bold text-gray-900">ASADERO DE POLLO VENTILADOR</h1>
                <p className="text-sm text-gray-500">Sistema de Gestión Integral</p>
              </div>
            </div>
            {profile && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-right">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{profile.name}</div>
                    <div className="text-xs text-gray-500">{ROLE_LABEL[profile.role]}</div>
                  </div>
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      isAdmin ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Salir</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {NAV.filter(item => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive(to)
                    ? 'border-amber-400 text-amber-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
