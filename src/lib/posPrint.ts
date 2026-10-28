import { getDateFromTimestamp } from './orderStore';
import {
  PAYMENT_METHODS,
  formatMoney,
  formatCajaDate,
  type BusinessInfo,
  type Sale,
  type Expense,
  type CajaSummary,
} from './posStore';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const methodLabel = (m: string) => PAYMENT_METHODS.find(p => p.id === m)?.label ?? m;

const TICKET_CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #000; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  h1 { font-size: 15px; margin: 0 0 2px; text-align: center; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .big { font-size: 15px; }
  .void { border: 2px solid #000; padding: 4px; text-align: center; font-weight: bold; margin: 6px 0; }
`;

function openAndPrint(html: string) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) {
    alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function printSaleTicket(sale: Sale, business: BusinessInfo) {
  const date = getDateFromTimestamp(sale.createdAt);
  const rows = sale.items
    .map(
      it => `<tr><td>${it.quantity} x ${esc(it.name)}</td><td class="r">${formatMoney(it.price * it.quantity)}</td></tr>`,
    )
    .join('');

  openAndPrint(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.id)}</title>
  <style>${TICKET_CSS}</style></head><body>
    <h1>${esc(business.name)}</h1>
    ${business.nit ? `<div class="c">NIT ${esc(business.nit)}</div>` : ''}
    ${business.address ? `<div class="c">${esc(business.address)}</div>` : ''}
    ${business.phone ? `<div class="c">Tel. ${esc(business.phone)}</div>` : ''}
    <hr>
    <div class="b">Factura POS ${esc(sale.id)}</div>
    <div>${date.toLocaleDateString('es-CO')} ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
    <div>Cajero: ${esc(sale.cashierName)}</div>
    ${sale.customerName ? `<div>Cliente: ${esc(sale.customerName)}</div>` : ''}
    ${sale.customerDoc ? `<div>CC/NIT: ${esc(sale.customerDoc)}</div>` : ''}
    ${sale.status === 'anulada' ? `<div class="void">VENTA ANULADA</div>` : ''}
    <hr>
    <table>${rows}</table>
    <hr>
    <table>
      <tr class="b big"><td>TOTAL</td><td class="r">${formatMoney(sale.total)}</td></tr>
      <tr><td>Pago</td><td class="r">${methodLabel(sale.paymentMethod)}</td></tr>
      ${sale.received !== undefined ? `<tr><td>Recibido</td><td class="r">${formatMoney(sale.received)}</td></tr>` : ''}
      ${sale.change !== undefined ? `<tr><td>Cambio</td><td class="r">${formatMoney(sale.change)}</td></tr>` : ''}
    </table>
    <hr>
    <div class="c">${esc(business.footer)}</div>
  </body></html>`);
}

export function printCajaReport(params: {
  cajaId: string;
  business: BusinessInfo;
  summary: CajaSummary;
  expenses: Expense[];
  countedCash?: number | null;
  closedByName?: string;
  status: string;
}) {
  const { summary: s } = params;
  const methods = PAYMENT_METHODS.map(
    m => `<tr><td>${m.label}</td><td class="r">${formatMoney(s.byMethod[m.id] ?? 0)}</td></tr>`,
  ).join('');
  const exp = params.expenses.length
    ? params.expenses
        .map(e => `<tr><td>${esc(e.description)}<br><small>${esc(e.responsible)}</small></td><td class="r">${formatMoney(e.amount)}</td></tr>`)
        .join('')
    : '<tr><td colspan="2">Sin gastos</td></tr>';
  const diff =
    params.countedCash !== undefined && params.countedCash !== null ? params.countedCash - s.expectedCash : null;

  openAndPrint(`<!doctype html><html><head><meta charset="utf-8"><title>Cierre ${params.cajaId}</title>
  <style>${TICKET_CSS}</style></head><body>
    <h1>${esc(params.business.name)}</h1>
    <div class="c b">CIERRE DE CAJA</div>
    <div class="c">${esc(formatCajaDate(params.cajaId))}</div>
    <div class="c">Estado: ${params.status === 'cerrada' ? 'CERRADA' : 'ABIERTA (parcial)'}</div>
    ${params.closedByName ? `<div class="c">Cerró: ${esc(params.closedByName)}</div>` : ''}
    <hr>
    <table>
      <tr><td>N° de ventas</td><td class="r">${s.salesCount}</td></tr>
      ${methods}
      <tr class="b"><td>Total vendido</td><td class="r">${formatMoney(s.total)}</td></tr>
    </table>
    <hr>
    <div class="b">Gastos</div>
    <table>${exp}</table>
    <hr>
    <table>
      <tr><td>(+) Base</td><td class="r">${formatMoney(s.base)}</td></tr>
      <tr><td>(+) Efectivo</td><td class="r">${formatMoney(s.byMethod.efectivo)}</td></tr>
      <tr><td>(-) Gastos</td><td class="r">${formatMoney(s.expenses)}</td></tr>
      <tr class="b big"><td>Esperado en caja</td><td class="r">${formatMoney(s.expectedCash)}</td></tr>
      ${params.countedCash !== undefined && params.countedCash !== null ? `<tr><td>Contado</td><td class="r">${formatMoney(params.countedCash)}</td></tr>` : ''}
      ${diff !== null ? `<tr class="b"><td>${diff === 0 ? 'Cuadra' : diff > 0 ? 'Sobrante' : 'Faltante'}</td><td class="r">${formatMoney(Math.abs(diff))}</td></tr>` : ''}
    </table>
    <br><br>
    <div>Firma: ______________________</div>
  </body></html>`);
}
