import { useState } from 'react';
import { toast } from 'sonner';
import { BellRing, Bike, Check, Copy, Globe, MapPin, Phone, QrCode, Store, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { formatCOP, isOpenNow, useCarta, useCartaConfig } from '../../lib/cartaStore';
import { zones } from '../../lib/zones';
import { getFormattedTime } from '../../lib/orderStore';
import {
  acceptMesaOrder,
  atenderLlamada,
  itemLabel,
  rejectWebOrder,
  sendToKitchen,
  setDeliveryZone,
  useActiveWebOrders,
  useLlamadas,
  type WebOrder,
} from '../../lib/webOrders';

const card = 'rounded-2xl bg-white border border-gray-200 shadow-sm';
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

function Items({ o }: { o: WebOrder }) {
  return (
    <ul className="text-sm space-y-0.5">
      {o.items.map((i, k) => (
        <li key={k} className="flex justify-between gap-3">
          <span>
            <b>{i.qty}×</b> {itemLabel(i)}
          </span>
          <span className="tabular-nums text-gray-500">{formatCOP(i.price * i.qty)}</span>
        </li>
      ))}
    </ul>
  );
}

function RejectButton({ o }: { o: WebOrder }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`}
      onClick={async () => {
        const motivo = window.prompt('¿Por qué no se puede tomar el pedido? (lo verá el cliente)', 'Se agotó un plato');
        if (motivo === null) return;
        setBusy(true);
        try {
          await rejectWebOrder(o.id, motivo);
        } finally {
          setBusy(false);
        }
      }}
    >
      <X className="w-4 h-4" /> Rechazar
    </button>
  );
}

/** Pedidos hechos desde el QR de las mesas y llamadas al mesero (se muestra en Mesas y en Pedidos web) */
export function MesaRequests() {
  const orders = useActiveWebOrders().filter(o => o.status === 'por-aceptar');
  const llamadas = useLlamadas();
  const { items: carta } = useCarta();
  const { cfg } = useCartaConfig();
  const { profile } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (orders.length === 0 && llamadas.length === 0) return null;

  const accept = async (o: WebOrder) => {
    setBusy(o.id);
    try {
      await acceptMesaOrder(o, profile?.name ?? 'Mesero', carta, cfg);
      toast.success(`Pedido agregado a la mesa ${o.mesa}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo aceptar el pedido');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-6 space-y-3" aria-label="Pedidos desde las mesas">
      {llamadas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {llamadas.map(l => (
            <div key={l.mesa} className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 pl-4 pr-2 py-2">
              <BellRing className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-semibold text-amber-900">
                Mesa {l.mesa} llama al mesero{l.at ? ` · ${getFormattedTime(l.at)}` : ''}
              </span>
              <button type="button" onClick={() => atenderLlamada(l.mesa)} className={`${btn} bg-amber-600 text-white py-1.5`}>
                Atendido
              </button>
            </div>
          ))}
        </div>
      )}
      {orders.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map(o => (
            <article key={o.id} className={`${card} p-4 border-blue-200 ring-1 ring-blue-100`}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-bold text-gray-900">
                  <QrCode className="w-4 h-4 text-blue-600" /> Mesa {o.mesa} · por aceptar
                </span>
                <span className="text-xs text-gray-500">{getFormattedTime(o.createdAt)}</span>
              </div>
              <Items o={o} />
              <div className="mt-2 flex justify-between font-semibold text-sm border-t pt-2">
                <span>Total</span>
                <span>{formatCOP(o.subtotal)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy === o.id} onClick={() => accept(o)} className={`${btn} flex-1 bg-blue-600 text-white hover:bg-blue-700`}>
                  <Check className="w-4 h-4" /> Aceptar y sumar a la mesa
                </button>
                <RejectButton o={o} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Cliente({ o }: { o: WebOrder }) {
  const c = o.cliente;
  if (!c) return null;
  return (
    <div className="text-sm text-gray-700 space-y-0.5">
      <p className="font-semibold text-gray-900">{c.nombre}</p>
      <p className="flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5 text-gray-400" />
        <a href={`https://wa.me/57${c.telefono}`} target="_blank" rel="noreferrer" className="underline">
          {c.telefono}
        </a>
      </p>
      {c.direccion && (
        <p className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-400" /> {c.direccion}, {c.barrio}
        </p>
      )}
      {c.notas && <p className="text-amber-800 bg-amber-50 rounded-lg px-2 py-1 mt-1">{c.notas}</p>}
    </div>
  );
}

function DeliveryCard({ o }: { o: WebOrder }) {
  const { items: carta } = useCarta();
  const { cfg } = useCartaConfig();
  const [zone, setZone] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const fee = zones.find(z => z.name === zone)?.fee;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`${card} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-gray-900">
          {o.tipo === 'recoger' ? <Store className="w-4 h-4 text-gray-500" /> : <Bike className="w-4 h-4 text-gray-500" />}
          {o.tipo === 'recoger' ? 'Recoge en el local' : 'Domicilio'}
        </span>
        <span className="text-xs text-gray-500">
          {getFormattedTime(o.createdAt)} · {o.pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}
        </span>
      </div>
      <Cliente o={o} />
      <div className="rounded-xl bg-gray-50 p-3">
        <Items o={o} />
        <div className="mt-2 pt-2 border-t border-gray-200 text-sm space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCOP(o.subtotal)}</span>
          </div>
          {o.deliveryFee != null && o.tipo === 'domicilio' && (
            <div className="flex justify-between">
              <span>Domicilio ({o.zone})</span>
              <span>{formatCOP(o.deliveryFee)}</span>
            </div>
          )}
          {o.total != null && (
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCOP(o.total)}</span>
            </div>
          )}
        </div>
      </div>

      {o.status === 'por-confirmar' && (
        <>
          <label className="block text-sm font-semibold text-gray-700">
            Zona del domicilio
            <select value={zone} onChange={e => setZone(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal">
              <option value="">Elige la zona…</option>
              {zones.map(z => (
                <option key={z.name} value={z.name}>
                  {z.name} · {formatCOP(z.fee)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!zone || busy}
              onClick={() => run(() => setDeliveryZone(o, zone, fee ?? 0), 'Se envió el total al cliente')}
              className={`${btn} flex-1 bg-gray-900 text-white`}
            >
              Enviar total al cliente{fee != null ? ` · ${formatCOP(o.subtotal + fee)}` : ''}
            </button>
            <RejectButton o={o} />
          </div>
        </>
      )}
      {o.status === 'por-aceptar-cliente' && <p className="text-sm text-gray-500">Esperando que el cliente confirme el total.</p>}
      {o.status === 'esperando-pago' && (
        <>
          <p className="text-sm text-gray-600">
            El cliente envía el comprobante al WhatsApp 301 550 1038. Cuando lo verifiques, pásalo a cocina.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => sendToKitchen(o, carta, cfg, true), 'Pago verificado: pedido en Cocina')}
              className={`${btn} flex-1 bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <Check className="w-4 h-4" /> Pago verificado · enviar a cocina
            </button>
            <RejectButton o={o} />
          </div>
        </>
      )}
      {o.status === 'confirmado' && <p className="text-sm text-gray-500">Pasando a cocina…</p>}
    </article>
  );
}

/** Panel del personal: pedidos que llegan por la web */
export function PedidosWeb() {
  const orders = useActiveWebOrders();
  const { cfg } = useCartaConfig();
  const domicilios = orders.filter(o => o.tipo !== 'mesa');
  const groups = [
    { title: 'Domicilios por confirmar', rows: domicilios.filter(o => o.status === 'por-confirmar') },
    { title: 'Esperando pago (transferencia)', rows: domicilios.filter(o => o.status === 'esperando-pago') },
    { title: 'Esperando que el cliente confirme', rows: domicilios.filter(o => o.status === 'por-aceptar-cliente' || o.status === 'confirmado') },
  ];
  const link = `${window.location.origin}/pedir`;
  const abierto = isOpenNow(cfg);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-amber-500" /> Pedidos web
          </h2>
          <p className="text-sm text-gray-600">
            Lo que piden los clientes desde el link de domicilios y el QR de las mesas. Los pedidos en efectivo pasan solos a Cocina.
          </p>
        </div>
        <div className={`${card} px-4 py-3 text-sm`}>
          <p className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${abierto ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {abierto ? 'Recibiendo pedidos' : 'Pedidos cerrados'}
            <span className="text-gray-500">
              · {cfg.pedidosWeb === 'auto' ? `${cfg.abre}–${cfg.cierra}` : cfg.pedidosWeb === 'abierto' ? 'abierto a mano' : 'cerrado a mano'}
            </span>
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link copiado'))}
            className="mt-1 inline-flex items-center gap-1.5 text-gray-600 underline"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar link para WhatsApp
          </button>
        </div>
      </div>

      <MesaRequests />

      {groups.map(
        g =>
          g.rows.length > 0 && (
            <section key={g.title} className="mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {g.title} <span className="text-gray-400">({g.rows.length})</span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.rows.map(o => (
                  <DeliveryCard key={o.id} o={o} />
                ))}
              </div>
            </section>
          ),
      )}

      {orders.length === 0 && (
        <div className={`${card} p-10 text-center text-gray-500`}>
          <Globe className="w-10 h-10 mx-auto text-gray-300" />
          <p className="mt-3">No hay pedidos web pendientes.</p>
          <p className="text-sm">Cuando un cliente pida, suena una alerta y aparece aquí.</p>
        </div>
      )}
    </div>
  );
}
