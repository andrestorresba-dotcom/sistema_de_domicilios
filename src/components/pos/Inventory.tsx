import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { toast } from 'sonner';
import { BarChart3, Flame, Package, Droplets, TrendingUp, XCircle, ShoppingCart, Plus, Pencil, Trash2, PackagePlus, History } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth, authErrorMessage } from '../../lib/auth';
import { getDateFromTimestamp } from '../../lib/orderStore';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  addStock,
  deleteProduct,
  formatCajaDate,
  formatMoney,
  loadDefaultMenu,
  saveProduct,
  summarize,
  todayCajaId,
  useCaja,
  useExpenses,
  useProducts,
  useSales,
  type Product,
} from '../../lib/posStore';
import { Card, Modal, PageHeader, ReadOnlyBadge, StatCard, btnPrimary, btnSecondary, inputCls, parseMoney } from './shared';

export function Inventory() {
  const [tab, setTab] = useState<'dashboard' | 'inventario'>('dashboard');
  const { isAdmin } = useAuth();
  const cajaId = todayCajaId();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader title="Inventario & Control" subtitle={formatCajaDate(cajaId)} actions={!isAdmin && <ReadOnlyBadge text="Vista de consulta" />} />

      <div className="inline-flex bg-gray-100 rounded-2xl p-1 mb-6">
        {(
          [
            ['dashboard', 'Dashboard Pollo', BarChart3],
            ['inventario', 'Inventario', Package],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              tab === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' ? <InventoryDashboard cajaId={cajaId} /> : <InventoryTable />}
    </div>
  );
}

function InventoryDashboard({ cajaId }: { cajaId: string }) {
  const { products } = useProducts();
  const sales = useSales(cajaId);
  const expenses = useExpenses(cajaId);
  const caja = useCaja(cajaId);

  const summary = summarize(sales, expenses, caja?.base ?? 0);
  const soldByProduct = useMemo(() => {
    const m: Record<string, number> = {};
    sales.filter(s => s.status === 'activa').forEach(s => Object.entries(s.qty).forEach(([id, q]) => (m[id] = (m[id] ?? 0) + q)));
    return m;
  }, [sales]);

  const pollos = products.filter(p => p.category === 'Pollo');
  const bebidas = products.filter(p => p.category === 'Bebidas');
  const sum = (list: Product[], f: (p: Product) => number) => list.reduce((a, p) => a + f(p), 0);
  const agotados = products.filter(p => p.active && p.stock <= 0).length;
  const bajos = products.filter(p => p.active && p.stock > 0 && p.stock <= p.minStock).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={<Flame className="w-5 h-5" />} label="Pollos Vendidos Hoy" value={sum(pollos, p => soldByProduct[p.id] ?? 0)} hint="unidades" />
        <StatCard icon={<Package className="w-5 h-5" />} tone="red" label="Pollos Restantes" value={sum(pollos, p => p.stock)} hint="en inventario" />
        <StatCard icon={<Droplets className="w-5 h-5" />} tone="blue" label="Bebidas Vendidas" value={sum(bebidas, p => soldByProduct[p.id] ?? 0)} hint="unidades" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} tone="green" label="Valor Vendido Hoy" value={formatMoney(summary.total)} hint={`${summary.salesCount} ventas`} />
        <StatCard icon={<XCircle className="w-5 h-5" />} tone="gray" label="Productos Agotados" value={agotados} hint={bajos ? `${bajos} con stock bajo` : 'ninguno bajo'} />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} tone="purple" label="Caja Efectivo" value={formatMoney(summary.expectedCash)} hint="base + ventas − gastos" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Estado Pollos" icon={<Flame className="w-5 h-5 text-amber-500" />}>
          {pollos.length === 0 && <p className="text-gray-400 text-center py-6">Aún no hay productos de pollo.</p>}
          <div className="space-y-4">
            {pollos.map(p => {
              const sold = soldByProduct[p.id] ?? 0;
              const totalDay = sold + p.stock;
              const pct = totalDay ? (sold / totalDay) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="font-semibold text-gray-900" title="vendidos / disponibles al inicio">
                      {sold}/{totalDay}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Ventas por Método de Pago" icon={<BarChart3 className="w-5 h-5 text-blue-500" />}>
          {summary.salesCount === 0 ? (
            <p className="text-gray-400 text-center py-10">Sin ventas registradas hoy</p>
          ) : (
            <div className="space-y-4">
              {PAYMENT_METHODS.map(m => {
                const v = summary.byMethod[m.id] ?? 0;
                const pct = summary.total ? (v / summary.total) * 100 : 0;
                return (
                  <div key={m.id}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-gray-700">{m.label}</span>
                      <span className="font-semibold text-gray-900">{formatMoney(v)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const emptyProduct = (): Product => ({ id: '', name: '', category: 'Pollo', price: 0, stock: 0, minStock: 5, active: true });

function InventoryTable() {
  const { products, loading } = useProducts();
  const { isAdmin, profile } = useAuth();
  const [editing, setEditing] = useState<{ product: Product; isNew: boolean } | null>(null);
  const [restocking, setRestocking] = useState<Product | null>(null);
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    if (!profile) return;
    setSeeding(true);
    try {
      await loadDefaultMenu(profile);
      toast.success('Menú cargado. Ahora registra las existencias de cada producto.');
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setSeeding(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar ${p.name} del inventario? Las ventas anteriores no se borran.`)) return;
    try {
      await deleteProduct(p.id);
      toast.success('Producto eliminado');
    } catch (e) {
      toast.error(authErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title={`Productos (${products.length})`}
        icon={<Package className="w-5 h-5 text-amber-500" />}
        actions={
          isAdmin && (
            <button className={btnPrimary} onClick={() => setEditing({ product: emptyProduct(), isNew: true })}>
              <Plus className="w-4 h-4" /> Nuevo producto
            </button>
          )
        }
      >
        {!loading && products.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 mb-4">No hay productos en el inventario.</p>
            {isAdmin ? (
              <button className={btnPrimary} onClick={seed} disabled={seeding}>
                {seeding ? 'Cargando…' : 'Cargar menú del asadero'}
              </button>
            ) : (
              <p className="text-sm text-gray-400">El administrador debe cargar los productos.</p>
            )}
          </div>
        )}

        {products.length > 0 && (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Código</th>
                  <th className="px-3 py-3 font-medium">Producto</th>
                  <th className="px-3 py-3 font-medium">Categoría</th>
                  <th className="px-3 py-3 font-medium text-right">Precio</th>
                  <th className="px-3 py-3 font-medium text-right">Existencias</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  {isAdmin && <th className="px-6 py-3 font-medium text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const status = !p.active
                    ? ['Inactivo', 'bg-gray-100 text-gray-500']
                    : p.stock <= 0
                      ? ['Agotado', 'bg-red-100 text-red-700']
                      : p.stock <= p.minStock
                        ? ['Bajo', 'bg-amber-100 text-amber-700']
                        : ['Disponible', 'bg-green-100 text-green-700'];
                  return (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3 font-mono text-gray-500">{p.id}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-3 py-3 text-gray-600">{p.category}</td>
                      <td className="px-3 py-3 text-right text-gray-900">{formatMoney(p.price)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-900">{p.stock}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${status[1]}`}>{status[0]}</span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setRestocking(p)} className="p-2 rounded-lg hover:bg-green-50 text-green-600" title="Registrar entrada">
                              <PackagePlus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditing({ product: p, isNew: false })} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => remove(p)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && <MovementsLog />}

      {editing && (
        <ProductModal
          initial={editing.product}
          isNew={editing.isNew}
          existingIds={products.map(p => p.id)}
          onClose={() => setEditing(null)}
        />
      )}
      {restocking && <RestockModal product={restocking} onClose={() => setRestocking(null)} />}
    </div>
  );
}

function ProductModal({ initial, isNew, existingIds, onClose }: { initial: Product; isNew: boolean; existingIds: string[]; onClose: () => void }) {
  const { profile } = useAuth();
  const [p, setP] = useState<Product>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    const id = p.id.trim().toUpperCase();
    if (!id || !/^[A-Z0-9-]+$/.test(id)) return toast.error('El código solo puede tener letras, números y guion (ej: P005).');
    if (isNew && existingIds.includes(id)) return toast.error('Ya existe un producto con ese código.');
    if (!p.name.trim()) return toast.error('Escribe el nombre del producto.');
    if (p.price <= 0) return toast.error('El precio debe ser mayor que cero.');
    if (!profile) return;
    setBusy(true);
    try {
      await saveProduct({ ...p, id, name: p.name.trim() }, profile, isNew ? undefined : initial);
      toast.success(isNew ? 'Producto creado' : 'Producto actualizado');
      onClose();
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Nuevo producto' : `Editar ${initial.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-gray-700">Código</span>
          <input className={inputCls} value={p.id} disabled={!isNew} onChange={e => set('id', e.target.value)} placeholder="P005" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Categoría</span>
          <select className={inputCls} value={p.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block col-span-2">
          <span className="text-sm text-gray-700">Nombre</span>
          <input className={inputCls} value={p.name} onChange={e => set('name', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Precio</span>
          <input className={inputCls} inputMode="numeric" value={p.price ? p.price.toLocaleString('es-CO') : ''} onChange={e => set('price', parseMoney(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Existencias</span>
          <input className={inputCls} inputMode="numeric" value={p.stock} onChange={e => set('stock', parseMoney(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Alerta de stock bajo</span>
          <input className={inputCls} inputMode="numeric" value={p.minStock} onChange={e => set('minStock', parseMoney(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={p.active} onChange={e => set('active', e.target.checked)} />
          <span className="text-sm text-gray-700">Disponible para la venta</span>
        </label>
      </div>
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnPrimary + ' flex-1'} onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

function RestockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { profile } = useAuth();
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const n = parseMoney(qty);

  const save = async () => {
    if (n <= 0 || !profile) return toast.error('Escribe cuántas unidades entran.');
    setBusy(true);
    try {
      await addStock(product, n, profile);
      toast.success(`Entrada registrada: +${n} ${product.name}`);
      onClose();
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Entrada de ${product.name}`} onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">Existencias actuales: <b className="text-gray-900">{product.stock}</b></p>
      <label className="block">
        <span className="text-sm text-gray-700">Unidades que entran</span>
        <input className={inputCls} inputMode="numeric" autoFocus value={qty} onChange={e => setQty(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      </label>
      {n > 0 && <p className="text-sm text-gray-500 mt-2">Quedarán {product.stock + n} unidades.</p>}
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnPrimary + ' flex-1'} onClick={save} disabled={busy}>
          Registrar entrada
        </button>
      </div>
    </Modal>
  );
}

interface Movement {
  id: string;
  productName: string;
  type: string;
  before: number;
  after: number;
  byName: string;
  createdAt: any;
}

function MovementsLog() {
  const [rows, setRows] = useState<Movement[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'movimientos_inventario'), orderBy('createdAt', 'desc'), limit(15)), snap =>
        setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Movement)),
      ),
    [],
  );
  if (rows.length === 0) return null;
  const label: Record<string, string> = { entrada: 'Entrada', ajuste: 'Ajuste', creacion: 'Creación' };
  return (
    <Card title="Últimos movimientos" icon={<History className="w-5 h-5 text-gray-500" />}>
      <ul className="divide-y divide-gray-50 text-sm">
        {rows.map(m => {
          const d = getDateFromTimestamp(m.createdAt);
          const diff = m.after - m.before;
          return (
            <li key={m.id} className="flex items-center justify-between py-2.5 gap-3">
              <div>
                <span className="font-medium text-gray-900">{m.productName}</span>
                <span className="text-gray-400"> · {label[m.type] ?? m.type} · {m.byName}</span>
              </div>
              <div className="text-right whitespace-nowrap">
                <span className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {diff >= 0 ? '+' : ''}
                  {diff}
                </span>
                <span className="text-gray-400 ml-2">
                  {d.toLocaleDateString('es-CO')} {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

