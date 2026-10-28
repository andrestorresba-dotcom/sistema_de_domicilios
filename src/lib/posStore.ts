import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { getDateFromTimestamp } from './orderStore';
import type { UserProfile } from './auth';

// ---------- Tipos ----------

export type PaymentMethod = 'efectivo' | 'transferencia' | 'nequi' | 'daviplata';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
];

export const CATEGORIES = ['Pollo', 'Bebidas', 'Acompañamientos', 'Otros'] as const;

export interface Product {
  id: string; // código, p. ej. P001
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  active: boolean;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string; // VTA-0001
  number: number;
  cajaId: string;
  items: SaleItem[];
  qty: Record<string, number>;
  total: number;
  paymentMethod: PaymentMethod;
  received?: number;
  change?: number;
  customerName?: string;
  customerDoc?: string;
  cashierUid: string;
  cashierName: string;
  status: 'activa' | 'anulada';
  voidReason?: string;
  voidedByName?: string;
  createdAt: any;
}

export interface Expense {
  id: string;
  cajaId: string;
  description: string;
  amount: number;
  responsible: string;
  createdByUid: string;
  createdByName: string;
  createdAt: any;
}

export interface Caja {
  id: string; // YYYY-MM-DD
  base: number;
  status: 'abierta' | 'cerrada';
  baseSetByName?: string;
  closedAt?: any;
  closedByName?: string;
  countedCash?: number | null;
  summary?: CajaSummary;
}

export interface CajaSummary {
  salesCount: number;
  total: number;
  byMethod: Record<PaymentMethod, number>;
  expenses: number;
  base: number;
  expectedCash: number;
}

export interface BusinessInfo {
  name: string;
  nit: string;
  address: string;
  phone: string;
  footer: string;
}

export const DEFAULT_BUSINESS: BusinessInfo = {
  name: 'ASADERO DE POLLO VENTILADOR',
  nit: '',
  address: '',
  phone: '',
  footer: '¡Gracias por su compra!',
};

// Menú inicial (el que aparece en el diseño). El admin lo carga con un botón.
export const DEFAULT_PRODUCTS: Omit<Product, 'stock' | 'minStock' | 'active'>[] = [
  { id: 'P001', name: '1/4 de Pollo', category: 'Pollo', price: 12000 },
  { id: 'P002', name: '1/2 Pollo', category: 'Pollo', price: 18000 },
  { id: 'P003', name: '1 Pollo Entero', category: 'Pollo', price: 32000 },
  { id: 'P004', name: 'Promo Pollo y Medio', category: 'Pollo', price: 42000 },
  { id: 'B001', name: 'Agua', category: 'Bebidas', price: 3000 },
  { id: 'B002', name: 'Cerveza', category: 'Bebidas', price: 4000 },
  { id: 'B003', name: 'Gaseosa Personal', category: 'Bebidas', price: 4000 },
  { id: 'B004', name: 'Gaseosa 1 Litro', category: 'Bebidas', price: 6000 },
  { id: 'B005', name: 'Gaseosa 1.5L', category: 'Bebidas', price: 8000 },
  { id: 'B006', name: 'Gaseosa 2.5L', category: 'Bebidas', price: 10000 },
  { id: 'B007', name: 'Gaseosa 3L', category: 'Bebidas', price: 15000 },
];

// ---------- Utilidades ----------

/** Fecha de hoy en Colombia como YYYY-MM-DD; identifica la caja del día. */
export const todayCajaId = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export const formatMoney = (value: number) => `$ ${Math.round(value || 0).toLocaleString('es-CO')}`;

export const formatCajaDate = (cajaId: string) => {
  const [y, m, d] = cajaId.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const sortByDateDesc = <T extends { createdAt: any }>(rows: T[]) =>
  [...rows].sort((a, b) => getDateFromTimestamp(b.createdAt).getTime() - getDateFromTimestamp(a.createdAt).getTime());

export function summarize(sales: Sale[], expenses: Expense[], base: number): CajaSummary {
  const active = sales.filter(s => s.status === 'activa');
  const byMethod: Record<PaymentMethod, number> = { efectivo: 0, transferencia: 0, nequi: 0, daviplata: 0 };
  for (const s of active) byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total;
  const total = active.reduce((a, s) => a + s.total, 0);
  const exp = expenses.reduce((a, e) => a + e.amount, 0);
  return {
    salesCount: active.length,
    total,
    byMethod,
    expenses: exp,
    base,
    expectedCash: base + byMethod.efectivo - exp,
  };
}

// ---------- Suscripciones (hooks) ----------

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'productos'),
        snap => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product);
          const rank = (c: string) => {
            const i = (CATEGORIES as readonly string[]).indexOf(c);
            return i === -1 ? CATEGORIES.length : i;
          };
          rows.sort((a, b) => rank(a.category) - rank(b.category) || a.id.localeCompare(b.id));
          setProducts(rows);
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [],
  );
  return { products, loading };
}

export function useSales(cajaId: string) {
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'ventas_pos'), where('cajaId', '==', cajaId)), snap =>
        setSales(sortByDateDesc(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale))),
      ),
    [cajaId],
  );
  return sales;
}

export function useExpenses(cajaId: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'gastos'), where('cajaId', '==', cajaId)), snap =>
        setExpenses(sortByDateDesc(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense))),
      ),
    [cajaId],
  );
  return expenses;
}

export function useCaja(cajaId: string) {
  const [caja, setCaja] = useState<Caja | null>(null);
  useEffect(
    () =>
      onSnapshot(doc(db, 'cajas', cajaId), snap =>
        setCaja(snap.exists() ? ({ id: snap.id, ...snap.data() } as Caja) : null),
      ),
    [cajaId],
  );
  return caja;
}

export function useBusinessInfo() {
  const [info, setInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS);
  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'negocio'), snap => {
        if (snap.exists()) setInfo({ ...DEFAULT_BUSINESS, ...(snap.data() as Partial<BusinessInfo>) });
      }),
    [],
  );
  return info;
}

// ---------- Inventario (solo admin; las reglas de Firestore lo exigen) ----------

export async function saveProduct(product: Product, user: UserProfile, previous?: Product) {
  const batch = writeBatch(db);
  const { id, ...data } = product;
  batch.set(doc(db, 'productos', id), data);
  const stockChanged = previous ? previous.stock !== product.stock : product.stock !== 0;
  if (stockChanged) {
    batch.set(doc(collection(db, 'movimientos_inventario')), {
      productId: id,
      productName: product.name,
      type: previous ? 'ajuste' : 'creacion',
      before: previous?.stock ?? 0,
      after: product.stock,
      byUid: user.uid,
      byName: user.name,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function addStock(product: Product, quantity: number, user: UserProfile) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'productos', product.id), { stock: increment(quantity) });
  batch.set(doc(collection(db, 'movimientos_inventario')), {
    productId: product.id,
    productName: product.name,
    type: 'entrada',
    before: product.stock,
    after: product.stock + quantity,
    byUid: user.uid,
    byName: user.name,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteProduct(productId: string) {
  await deleteDoc(doc(db, 'productos', productId));
}

export async function loadDefaultMenu(user: UserProfile) {
  for (const p of DEFAULT_PRODUCTS) {
    await saveProduct({ ...p, stock: 0, minStock: 5, active: true }, user);
  }
}

// ---------- Ventas POS ----------

export class SaleError extends Error {}

/**
 * Registra una venta en una sola transacción: toma el siguiente consecutivo,
 * verifica que haya existencias, descuenta el inventario y guarda la factura.
 * Si dos cajas venden el último producto a la vez, solo una lo logra.
 */
export async function createSale(input: {
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  received?: number;
  customerName?: string;
  customerDoc?: string;
  cashier: UserProfile;
}): Promise<Sale> {
  const cajaId = todayCajaId();
  const counterRef = doc(db, 'config', 'ventas');
  const cajaRef = doc(db, 'cajas', cajaId);

  const qty: Record<string, number> = {};
  for (const it of input.items) qty[it.productId] = (qty[it.productId] ?? 0) + it.quantity;
  const total = input.items.reduce((a, it) => a + it.price * it.quantity, 0);
  if (total <= 0) throw new SaleError('La orden está vacía.');
  if (input.paymentMethod === 'efectivo' && input.received !== undefined && input.received < total) {
    throw new SaleError('El dinero recibido es menor que el total.');
  }

  return runTransaction(db, async tx => {
    const cajaSnap = await tx.get(cajaRef);
    if (cajaSnap.exists() && cajaSnap.data().status === 'cerrada') {
      throw new SaleError('La caja de hoy ya fue cerrada. No se pueden registrar más ventas.');
    }
    const counterSnap = await tx.get(counterRef);
    const productRefs = Object.keys(qty).map(id => doc(db, 'productos', id));
    const productSnaps = await Promise.all(productRefs.map(r => tx.get(r)));

    for (const snap of productSnaps) {
      if (!snap.exists()) throw new SaleError('Un producto de la orden ya no existe.');
      const p = snap.data() as Product;
      const need = qty[snap.id];
      if (!p.active) throw new SaleError(`${p.name} no está disponible.`);
      if (p.stock < need) {
        throw new SaleError(`No hay suficiente ${p.name}: quedan ${p.stock}, pediste ${need}.`);
      }
    }

    const number = (counterSnap.exists() ? counterSnap.data().lastSaleNumber || 0 : 0) + 1;
    const saleId = `VTA-${String(number).padStart(5, '0')}`;
    const change =
      input.paymentMethod === 'efectivo' && input.received !== undefined ? input.received - total : undefined;

    const sale: Omit<Sale, 'id' | 'createdAt'> = {
      number,
      cajaId,
      items: input.items,
      qty,
      total,
      paymentMethod: input.paymentMethod,
      ...(input.paymentMethod === 'efectivo' && input.received !== undefined
        ? { received: input.received, change }
        : {}),
      ...(input.customerName ? { customerName: input.customerName } : {}),
      ...(input.customerDoc ? { customerDoc: input.customerDoc } : {}),
      cashierUid: input.cashier.uid,
      cashierName: input.cashier.name,
      status: 'activa',
    };

    tx.set(counterRef, { lastSaleNumber: number }, { merge: true });
    productSnaps.forEach(snap => {
      const p = snap.data() as Product;
      tx.update(snap.ref, { stock: p.stock - qty[snap.id], lastSaleId: saleId });
    });
    tx.set(doc(db, 'ventas_pos', saleId), { ...sale, createdAt: serverTimestamp() });

    return { id: saleId, ...sale, createdAt: new Date() } as Sale;
  });
}

/** Anula una venta y devuelve las unidades al inventario (solo admin). */
export async function voidSale(sale: Sale, reason: string, admin: UserProfile) {
  await runTransaction(db, async tx => {
    const saleRef = doc(db, 'ventas_pos', sale.id);
    const snap = await tx.get(saleRef);
    if (!snap.exists() || snap.data().status === 'anulada') throw new SaleError('La venta ya estaba anulada.');
    const productSnaps = await Promise.all(Object.keys(sale.qty).map(id => tx.get(doc(db, 'productos', id))));
    productSnaps.forEach(p => {
      if (p.exists()) tx.update(p.ref, { stock: (p.data().stock || 0) + sale.qty[p.id] });
    });
    tx.update(saleRef, {
      status: 'anulada',
      voidReason: reason,
      voidedByName: admin.name,
      voidedAt: serverTimestamp(),
    });
  });
}

// ---------- Caja y gastos ----------

export async function setCajaBase(cajaId: string, base: number, admin: UserProfile) {
  await setDoc(
    doc(db, 'cajas', cajaId),
    { base, status: 'abierta', baseSetByName: admin.name, baseSetAt: serverTimestamp() },
    { merge: true },
  );
}

export async function addExpense(cajaId: string, data: { description: string; amount: number; responsible: string }, user: UserProfile) {
  await addDoc(collection(db, 'gastos'), {
    cajaId,
    description: data.description.trim(),
    amount: data.amount,
    responsible: data.responsible.trim() || user.name,
    createdByUid: user.uid,
    createdByName: user.name,
    createdAt: serverTimestamp(),
  });
}

export async function deleteExpense(id: string) {
  await deleteDoc(doc(db, 'gastos', id));
}

export async function closeCaja(cajaId: string, summary: CajaSummary, countedCash: number | null, admin: UserProfile) {
  await setDoc(
    doc(db, 'cajas', cajaId),
    {
      base: summary.base,
      status: 'cerrada',
      summary,
      countedCash,
      closedByUid: admin.uid,
      closedByName: admin.name,
      closedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function reopenCaja(cajaId: string) {
  await updateDoc(doc(db, 'cajas', cajaId), { status: 'abierta' });
}

export async function saveBusinessInfo(info: BusinessInfo) {
  await setDoc(doc(db, 'config', 'negocio'), info);
}
