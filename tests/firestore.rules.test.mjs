import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, collection, addDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-asadero',
  firestore: { rules: readFileSync(process.argv[2] ?? 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('ok   ', name); }
  catch (e) { fail++; console.log('FALLA', name, '-', e.message.split('\n')[0]); }
}

const TODAY = '2026-10-28';
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'usuarios/cajero'), { name: 'Caja', username: 'cajero1', role: 'cajero', active: true });
  await setDoc(doc(db, 'usuarios/inactivo'), { name: 'X', username: 'x', role: 'cajero', active: false });
  await setDoc(doc(db, 'productos/P001'), { name: '1/4', category: 'Pollo', price: 12000, stock: 10, minStock: 2, active: true });
  await setDoc(doc(db, 'pedidos/PED-0001'), { total: 1 });
  await setDoc(doc(db, 'insumos/POLLO'), { name: 'Pollo', unit: 'pollos', parts: 4, stock: 160, minStock: 20 });
});

const anon = env.unauthenticatedContext().firestore();
const fresh = env.authenticatedContext('fundador').firestore();

// --- Primer administrador ---
await t('nadie sin cuenta puede leer pedidos', () => assertFails(getDoc(doc(anon, 'pedidos/PED-0001'))));
await t('config/setup es legible sin sesión', () => assertSucceeds(getDoc(doc(anon, 'config/setup'))));
await t('crear primer admin + config/setup en un lote', () => {
  const b = writeBatch(fresh);
  b.set(doc(fresh, 'usuarios/fundador'), { name: 'Admin', username: 'admin', role: 'admin', active: true });
  b.set(doc(fresh, 'config/setup'), { adminUid: 'fundador' });
  return assertSucceeds(b.commit());
});
const intruso = env.authenticatedContext('intruso').firestore();
await t('un segundo "primer admin" es rechazado', () => {
  const b = writeBatch(intruso);
  b.set(doc(intruso, 'usuarios/intruso'), { name: 'I', username: 'i', role: 'admin', active: true });
  b.set(doc(intruso, 'config/setup'), { adminUid: 'intruso' });
  return assertFails(b.commit());
});
await t('cuenta de Auth sin perfil no lee productos', () => assertFails(getDoc(doc(intruso, 'productos/P001'))));
await t('usuario inactivo no lee pedidos', () => assertFails(getDoc(doc(env.authenticatedContext('inactivo').firestore(), 'pedidos/PED-0001'))));

const admin = fresh;
const caj = env.authenticatedContext('cajero').firestore();

// --- Usuarios ---
await t('cajero no puede subirse a admin', () => assertFails(updateDoc(doc(caj, 'usuarios/cajero'), { role: 'admin' })));
await t('cajero no puede ver otros usuarios', () => assertFails(getDoc(doc(caj, 'usuarios/fundador'))));
await t('admin cambia rol de otro', () => assertSucceeds(updateDoc(doc(admin, 'usuarios/inactivo'), { role: 'cajero' })));
await t('admin no puede quitarse su propio rol', () => assertFails(updateDoc(doc(admin, 'usuarios/fundador'), { role: 'cajero' })));

// --- Inventario ---
await t('cajero lee inventario', () => assertSucceeds(getDoc(doc(caj, 'productos/P001'))));
await t('cajero NO cambia precio', () => assertFails(updateDoc(doc(caj, 'productos/P001'), { price: 1000 })));
await t('cajero NO sube existencias', () => assertFails(updateDoc(doc(caj, 'productos/P001'), { stock: 99 })));
await t('cajero NO baja existencias sin venta', () => assertFails(updateDoc(doc(caj, 'productos/P001'), { stock: 0 })));
await t('cajero NO crea productos', () => assertFails(setDoc(doc(caj, 'productos/X1'), { name: 'x', price: 1, stock: 1 })));
await t('cajero NO borra productos', () => assertFails(deleteDoc(doc(caj, 'productos/P001'))));
await t('admin edita precio', () => assertSucceeds(updateDoc(doc(admin, 'productos/P001'), { price: 13000 })));

// --- Ventas ---
function sale(db, n, qtySold, stockAfter, extra = {}) {
  const id = `VTA-${String(n).padStart(5, '0')}`;
  const b = writeBatch(db);
  b.set(doc(db, 'config/ventas'), { lastSaleNumber: n }, { merge: true });
  b.update(doc(db, 'productos/P001'), { stock: stockAfter, lastSaleId: id });
  b.set(doc(db, `ventas_pos/${id}`), {
    number: n, cajaId: TODAY, items: [], qty: { P001: qtySold }, total: 12000 * qtySold,
    paymentMethod: 'efectivo', cashierUid: 'cajero', cashierName: 'Caja', status: 'activa', ...extra,
  });
  return b.commit();
}
await t('cajero registra venta y descuenta 2 (10→8)', () => assertSucceeds(sale(caj, 1, 2, 8)));
await t('venta que descuenta más de lo vendido es rechazada', () => assertFails(sale(caj, 2, 1, 0)));
await t('venta saltando consecutivo es rechazada', () => assertFails(sale(caj, 5, 1, 7)));
await t('venta a nombre de otro cajero es rechazada', () => assertFails(sale(caj, 2, 1, 7, { cashierUid: 'fundador' })));
await t('reusar factura vieja para bajar stock es rechazado', () =>
  assertFails(updateDoc(doc(caj, 'productos/P001'), { stock: 6, lastSaleId: 'VTA-00001' })));
await t('cajero NO anula factura', () => assertFails(updateDoc(doc(caj, 'ventas_pos/VTA-00001'), { status: 'anulada' })));
await t('cajero NO borra factura', () => assertFails(deleteDoc(doc(caj, 'ventas_pos/VTA-00001'))));
await t('admin anula factura', () => assertSucceeds(updateDoc(doc(admin, 'ventas_pos/VTA-00001'), { status: 'anulada' })));
await t('admin tampoco borra factura', () => assertFails(deleteDoc(doc(admin, 'ventas_pos/VTA-00001'))));

// --- Inventario compartido de pollos (en cuartos) ---
function polloSale(db, n, cuartos, stockAfter) {
  const id = `VTA-${String(n).padStart(5, '0')}`;
  const b = writeBatch(db);
  b.set(doc(db, 'config/ventas'), { lastSaleNumber: n }, { merge: true });
  b.update(doc(db, 'insumos/POLLO'), { stock: stockAfter, lastSaleId: id });
  b.set(doc(db, `ventas_pos/${id}`), {
    number: n, cajaId: TODAY, items: [], qty: { P002: 1, P001: 1 }, insumoQty: { POLLO: cuartos }, total: 30000,
    paymentMethod: 'nequi', cashierUid: 'cajero', cashierName: 'Caja', status: 'activa',
  });
  return b.commit();
}
await t('cajero lee el inventario de pollos', () => assertSucceeds(getDoc(doc(caj, 'insumos/POLLO'))));
await t('venta de ½ + ¼ descuenta ¾ de pollo (40 → 39¼)', () => assertSucceeds(polloSale(caj, 2, 3, 157)));
await t('venta que descuenta más pollo del vendido es rechazada', () => assertFails(polloSale(caj, 3, 3, 150)));
await t('cajero NO suma pollos', () => assertFails(updateDoc(doc(caj, 'insumos/POLLO'), { stock: 400 })));
await t('cajero NO cambia la alerta', () => assertFails(updateDoc(doc(caj, 'insumos/POLLO'), { minStock: 0 })));
await t('cajero NO crea otro inventario compartido', () => assertFails(setDoc(doc(caj, 'insumos/PAPA'), { stock: 1 })));
await t('admin registra entrada de pollos', () => assertSucceeds(updateDoc(doc(admin, 'insumos/POLLO'), { stock: 197 })));

// --- Caja y gastos ---
await t('cajero NO fija base de caja', () => assertFails(setDoc(doc(caj, `cajas/${TODAY}`), { base: 1, status: 'abierta' })));
await t('admin fija base de caja', () => assertSucceeds(setDoc(doc(admin, `cajas/${TODAY}`), { base: 200000, status: 'abierta' })));
let gastoId;
await t('cajero agrega gasto', async () => {
  const r = await assertSucceeds(addDoc(collection(caj, 'gastos'), { cajaId: TODAY, description: 'hielo', amount: 5000, responsible: 'Caja', createdByUid: 'cajero' }));
  gastoId = r.id;
});
await t('cajero NO borra gasto', () => assertFails(deleteDoc(doc(caj, `gastos/${gastoId}`))));
await t('cajero NO edita gasto', () => assertFails(updateDoc(doc(caj, `gastos/${gastoId}`), { amount: 1 })));
await t('cajero NO cierra caja', () => assertFails(updateDoc(doc(caj, `cajas/${TODAY}`), { status: 'cerrada' })));
await t('admin cierra caja', () => assertSucceeds(updateDoc(doc(admin, `cajas/${TODAY}`), { status: 'cerrada' })));
await t('con caja cerrada no se puede vender', () => assertFails(sale(caj, 3, 1, 7)));
await t('con caja cerrada no se puede vender pollo', () => assertFails(polloSale(caj, 3, 1, 196)));
await t('con caja cerrada no se pueden agregar gastos', () =>
  assertFails(addDoc(collection(caj, 'gastos'), { cajaId: TODAY, description: 'x', amount: 1, responsible: 'C', createdByUid: 'cajero' })));
await t('cajero NO edita datos de la factura', () => assertFails(setDoc(doc(caj, 'config/negocio'), { nit: '1' })));

// --- Módulos existentes siguen funcionando ---
await t('cajero sigue usando pedidos', () => assertSucceeds(updateDoc(doc(caj, 'pedidos/PED-0001'), { status: 'preparing' })));
await t('cajero sigue usando mesas', () => assertSucceeds(setDoc(doc(caj, 'mesas/1'), { items: [] })));

console.log(`\n${pass} pasaron, ${fail} fallaron`);
await env.cleanup();
process.exit(fail ? 1 : 0);
