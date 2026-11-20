import { useEffect, useState } from 'react';
import { ArrowLeft, Bike, Check, Clock, Copy, MessageCircle, Store } from 'lucide-react';
import { formatCOP, isOpenNow, useCarta, useCartaConfig, usePolloStock } from '../../lib/cartaStore';
import {
  CUENTAS_PAGO,
  WHATSAPP_PAGOS,
  clientCancel,
  clientConfirm,
  createWebOrder,
  itemLabel,
  useWebOrder,
  type WebCliente,
  type WebOrder,
  type WebPago,
  type WebTipo,
} from '../../lib/webOrders';
import { CartBar, CartLines, OrderMenu, PublicHeader, Row, SHELL, Sheet, useCart, useStoredId } from './shared';

const CLIENTE_KEY = 'cliente-domicilio';
const loadCliente = (): WebCliente => {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENTE_KEY) || '{}') as Partial<WebCliente>;
    return { nombre: '', telefono: '', direccion: '', barrio: '', ...saved, notas: '' };
  } catch {
    return { nombre: '', telefono: '', direccion: '', barrio: '', notas: '' };
  }
};

/** Pedido a domicilio o para recoger: /pedir (el link que se comparte por WhatsApp) */
export default function PedirPage() {
  const { items: carta, loading } = useCarta();
  const { cfg, loaded } = useCartaConfig();
  const polloStock = usePolloStock();
  const cart = useCart('carrito-domicilio');
  const [orderId, setOrderId] = useStoredId('pedido-domicilio');
  const order = useWebOrder(orderId);
  const [tipo, setTipo] = useState<WebTipo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = 'Pedir a domicilio | Asadero de Pollo Ventilador';
  }, []);

  const finished = order && ['en-cocina', 'rechazado', 'cancelado'].includes(order.status) && Date.now() - (order.createdAt?.toMillis?.() ?? 0) > 6 * 3600_000;
  if (order && !finished) {
    return <Tracking order={order} onNew={() => setOrderId(null)} />;
  }

  const abierto = isOpenNow(cfg);
  if (loaded && !abierto) {
    return (
      <div className={SHELL}>
        <PublicHeader title="Pedidos a domicilio" />
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <Clock className="w-10 h-10 mx-auto text-stone-400" />
          <p className="mt-3 text-lg font-semibold">En este momento no estamos recibiendo pedidos</p>
          {cfg.pedidosWeb === 'auto' && (
            <p className="mt-1 text-stone-600">
              Horario de pedidos: {cfg.abre} a {cfg.cierra}
            </p>
          )}
          <a href="/carta" className="mt-6 inline-block underline text-stone-800">
            Ver la carta
          </a>
        </div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div className={SHELL}>
        <PublicHeader title="Haz tu pedido" subtitle="¿Cómo quieres recibirlo?" />
        <div className="max-w-md mx-auto px-4 py-8 grid gap-3">
          <ChoiceCard icon={<Bike className="w-6 h-6" />} title="Domicilio" text="Te lo llevamos. El valor del envío se confirma según tu dirección." onClick={() => setTipo('domicilio')} />
          <ChoiceCard icon={<Store className="w-6 h-6" />} title="Recoger en el local" text="Sin costo de envío. Lo pides y pasas por él." onClick={() => setTipo('recoger')} />
          <p className="text-center text-xs text-stone-500 mt-2">Los precios para llevar incluyen el empaque.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} pb-28`}>
      <PublicHeader title={tipo === 'domicilio' ? 'Pedido a domicilio' : 'Pedido para recoger'} subtitle="Elige tus platos">
        <button type="button" onClick={() => setTipo(null)} className="mt-3 inline-flex items-center gap-1 text-sm text-white/80 underline">
          <ArrowLeft className="w-4 h-4" /> Cambiar {tipo === 'domicilio' ? 'a recoger' : 'a domicilio'}
        </button>
      </PublicHeader>
      {loading ? (
        <p className="text-center text-stone-500 py-16">Cargando la carta…</p>
      ) : (
        <OrderMenu carta={carta} cfg={cfg} polloStock={polloStock} llevar cart={cart} />
      )}
      <CartBar cart={cart} label="Continuar" onOpen={() => setOpen(true)} />
      {open && (
        <Checkout
          tipo={tipo}
          cart={cart}
          onClose={() => setOpen(false)}
          onSent={id => {
            cart.clear();
            setOpen(false);
            setTipo(null);
            setOrderId(id);
          }}
        />
      )}
    </div>
  );
}

function ChoiceCard({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-2xl bg-white border border-stone-200 p-5 text-left hover:border-stone-400">
      <span className="w-12 h-12 rounded-full bg-stone-900 text-white grid place-items-center shrink-0">{icon}</span>
      <span>
        <span className="block font-semibold text-lg">{title}</span>
        <span className="block text-sm text-stone-500">{text}</span>
      </span>
    </button>
  );
}

function PagoPicker({ value, onChange }: { value: WebPago; onChange: (p: WebPago) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pago">
      {(
        [
          ['efectivo', 'Efectivo'],
          ['transferencia', 'Transferencia'],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-xl border py-3 text-sm font-medium ${value === v ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
const input = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base';

function Checkout({ tipo, cart, onClose, onSent }: { tipo: WebTipo; cart: ReturnType<typeof useCart>; onClose: () => void; onSent: (id: string) => void }) {
  const [c, setC] = useState<WebCliente>(loadCliente);
  const [pago, setPago] = useState<WebPago>('efectivo');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const domicilio = tipo === 'domicilio';

  const tel = (c.telefono || '').replace(/\D/g, '');
  const errs = {
    nombre: !c.nombre.trim() ? 'Escribe tu nombre' : '',
    telefono: tel.length !== 10 ? 'Escribe un celular de 10 dígitos' : '',
    direccion: domicilio && !c.direccion?.trim() ? 'Escribe la dirección' : '',
    barrio: domicilio && !c.barrio?.trim() ? 'Escribe el barrio' : '',
  };
  const valid = !Object.values(errs).some(Boolean);
  const set = (k: keyof WebCliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  const enviar = async () => {
    setTouched(true);
    if (!valid || cart.count === 0) return;
    setSending(true);
    setError('');
    const cliente: WebCliente = {
      nombre: c.nombre.trim(),
      telefono: tel,
      ...(domicilio ? { direccion: c.direccion!.trim(), barrio: c.barrio!.trim() } : {}),
      notas: c.notas?.trim(),
    };
    try {
      try {
        localStorage.setItem(CLIENTE_KEY, JSON.stringify({ ...cliente, notas: '' }));
      } catch {
        /* sin almacenamiento */
      }
      const id = await createWebOrder({ tipo, cliente, pago, items: cart.items });
      onSent(id);
    } catch (e) {
      console.error(e);
      setError('No pudimos enviar el pedido. Revisa tu conexión e intenta de nuevo.');
      setSending(false);
    }
  };

  const err = (k: keyof typeof errs) => touched && errs[k] && <span className="mt-1 block text-xs text-red-700">{errs[k]}</span>;

  return (
    <Sheet title="Tu pedido" onClose={onClose}>
      <CartLines cart={cart} />
      <div className="mt-5 space-y-3">
        <h3 className="font-semibold">{domicilio ? 'Datos para el domicilio' : 'Tus datos'}</h3>
        <Field label="Nombre">
          <input className={input} value={c.nombre} onChange={set('nombre')} autoComplete="name" />
          {err('nombre')}
        </Field>
        <Field label="Celular">
          <input className={input} value={c.telefono} onChange={set('telefono')} inputMode="tel" autoComplete="tel" placeholder="300 000 0000" />
          {err('telefono')}
        </Field>
        {domicilio && (
          <>
            <Field label="Dirección">
              <input className={input} value={c.direccion} onChange={set('direccion')} autoComplete="street-address" placeholder="Calle 00 # 00-00, casa / apto" />
              {err('direccion')}
            </Field>
            <Field label="Barrio">
              <input className={input} value={c.barrio} onChange={set('barrio')} />
              {err('barrio')}
            </Field>
          </>
        )}
        <Field label="Notas (opcional)">
          <textarea className={input} rows={2} value={c.notas} onChange={set('notas')} maxLength={200} placeholder={domicilio ? 'Punto de referencia, cambio para…' : 'Hora en que pasas, cambio para…'} />
        </Field>
        <Field label="Forma de pago">
          <PagoPicker value={pago} onChange={setPago} />
        </Field>
      </div>
      <div className="mt-5 pt-4 border-t border-stone-200 space-y-1.5">
        <Row label="Subtotal" value={formatCOP(cart.subtotal)} />
        <Row label="Domicilio" value={domicilio ? 'Por confirmar' : 'Sin costo'} />
        <Row label={domicilio ? 'Total (sin domicilio)' : 'Total'} value={formatCOP(cart.subtotal)} strong />
        {domicilio && <p className="text-xs text-stone-500">Te mostramos el valor del domicilio según tu dirección y confirmas antes de que lo preparemos.</p>}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={enviar} disabled={sending} className="mt-5 w-full rounded-2xl bg-stone-900 text-white font-semibold py-4 disabled:opacity-50">
        {sending ? 'Enviando…' : domicilio ? 'Enviar pedido' : 'Hacer pedido'}
      </button>
    </Sheet>
  );
}

// ---------- Seguimiento del pedido ----------

function Tracking({ order, onNew }: { order: WebOrder; onNew: () => void }) {
  const [pago, setPago] = useState<WebPago>(order.pago ?? 'efectivo');
  const [busy, setBusy] = useState(false);
  const total = order.total ?? order.subtotal;
  const ref = order.id.slice(0, 6).toUpperCase();

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const steps: { key: string; label: string }[] = [
    { key: 'recibido', label: 'Recibido' },
    ...(order.tipo === 'domicilio' ? [{ key: 'envio', label: 'Domicilio' }] : []),
    ...(order.pago === 'transferencia' ? [{ key: 'pago', label: 'Pago' }] : []),
    { key: 'cocina', label: 'En cocina' },
  ];
  const at = { 'por-confirmar': 'envio', 'por-aceptar-cliente': 'envio', 'esperando-pago': 'pago', confirmado: 'cocina', 'en-cocina': 'cocina' }[order.status as string] ?? 'recibido';
  const atIdx = Math.max(0, steps.findIndex(s => s.key === at));

  return (
    <div className={SHELL}>
      <PublicHeader title={order.tipo === 'recoger' ? 'Pedido para recoger' : 'Pedido a domicilio'} subtitle={`Pedido ${ref}`} />
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {!['rechazado', 'cancelado'].includes(order.status) && (
          <ol className="flex items-center gap-2" aria-label="Estado del pedido">
            {steps.map((s, i) => (
              <li key={s.key} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= atIdx ? 'bg-stone-900' : 'bg-stone-200'}`} />
                <p className={`mt-1 text-xs ${i <= atIdx ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>{s.label}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="rounded-2xl bg-white border border-stone-200 p-5 space-y-3" role="status">
          {order.status === 'por-confirmar' && (
            <Msg icon={<Clock className="w-5 h-5" />} title="Estamos calculando tu domicilio" text="En un momento te mostramos el valor del envío según tu dirección. No cierres esta página." />
          )}
          {order.status === 'por-aceptar-cliente' && (
            <>
              <Msg icon={<Bike className="w-5 h-5" />} title="Confirma tu pedido" text={`Domicilio a ${order.zone ?? 'tu zona'}.`} />
              <div className="space-y-1.5 pt-1">
                <Row label="Subtotal" value={formatCOP(order.subtotal)} />
                <Row label="Domicilio" value={formatCOP(order.deliveryFee ?? 0)} />
                <Row label="Total" value={formatCOP(total)} strong />
              </div>
              <PagoPicker value={pago} onChange={setPago} />
              <button type="button" disabled={busy} onClick={() => act(() => clientConfirm(order.id, pago))} className="w-full rounded-2xl bg-stone-900 text-white font-semibold py-4 disabled:opacity-50">
                Confirmar pedido · {formatCOP(total)}
              </button>
              <button type="button" disabled={busy} onClick={() => act(() => clientCancel(order.id))} className="w-full text-sm text-stone-500 underline">
                Cancelar pedido
              </button>
            </>
          )}
          {order.status === 'esperando-pago' && <PagoTransferencia order={order} total={total} refCode={ref} />}
          {order.status === 'confirmado' && <Msg icon={<Check className="w-5 h-5" />} title="Pedido confirmado" text="Lo estamos pasando a cocina." />}
          {order.status === 'en-cocina' && (
            <Msg
              icon={<Check className="w-5 h-5" />}
              title="Tu pedido está en preparación"
              text={order.tipo === 'recoger' ? 'Puedes pasar por él en unos 30 minutos.' : 'Pronto sale para tu dirección.'}
            />
          )}
          {order.status === 'rechazado' && <Msg title="No pudimos tomar tu pedido" text={order.motivo ?? 'Escríbenos por WhatsApp.'} />}
          {order.status === 'cancelado' && <Msg title="Pedido cancelado" text="Puedes hacer uno nuevo cuando quieras." />}
        </div>

        <div className="rounded-2xl bg-white border border-stone-200 p-5">
          <h3 className="font-semibold mb-2">Resumen</h3>
          <ul className="text-sm space-y-1">
            {order.items.map((i, k) => (
              <li key={k} className="flex justify-between gap-3">
                <span>
                  {i.qty}× {itemLabel(i)}
                </span>
                <span className="tabular-nums text-stone-600">{formatCOP(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-stone-100 space-y-1">
            <Row label="Domicilio" value={order.tipo === 'recoger' ? 'Recoges en el local' : order.deliveryFee != null ? formatCOP(order.deliveryFee) : 'Por confirmar'} />
            <Row label="Total" value={formatCOP(total)} strong />
          </div>
        </div>

        {['en-cocina', 'rechazado', 'cancelado'].includes(order.status) && (
          <button type="button" onClick={onNew} className="w-full rounded-2xl border border-stone-300 bg-white font-medium py-3.5">
            Hacer otro pedido
          </button>
        )}
        <a
          href={`https://wa.me/${WHATSAPP_PAGOS}?text=${encodeURIComponent(`Hola, tengo una pregunta sobre mi pedido ${ref}`)}`}
          className="flex items-center justify-center gap-2 text-sm text-stone-600"
        >
          <MessageCircle className="w-4 h-4" /> ¿Dudas? Escríbenos al 301 550 1038
        </a>
      </div>
    </div>
  );
}

function Msg({ icon, title, text }: { icon?: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      {icon && <span className="w-9 h-9 rounded-full bg-stone-100 grid place-items-center shrink-0">{icon}</span>}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-stone-600">{text}</p>
      </div>
    </div>
  );
}

function PagoTransferencia({ order, total, refCode }: { order: WebOrder; total: number; refCode: string }) {
  const [copied, setCopied] = useState('');
  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v.replace(/\s/g, ''));
      setCopied(v);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* el portapapeles no está disponible */
    }
  };
  const msg = `Hola, envío el comprobante del pedido ${refCode} a nombre de ${order.cliente?.nombre ?? ''} por ${formatCOP(total)}.`;
  return (
    <>
      <Msg icon={<Clock className="w-5 h-5" />} title={`Transfiere ${formatCOP(total)}`} text="Cuando verifiquemos el pago, tu pedido pasa a cocina." />
      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
        {CUENTAS_PAGO.map(c => (
          <li key={c.value} className="flex items-center justify-between px-3 py-2.5">
            <span>
              <span className="block text-xs text-stone-500">{c.label}</span>
              <span className="font-medium tabular-nums">{c.value}</span>
            </span>
            <button type="button" onClick={() => copy(c.value)} className="inline-flex items-center gap-1 text-sm text-stone-600" aria-label={`Copiar ${c.label} ${c.value}`}>
              {copied === c.value ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === c.value ? 'Copiado' : 'Copiar'}
            </button>
          </li>
        ))}
      </ul>
      <a
        href={`https://wa.me/${WHATSAPP_PAGOS}?text=${encodeURIComponent(msg)}`}
        className="flex items-center justify-center gap-2 w-full rounded-2xl bg-stone-900 text-white font-semibold py-4"
      >
        <MessageCircle className="w-5 h-5" /> Enviar comprobante por WhatsApp
      </a>
      <p className="text-xs text-stone-500 text-center">WhatsApp 301 550 1038 · Referencia {refCode}</p>
    </>
  );
}
