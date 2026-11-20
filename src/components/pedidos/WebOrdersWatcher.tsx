import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useCarta, useCartaConfig } from '../../lib/cartaStore';
import { playSound, unlockAudioOnInteraction } from '../../lib/sounds';
import { sendToKitchen, useActiveWebOrders, useLlamadas, type WebOrder } from '../../lib/webOrders';

/**
 * Corre en todas las pantallas del personal:
 *  - suena y avisa cuando llega un pedido de la web, una llamada de mesa o un pago por verificar
 *  - pasa a Cocina los pedidos confirmados (efectivo) sin que nadie tenga que tocar nada
 */
export function WebOrdersWatcher() {
  const orders = useActiveWebOrders();
  const llamadas = useLlamadas();
  const { items: carta } = useCarta();
  const { cfg, loaded } = useCartaConfig();
  const seen = useRef<Map<string, string> | null>(null);
  const seenCalls = useRef<Set<number> | null>(null);
  const sending = useRef(new Set<string>());

  useEffect(unlockAudioOnInteraction, []);

  // Avisos de pedidos nuevos o que cambian a un estado que requiere al personal
  useEffect(() => {
    const prev = seen.current;
    const next = new Map(orders.map(o => [o.id, o.status]));
    seen.current = next;
    if (!prev) return; // primera carga: no sonar por lo que ya estaba
    for (const o of orders) {
      if (prev.get(o.id) === o.status) continue;
      if (o.status === 'por-aceptar') {
        playSound('pedido');
        toast.info(`Mesa ${o.mesa}: pedido nuevo desde el QR`, { description: 'Acéptalo en Mesas o en Pedidos web.' });
      } else if (o.status === 'por-confirmar') {
        playSound('pedido');
        toast.info(`Domicilio nuevo de ${o.cliente?.nombre ?? 'un cliente'}`, { description: 'Confirma la zona del envío en Pedidos web.' });
      } else if (o.status === 'esperando-pago') {
        playSound('pago');
        toast.info(`${o.cliente?.nombre ?? 'Un cliente'} va a pagar por transferencia`, { description: 'Verifica el comprobante en WhatsApp.' });
      }
    }
  }, [orders]);

  useEffect(() => {
    const prev = seenCalls.current;
    seenCalls.current = new Set(llamadas.map(l => l.mesa));
    if (!prev) return;
    for (const l of llamadas) {
      if (!prev.has(l.mesa)) {
        playSound('llamada');
        toast.warning(`La mesa ${l.mesa} está llamando al mesero`);
      }
    }
  }, [llamadas]);

  // Pedidos confirmados (efectivo): directo a Cocina
  useEffect(() => {
    if (!loaded || carta.length === 0) return;
    orders
      .filter(o => o.status === 'confirmado' && !sending.current.has(o.id))
      .forEach(async (o: WebOrder) => {
        sending.current.add(o.id);
        try {
          const id = await sendToKitchen(o, carta, cfg);
          if (id) {
            playSound('pedido');
            toast.success(`${id} enviado a Cocina`, { description: `${o.tipo === 'recoger' ? 'Recoge en el local' : 'Domicilio'} · ${o.cliente?.nombre ?? ''}` });
          }
        } catch (e) {
          console.error('No se pudo pasar a cocina', e);
          sending.current.delete(o.id);
        }
      });
  }, [orders, carta, cfg, loaded]);

  return null;
}
