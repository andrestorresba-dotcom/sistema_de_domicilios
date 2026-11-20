import { useEffect, useState } from 'react';
import { BellRing, Check, Clock, UtensilsCrossed } from 'lucide-react';
import { formatCOP, useCarta, useCartaConfig, usePolloStock } from '../../lib/cartaStore';
import { callWaiter, createWebOrder, itemLabel, useWebOrder } from '../../lib/webOrders';
import { CartBar, CartLines, OrderMenu, PublicHeader, Row, SHELL, Sheet, useCart, useStoredId } from './shared';

const TOTAL_MESAS = 42;

/** Página que abre el QR de cada mesa: /mesa/12 */
export default function MesaPage({ mesa }: { mesa: number }) {
  const { items: carta, loading } = useCarta();
  const { cfg } = useCartaConfig();
  const polloStock = usePolloStock();
  const cart = useCart(`carrito-mesa-${mesa}`);
  const [orderId, setOrderId] = useStoredId(`pedido-mesa-${mesa}`);
  const order = useWebOrder(orderId);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [called, setCalled] = useState(0);

  useEffect(() => {
    document.title = `Mesa ${mesa} | Asadero de Pollo Ventilador`;
  }, [mesa]);

  if (!Number.isInteger(mesa) || mesa < 1 || mesa > TOTAL_MESAS) {
    return (
      <div className={SHELL}>
        <PublicHeader title="Mesa no encontrada" />
        <p className="text-center text-stone-600 py-12 px-4">Este código no corresponde a una mesa. Pídele ayuda al mesero.</p>
      </div>
    );
  }

  const llamar = async () => {
    try {
      await callWaiter(mesa);
      setCalled(Date.now());
    } catch {
      setError('No pudimos llamar al mesero. Intenta de nuevo.');
    }
  };

  const enviar = async () => {
    setSending(true);
    setError('');
    try {
      const id = await createWebOrder({ tipo: 'mesa', mesa, items: cart.items });
      setOrderId(id);
      cart.clear();
      setOpen(false);
    } catch (e) {
      console.error(e);
      setError('No pudimos enviar el pedido. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const recentlyCalled = called && Date.now() - called < 60_000;
  const showStatus = order && (order.status === 'por-aceptar' || Date.now() - (order.createdAt?.toMillis?.() ?? Date.now()) < 30 * 60_000);

  return (
    <div className={`${SHELL} pb-28`}>
      <PublicHeader title={`Mesa ${mesa}`} subtitle="Pide desde tu celular. El mesero confirma tu pedido.">
        <button
          type="button"
          onClick={llamar}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-stone-900 font-medium px-5 py-2.5"
        >
          <BellRing className="w-4 h-4" /> {recentlyCalled ? 'Mesero en camino' : 'Llamar al mesero'}
        </button>
      </PublicHeader>

      {showStatus && order && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 ${
              order.status === 'aceptado'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : order.status === 'rechazado'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
            role="status"
          >
            {order.status === 'aceptado' ? <Check className="w-5 h-5 shrink-0" /> : <Clock className="w-5 h-5 shrink-0" />}
            <div>
              <p className="font-medium">
                {order.status === 'aceptado'
                  ? 'Tu pedido fue recibido y va para cocina.'
                  : order.status === 'rechazado'
                    ? `El mesero no pudo tomar el pedido: ${order.motivo ?? ''}`
                    : 'Pedido enviado. Un mesero lo confirmará en un momento.'}
              </p>
              <p className="opacity-80">{order.items.map(i => `${i.qty}× ${itemLabel(i)}`).join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-stone-500 py-16">Cargando la carta…</p>
      ) : carta.length === 0 ? (
        <div className="text-center py-16">
          <UtensilsCrossed className="w-10 h-10 mx-auto text-stone-300" />
          <p className="mt-3 text-stone-600">La carta no está disponible. Llama al mesero.</p>
        </div>
      ) : (
        <OrderMenu carta={carta} cfg={cfg} polloStock={polloStock} llevar={false} cart={cart} />
      )}

      <CartBar cart={cart} label="Ver pedido" onOpen={() => setOpen(true)} />

      {open && (
        <Sheet title={`Tu pedido · Mesa ${mesa}`} onClose={() => setOpen(false)}>
          <CartLines cart={cart} />
          <div className="mt-4 pt-4 border-t border-stone-200 space-y-1">
            <Row label="Total" value={formatCOP(cart.subtotal)} strong />
            <p className="text-xs text-stone-500">Pagas al final, en la caja o con el mesero.</p>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <button
            type="button"
            onClick={enviar}
            disabled={sending || cart.count === 0}
            className="mt-5 w-full rounded-2xl bg-stone-900 text-white font-semibold py-4 disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Enviar pedido al mesero'}
          </button>
        </Sheet>
      )}
      {error && !open && <p className="fixed bottom-24 inset-x-4 text-center text-sm text-red-700">{error}</p>}
    </div>
  );
}
