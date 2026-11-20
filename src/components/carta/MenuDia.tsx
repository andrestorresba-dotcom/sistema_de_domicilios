import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  ImageDown,
  Megaphone,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth, authErrorMessage } from '../../lib/auth';
import {
  CARTA_CATEGORIES,
  CARTA_PHOTOS,
  DAY_NAMES,
  DAY_SHORT,
  bogotaDateLabel,
  bogotaDay,
  deleteCartaItem,
  formatCOP,
  isAvailableToday,
  llevarPrice,
  loadDefaultCarta,
  newCartaId,
  priceForDay,
  publishMenuDia,
  saveCartaItem,
  saveCartaSettings,
  setCartaAvailable,
  useCarta,
  useCartaConfig,
  usePolloStock,
  type CartaCategory,
  type CartaConfig,
  type CartaItem,
} from '../../lib/cartaStore';
import { PedidosWebCard } from './PedidosWebCard';
import { printMenuMesa, renderWhatsappImage, shareOrDownload } from '../../lib/cartaPrint';
import { getDateFromTimestamp } from '../../lib/orderStore';
import { Card, Modal, PageHeader, ReadOnlyBadge, btnDanger, btnPrimary, btnSecondary, inputCls, parseMoney } from '../pos/shared';

export function MenuDia() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'hoy' | 'carta'>('hoy');
  const { items, loading } = useCarta();
  const { cfg } = useCartaConfig();
  const polloStock = usePolloStock();
  const day = bogotaDay();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Menú del día"
        subtitle={bogotaDateLabel()}
        actions={!isAdmin && <ReadOnlyBadge text="Puedes marcar platos agotados" />}
      />

      <div className="inline-flex bg-gray-100 rounded-2xl p-1 mb-6">
        {(
          [
            ['hoy', 'Hoy', CalendarDays],
            ['carta', 'Carta y precios', UtensilsCrossed],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando carta…</p>
      ) : items.length === 0 ? (
        <EmptyCarta isAdmin={isAdmin} />
      ) : tab === 'hoy' ? (
        <TodayTab items={items} cfg={cfg} day={day} polloStock={polloStock} isAdmin={isAdmin} />
      ) : (
        <CartaTab items={items} cfg={cfg} day={day} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function EmptyCarta({ isAdmin }: { isAdmin: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <div className="text-center py-10">
        <UtensilsCrossed className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900">La carta todavía está vacía</h3>
        {isAdmin ? (
          <>
            <p className="text-gray-500 mt-1 mb-5">
              Carga los platos de tu menú (especiales, platos del día, corrientes, pollo asado y bebidas) con sus fotos y precios de mesa. Después puedes editarlos.
            </p>
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await loadDefaultCarta();
                  toast.success('Carta cargada');
                } catch (e) {
                  toast.error(authErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus className="w-4 h-4" /> Cargar carta del asadero
            </button>
          </>
        ) : (
          <p className="text-gray-500 mt-1">Pide al administrador que cargue la carta.</p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Hoy

function TodayTab({
  items,
  cfg,
  day,
  polloStock,
  isAdmin,
}: {
  items: CartaItem[];
  cfg: CartaConfig;
  day: number;
  polloStock: number | null;
  isAdmin: boolean;
}) {
  const { profile } = useAuth();
  const proteinas = items.filter(i => i.category === 'Proteínas del corriente');
  const [sopa, setSopa] = useState(cfg.sopa);
  const [jugo, setJugo] = useState(cfg.jugo);
  const [nota, setNota] = useState(cfg.nota);
  const [principios, setPrincipios] = useState<string[]>(cfg.principios);
  const [nuevoPrincipio, setNuevoPrincipio] = useState('');
  const [prot, setProt] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  // Cuando llega la configuración guardada, la cargamos en el formulario
  useEffect(() => {
    setSopa(cfg.sopa);
    setJugo(cfg.jugo);
    setNota(cfg.nota);
    setPrincipios(cfg.principios);
  }, [cfg.sopa, cfg.jugo, cfg.nota, cfg.principios.join('|')]);
  useEffect(() => {
    setProt(Object.fromEntries(proteinas.map(p => [p.id, p.available])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proteinas.map(p => p.id + p.available).join('|')]);

  const addPrincipio = () => {
    const v = nuevoPrincipio.trim();
    if (!v) return;
    if (!principios.some(p => p.toLowerCase() === v.toLowerCase())) setPrincipios([...principios, v]);
    setNuevoPrincipio('');
  };

  const publishedAt = cfg.publishedAt ? getDateFromTimestamp(cfg.publishedAt) : null;
  const publishedToday = publishedAt && bogotaDateLabel(publishedAt) === bogotaDateLabel();
  const cartaUrl = `${location.origin}/carta`;

  const publish = async () => {
    setBusy(true);
    try {
      await publishMenuDia(
        { sopa: sopa.trim(), jugo: jugo.trim(), nota: nota.trim(), principios },
        proteinas.map(p => ({ id: p.id, available: !!prot[p.id] })),
        profile!,
      );
      toast.success('Menú del día publicado: la carta digital ya está actualizada');
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const whatsappImage = async () => {
    setImgBusy(true);
    try {
      const blob = await renderWhatsappImage(items, cfg, day, polloStock);
      await shareOrDownload(blob, `menu-del-dia-${new Date().toISOString().slice(0, 10)}.png`);
    } catch (e) {
      toast.error('No se pudo crear la imagen');
    } finally {
      setImgBusy(false);
    }
  };

  const others = items.filter(i => i.category !== 'Proteínas del corriente');

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <Card title="Corriente del día" icon={<Megaphone className="w-5 h-5 text-amber-500" />}>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-gray-700">Sopa</span>
              <input className={inputCls} value={sopa} onChange={e => setSopa(e.target.value)} placeholder="Ej: Sancocho" disabled={!isAdmin} />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Jugo</span>
              <input className={inputCls} value={jugo} onChange={e => setJugo(e.target.value)} placeholder="Ej: Mora" disabled={!isAdmin} />
            </label>
          </div>

          <div className="mt-4">
            <span className="text-sm text-gray-700">Principios</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {principios.map(p => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 pl-3 pr-1.5 py-1 text-sm">
                  {p}
                  {isAdmin && (
                    <button
                      onClick={() => setPrincipios(principios.filter(x => x !== p))}
                      className="p-0.5 rounded-full hover:bg-amber-100"
                      aria-label={`Quitar ${p}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {principios.length === 0 && <span className="text-sm text-gray-400">Sin principios todavía</span>}
            </div>
            {isAdmin && (
              <div className="flex gap-2 mt-2">
                <input
                  className={inputCls}
                  value={nuevoPrincipio}
                  onChange={e => setNuevoPrincipio(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPrincipio();
                    }
                  }}
                  placeholder="Ej: Fríjol, Coliflor…"
                  aria-label="Nuevo principio"
                />
                <button className={btnSecondary} onClick={addPrincipio}>
                  <Plus className="w-4 h-4" /> Agregar
                </button>
              </div>
            )}
          </div>

          <div className="mt-5">
            <span className="text-sm text-gray-700">Proteínas de hoy</span>
            <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
              {proteinas.map(p => {
                const on = !!prot[p.id];
                return (
                  <button
                    key={p.id}
                    disabled={!isAdmin}
                    onClick={() => setProt({ ...prot, [p.id]: !on })}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      on ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white text-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center border ${on ? 'bg-amber-400 border-amber-400 text-white' : 'border-gray-300'}`}>
                        {on && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className={on ? 'text-gray-900 font-medium' : ''}>{p.name}</span>
                    </span>
                    <span className="text-sm">{formatCOP(p.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block mt-4">
            <span className="text-sm text-gray-700">Nota para los clientes (opcional)</span>
            <input className={inputCls} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: Hoy tenemos jugo de lulo" disabled={!isAdmin} />
          </label>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button className={btnPrimary} onClick={publish} disabled={busy}>
                <Megaphone className="w-4 h-4" /> {busy ? 'Publicando…' : 'Publicar menú del día'}
              </button>
              <span className="text-sm text-gray-500">
                {publishedAt
                  ? `Publicado ${publishedToday ? 'hoy' : bogotaDateLabel(publishedAt)} a las ${publishedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}${cfg.publishedBy ? ` por ${cfg.publishedBy}` : ''}`
                  : 'Aún no se ha publicado'}
              </span>
            </div>
          )}
        </Card>

        <Card title="Compartir" icon={<ExternalLink className="w-5 h-5 text-amber-500" />}>
          <div className="flex flex-wrap gap-2">
            <button className={btnSecondary} onClick={() => printMenuMesa(items, cfg, day, polloStock)}>
              <Printer className="w-4 h-4" /> Imprimir menú para mesas
            </button>
            <button className={btnSecondary} onClick={whatsappImage} disabled={imgBusy}>
              <ImageDown className="w-4 h-4" /> {imgBusy ? 'Creando…' : 'Imagen para WhatsApp'}
            </button>
            <a className={btnSecondary} href="/carta" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" /> Ver carta digital
            </a>
            <button
              className={btnSecondary}
              onClick={() => navigator.clipboard?.writeText(cartaUrl).then(() => toast.success('Enlace copiado'))}
            >
              <Copy className="w-4 h-4" /> Copiar enlace
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            El menú impreso usa precios de mesa. La imagen de WhatsApp usa precios para llevar (+{formatCOP(cfg.recargoLlevar)} en almuerzos; el pollo asado y las bebidas no cambian). Publica primero para que salgan la sopa y los principios.
          </p>
        </Card>

        <PedidosWebCard cfg={cfg} isAdmin={isAdmin} />
      </div>

      <div className="lg:col-span-2">
        <Card title="Disponible hoy" icon={<Check className="w-5 h-5 text-green-600" />}>
          <p className="text-sm text-gray-500 -mt-2 mb-3">Toca un plato para marcarlo agotado. Se actualiza al instante en la carta.</p>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {CARTA_CATEGORIES.filter(c => c !== 'Proteínas del corriente').map(cat => {
              const rows = others.filter(i => i.category === cat && priceForDay(i, day) !== null);
              if (!rows.length) return null;
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{cat}</div>
                  <div className="space-y-1">
                    {rows.map(i => {
                      const ok = isAvailableToday(i, day, polloStock);
                      const byStock = i.available && !ok && !!i.insumoParts;
                      return (
                        <button
                          key={i.id}
                          onClick={async () => {
                            try {
                              await setCartaAvailable(i.id, !i.available);
                            } catch (e) {
                              toast.error(authErrorMessage(e));
                            }
                          }}
                          className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <span className={ok ? 'text-gray-900' : 'text-gray-400 line-through'}>{i.name}</span>
                          <span
                            className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                              ok ? 'bg-green-50 text-green-700' : byStock ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {ok ? 'Disponible' : byStock ? 'Sin pollos' : 'Agotado'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Carta

function CartaTab({ items, cfg, day, isAdmin }: { items: CartaItem[]; cfg: CartaConfig; day: number; isAdmin: boolean }) {
  const [editing, setEditing] = useState<CartaItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CartaItem | null>(null);
  const [settings, setSettings] = useState(false);

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> Agregar plato
          </button>
          <button className={btnSecondary} onClick={() => setSettings(true)}>
            <Settings2 className="w-4 h-4" /> Recargo y ají ({formatCOP(cfg.recargoLlevar)} · {formatCOP(cfg.ajiPrecio)})
          </button>
        </div>
      )}

      {CARTA_CATEGORIES.map(cat => {
        const rows = items.filter(i => i.category === cat);
        if (!rows.length) return null;
        return (
          <Card key={cat} title={cat}>
            <div className="divide-y divide-gray-100">
              {rows.map(i => {
                const mesa = priceForDay(i, day) ?? i.price;
                return (
                  <div key={i.id} className="flex items-center gap-3 py-3">
                    {i.photo ? (
                      <img src={i.photo} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 shrink-0">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{i.name}</span>
                        {i.featured && <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Plato nuevo</span>}
                        {!i.available && <span className="text-xs rounded-full bg-red-50 text-red-600 px-2 py-0.5">Agotado</span>}
                        {i.days?.length ? (
                          <span className="text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">
                            {i.days.map(d => `${DAY_SHORT[d.day]} ${formatCOP(d.price)}`).join(' · ')}
                          </span>
                        ) : null}
                      </div>
                      {i.description && <div className="text-sm text-gray-500 truncate">{i.description}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-gray-900">{formatCOP(i.days?.length ? mesa : i.price)}</div>
                      <div className="text-xs text-gray-400">
                        llevar {formatCOP(llevarPrice(i.days?.length ? mesa : i.price, i, cfg))}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0">
                        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" onClick={() => setEditing(i)} aria-label={`Editar ${i.name}`} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-red-500" onClick={() => setDeleting(i)} aria-label={`Eliminar ${i.name}`} title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {editing && <ItemModal item={editing === 'new' ? null : editing} items={items} onClose={() => setEditing(null)} />}
      {deleting && (
        <Modal title={`Eliminar ${deleting.name}`} onClose={() => setDeleting(null)}>
          <p className="text-gray-600">
            Se quita de la carta digital y del menú impreso. Si solo no hay hoy, mejor márcalo como agotado.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button className={btnSecondary} onClick={() => setDeleting(null)}>
              Cancelar
            </button>
            <button
              className={btnDanger}
              onClick={async () => {
                try {
                  await deleteCartaItem(deleting.id);
                  toast.success(`${deleting.name} eliminado`);
                  setDeleting(null);
                } catch (e) {
                  toast.error(authErrorMessage(e));
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> Eliminar {deleting.name}
            </button>
          </div>
        </Modal>
      )}
      {settings && <SettingsModal cfg={cfg} onClose={() => setSettings(false)} />}
    </div>
  );
}

function SettingsModal({ cfg, onClose }: { cfg: CartaConfig; onClose: () => void }) {
  const [recargo, setRecargo] = useState(String(cfg.recargoLlevar));
  const [aji, setAji] = useState(String(cfg.ajiPrecio));
  return (
    <Modal title="Recargo para llevar y ají" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">Recargo para llevar / domicilio</span>
          <input className={inputCls} inputMode="numeric" value={recargo} onChange={e => setRecargo(e.target.value)} />
          <span className="text-xs text-gray-500">Se suma a los platos marcados con recargo (no al pollo asado ni a las bebidas).</span>
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Precio de cada ají extra</span>
          <input className={inputCls} inputMode="numeric" value={aji} onChange={e => setAji(e.target.value)} />
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className={btnSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button
          className={btnPrimary}
          onClick={async () => {
            try {
              await saveCartaSettings({ recargoLlevar: parseMoney(recargo), ajiPrecio: parseMoney(aji) });
              toast.success('Guardado');
              onClose();
            } catch (e) {
              toast.error(authErrorMessage(e));
            }
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

const POLLO_PARTS = [
  [0, 'No descuenta pollo'],
  [1, '1/4 de pollo'],
  [2, '1/2 pollo'],
  [4, '1 pollo'],
  [6, '1 ½ pollos'],
] as const;

function ItemModal({ item, items, onClose }: { item: CartaItem | null; items: CartaItem[]; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<CartaCategory>(item?.category ?? 'Especiales');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [recargo, setRecargo] = useState(item?.recargo ?? true);
  const [available, setAvailable] = useState(item?.available ?? true);
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [photo, setPhoto] = useState(item?.photo ?? '');
  const [insumoParts, setInsumoParts] = useState(item?.insumoParts ?? 0);
  const [byDay, setByDay] = useState(!!item?.days?.length);
  const [days, setDays] = useState<Record<number, string>>(
    Object.fromEntries((item?.days ?? []).map(d => [d.day, String(d.price)])),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dayList = useMemo(
    () =>
      Object.entries(days)
        .filter(([, v]) => parseMoney(v) > 0)
        .map(([d, v]) => ({ day: Number(d), price: parseMoney(v) })),
    [days],
  );

  const save = async () => {
    setError('');
    if (!name.trim()) return setError('Escribe el nombre del plato.');
    const p = parseMoney(price);
    if (!byDay && p <= 0) return setError('Escribe el precio de mesa.');
    if (byDay && dayList.length === 0) return setError('Escribe el precio de al menos un día.');
    setBusy(true);
    try {
      await saveCartaItem({
        id: item?.id ?? newCartaId(name, items),
        name: name.trim(),
        category,
        description: description.trim(),
        price: byDay ? Math.min(...dayList.map(d => d.price)) : p,
        recargo,
        available,
        featured,
        photo: photo || undefined,
        insumoParts: insumoParts || undefined,
        days: byDay ? dayList : undefined,
        order: item?.order ?? items.length,
      });
      toast.success(item ? 'Plato actualizado' : 'Plato agregado');
      onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={item ? `Editar ${item.name}` : 'Agregar plato'} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2">
          <span className="text-sm text-gray-700">Nombre</span>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Bandeja Paisa" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Sección</span>
          <select
            className={inputCls}
            value={category}
            onChange={e => {
              const c = e.target.value as CartaCategory;
              setCategory(c);
              if (!item) setRecargo(!['Pollo asado', 'Bebidas', 'Adicionales'].includes(c));
            }}
          >
            {CARTA_CATEGORIES.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {!byDay && (
          <label className="block">
            <span className="text-sm text-gray-700">Precio en mesa</span>
            <input className={inputCls} inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ej: 24000" />
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className="text-sm text-gray-700">Qué incluye (opcional)</span>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Arroz, ensalada, patacón y jugo" />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-gray-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={recargo} onChange={e => setRecargo(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          Suma recargo para llevar
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          Disponible
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          Destacar como "Plato nuevo"
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={byDay} onChange={e => setByDay(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          Solo algunos días
        </label>
      </div>

      {byDay && (
        <div className="mt-4">
          <span className="text-sm text-gray-700">Precio en mesa por día (deja vacío los días que no sale)</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map(d => (
              <label key={d} className="block">
                <span className="text-xs text-gray-500">{DAY_NAMES[d]}</span>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={days[d] ?? ''}
                  onChange={e => setDays({ ...days, [d]: e.target.value })}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {category === 'Pollo asado' || category === 'Proteínas del corriente' ? (
        <label className="block mt-4">
          <span className="text-sm text-gray-700">Marcar agotado automáticamente cuando no alcance el inventario de pollo</span>
          <select className={inputCls} value={insumoParts} onChange={e => setInsumoParts(Number(e.target.value))}>
            {POLLO_PARTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-4">
        <span className="text-sm text-gray-700">Foto</span>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1.5 max-h-56 overflow-y-auto">
          <button
            onClick={() => setPhoto('')}
            className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xs text-gray-500 ${!photo ? 'border-amber-400' : 'border-gray-200'}`}
          >
            Sin foto
          </button>
          {CARTA_PHOTOS.map(p => (
            <button
              key={p.file}
              onClick={() => setPhoto(p.file)}
              title={p.label}
              className={`aspect-square rounded-xl overflow-hidden border-2 ${photo === p.file ? 'border-amber-400' : 'border-transparent'}`}
            >
              <img src={p.file} alt={p.label} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button className={btnSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnPrimary} onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : item ? 'Guardar cambios' : 'Agregar plato'}
        </button>
      </div>
    </Modal>
  );
}
