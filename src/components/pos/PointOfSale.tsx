import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Flame, Droplets, ShoppingCart, Minus, Plus, Trash2, Printer, Ban, Settings, Lock, Utensils, Package } from 'lucide-react';
import { useAuth, authErrorMessage } from '../../lib/auth';
import { getFormattedTime } from '../../lib/orderStore';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  SaleError,
  createSale,
  formatMoney,
  saveBusinessInfo,
  todayCajaId,
  useBusinessInfo,
  useCaja,
  useProducts,
  useSales,
  voidSale,
  type BusinessInfo,
  type PaymentMethod,
  type Product,
  type Sale,
  type SaleItem,
} from '../../lib/posStore';
import { printSaleTicket } from '../../lib/posPrint';
import { Card, Modal, PageHeader, btnDanger, btnPrimary, btnSecondary, inputCls, parseMoney } from './shared';

const CATEGORY_STYLE: Record<string, { icon: typeof Flame; header: string; title: string }> = {
  Pollo: { icon: Flame, header: 'bg-gradient-to-r from-amber-50 to-orange-50', title: 'Pollo Asado & Broaster' },
  Bebidas: { icon: Droplets, header: 'bg-blue-50', title: 'Bebidas' },
  Acompañamientos: { icon: Utensils, header: 'bg-green-50', title: 'Acompañamientos' },
  Otros: { icon: Package, header: 'bg-gray-50', title: 'Otros' },
};

export function PointOfSale() {
  const { profile, isAdmin } = useAuth();
  const cajaId = todayCajaId();
  const { products, loading } = useProducts();
  const sales = useSales(cajaId);
  const caja = useCaja(cajaId);
  const business = useBusinessInfo();

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [received, setReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const closed = caja?.status === 'cerrada';
  const activeSales = sales.filter(s => s.status === 'activa');
  const total = cart.reduce((a, it) => a + it.price * it.quantity, 0);
  const receivedN = parseMoney(received);
  const change = method === 'efectivo' && receivedN ? receivedN - total : 0;

  const grouped = useMemo(() => {
    const byCat: Record<string, Product[]> = {};
    products.filter(p => p.active).forEach(p => (byCat[p.category] ??= []).push(p));
    const order = [...CATEGORIES, ...Object.keys(byCat).filter(c => !(CATEGORIES as readonly string[]).includes(c))];
    return order.filter(c => byCat[c]?.length).map(c => [c, byCat[c]] as const);
  }, [products]);

  const inCart = (id: string) => cart.find(it => it.productId === id)?.quantity ?? 0;

  const add = (p: Product) => {
    if (closed) return;
    if (inCart(p.id) >= p.stock) {
      toast.warning(p.stock <= 0 ? `${p.name} está agotado` : `Solo quedan ${p.stock} de ${p.name}`);
      return;
    }
    setCart(prev =>
      prev.some(it => it.productId === p.id)
        ? prev.map(it => (it.productId === p.id ? { ...it, quantity: it.quantity + 1 } : it))
        : [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }],
    );
  };

  const changeQty = (id: string, delta: number) => {
    const p = products.find(x => x.id === id);
    setCart(prev =>
      prev
        .map(it => {
          if (it.productId !== id) return it;
          const q = it.quantity + delta;
          if (p && q > p.stock) {
            toast.warning(`Solo quedan ${p.stock} de ${p.name}`);
            return it;
          }
          return { ...it, quantity: q };
        })
        .filter(it => it.quantity > 0),
    );
  };

  const reset = () => {
    setCart([]);
    setReceived('');
    setCustomerName('');
    setCustomerDoc('');
    setMethod('efectivo');
  };

  const checkout = async () => {
    if (!profile || cart.length === 0) return;
    if (method === 'efectivo' && received && receivedN < total) {
      toast.error('El dinero recibido es menor que el total.');
      return;
    }
    setBusy(true);
    try {
      const sale = await createSale({
        items: cart,
        paymentMethod: method,
        received: method === 'efectivo' && received ? receivedN : undefined,
        customerName: customerName.trim() || undefined,
        customerDoc: customerDoc.trim() || undefined,
        cashier: profile,
      });
      setLastSale(sale);
      reset();
      toast.success(`Venta ${sale.id} registrada`);
    } catch (e) {
      toast.error(e instanceof SaleError ? e.message : authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Punto de Venta"
        subtitle={undefined}
        actions={
          <>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
              <span className="text-gray-500">Cajero:</span>
              <span className="font-medium text-gray-900">{profile?.name}</span>
            </div>
            {isAdmin && (
              <button className={btnSecondary} onClick={() => setShowSettings(true)} title="Datos de la factura">
                <Settings className="w-4 h-4" /> Factura
              </button>
            )}
          </>
        }
      />
      <p className="-mt-4 mb-6 text-gray-500">
        Ventas hoy: <b className="text-gray-900">{activeSales.length}</b> — Total:{' '}
        <b className="text-green-600">{formatMoney(activeSales.reduce((a, s) => a + s.total, 0))}</b>
      </p>

      {closed && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
          <Lock className="w-5 h-5" />
          La caja de hoy fue cerrada{caja?.closedByName ? ` por ${caja.closedByName}` : ''}. No se pueden registrar más ventas.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          {!loading && grouped.length === 0 && (
            <Card>
              <p className="text-center text-gray-500 py-8">
                No hay productos disponibles. {isAdmin ? 'Créalos en Inventario.' : 'Pide al administrador que los cree en Inventario.'}
              </p>
            </Card>
          )}
          {grouped.map(([cat, list]) => {
            const st = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE.Otros;
            const Icon = st.icon;
            return (
              <div key={cat} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className={`flex items-center gap-2 px-6 py-4 border-b border-gray-100 ${st.header}`}>
                  <Icon className="w-5 h-5 text-amber-600" />
                  <h3 className="font-semibold text-gray-900">{st.title}</h3>
                </div>
                <div className={`p-5 grid gap-4 ${cat === 'Pollo' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
                  {list.map(p => {
                    const left = p.stock - inCart(p.id);
                    const out = p.stock <= 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => add(p)}
                        disabled={out || closed}
                        className="relative rounded-2xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50/40 disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:cursor-not-allowed p-4 text-center transition-colors"
                      >
                        <div className="text-xs font-mono text-gray-400">{p.id}</div>
                        <div className="font-semibold text-gray-900 mt-1">{p.name}</div>
                        <div className="font-bold text-amber-600 mt-1">{formatMoney(p.price)}</div>
                        <div className={`text-xs mt-1 ${out ? 'text-red-600 font-medium' : left <= p.minStock ? 'text-amber-600' : 'text-gray-400'}`}>
                          {out ? 'Agotado' : `${left} disponibles`}
                        </div>
                        {inCart(p.id) > 0 && (
                          <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
                            {inCart(p.id)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6 lg:sticky lg:top-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                <ShoppingCart className="w-5 h-5" /> Orden Actual
              </h3>
              {cart.length > 0 && (
                <button className="text-sm text-gray-400 hover:text-red-600" onClick={reset}>
                  Vaciar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-14 text-center text-gray-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                Selecciona productos del menú
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <ul className="space-y-3">
                  {cart.map(it => (
                    <li key={it.productId} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{it.name}</div>
                        <div className="text-sm text-gray-500">{formatMoney(it.price)} c/u</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center" onClick={() => changeQty(it.productId, -1)} aria-label="Quitar uno">
                          {it.quantity === 1 ? <Trash2 className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4" />}
                        </button>
                        <span className="w-8 text-center font-semibold">{it.quantity}</span>
                        <button className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center" onClick={() => changeQty(it.productId, 1)} aria-label="Agregar uno">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="w-24 text-right font-semibold text-gray-900">{formatMoney(it.price * it.quantity)}</div>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                  <span className="text-gray-600">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{formatMoney(total)}</span>
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Método de pago</div>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={`rounded-xl border-2 py-2 text-sm font-medium transition-colors ${
                          method === m.id ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {method === 'efectivo' && (
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <label className="block">
                      <span className="text-sm text-gray-700">Recibido</span>
                      <input className={inputCls} inputMode="numeric" placeholder="Opcional" value={received ? receivedN.toLocaleString('es-CO') : ''} onChange={e => setReceived(e.target.value)} />
                    </label>
                    <div className={`rounded-xl px-4 py-2.5 text-right ${change < 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      <div className="text-xs">{change < 0 ? 'Falta' : 'Cambio'}</div>
                      <div className="font-bold">{formatMoney(Math.abs(change))}</div>
                    </div>
                  </div>
                )}

                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Datos del cliente (opcional)</summary>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input className={inputCls} placeholder="Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    <input className={inputCls} placeholder="CC / NIT" value={customerDoc} onChange={e => setCustomerDoc(e.target.value)} />
                  </div>
                </details>

                <button className={btnPrimary + ' w-full py-3 text-base'} onClick={checkout} disabled={busy || closed}>
                  {busy ? 'Registrando…' : `Cobrar ${formatMoney(total)}`}
                </button>
              </div>
            )}
          </div>

          <Card title="Ventas de hoy" icon={<Printer className="w-5 h-5 text-gray-500" />}>
            {sales.length === 0 ? (
              <p className="text-center text-gray-400 py-4">Aún no hay ventas.</p>
            ) : (
              <ul className="divide-y divide-gray-50 -my-2 max-h-96 overflow-y-auto">
                {sales.map(s => (
                  <li key={s.id} className="py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${s.status === 'anulada' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {s.id} · {formatMoney(s.total)}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {getFormattedTime(s.createdAt)} · {PAYMENT_METHODS.find(m => m.id === s.paymentMethod)?.label} · {s.cashierName}
                        {s.status === 'anulada' && <span className="text-red-600"> · Anulada</span>}
                      </div>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Reimprimir" onClick={() => printSaleTicket(s, business)}>
                      <Printer className="w-4 h-4" />
                    </button>
                    {isAdmin && s.status === 'activa' && !closed && (
                      <button className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Anular venta" onClick={() => setVoiding(s)}>
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {lastSale && <SaleDoneModal sale={lastSale} business={business} onClose={() => setLastSale(null)} />}
      {voiding && <VoidModal sale={voiding} onClose={() => setVoiding(null)} />}
      {showSettings && <BusinessModal initial={business} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function SaleDoneModal({ sale, business, onClose }: { sale: Sale; business: BusinessInfo; onClose: () => void }) {
  return (
    <Modal title={`Venta ${sale.id}`} onClose={onClose}>
      <div className="text-center py-2">
        <div className="text-sm text-gray-500">Total cobrado</div>
        <div className="text-3xl font-bold text-gray-900">{formatMoney(sale.total)}</div>
        {sale.change !== undefined && (
          <div className="mt-3 inline-block rounded-xl bg-green-50 text-green-700 px-4 py-2">
            Cambio: <b>{formatMoney(sale.change)}</b>
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Nueva venta
        </button>
        <button
          className={btnPrimary + ' flex-1'}
          onClick={() => {
            printSaleTicket(sale, business);
            onClose();
          }}
        >
          <Printer className="w-4 h-4" /> Imprimir factura
        </button>
      </div>
    </Modal>
  );
}

function VoidModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { profile } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return toast.error('Escribe el motivo de la anulación.');
    if (!profile) return;
    setBusy(true);
    try {
      await voidSale(sale, reason.trim(), profile);
      toast.success(`Venta ${sale.id} anulada; el inventario fue devuelto.`);
      onClose();
    } catch (e) {
      toast.error(e instanceof SaleError ? e.message : authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Anular ${sale.id}`} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-3">
        Se devolverán las unidades al inventario y la venta dejará de contar en el cierre. Queda registrada como anulada.
      </p>
      <label className="block">
        <span className="text-sm text-gray-700">Motivo</span>
        <input className={inputCls} autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: cliente canceló" />
      </label>
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnDanger + ' flex-1'} onClick={submit} disabled={busy}>
          Anular venta
        </button>
      </div>
    </Modal>
  );
}

function BusinessModal({ initial, onClose }: { initial: BusinessInfo; onClose: () => void }) {
  const [info, setInfo] = useState(initial);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof BusinessInfo, label: string) => (
    <label className="block">
      <span className="text-sm text-gray-700">{label}</span>
      <input className={inputCls} value={info[k]} onChange={e => setInfo({ ...info, [k]: e.target.value })} />
    </label>
  );
  const save = async () => {
    setBusy(true);
    try {
      await saveBusinessInfo(info);
      toast.success('Datos de la factura guardados');
      onClose();
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Datos que salen en la factura" onClose={onClose}>
      <div className="space-y-3">
        {field('name', 'Nombre del negocio')}
        {field('nit', 'NIT')}
        {field('address', 'Dirección')}
        {field('phone', 'Teléfono')}
        {field('footer', 'Mensaje al final')}
      </div>
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnPrimary + ' flex-1'} onClick={save} disabled={busy}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
