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

// --- Carta digital ---
await t('admin crea plato en la carta', () =>
  assertSucceeds(setDoc(doc(admin, 'carta/mojarra-frita'), { name: 'Mojarra Frita', category: 'Especiales', price: 24000, recargo: true, available: true, order: 1, description: '' })));
await t('cliente sin sesión lee la carta', () => assertSucceeds(getDoc(doc(anon, 'carta/mojarra-frita'))));
await t('cliente sin sesión lee el corriente del día', () => assertSucceeds(getDoc(doc(anon, 'config/carta'))));
await t('cliente sin sesión ve el stock de pollo', () => assertSucceeds(getDoc(doc(anon, 'insumos/POLLO'))));
await t('cliente sin sesión NO ve otros insumos', () => assertFails(getDoc(doc(anon, 'insumos/OTRO'))));
await t('cliente sin sesión NO modifica la carta', () => assertFails(updateDoc(doc(anon, 'carta/mojarra-frita'), { price: 1 })));
await t('cliente sin sesión NO marca agotado', () => assertFails(updateDoc(doc(anon, 'carta/mojarra-frita'), { available: false })));
await t('cajero marca un plato agotado', () => assertSucceeds(updateDoc(doc(caj, 'carta/mojarra-frita'), { available: false })));
await t('cajero NO cambia precios de la carta', () => assertFails(updateDoc(doc(caj, 'carta/mojarra-frita'), { price: 1000 })));
await t('cajero NO cambia precio junto con disponible', () => assertFails(updateDoc(doc(caj, 'carta/mojarra-frita'), { available: true, price: 1000 })));
await t('cajero NO crea platos', () => assertFails(setDoc(doc(caj, 'carta/x'), { name: 'x', price: 1 })));
await t('cajero NO borra platos', () => assertFails(deleteDoc(doc(caj, 'carta/mojarra-frita'))));
await t('cajero NO publica el menú del día', () => assertFails(setDoc(doc(caj, 'config/carta'), { sopa: 'x' }, { merge: true })));
await t('admin publica el menú del día', () => assertSucceeds(setDoc(doc(admin, 'config/carta'), { sopa: 'Sancocho', principios: ['Fríjol'] }, { merge: true })));
await t('admin borra plato', () => assertSucceeds(deleteDoc(doc(admin, 'carta/mojarra-frita'))));

// --- Pedidos de clientes (QR y domicilios) ---
const { serverTimestamp, query, where, getDocs } = await import('firebase/firestore');
const item = [{ id: 'cuarto', name: '1/4 de Pollo', qty: 1, price: 12000 }];
const cli = { nombre: 'Ana', telefono: '3001234567', direccion: 'Calle 1 # 2-3', barrio: 'Centro' };
const mesaOrder = (o = {}) => ({ tipo: 'mesa', status: 'por-aceptar', mesa: 5, items: item, subtotal: 12000, createdAt: serverTimestamp(), ...o });
const domOrder = (o = {}) => ({ tipo: 'domicilio', status: 'por-confirmar', cliente: cli, pago: 'efectivo', items: item, subtotal: 12000, createdAt: serverTimestamp(), ...o });
const recOrder = (o = {}) => ({ tipo: 'recoger', status: 'confirmado', cliente: { nombre: 'Ana', telefono: '3001234567' }, pago: 'efectivo', items: item, subtotal: 12000, deliveryFee: 0, total: 12000, zone: 'Recoge en el local', createdAt: serverTimestamp(), ...o });

await t('cliente pide desde el QR de la mesa', () => assertSucceeds(setDoc(doc(anon, 'pedidos_web/m1'), mesaOrder())));
await t('cliente NO pide a una mesa que no existe', () => assertFails(setDoc(doc(anon, 'pedidos_web/m2'), mesaOrder({ mesa: 99 }))));
await t('cliente NO crea un pedido de mesa ya aceptado', () => assertFails(setDoc(doc(anon, 'pedidos_web/m3'), mesaOrder({ status: 'aceptado' }))));
await t('cliente NO manda pedido vacío', () => assertFails(setDoc(doc(anon, 'pedidos_web/m4'), mesaOrder({ items: [] }))));
await t('cliente pide a domicilio', () => assertSucceeds(setDoc(doc(anon, 'pedidos_web/d1'), domOrder())));
await t('cliente NO pone el valor del domicilio', () => assertFails(setDoc(doc(anon, 'pedidos_web/d2'), domOrder({ deliveryFee: 0, total: 12000 }))));
await t('cliente NO manda el domicilio directo a cocina', () => assertFails(setDoc(doc(anon, 'pedidos_web/d3'), domOrder({ status: 'confirmado' }))));
await t('domicilio sin dirección es rechazado', () => assertFails(setDoc(doc(anon, 'pedidos_web/d4'), domOrder({ cliente: { nombre: 'Ana', telefono: '3001234567' } }))));
await t('cliente pide para recoger en efectivo', () => assertSucceeds(setDoc(doc(anon, 'pedidos_web/r1'), recOrder())));
await t('recoger con transferencia espera el pago', () => assertSucceeds(setDoc(doc(anon, 'pedidos_web/r2'), recOrder({ pago: 'transferencia', status: 'esperando-pago' }))));
await t('recoger con transferencia NO va directo a cocina', () => assertFails(setDoc(doc(anon, 'pedidos_web/r3'), recOrder({ pago: 'transferencia' }))));
await t('cliente consulta su pedido por el id', () => assertSucceeds(getDoc(doc(anon, 'pedidos_web/d1'))));
await t('cliente NO lista los pedidos de otros', () => assertFails(getDocs(query(collection(anon, 'pedidos_web'), where('status', '==', 'por-confirmar')))));
await t('cliente NO acepta su propio pedido de mesa', () => assertFails(updateDoc(doc(anon, 'pedidos_web/m1'), { status: 'aceptado' })));
await t('cliente NO confirma antes de que le pongan el domicilio', () => assertFails(updateDoc(doc(anon, 'pedidos_web/d1'), { status: 'confirmado' })));
await t('cajero lista los pedidos web', () => assertSucceeds(getDocs(query(collection(caj, 'pedidos_web'), where('status', '==', 'por-confirmar')))));
await t('cajero pone la zona del domicilio', () =>
  assertSucceeds(updateDoc(doc(caj, 'pedidos_web/d1'), { zone: 'Centro', deliveryFee: 5000, total: 17000, status: 'por-aceptar-cliente' })));
await t('cliente NO cambia el valor del domicilio', () => assertFails(updateDoc(doc(anon, 'pedidos_web/d1'), { status: 'confirmado', deliveryFee: 0 })));
await t('cliente NO confirma efectivo como "esperando pago"', () => assertFails(updateDoc(doc(anon, 'pedidos_web/d1'), { status: 'esperando-pago', pago: 'efectivo' })));
await t('cliente confirma el total en efectivo', () => assertSucceeds(updateDoc(doc(anon, 'pedidos_web/d1'), { status: 'confirmado', pago: 'efectivo' })));
await t('cliente NO cambia un pedido ya confirmado', () => assertFails(updateDoc(doc(anon, 'pedidos_web/d1'), { status: 'cancelado' })));
await t('cajero NO borra pedidos web', () => assertFails(deleteDoc(doc(caj, 'pedidos_web/d1'))));

await t('cliente llama al mesero', () => assertSucceeds(setDoc(doc(anon, 'llamadas/5'), { mesa: 5, at: serverTimestamp() })));
await t('llamada con número de mesa cambiado es rechazada', () => assertFails(setDoc(doc(anon, 'llamadas/6'), { mesa: 5, at: serverTimestamp() })));
await t('NO se puede llamar otra vez antes de 20 segundos', () => assertFails(setDoc(doc(anon, 'llamadas/5'), { mesa: 5, at: serverTimestamp() })));
await t('cliente NO ve las llamadas', () => assertFails(getDoc(doc(anon, 'llamadas/5'))));
await t('cajero ve y atiende la llamada', async () => {
  await assertSucceeds(getDoc(doc(caj, 'llamadas/5')));
  await assertSucceeds(deleteDoc(doc(caj, 'llamadas/5')));
});

console.log(`\n${pass} pasaron, ${fail} fallaron`);
await env.cleanup();
process.exit(fail ? 1 : 0);
