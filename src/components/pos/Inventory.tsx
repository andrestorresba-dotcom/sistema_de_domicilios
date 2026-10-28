import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { toast } from 'sonner';
import { BarChart3, Flame, Package, Droplets, TrendingUp, XCircle, ShoppingCart, Plus, Pencil, Trash2, PackagePlus, History, SlidersHorizontal } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth, authErrorMessage } from '../../lib/auth';
import { getDateFromTimestamp } from '../../lib/orderStore';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  POLLO_ID,
  addStock,
  availableUnits,
  changeInsumoStock,
  deleteProduct,
  enablePolloInventory,
  formatCajaDate,
  formatMoney,
  formatParts,
  loadDefaultMenu,
  parseToParts,
  saveInsumoSettings,
  saveProduct,
  summarize,
  todayCajaId,
  useCaja,
  useExpenses,
  useInsumos,
  useProducts,
  useSales,
  type Insumo,
  type Product,
} from '../../lib/posStore';
import { Card, Modal, PageHeader, ReadOnlyBadge, StatCard, btnPrimary, btnSecondary, inputCls, parseMoney } from './shared';

/** "¼ de pollo", "1 pollo", "1 ½ pollos" */
export function partsLabel(units: number, ins: Pick<Insumo, 'parts' | 'name'>) {
  const name = ins.name.toLowerCase();
  if (units < ins.parts) return `${formatParts(units, ins.parts)} de ${name}`;
  return `${formatParts(units, ins.parts)} ${units === ins.parts ? name : name + 's'}`;
}

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
  const insumos = useInsumos();
  const sales = useSales(cajaId);
  const expenses = useExpenses(cajaId);
  const caja = useCaja(cajaId);
  const pollo = insumos[POLLO_ID];

  const summary = summarize(sales, expenses, caja?.base ?? 0);
  const { soldByProduct, polloPartsSold } = useMemo(() => {
    const m: Record<string, number> = {};
    let parts = 0;
    sales
      .filter(s => s.status === 'activa')
      .forEach(s => {
        Object.entries(s.qty).forEach(([id, q]) => (m[id] = (m[id] ?? 0) + q));
        parts += s.insumoQty?.[POLLO_ID] ?? 0;
      });
    return { soldByProduct: m, polloPartsSold: parts };
  }, [sales]);

  const pollos = products.filter(p => p.category === 'Pollo');
  const bebidas = products.filter(p => p.category === 'Bebidas');
  const sum = (list: Product[], f: (p: Product) => number) => list.reduce((a, p) => a + f(p), 0);
  const ownPollos = pollos.filter(p => !p.insumoId);
  const agotados = products.filter(p => p.active && availableUnits(p, insumos) <= 0).length;
  const bajos =
    products.filter(p => p.active && !p.insumoId && p.stock > 0 && p.stock <= p.minStock).length +
    Object.values(insumos).filter(i => i.stock > 0 && i.stock <= i.minStock).length;

  const pollosVendidos = pollo ? formatParts(polloPartsSold, pollo.parts) : sum(ownPollos, p => soldByProduct[p.id] ?? 0);
  const pollosRestantes = pollo ? formatParts(pollo.stock, pollo.parts) : sum(ownPollos, p => p.stock);
  const polloBajo = pollo && pollo.stock <= pollo.minStock;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={<Flame className="w-5 h-5" />} label="Pollos Vendidos Hoy" value={pollosVendidos} hint={pollo ? 'pollos enteros' : 'unidades'} />
        <StatCard
          icon={<Package className="w-5 h-5" />}
          tone="red"
          label="Pollos Restantes"
          value={pollosRestantes}
          hint={polloBajo ? '¡quedan pocos!' : 'en inventario'}
        />
        <StatCard icon={<Droplets className="w-5 h-5" />} tone="blue" label="Bebidas Vendidas" value={sum(bebidas, p => soldByProduct[p.id] ?? 0)} hint="unidades" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} tone="green" label="Valor Vendido Hoy" value={formatMoney(summary.total)} hint={`${summary.salesCount} ventas`} />
        <StatCard icon={<XCircle className="w-5 h-5" />} tone="gray" label="Productos Agotados" value={agotados} hint={bajos ? `${bajos} con stock bajo` : 'ninguno bajo'} />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} tone="purple" label="Caja Efectivo" value={formatMoney(summary.expectedCash)} hint="base + ventas − gastos" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Estado Pollos" icon={<Flame className="w-5 h-5 text-amber-500" />}>
          {pollos.length === 0 && <p className="text-gray-400 text-center py-6">Aún no hay productos de pollo.</p>}
          {pollo && (
            <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3">
              <div className="flex justify-between mb-1.5 text-amber-900">
                <span>Pollos usados hoy</span>
                <span className="font-semibold">
                  {formatParts(polloPartsSold, pollo.parts)} de {formatParts(polloPartsSold + pollo.stock, pollo.parts)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${polloPartsSold + pollo.stock ? (polloPartsSold / (polloPartsSold + pollo.stock)) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          <div className="space-y-4">
            {pollos.map(p => {
              const sold = soldByProduct[p.id] ?? 0;
              const left = availableUnits(p, insumos);
              const pct = sold + left ? (sold / (sold + left)) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="text-sm text-gray-500">
                      <b className="text-gray-900">{sold}</b> vendido{sold === 1 ? '' : 's'} · alcanza para <b className="text-gray-900">{left}</b>
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
  const insumos = useInsumos();
  const { isAdmin, profile } = useAuth();
  const [editing, setEditing] = useState<{ product: Product; isNew: boolean } | null>(null);
  const [restocking, setRestocking] = useState<Product | null>(null);
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    if (!profile) return;
    setSeeding(true);
    try {
      await loadDefaultMenu(profile);
      toast.success('Menú cargado. Registra los pollos que entran y las existencias de bebidas.');
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
      <SharedStockCard products={products} insumos={insumos} />

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
                  const ins = p.insumoId ? insumos[p.insumoId] : undefined;
                  const left = availableUnits(p, insumos);
                  const low = ins ? ins.stock <= ins.minStock : p.stock <= p.minStock;
                  const status = !p.active
                    ? ['Inactivo', 'bg-gray-100 text-gray-500']
                    : left <= 0
                      ? ['Agotado', 'bg-red-100 text-red-700']
                      : low
                        ? ['Bajo', 'bg-amber-100 text-amber-700']
                        : ['Disponible', 'bg-green-100 text-green-700'];
                  return (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3 font-mono text-gray-500">{p.id}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-3 py-3 text-gray-600">{p.category}</td>
                      <td className="px-3 py-3 text-right text-gray-900">{formatMoney(p.price)}</td>
                      <td className="px-3 py-3 text-right">
                        {p.insumoId ? (
                          ins && p.insumoParts ? (
                            <div>
                              <div className="font-semibold text-gray-900">alcanza para {left}</div>
                              <div className="text-xs text-gray-400">gasta {partsLabel(p.insumoParts, ins)}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">Inventario compartido no existe</span>
                          )
                        ) : (
                          <span className="font-semibold text-gray-900">{p.stock}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${status[1]}`}>{status[0]}</span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1">
                            {!p.insumoId && (
                              <button onClick={() => setRestocking(p)} className="p-2 rounded-lg hover:bg-green-50 text-green-600" title="Registrar entrada">
                                <PackagePlus className="w-4 h-4" />
                              </button>
                            )}
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
          insumos={insumos}
          onClose={() => setEditing(null)}
        />
      )}
      {restocking && <RestockModal product={restocking} onClose={() => setRestocking(null)} />}
    </div>
  );
}

function SharedStockCard({ products, insumos }: { products: Product[]; insumos: Record<string, Insumo> }) {
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<{ ins: Insumo; type: 'entrada' | 'ajuste' } | null>(null);
  const [busy, setBusy] = useState(false);
  const list = Object.values(insumos);
  const hasPolloProducts = products.some(p => p.category === 'Pollo');

  const enable = async () => {
    setBusy(true);
    try {
      const linked = await enablePolloInventory(products);
      toast.success(
        linked.length
          ? `Inventario de pollos creado. Ahora descuentan de ahí: ${linked.join(', ')}.`
          : 'Inventario de pollos creado. Conecta tus productos de pollo desde Editar.',
      );
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (list.length === 0) {
    if (!isAdmin || !hasPolloProducts) return null;
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <div className="font-semibold text-amber-900">Inventario compartido de pollos</div>
          <p className="text-sm text-amber-800">
            Registra los pollos enteros una sola vez; cada cuarto, medio, entero o promo descuenta su parte de ahí.
          </p>
        </div>
        <button className={btnPrimary} onClick={enable} disabled={busy}>
          Activar
        </button>
      </div>
    );
  }

  return (
    <>
      {list.map(ins => {
        const users = products.filter(p => p.insumoId === ins.id);
        const low = ins.stock <= ins.minStock;
        return (
          <div key={ins.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Flame className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Inventario de {ins.name.toLowerCase()}s enteros</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatParts(ins.stock, ins.parts)} <span className="text-lg font-medium text-gray-500">{ins.unit}</span>
                  </div>
                  <div className={`text-sm ${low ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {low ? 'Por debajo de la alerta' : 'Alerta'} de {formatParts(ins.minStock, ins.parts)} {ins.unit}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button className={btnPrimary} onClick={() => setMode({ ins, type: 'entrada' })}>
                    <PackagePlus className="w-4 h-4" /> Entrada de pollos
                  </button>
                  <button className={btnSecondary} onClick={() => setMode({ ins, type: 'ajuste' })} title="Corregir conteo o alerta">
                    <SlidersHorizontal className="w-4 h-4" /> Ajustar
                  </button>
                </div>
              )}
            </div>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-100">
                {users.map(p => (
                  <span key={p.id} className="text-sm rounded-full bg-gray-50 border border-gray-100 px-3 py-1 text-gray-600">
                    {p.name}: <b className="text-gray-900">{p.insumoParts ? formatParts(p.insumoParts, ins.parts) : '—'}</b> · alcanza para{' '}
                    <b className="text-gray-900">{availableUnits(p, insumos)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {mode && <InsumoModal ins={mode.ins} type={mode.type} onClose={() => setMode(null)} />}
    </>
  );
}

function InsumoModal({ ins, type, onClose }: { ins: Insumo; type: 'entrada' | 'ajuste'; onClose: () => void }) {
  const { profile } = useAuth();
  const [value, setValue] = useState(type === 'ajuste' ? String(ins.stock / ins.parts).replace('.', ',') : '');
  const [min, setMin] = useState(String(ins.minStock / ins.parts).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const parts = value.trim() ? parseToParts(value, ins.parts) : null;
  const newStock = parts === null ? null : type === 'entrada' ? ins.stock + parts : parts;

  const save = async () => {
    if (!profile) return;
    if (newStock === null || (type === 'entrada' && !parts)) {
      return toast.error(`Escribe una cantidad de ${ins.unit} (puedes usar ,25 ,5 o ,75).`);
    }
    const minParts = parseToParts(min, ins.parts);
    if (type === 'ajuste' && minParts === null) return toast.error('Revisa la alerta de stock bajo.');
    setBusy(true);
    try {
      if (newStock !== ins.stock) await changeInsumoStock(ins, newStock, type, profile);
      if (type === 'ajuste' && minParts !== ins.minStock) await saveInsumoSettings(ins, { name: ins.name, minStock: minParts! });
      toast.success(type === 'entrada' ? `Entrada: +${formatParts(parts!, ins.parts)} ${ins.unit}` : 'Inventario ajustado');
      onClose();
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={type === 'entrada' ? `Entrada de ${ins.unit}` : `Ajustar ${ins.unit}`} onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">
        Hay <b className="text-gray-900">{formatParts(ins.stock, ins.parts)} {ins.unit}</b>.{' '}
        {type === 'ajuste' && 'Usa esto solo para corregir el conteo físico; las entradas normales van por "Entrada de pollos".'}
      </p>
      <label className="block">
        <span className="text-sm text-gray-700">{type === 'entrada' ? `${ins.unit[0].toUpperCase()}${ins.unit.slice(1)} enteros que entran` : `${ins.unit[0].toUpperCase()}${ins.unit.slice(1)} que hay realmente`}</span>
        <input className={inputCls} inputMode="decimal" autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Ej: 40" />
      </label>
      {value.trim() && newStock === null && <p className="text-sm text-red-600 mt-2">Usa enteros o cuartos: 10 · 10,25 · 10,5 · 10,75</p>}
      {newStock !== null && type === 'entrada' && !!parts && (
        <p className="text-sm text-gray-500 mt-2">
          Quedarán {formatParts(newStock, ins.parts)} {ins.unit}.
        </p>
      )}
      {type === 'ajuste' && (
        <label className="block mt-3">
          <span className="text-sm text-gray-700">Avisar cuando queden menos de ({ins.unit})</span>
          <input className={inputCls} inputMode="decimal" value={min} onChange={e => setMin(e.target.value)} />
        </label>
      )}
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnPrimary + ' flex-1'} onClick={save} disabled={busy}>
          {type === 'entrada' ? 'Registrar entrada' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

function ProductModal({
  initial,
  isNew,
  existingIds,
  insumos,
  onClose,
}: {
  initial: Product;
  isNew: boolean;
  existingIds: string[];
  insumos: Record<string, Insumo>;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [p, setP] = useState<Product>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP(prev => ({ ...prev, [k]: v }));
  const ins = p.insumoId ? insumos[p.insumoId] : undefined;
  const insumoList = Object.values(insumos);

  const save = async () => {
    const id = p.id.trim().toUpperCase();
    if (!id || !/^[A-Z0-9-]+$/.test(id)) return toast.error('El código solo puede tener letras, números y guion (ej: P005).');
    if (isNew && existingIds.includes(id)) return toast.error('Ya existe un producto con ese código.');
    if (!p.name.trim()) return toast.error('Escribe el nombre del producto.');
    if (p.price <= 0) return toast.error('El precio debe ser mayor que cero.');
    if (p.insumoId && !p.insumoParts) return toast.error('Indica cuánto gasta cada unidad.');
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
          <span className="text-sm text-gray-700">Descuenta de</span>
          <select
            className={inputCls}
            value={p.insumoId ?? ''}
            onChange={e => {
              const v = e.target.value;
              setP(prev => ({ ...prev, insumoId: v || undefined, insumoParts: v ? prev.insumoParts || insumos[v]?.parts : undefined }));
            }}
          >
            <option value="">Sus propias existencias</option>
            {insumoList.map(i => (
              <option key={i.id} value={i.id}>
                Inventario de {i.unit}
              </option>
            ))}
          </select>
        </label>

        {ins ? (
          <label className="block col-span-2">
            <span className="text-sm text-gray-700">Cuánto {ins.name.toLowerCase()} gasta cada unidad</span>
            <select className={inputCls} value={p.insumoParts ?? ''} onChange={e => set('insumoParts', Number(e.target.value))}>
              {Array.from({ length: ins.parts * 4 }, (_, i) => i + 1).map(k => (
                <option key={k} value={k}>
                  {partsLabel(k, ins)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="block">
              <span className="text-sm text-gray-700">Existencias</span>
              <input className={inputCls} inputMode="numeric" value={p.stock} onChange={e => set('stock', parseMoney(e.target.value))} />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Alerta de stock bajo</span>
              <input className={inputCls} inputMode="numeric" value={p.minStock} onChange={e => set('minStock', parseMoney(e.target.value))} />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 col-span-2 mt-1">
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
  parts?: number;
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
          const shown = m.parts ? formatParts(Math.abs(diff), m.parts) : String(Math.abs(diff));
          return (
            <li key={m.id} className="flex items-center justify-between py-2.5 gap-3">
              <div>
                <span className="font-medium text-gray-900">{m.productName}</span>
                <span className="text-gray-400"> · {label[m.type] ?? m.type} · {m.byName}</span>
              </div>
              <div className="text-right whitespace-nowrap">
                <span className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {diff >= 0 ? '+' : '−'}
                  {shown}
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
