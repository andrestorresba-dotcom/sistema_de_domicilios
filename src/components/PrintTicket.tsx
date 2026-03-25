import { Order } from '../lib/orderStore';

interface PrintTicketProps {
  order: Order;
}

export function PrintTicket({ order }: PrintTicketProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const subtotal = order.items.reduce((sum, item) => sum + item.price, 0);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket #${order.orderNumber}</title>
          <style>
            @media print {
              @page { margin: 0; }
              body { margin: 0; }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              padding: 10px;
              max-width: 80mm;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
            }
            .restaurant-name {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 5px;
            }
            .order-info {
              margin-bottom: 15px;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .label {
              font-weight: bold;
            }
            .items {
              margin-bottom: 15px;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .item-name {
              flex: 1;
            }
            .item-qty {
              width: 30px;
              text-align: center;
            }
            .item-price {
              width: 80px;
              text-align: right;
            }
            .totals {
              margin-bottom: 15px;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .total-final {
              font-weight: bold;
              font-size: 14px;
              margin-top: 5px;
              padding-top: 5px;
              border-top: 1px solid #000;
            }
            .customer-info {
              margin-bottom: 15px;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .observations {
              background: #f0f0f0;
              padding: 8px;
              margin-bottom: 15px;
              border: 1px solid #000;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              margin-top: 15px;
            }
            .delivery-person {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              text-align: center;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">ASADERO DE POLLO VENTILADOR</div>
            <div>Sistema de Gestión de Pedidos</div>
          </div>

          <div class="order-info">
            <div class="info-row">
              <span class="label">Pedido:</span>
              <span>#${order.orderNumber}</span>
            </div>
            <div class="info-row">
              <span class="label">Fecha:</span>
              <span>${order.createdAt.toLocaleDateString('es-CO')} ${order.createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="info-row">
              <span class="label">Estado:</span>
              <span>${order.status === 'pending' ? 'Pendiente' : order.status === 'preparing' ? 'En Preparación' : order.status === 'in-route' ? 'En Ruta' : 'Entregado'}</span>
            </div>
          </div>

          <div class="customer-info">
            <div class="info-row">
              <span class="label">Cliente:</span>
              <span>${order.customerName}</span>
            </div>
            <div class="info-row">
              <span class="label">Teléfono:</span>
              <span>${order.phone}</span>
            </div>
            <div class="info-row">
              <span class="label">Dirección:</span>
            </div>
            <div style="margin-top: 3px; padding-left: 10px;">
              ${order.address}
            </div>
          </div>

          <div class="items">
            <div style="font-weight: bold; margin-bottom: 8px;">PRODUCTOS:</div>
            ${order.items.map(item => `
              <div class="item-row">
                <span class="item-qty">${item.quantity}x</span>
                <span class="item-name">${item.name}</span>
                <span class="item-price">$${item.price.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>

          ${order.observations ? `
            <div class="observations">
              <div style="font-weight: bold; margin-bottom: 5px;">⚠️ OBSERVACIONES:</div>
              <div>${order.observations}</div>
            </div>
          ` : ''}

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>Domicilio:</span>
              <span>$${order.deliveryFee.toLocaleString()}</span>
            </div>
            <div class="total-row total-final">
              <span>TOTAL:</span>
              <span>$${order.total.toLocaleString()}</span>
            </div>
          </div>

          <div class="order-info">
            <div class="info-row">
              <span class="label">Método de Pago:</span>
              <span>${order.paymentMethod === 'cash' ? '💵 EFECTIVO' : '💳 TRANSFERENCIA'}</span>
            </div>
            ${order.paymentMethod === 'cash' ? `
              <div class="info-row" style="margin-top: 5px;">
                <span class="label">A Cobrar:</span>
                <span style="font-size: 14px; font-weight: bold;">$${order.total.toLocaleString()}</span>
              </div>
            ` : ''}
          </div>

          ${order.deliveryPerson ? `
            <div class="delivery-person">
              🛵 Domiciliario: ${order.deliveryPerson}
            </div>
          ` : ''}

          <div class="footer">
            ¡Gracias por su compra!<br>
            Asadero de Pollo Ventilador
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <button
      onClick={handlePrint}
      className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors border-2 border-gray-300 flex items-center justify-center gap-2"
      type="button"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Imprimir Ticket
    </button>
  );
}
