import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  bogotaDay,
  llevarPrice,
  priceForDay,
  type CartaConfig,
  type CartaItem,
} from './cartaStore';

// Pedidos que hacen los clientes desde la carta (QR de mesa o link de domicilio).
// Viven en `pedidos_web` y el personal los convierte en pedidos reales:
//   mesa       → el mesero lo acepta y se suma a la mesa (colección `mesas`)
//   domicilio  → se confirma el envío, el cliente acepta el total y pasa a Cocina (`pedidos`)
//   recoger    → sin envío; en efectivo pasa directo a Cocina

export type WebTipo = 'mesa' | 'domicilio' | 'recoger';
export type WebPago = 'efectivo' | 'transferencia';
export type WebStatus =
  | 'por-aceptar' // mesa: espera al mesero
  | 'aceptado' // mesa: ya está en la mesa
  | 'por-confirmar' // domicilio: el personal debe poner la zona / valor del envío
  | 'por-aceptar-cliente' // domicilio: el cliente debe aceptar el total
  | 'esperando-pago' // transferencia: espera que el personal verifique el comprobante
  | 'confirmado' // listo para Cocina (se envía solo)
  | 'en-cocina'
  | 'rechazado'
  | 'cancelado';

export interface WebItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  nota?: string;
}

export interface WebCliente {
  nombre: string;
  telefono: string;
  direccion?: string;
  barrio?: string;
  notas?: string;
}

export interface WebOrder {
  id: string;
  tipo: WebTipo;
  status: WebStatus;
  mesa?: number;
  cliente?: WebCliente;
  pago?: WebPago;
  items: WebItem[];
  subtotal: number;
  zone?: string;
  deliveryFee?: number;
  total?: number;
  pedidoId?: string;
  motivo?: string;
  aceptadoPor?: string;
  createdAt?: any;
}

export const WHATSAPP_PAGOS = '573015501038';
export const CUENTAS_PAGO = [
  { label: 'Nequi', value: '305 753 9863' },
  { label: 'Daviplata', value: '311 802 0331' },
  { label: 'Llave Bre-B', value: '@3057539863' },
  { label: 'Llave Bre-B', value: '3118020331' },
];

export const AJI_ID = 'aji-extra';
export const CORRIENTE = 'Proteínas del corriente';

export const STATUS_LABEL: Record<WebStatus, string> = {
  'por-aceptar': 'Esperando al mesero',
  aceptado: 'Aceptado',
  'por-confirmar': 'Calculando el domicilio',
  'por-aceptar-cliente': 'Confirma tu pedido',
  'esperando-pago': 'Esperando el pago',
  confirmado: 'Enviando a cocina',
  'en-cocina': 'En preparación',
  rechazado: 'No se pudo tomar',
  cancelado: 'Cancelado',
};

export const ACTIVE_STATUSES: WebStatus[] = ['por-aceptar', 'por-confirmar', 'por-aceptar-cliente', 'esperando-pago', 'confirmado'];

const col = collection(db, 'pedidos_web');

export const itemLabel = (i: Pick<WebItem, 'name' | 'nota'>) => (i.nota ? `${i.name} (${i.nota})` : i.name);
export const subtotalOf = (items: WebItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);

/** Nombre que ve la cocina: los platos del corriente llevan "Almuerzo" adelante */
export const orderName = (c: CartaItem) => (c.category === CORRIENTE ? `Almuerzo corriente – ${c.name}` : c.name);

/** Precio vigente de un plato hoy (mesa o para llevar) */
export function currentPrice(c: CartaItem, cfg: CartaConfig, llevar: boolean, day = bogotaDay()) {
  const mesa = priceForDay(c, day) ?? c.price;
  return llevar ? llevarPrice(mesa, c, cfg) : mesa;
}

/**
 * Recalcula los precios con la carta (no se confía en el precio que manda el navegador del cliente).
 * Si un plato ya no existe en la carta se deja el precio con el que se pidió.
 */
export function repriceItems(items: WebItem[], carta: CartaItem[], cfg: CartaConfig, llevar: boolean): WebItem[] {
  return items.map(i => {
    if (i.id === AJI_ID) return { ...i, price: cfg.ajiPrecio };
    const c = carta.find(x => x.id === i.id);
    return c ? { ...i, name: orderName(c), price: currentPrice(c, cfg, llevar) } : i;
  });
}

// ---------------- Cliente (sin iniciar sesión) ----------------

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

export async function createWebOrder(data: {
  tipo: WebTipo;
  mesa?: number;
  cliente?: WebCliente;
  pago?: WebPago;
  items: WebItem[];
}) {
  const items = data.items.map(i => clean({ id: i.id, name: i.name, qty: i.qty, price: i.price, nota: i.nota?.trim() }));
  const subtotal = subtotalOf(items as WebItem[]);
  let status: WebStatus;
  if (data.tipo === 'mesa') status = 'por-aceptar';
  else if (data.tipo === 'domicilio') status = 'por-confirmar';
  else status = data.pago === 'transferencia' ? 'esperando-pago' : 'confirmado';

  const ref = await addDoc(
    col,
    clean({
      tipo: data.tipo,
      status,
      mesa: data.mesa,
      cliente: data.cliente ? clean(data.cliente) : undefined,
      pago: data.pago,
      items,
      subtotal,
      ...(data.tipo === 'recoger' ? { deliveryFee: 0, total: subtotal, zone: 'Recoge en el local' } : {}),
      createdAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

/** El cliente acepta el total con el domicilio ya calculado */
export async function clientConfirm(id: string, pago: WebPago) {
  await updateDoc(doc(db, 'pedidos_web', id), {
    status: pago === 'transferencia' ? 'esperando-pago' : 'confirmado',
    pago,
  });
}

export async function clientCancel(id: string) {
  await updateDoc(doc(db, 'pedidos_web', id), { status: 'cancelado' });
}

export function useWebOrder(id: string | null) {
  const [order, setOrder] = useState<WebOrder | null>(null);
  useEffect(() => {
    if (!id) {
      setOrder(null);
      return;
    }
    return onSnapshot(
      doc(db, 'pedidos_web', id),
      s => setOrder(s.exists() ? ({ id: s.id, ...s.data() } as WebOrder) : null),
      () => setOrder(null),
    );
  }, [id]);
  return order;
}

/** El cliente en la mesa llama al mesero */
export async function callWaiter(mesa: number) {
  await setDoc(doc(db, 'llamadas', String(mesa)), { mesa, at: serverTimestamp() });
}

// ---------------- Personal ----------------

/** Si el permiso falla (p. ej. justo al crear la cuenta) se vuelve a intentar en unos segundos */
function useRetry() {
  const [n, setN] = useState(0);
  const retry = (what: string) => (err: unknown) => {
    console.warn(`${what}: reintentando`, err);
    setTimeout(() => setN(x => x + 1), 3000);
  };
  return [n, retry] as const;
}

export function useActiveWebOrders() {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [attempt, retry] = useRetry();
  useEffect(
    () =>
      onSnapshot(
        query(col, where('status', 'in', ACTIVE_STATUSES)),
        s =>
          setOrders(
            s.docs
              .map(d => ({ id: d.id, ...d.data() }) as WebOrder)
              .sort((a, b) => (a.createdAt?.toMillis?.() ?? Date.now()) - (b.createdAt?.toMillis?.() ?? Date.now())),
          ),
        retry('pedidos_web'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );
  return orders;
}

export interface Llamada {
  mesa: number;
  at?: any;
}

export function useLlamadas() {
  const [rows, setRows] = useState<Llamada[]>([]);
  const [attempt, retry] = useRetry();
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'llamadas'),
        s => setRows(s.docs.map(d => d.data() as Llamada).sort((a, b) => a.mesa - b.mesa)),
        retry('llamadas'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );
  return rows;
}

export async function atenderLlamada(mesa: number) {
  await deleteDoc(doc(db, 'llamadas', String(mesa)));
}

/** El personal pone la zona y el valor del domicilio; el cliente debe aceptar */
export async function setDeliveryZone(o: WebOrder, zone: string, fee: number) {
  await updateDoc(doc(db, 'pedidos_web', o.id), {
    zone,
    deliveryFee: fee,
    total: o.subtotal + fee,
    status: 'por-aceptar-cliente',
  });
}

export async function rejectWebOrder(id: string, motivo: string) {
  await updateDoc(doc(db, 'pedidos_web', id), { status: 'rechazado', motivo: motivo.trim() || 'No se pudo tomar el pedido' });
}

const tableFloor = (n: number) => (n <= 26 ? 1 : 2);

/** El mesero acepta un pedido hecho desde el QR: se suma a lo que ya tiene la mesa */
export async function acceptMesaOrder(o: WebOrder, waiter: string, carta: CartaItem[], cfg: CartaConfig) {
  if (!o.mesa) throw new Error('El pedido no tiene mesa');
  const webRef = doc(db, 'pedidos_web', o.id);
  const mesaRef = doc(db, 'mesas', String(o.mesa));
  await runTransaction(db, async tx => {
    const web = await tx.get(webRef);
    if (!web.exists() || web.data().status !== 'por-aceptar') throw new Error('Este pedido ya fue atendido');
    const mesa = await tx.get(mesaRef);
    const cur = mesa.exists() && mesa.data().status !== 'available' ? mesa.data() : null;

    const items: { name: string; quantity: number; price: number; customNote?: string }[] = [...(cur?.items ?? [])];
    for (const i of repriceItems(o.items, carta, cfg, false)) {
      const same = items.find(x => x.name === i.name && x.price === i.price && (x.customNote ?? '') === (i.nota ?? ''));
      if (same) same.quantity += i.qty;
      else items.push({ name: i.name, quantity: i.qty, price: i.price, ...(i.nota ? { customNote: i.nota } : {}) });
    }
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

    tx.set(mesaRef, {
      tableNumber: o.mesa,
      floor: cur?.floor ?? tableFloor(o.mesa!),
      waiterName: cur?.waiterName || waiter,
      numberOfPeople: cur?.numberOfPeople ?? 1,
      items,
      total,
      observations: cur?.observations ?? '',
      status: 'occupied',
      createdAt: cur?.createdAt ?? new Date(),
    });
    tx.update(webRef, { status: 'aceptado', aceptadoPor: waiter });
  });
}

/**
 * Pasa un pedido de domicilio / recoger a Cocina (colección `pedidos`, con su consecutivo PED-0000).
 * `pagado` = el personal verificó la transferencia.
 * Es una transacción: si dos pantallas lo intentan a la vez, solo una lo crea.
 */
export async function sendToKitchen(o: WebOrder, carta: CartaItem[], cfg: CartaConfig, pagado = false) {
  const webRef = doc(db, 'pedidos_web', o.id);
  const counterRef = doc(db, 'config', 'counters');
  return runTransaction(db, async tx => {
    const web = await tx.get(webRef);
    const st = web.data()?.status;
    if (!web.exists() || !(st === 'confirmado' || (pagado && st === 'esperando-pago'))) return null;
    const counter = await tx.get(counterRef);
    const next = (counter.exists() ? Number(counter.data().lastOrderNumber) || 0 : 0) + 1;
    const displayId = `PED-${String(next).padStart(4, '0')}`;

    const items = repriceItems(o.items, carta, cfg, true);
    const subtotal = subtotalOf(items);
    const fee = o.deliveryFee ?? 0;
    const recoger = o.tipo === 'recoger';
    const c = o.cliente ?? { nombre: '', telefono: '' };
    const obs = [recoger ? 'RECOGE EN EL LOCAL' : '', c.notas ?? '', pagado ? 'Transferencia verificada' : '']
      .filter(Boolean)
      .join(' · ');

    if (counter.exists()) tx.update(counterRef, { lastOrderNumber: next });
    else tx.set(counterRef, { lastOrderNumber: next });

    tx.set(doc(db, 'pedidos', displayId), {
      customerName: c.nombre,
      address: recoger ? 'Recoge en el local' : [c.direccion, c.barrio].filter(Boolean).join(', '),
      phone: c.telefono,
      items: items.map(i => ({ name: itemLabel(i), quantity: i.qty, price: i.price })),
      zone: recoger ? 'Recoge en el local' : (o.zone ?? ''),
      deliveryFee: fee,
      total: subtotal + fee,
      paymentMethod: o.pago === 'transferencia' ? 'transfer' : 'cash',
      observations: obs,
      origen: 'web',
      tipoEntrega: o.tipo,
      webOrderId: o.id,
      ...(pagado ? { pagado: true } : {}),
      orderNumber: next,
      displayId,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
    tx.update(webRef, { status: 'en-cocina', pedidoId: displayId, total: subtotal + fee });
    return displayId;
  });
}
