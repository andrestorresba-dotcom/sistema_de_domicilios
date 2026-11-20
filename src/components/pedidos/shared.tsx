import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import {
  CARTA_CATEGORIES,
  bogotaDay,
  formatCOP,
  isAvailableToday,
  priceForDay,
  type CartaConfig,
  type CartaItem,
} from '../../lib/cartaStore';
import { AJI_ID, CORRIENTE, currentPrice, orderName, subtotalOf, type WebItem } from '../../lib/webOrders';

// Piezas compartidas por las páginas públicas de pedido (QR de mesa y domicilio).

export const SHELL = 'min-h-screen bg-[#faf7f2] text-stone-900';

export function PublicHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="bg-gradient-to-br from-[#1c1410] via-[#2a1810] to-[#3a1d10] text-white">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-5 text-center">
        <img src="/logo-ventilador.png" alt="Asadero de Pollo Ventilador" className="h-20 w-auto mx-auto drop-shadow-lg" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-amber-200/90">{subtitle}</p>}
        {children}
      </div>
    </header>
  );
}

// ---------- Carrito ----------

export function useCart(storageKey: string) {
  const [items, setItems] = useState<WebItem[]>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as WebItem[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* sin almacenamiento: el carrito vive solo en memoria */
    }
  }, [items, storageKey]);

  const qtyOf = (id: string) => items.find(i => i.id === id)?.qty ?? 0;
  const add = (it: Omit<WebItem, 'qty'>, delta = 1) =>
    setItems(prev => {
      const cur = prev.find(i => i.id === it.id);
      if (!cur) return delta > 0 ? [...prev, { ...it, qty: delta }] : prev;
      const qty = cur.qty + delta;
      return qty <= 0 ? prev.filter(i => i.id !== it.id) : prev.map(i => (i.id === it.id ? { ...i, qty } : i));
    });
  const setNota = (id: string, nota: string) => setItems(prev => prev.map(i => (i.id === id ? { ...i, nota } : i)));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return { items, qtyOf, add, setNota, clear, count, subtotal: subtotalOf(items) };
}
export type Cart = ReturnType<typeof useCart>;

export function Stepper({ qty, onAdd, onRemove, disabled, name }: { qty: number; onAdd: () => void; onRemove: () => void; disabled?: boolean; name: string }) {
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Agregar ${name}`}
        className="h-9 px-4 rounded-full bg-stone-900 text-white text-sm font-medium disabled:bg-stone-200 disabled:text-stone-400"
      >
        {disabled ? 'Agotado' : 'Agregar'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full border border-stone-300 bg-white">
      <button type="button" onClick={onRemove} aria-label={`Quitar ${name}`} className="w-9 h-9 grid place-items-center text-stone-700">
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
      <button type="button" onClick={onAdd} disabled={disabled} aria-label={`Agregar otro ${name}`} className="w-9 h-9 grid place-items-center text-stone-700 disabled:text-stone-300">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

const anchor = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

/** La carta con botones para agregar al pedido */
export function OrderMenu({
  carta,
  cfg,
  polloStock,
  llevar,
  cart,
}: {
  carta: CartaItem[];
  cfg: CartaConfig;
  polloStock: number | null;
  llevar: boolean;
  cart: Cart;
}) {
  const day = bogotaDay();
  const visible = useMemo(() => carta.filter(i => priceForDay(i, day) !== null), [carta, day]);
  const sections = CARTA_CATEGORIES.map(cat => ({
    cat,
    title: cat === CORRIENTE ? 'Almuerzo corriente' : cat,
    rows: visible.filter(i => i.category === cat),
  })).filter(s => s.rows.length);

  const corrienteInfo = [cfg.sopa && `Sopa: ${cfg.sopa}`, cfg.principios.length && `Principio: ${cfg.principios.join(', ')}`, cfg.jugo && `Jugo: ${cfg.jugo}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <nav className="sticky top-0 z-10 bg-[#faf7f2]/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 flex gap-2 overflow-x-auto py-2.5 no-scrollbar">
          {sections.map(s => (
            <a key={s.cat} href={`#${anchor(s.title)}`} className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm text-stone-700">
              {s.title}
            </a>
          ))}
        </div>
      </nav>
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-7">
        {sections.map(({ cat, title, rows }) => (
          <section key={cat} id={anchor(title)} className="scroll-mt-16">
            <h2 className="text-base font-semibold tracking-tight mb-1">{title}</h2>
            {cat === CORRIENTE && (
              <p className="text-sm text-stone-500 mb-2">{corrienteInfo || 'Incluye sopa, principio, arroz, ensalada y jugo. Elige tu proteína.'}</p>
            )}
            <ul className="mt-2 rounded-2xl bg-white border border-stone-200 divide-y divide-stone-100">
              {rows.map(c => {
                const ok = isAvailableToday(c, day, polloStock);
                const price = currentPrice(c, cfg, llevar, day);
                const name = orderName(c);
                return (
                  <li key={c.id} className={`flex items-center gap-3 p-3 ${ok ? '' : 'opacity-50'}`}>
                    {c.photo && <img src={c.photo} alt="" loading="lazy" className="w-16 h-16 rounded-xl object-cover bg-stone-100 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium leading-snug">{c.name}</p>
                      {c.description && <p className="text-xs text-stone-500 leading-snug line-clamp-2">{c.description}</p>}
                      <p className="text-sm font-semibold tabular-nums mt-0.5">{formatCOP(price)}</p>
                    </div>
                    <Stepper
                      name={c.name}
                      qty={cart.qtyOf(c.id)}
                      disabled={!ok}
                      onAdd={() => cart.add({ id: c.id, name, price })}
                      onRemove={() => cart.add({ id: c.id, name, price }, -1)}
                    />
                  </li>
                );
              })}
              {cat === 'Adicionales' && (
                <li className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="font-medium">Ají extra</p>
                    <p className="text-sm font-semibold tabular-nums">{formatCOP(cfg.ajiPrecio)}</p>
                  </div>
                  <Stepper
                    name="Ají extra"
                    qty={cart.qtyOf(AJI_ID)}
                    onAdd={() => cart.add({ id: AJI_ID, name: 'Ají extra', price: cfg.ajiPrecio })}
                    onRemove={() => cart.add({ id: AJI_ID, name: 'Ají extra', price: cfg.ajiPrecio }, -1)}
                  />
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/** Barra fija abajo con el total del carrito */
export function CartBar({ cart, label, onOpen }: { cart: Cart; label: string; onOpen: () => void }) {
  if (cart.count === 0) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-[#faf7f2] via-[#faf7f2] to-transparent">
      <button
        type="button"
        onClick={onOpen}
        className="max-w-2xl mx-auto w-full flex items-center justify-between rounded-2xl bg-stone-900 text-white px-5 py-4 shadow-lg"
      >
        <span className="flex items-center gap-2 font-medium">
          <ShoppingBag className="w-5 h-5" /> {label} · {cart.count}
        </span>
        <span className="font-semibold tabular-nums">{formatCOP(cart.subtotal)}</span>
      </button>
    </div>
  );
}

/** Hoja inferior (modal) simple y accesible */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-9 h-9 grid place-items-center rounded-full hover:bg-stone-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Lista del carrito con cantidades y nota por plato */
export function CartLines({ cart }: { cart: Cart }) {
  return (
    <ul className="divide-y divide-stone-100">
      {cart.items.map(i => (
        <li key={i.id} className="py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-snug">{i.name}</p>
              <p className="text-sm text-stone-500 tabular-nums">{formatCOP(i.price * i.qty)}</p>
            </div>
            <Stepper name={i.name} qty={i.qty} onAdd={() => cart.add(i)} onRemove={() => cart.add(i, -1)} />
          </div>
          <input
            value={i.nota ?? ''}
            onChange={e => cart.setNota(i.id, e.target.value)}
            maxLength={80}
            placeholder="Nota (ej: sin ensalada)"
            aria-label={`Nota para ${i.name}`}
            className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
          />
        </li>
      ))}
    </ul>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-semibold' : 'text-sm text-stone-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Guarda el id del último pedido para poder seguirlo si el cliente recarga la página */
export function useStoredId(key: string) {
  const [id, setIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  });
  const setId = (v: string | null) => {
    setIdState(v);
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch {
      /* sin almacenamiento */
    }
  };
  return [id, setId] as const;
}
