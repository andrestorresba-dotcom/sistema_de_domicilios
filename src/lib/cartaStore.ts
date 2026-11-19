import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './auth';

// Carta central del asadero: la usan la carta digital, el menú impreso,
// la imagen para WhatsApp y (en las siguientes fases) los pedidos por QR y domicilio.

export const CARTA_CATEGORIES = [
  'Pollo asado',
  'Especiales',
  'Platos del día',
  'Proteínas del corriente',
  'Sancochos',
  'Menú infantil',
  'Adicionales',
  'Bebidas',
  'Otros',
] as const;
export type CartaCategory = (typeof CARTA_CATEGORIES)[number];

/** Precio especial y disponibilidad por día de la semana (0 = domingo … 6 = sábado). */
export interface DayPrice {
  day: number;
  price: number;
}

export interface CartaItem {
  id: string;
  name: string;
  description: string;
  category: CartaCategory;
  /** Precio en mesa (el del menú blanco y negro) */
  price: number;
  /** Si suma el recargo para llevar/domicilio */
  recargo: boolean;
  available: boolean;
  /** Ruta de la foto, ej: /platos/mojarra-frita.jpg */
  photo?: string;
  /** Si tiene días, el plato solo sale esos días y con ese precio */
  days?: DayPrice[];
  /** Plato destacado ("Plato nuevo") */
  featured?: boolean;
  /** Pollo: se marca agotado solo cuando no alcanzan los cuartos del inventario */
  insumoParts?: number;
  order: number;
}

export interface CartaConfig {
  recargoLlevar: number;
  ajiPrecio: number;
  sopa: string;
  principios: string[];
  jugo: string;
  nota: string;
  publishedAt?: any;
  publishedBy?: string;
}

export const DEFAULT_CONFIG: CartaConfig = {
  recargoLlevar: 2000,
  ajiPrecio: 500,
  sopa: '',
  principios: [],
  jugo: '',
  nota: '',
};

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Día de la semana en Bogotá */
export const bogotaDay = (d = new Date()) =>
  new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' })).getDay();

export const bogotaDateLabel = (d = new Date()) =>
  d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' });

/** Precio en mesa para el día dado; null si el plato no sale ese día */
export function priceForDay(item: CartaItem, day: number): number | null {
  if (!item.days || item.days.length === 0) return item.price;
  const d = item.days.find(x => x.day === day);
  return d ? d.price : null;
}

export function llevarPrice(mesaPrice: number, item: CartaItem, cfg: CartaConfig) {
  return item.recargo ? mesaPrice + cfg.recargoLlevar : mesaPrice;
}

/** Disponible hoy: activo, sale hoy y (si es pollo) alcanza el inventario */
export function isAvailableToday(item: CartaItem, day: number, polloStock: number | null) {
  if (!item.available) return false;
  if (priceForDay(item, day) === null) return false;
  if (item.insumoParts && polloStock !== null && polloStock < item.insumoParts) return false;
  return true;
}

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'plato';

/** Fotos incluidas en la app (generadas para la carta) */
export const CARTA_PHOTOS: { file: string; label: string }[] = [
  ['cuarto-pollo', '1/4 de pollo'],
  ['medio-pollo', '1/2 pollo'],
  ['pollo-entero', 'Pollo entero'],
  ['promo-pollo-y-medio', 'Promo pollo y medio'],
  ['mojarra-frita', 'Mojarra frita'],
  ['churrasquito', 'Churrasquito'],
  ['lomo-plancha', 'Lomo a la plancha'],
  ['lomo-ranchero', 'Lomo ranchero'],
  ['lomo-hawaiano', 'Lomo hawaiano'],
  ['pechuga-plancha', 'Pechuga a la plancha'],
  ['pechuga-hawaiana', 'Pechuga hawaiana'],
  ['pechuga-ranchera', 'Pechuga ranchera'],
  ['pechuga-gratinada', 'Pechuga gratinada'],
  ['costillas-bbq', 'Costillas BBQ'],
  ['tabla-mixta', 'Tabla mixta'],
  ['hamburguesa-casa', 'Hamburguesa'],
  ['salchipapa', 'Salchipapa'],
  ['nuggets', 'Nuggets'],
  ['sancocho-costilla', 'Sancocho de costilla'],
  ['sancocho-carne', 'Sancocho de carne'],
  ['sancocho-pollo', 'Sancocho de pollo'],
  ['viudo-bocachico', 'Viudo de bocachico'],
  ['viudo-mojarra', 'Viudo de mojarra'],
  ['almuerzo-corriente', 'Almuerzo corriente'],
].map(([f, label]) => ({ file: `/platos/${f}.jpg`, label }));

const ESP = 'Arroz, ensalada, patacón, papa francesa y jugo';

type Seed = Omit<CartaItem, 'id' | 'order' | 'available'> & { id?: string };
const S = (
  category: CartaCategory,
  name: string,
  price: number,
  description = '',
  photo?: string,
  extra: Partial<Seed> = {},
): Seed => ({
  category,
  name,
  price,
  description,
  recargo: !['Pollo asado', 'Bebidas', 'Adicionales'].includes(category),
  ...(photo ? { photo: `/platos/${photo}.jpg` } : {}),
  ...extra,
});

/** Carta inicial: precios del menú blanco y negro (mesa) */
export const DEFAULT_CARTA: Seed[] = [
  S('Pollo asado', '1/4 de Pollo Asado', 12000, 'Pierna o pechuga', 'cuarto-pollo', { insumoParts: 1 }),
  S('Pollo asado', '1/2 Pollo Asado', 18000, '', 'medio-pollo', { insumoParts: 2 }),
  S('Pollo asado', '1 Pollo Entero Asado', 32000, '', 'pollo-entero', { insumoParts: 4 }),
  S('Pollo asado', 'Promoción Pollo y Medio', 42000, '', 'promo-pollo-y-medio', { insumoParts: 6 }),

  S('Especiales', 'Hamburguesa de la Casa', 22000, 'Carne de hamburguesa de las brisas, toque especial de la casa, papa francesa y jugo', 'hamburguesa-casa', { featured: true }),
  S('Especiales', 'Mojarra Frita', 24000, 'Arroz, ensalada, patacón y jugo', 'mojarra-frita'),
  S('Especiales', 'Churrasquito', 24000, 'Arroz, ensalada, patacón, papa francesa, chimichurri y jugo', 'churrasquito'),
  S('Especiales', 'Lomo de Cerdo a la Plancha', 24000, ESP, 'lomo-plancha'),
  S('Especiales', 'Lomo de Cerdo Ranchero', 29000, ESP, 'lomo-ranchero'),
  S('Especiales', 'Lomo de Cerdo Hawaiano', 27000, ESP, 'lomo-hawaiano'),
  S('Especiales', 'Pechuga a la Plancha', 24000, ESP, 'pechuga-plancha'),
  S('Especiales', 'Pechuga Hawaiana', 27000, ESP, 'pechuga-hawaiana'),
  S('Especiales', 'Pechuga Gratinada', 27000, ESP, 'pechuga-gratinada'),
  S('Especiales', 'Pechuga Ranchera', 29000, ESP, 'pechuga-ranchera'),
  S('Especiales', 'Costillas en BBQ', 27000, 'Costillas, papa francesa, ensalada, arroz y jugo', 'costillas-bbq'),
  S('Especiales', 'Tabla Mixta', 24000, 'Carne de res, cerdo, pechuga, papa francesa, patacón, ensalada y jugo', 'tabla-mixta'),

  S('Platos del día', 'Sancocho de Costilla', 12000, 'Arroz, ensalada, sopa y jugo', 'sancocho-costilla'),
  S('Platos del día', 'Viudo de Bocachico 1/2', 14000, '', 'viudo-bocachico'),
  S('Platos del día', 'Viudo de Mojarra', 11000, '', 'viudo-mojarra'),
  S('Platos del día', 'Bandeja Paisa', 12000, '', undefined, {
    days: [
      { day: 4, price: 12000 },
      { day: 0, price: 18000 },
    ],
  }),

  S('Proteínas del corriente', 'Pollo Asado con 1/4', 15000, '', 'cuarto-pollo', { insumoParts: 1 }),
  S('Proteínas del corriente', 'Carne Asada de Cerdo', 10000),
  S('Proteínas del corriente', 'Carne Sudada', 10000, '', 'almuerzo-corriente'),
  S('Proteínas del corriente', 'Pollo Sudado', 10000),
  S('Proteínas del corriente', 'Hamburguesa de las Brisas', 10000),
  S('Proteínas del corriente', 'Butifarra', 10000),
  S('Proteínas del corriente', 'Chorizo', 10000),

  S('Sancochos', 'Sancocho de Carne', 10000, '', 'sancocho-carne'),
  S('Sancochos', 'Sancocho de Pollo', 10000, '', 'sancocho-pollo'),

  S('Menú infantil', 'Salchipapa', 14000, 'Papa francesa, salchichas, queso, salsas y jugo Hit de cajita', 'salchipapa'),
  S('Menú infantil', 'Nuggets de Pollo', 14000, 'Papa francesa, nuggets de pollo, salsas y jugo Hit de cajita', 'nuggets'),

  S('Adicionales', 'Papas Francesa', 8000),
  S('Adicionales', 'Sopa del Día', 5000),
  S('Adicionales', 'Ensalada', 7000),
  S('Adicionales', 'Papa Salada', 3000),
  S('Adicionales', 'Arroz', 3000),
  S('Adicionales', 'Patacones', 5000),
  S('Adicionales', 'Maduro', 2000),
  S('Adicionales', 'Panceta', 7000),

  S('Bebidas', 'Jugo del Día', 2000),
  S('Bebidas', 'Botella de Agua', 3000),
  S('Bebidas', 'Cerveza', 4000),
  S('Bebidas', 'Gaseosa Personal', 4000),
  S('Bebidas', 'Gaseosa 1 L', 6000),
  S('Bebidas', 'Gaseosa 1.5 L', 8000),
  S('Bebidas', 'Gaseosa 2 L', 10000),
  S('Bebidas', 'Gaseosa 3 L', 15000),
];

const catRank = (c: string) => {
  const i = (CARTA_CATEGORIES as readonly string[]).indexOf(c);
  return i === -1 ? CARTA_CATEGORIES.length : i;
};
export const sortCarta = (rows: CartaItem[]) =>
  [...rows].sort((a, b) => catRank(a.category) - catRank(b.category) || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

// ---------- Suscripciones ----------

export function useCarta() {
  const [items, setItems] = useState<CartaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'carta'),
        snap => {
          setItems(sortCarta(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CartaItem)));
          setLoading(false);
        },
        () => {
          setError(true);
          setLoading(false);
        },
      ),
    [],
  );
  return { items, loading, error };
}

export function useCartaConfig() {
  const [cfg, setCfg] = useState<CartaConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'carta'),
        snap => {
          setCfg(snap.exists() ? { ...DEFAULT_CONFIG, ...(snap.data() as Partial<CartaConfig>) } : DEFAULT_CONFIG);
          setLoaded(true);
        },
        () => setLoaded(true),
      ),
    [],
  );
  return { cfg, loaded };
}

/** Pollos en cuartos (null si no se puede leer o no hay inventario de pollo) */
export function usePolloStock() {
  const [stock, setStock] = useState<number | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'insumos', 'POLLO'),
        snap => setStock(snap.exists() ? Number(snap.data().stock ?? 0) : null),
        () => setStock(null),
      ),
    [],
  );
  return stock;
}

// ---------- Escritura ----------

function clean<T extends Record<string, unknown>>(o: T) {
  const out: Record<string, unknown> = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
}

export async function loadDefaultCarta() {
  const batch = writeBatch(db);
  DEFAULT_CARTA.forEach((s, i) => {
    const id = slugify(s.name);
    batch.set(doc(db, 'carta', id), clean({ ...s, id: undefined, available: true, order: i }));
  });
  batch.set(doc(db, 'config', 'carta'), DEFAULT_CONFIG, { merge: true });
  await batch.commit();
}

export async function saveCartaItem(item: CartaItem) {
  const { id, ...rest } = item;
  const data = clean({ ...rest, updatedAt: serverTimestamp() } as Record<string, unknown>);
  if (!item.days?.length) delete data.days;
  if (!item.photo) delete data.photo;
  if (!item.insumoParts) delete data.insumoParts;
  await setDoc(doc(db, 'carta', id), data);
}

export const newCartaId = (name: string, existing: CartaItem[]) => {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (existing.some(i => i.id === id)) id = `${base}-${n++}`;
  return id;
};

export async function deleteCartaItem(id: string) {
  await deleteDoc(doc(db, 'carta', id));
}

/** Disponible / agotado (también lo puede hacer el cajero) */
export async function setCartaAvailable(id: string, available: boolean) {
  await updateDoc(doc(db, 'carta', id), { available });
}

export async function saveCartaSettings(data: Pick<CartaConfig, 'recargoLlevar' | 'ajiPrecio'>) {
  await setDoc(doc(db, 'config', 'carta'), data, { merge: true });
}

export async function publishMenuDia(
  data: Pick<CartaConfig, 'sopa' | 'principios' | 'jugo' | 'nota'>,
  proteinas: { id: string; available: boolean }[],
  user: UserProfile,
) {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'config', 'carta'),
    { ...data, publishedAt: serverTimestamp(), publishedBy: user.name },
    { merge: true },
  );
  proteinas.forEach(p => batch.update(doc(db, 'carta', p.id), { available: p.available }));
  await batch.commit();
}

export const formatCOP = (v: number) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
