import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Soup, UtensilsCrossed } from 'lucide-react';
import {
  CARTA_CATEGORIES,
  bogotaDateLabel,
  bogotaDay,
  formatCOP,
  isAvailableToday,
  llevarPrice,
  priceForDay,
  useCarta,
  useCartaConfig,
  usePolloStock,
  type CartaItem,
} from '../../lib/cartaStore';
import { getDateFromTimestamp } from '../../lib/orderStore';

const WHATSAPP = '573015501038';
const CORRIENTE = 'Proteínas del corriente';
const COMPACT = new Set(['Bebidas', 'Adicionales']);

/** Carta digital pública (sin iniciar sesión): /carta */
export default function PublicCarta() {
  const { items, loading, error } = useCarta();
  const { cfg } = useCartaConfig();
  const polloStock = usePolloStock();
  const [llevar, setLlevar] = useState(false);
  const day = bogotaDay();

  useEffect(() => {
    document.title = 'Carta | Asadero de Pollo Ventilador';
  }, []);

  const visible = useMemo(() => items.filter(i => priceForDay(i, day) !== null), [items, day]);
  const priceOf = (i: CartaItem) => {
    const mesa = priceForDay(i, day) ?? i.price;
    return llevar ? llevarPrice(mesa, i, cfg) : mesa;
  };
  const featured = visible.find(i => i.featured);
  const proteinas = visible.filter(i => i.category === CORRIENTE);
  const sections = CARTA_CATEGORIES.filter(c => c !== CORRIENTE)
    .map(c => ({ cat: c, rows: visible.filter(i => i.category === c && i.id !== featured?.id) }))
    .filter(s => s.rows.length);

  const publishedAt = cfg.publishedAt ? getDateFromTimestamp(cfg.publishedAt) : null;
  const publishedToday = !!publishedAt && bogotaDateLabel(publishedAt) === bogotaDateLabel();
  const date = bogotaDateLabel();

  const nav = [...(proteinas.length ? ['Corriente'] : []), ...sections.map(s => s.cat)];

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900">
      <header className="bg-gradient-to-br from-[#1c1410] via-[#2a1810] to-[#3a1d10] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-5 text-center">
          <img src="/logo-ventilador.png" alt="Asadero de Pollo Ventilador" className="h-28 w-auto mx-auto drop-shadow-lg" />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nuestra carta</h1>
          <p className="text-sm text-amber-200/90 first-letter:uppercase">{date}</p>
          <div className="mt-4 inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/15" role="group" aria-label="Tipo de pedido">
            {[
              [false, 'Comer aquí'],
              [true, 'Para llevar'],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                onClick={() => setLlevar(v as boolean)}
                aria-pressed={llevar === v}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  llevar === v ? 'bg-white text-stone-900' : 'text-white/80 hover:text-white'
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
          {llevar && (
            <p className="mt-2 text-xs text-white/70">
              Los almuerzos para llevar tienen {formatCOP(cfg.recargoLlevar)} adicionales. El pollo asado y las bebidas no cambian.
            </p>
          )}
        </div>
      </header>

      {nav.length > 0 && (
        <nav className="sticky top-0 z-10 bg-[#faf7f2]/95 backdrop-blur border-b border-stone-200">
          <div className="max-w-3xl mx-auto px-4 flex gap-2 overflow-x-auto py-2.5 no-scrollbar">
            {nav.map(n => (
              <a
                key={n}
                href={`#${anchor(n)}`}
                className="whitespace-nowrap rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm text-stone-700 hover:border-stone-500"
              >
                {n}
              </a>
            ))}
          </div>
        </nav>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {loading && <p className="text-center text-stone-500 py-16">Cargando la carta…</p>}
        {!loading && (error || items.length === 0) && (
          <div className="text-center py-16">
            <UtensilsCrossed className="w-10 h-10 mx-auto text-stone-300" />
            <p className="mt-3 text-stone-600">La carta no está disponible en este momento.</p>
            <a href={`https://wa.me/${WHATSAPP}`} className="inline-block mt-4 underline text-stone-800">
              Escríbenos por WhatsApp
            </a>
          </div>
        )}

        {cfg.nota && publishedToday && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900 text-sm">{cfg.nota}</p>
        )}

        {featured && (
          <article className="relative overflow-hidden rounded-2xl bg-stone-900 text-white shadow-sm">
            {featured.photo && <img src={featured.photo} alt="" className="w-full h-56 sm:h-72 object-cover opacity-80" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-5">
              <span className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Plato nuevo</span>
              <div className="flex items-end justify-between gap-4 mt-1">
                <div>
                  <h2 className="text-2xl font-semibold">{featured.name}</h2>
                  {featured.description && <p className="text-sm text-white/80 mt-0.5 max-w-md">{featured.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  {isAvailableToday(featured, day, polloStock) ? (
                    <span className="text-2xl font-semibold">{formatCOP(priceOf(featured))}</span>
                  ) : (
                    <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Agotado</span>
                  )}
                </div>
              </div>
            </div>
          </article>
        )}

        {proteinas.length > 0 && (
          <section id={anchor('Corriente')} className="scroll-mt-16">
            <div className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-[#2a1810] to-[#4a2414] text-white">
                <Soup className="w-5 h-5 text-amber-300" />
                <div>
                  <h2 className="font-semibold">Almuerzo corriente</h2>
                  <p className="text-xs text-white/70">Elige tu proteína</p>
                </div>
              </div>
              <div className="p-5">
                {publishedToday && (cfg.sopa || cfg.principios.length || cfg.jugo) ? (
                  <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm mb-4">
                    {cfg.sopa && (
                      <>
                        <dt className="text-stone-500">Sopa</dt>
                        <dd className="font-medium">{cfg.sopa}</dd>
                      </>
                    )}
                    {cfg.principios.length > 0 && (
                      <>
                        <dt className="text-stone-500">Principio</dt>
                        <dd className="font-medium">{cfg.principios.join(' · ')}</dd>
                      </>
                    )}
                    {cfg.jugo && (
                      <>
                        <dt className="text-stone-500">Jugo</dt>
                        <dd className="font-medium">{cfg.jugo}</dd>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-stone-500 mb-4">Pregunta por la sopa y los principios de hoy.</p>
                )}
                <ul className="divide-y divide-stone-100">
                  {proteinas.map(p => {
                    const ok = isAvailableToday(p, day, polloStock);
                    return (
                      <li key={p.id} className={`flex items-center justify-between py-2.5 ${ok ? '' : 'opacity-45'}`}>
                        <span className={ok ? '' : 'line-through'}>{p.name}</span>
                        <span className="font-semibold tabular-nums">{ok ? formatCOP(priceOf(p)) : 'Agotado'}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        )}

        {sections.map(({ cat, rows }) => (
          <section key={cat} id={anchor(cat)} className="scroll-mt-16">
            <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-3">
              {cat}
              <span className="flex-1 h-px bg-stone-200" />
            </h2>
            {COMPACT.has(cat) ? (
              <ul className="rounded-2xl bg-white border border-stone-200 divide-y divide-stone-100 px-4">
                {rows.map(i => {
                  const ok = isAvailableToday(i, day, polloStock);
                  return (
                    <li key={i.id} className={`flex items-center justify-between py-2.5 ${ok ? '' : 'opacity-45'}`}>
                      <span className={ok ? '' : 'line-through'}>{i.name}</span>
                      <span className="font-semibold tabular-nums">{ok ? formatCOP(priceOf(i)) : 'Agotado'}</span>
                    </li>
                  );
                })}
                {cat === 'Adicionales' && (
                  <li className="flex items-center justify-between py-2.5">
                    <span>Ají extra (cada uno)</span>
                    <span className="font-semibold tabular-nums">{formatCOP(cfg.ajiPrecio)}</span>
                  </li>
                )}
              </ul>
            ) : (
              <div className="grid gap-3">
                {rows.map(i => (
                  <ItemCard key={i.id} item={i} price={priceOf(i)} ok={isAvailableToday(i, day, polloStock)} />
                ))}
              </div>
            )}
          </section>
        ))}

        {!loading && items.length > 0 && (
          <div className="rounded-2xl bg-stone-900 text-white p-5 text-center">
            <p className="font-semibold">¿Quieres pedir a domicilio?</p>
            <p className="text-sm text-white/70 mt-1">Escríbenos y te lo llevamos.</p>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quiero hacer un pedido')}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-stone-900 font-semibold px-5 py-2.5"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp 301 550 1038
            </a>
          </div>
        )}
      </main>
      <footer className="text-center text-xs text-stone-400 pb-8">Asadero de Pollo Ventilador</footer>
    </div>
  );
}

function ItemCard({ item, price, ok }: { item: CartaItem; price: number; ok: boolean }) {
  return (
    <article className={`flex gap-4 rounded-2xl bg-white border border-stone-200 p-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] ${ok ? '' : 'opacity-50'}`}>
      <div className="flex-1 min-w-0 py-1 pl-1">
        <h3 className="font-semibold leading-snug">{item.name}</h3>
        {item.description && <p className="text-sm text-stone-500 mt-0.5 leading-snug">{item.description}</p>}
        {item.days?.length ? <p className="text-xs text-stone-500 mt-1">Solo {item.days.map(d => dayName(d.day)).join(' y ')}</p> : null}
        <div className="mt-2">
          {ok ? (
            <span className="font-semibold tabular-nums">{formatCOP(price)}</span>
          ) : (
            <span className="text-xs font-medium rounded-full bg-stone-100 text-stone-600 px-2.5 py-1">Agotado</span>
          )}
        </div>
      </div>
      {item.photo && (
        <img
          src={item.photo}
          alt={item.name}
          loading="lazy"
          className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-cover bg-stone-100 shrink-0"
        />
      )}
    </article>
  );
}

const dayName = (d: number) => ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'][d];
const anchor = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
