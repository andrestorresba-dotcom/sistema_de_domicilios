import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Globe, QrCode } from 'lucide-react';
import { authErrorMessage } from '../../lib/auth';
import { isOpenNow, saveHorario, type CartaConfig } from '../../lib/cartaStore';
import { printMesaQRs } from '../../lib/qrPrint';
import { Card, btnPrimary, btnSecondary, inputCls } from '../pos/shared';

/** Horario de pedidos por la web, abrir/cerrar a mano, link de domicilios y QR de mesas */
export function PedidosWebCard({ cfg, isAdmin }: { cfg: CartaConfig; isAdmin: boolean }) {
  const [abre, setAbre] = useState(cfg.abre);
  const [cierra, setCierra] = useState(cfg.cierra);
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState('42');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAbre(cfg.abre);
    setCierra(cfg.cierra);
  }, [cfg.abre, cfg.cierra]);

  const abierto = isOpenNow(cfg);
  const link = `${window.location.origin}/pedir`;

  const save = async (data: Partial<Pick<CartaConfig, 'abre' | 'cierra' | 'pedidosWeb'>>) => {
    setBusy(true);
    try {
      await saveHorario({ abre, cierra, pedidosWeb: cfg.pedidosWeb, ...data });
      toast.success('Guardado');
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const modes = [
    ['auto', 'Según horario'],
    ['abierto', 'Abierto ya'],
    ['cerrado', 'Cerrado ya'],
  ] as const;

  return (
    <Card title="Pedidos por la web" icon={<Globe className="w-5 h-5 text-amber-500" />}>
      <p className="flex items-center gap-2 text-sm -mt-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${abierto ? 'bg-emerald-500' : 'bg-gray-400'}`} />
        <b>{abierto ? 'Recibiendo pedidos ahora' : 'Pedidos cerrados ahora'}</b>
      </p>

      <div className="inline-flex rounded-xl border border-gray-200 p-1 mb-3" role="group" aria-label="Recibir pedidos">
        {modes.map(([v, l]) => (
          <button
            key={v}
            type="button"
            disabled={!isAdmin || busy}
            aria-pressed={cfg.pedidosWeb === v}
            onClick={() => save({ pedidosWeb: v })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${cfg.pedidosWeb === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Abre
          <input type="time" className={inputCls} value={abre} onChange={e => setAbre(e.target.value)} disabled={!isAdmin} />
        </label>
        <label className="text-sm">
          Cierra
          <input type="time" className={inputCls} value={cierra} onChange={e => setCierra(e.target.value)} disabled={!isAdmin} />
        </label>
        {isAdmin && (abre !== cfg.abre || cierra !== cfg.cierra) && (
          <button type="button" className={btnPrimary} disabled={busy || !abre || !cierra} onClick={() => save({})}>
            Guardar horario
          </button>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link de domicilios copiado'))}>
          <Copy className="w-4 h-4" /> Copiar link de domicilios
        </button>
        <a className={btnSecondary} href="/pedir" target="_blank" rel="noreferrer">
          <ExternalLink className="w-4 h-4" /> Abrir como cliente
        </a>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-2">QR para las mesas</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Desde la mesa
            <input className={`${inputCls} w-24`} inputMode="numeric" value={desde} onChange={e => setDesde(e.target.value)} />
          </label>
          <label className="text-sm">
            hasta
            <input className={`${inputCls} w-24`} inputMode="numeric" value={hasta} onChange={e => setHasta(e.target.value)} />
          </label>
          <button
            type="button"
            className={btnSecondary}
            onClick={async () => {
              const a = Math.max(1, parseInt(desde, 10) || 1);
              const b = Math.min(42, parseInt(hasta, 10) || 42);
              if (a > b) return toast.error('Revisa el rango de mesas');
              const ok = await printMesaQRs(a, b);
              if (!ok) toast.error('Permite las ventanas emergentes para imprimir');
            }}
          >
            <QrCode className="w-4 h-4" /> Imprimir QR
          </button>
          <a className={btnSecondary} href="/mesa/1" target="_blank" rel="noreferrer">
            <ExternalLink className="w-4 h-4" /> Probar mesa 1
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Cada QR abre la carta de esa mesa. El cliente pide y llama al mesero; el pedido llega a Mesas para que lo aceptes.
        </p>
      </div>
    </Card>
  );
}
