import { TableOrder, formatCurrency } from '../lib/tableStore';

interface PrintTableTicketProps {
  order: TableOrder;
}

export function PrintTableTicket({ order }: PrintTableTicketProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket Mesa ${order.tableNumber}</title>
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
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              padding: 2px 0;
            }
            .item-name {
              flex: 1;
              margin-right: 10px;
            }
            .item-quantity {
              margin-right: 10px;
            }
            .item-price {
              text-align: right;
            }
            .total {
              border-top: 1px dashed #000;
              padding-top: 10px;
              margin-top: 10px;
              font-weight: bold;
              display: flex;
              justify-content: space-between;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              font-size: 10px;
              border-top: 1px dashed #000;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">ASADERO VENTILADOR</div>
            <div>Pedido Mesa ${order.tableNumber}</div>
            <div>Piso ${order.floor}</div>
          </div>

          <div class="order-info">
            <div><strong>Mesero:</strong> ${order.waiterName}</div>
            <div><strong>Fecha:</strong> ${order.createdAt.toLocaleDateString()}</div>
            <div><strong>Hora:</strong> ${order.createdAt.toLocaleTimeString()}</div>
            ${order.observations ? `<div><strong>Observaciones:</strong> ${order.observations}</div>` : ''}
          </div>

          <div class="items">
            ${order.items.map(item => `
              <div class="item">
                <div class="item-name">${item.name}${item.customNote ? ` (${item.customNote})` : ''}</div>
                <div class="item-quantity">${item.quantity}x</div>
                <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
              </div>
            `).join('')}
          </div>

          <div class="total">
            <span>TOTAL:</span>
            <span>${formatCurrency(order.total)}</span>
          </div>

          <div class="footer">
            ¡Gracias por su visita!<br>
            www.asaderoventilador.com
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <button
      onClick={handlePrint}
      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
    >
      🖨️ Imprimir Ticket
    </button>
  );
}