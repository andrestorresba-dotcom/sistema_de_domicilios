import { TableOrder, formatCurrency } from '../lib/tableStore';

interface PrintTableTicketProps {
  order: TableOrder;
}

export function PrintTableTicket({ order }: PrintTableTicketProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // 1. Extraemos y formateamos de forma segura las variables antes de inyectarlas
    const isToGo = order.tableNumber >= 23 && order.tableNumber <= 26;
    const titleText = isToGo ? `PARA LLEVAR #${order.tableNumber}` : `Pedido Mesa ${order.tableNumber}`;
    
    // Validamos si createdAt es un objeto Date válido, si no, usamos la fecha actual
    const dateObj = order.createdAt instanceof Date ? order.createdAt : new Date();
    const formattedDate = dateObj.toLocaleDateString('es-CO');
    const formattedTime = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // Calculamos el total formateado listo para el string
    const totalFormatted = formatCurrency(order.total);

    // Generamos la URL del código de barras
    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${order.tableNumber}&scale=2&height=12&includetext=true`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket ${titleText}</title>
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
              color: #000;
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
              font-size: 14px;
            }
            .barcode-container {
              text-align: center;
              margin-top: 15px;
              margin-bottom: 5px;
              padding-top: 5px;
            }
            .barcode-img {
              max-width: 100%;
              height: auto;
              /* Propiedades CSS clave para impresión térmica limpia en blanco y negro puro */
              image-rendering: pixelated;
              image-rendering: crisp-edges;
              filter: contrast(200%);
            }
            .footer {
              text-align: center;
              margin-top: 10px;
              font-size: 10px;
              border-top: 1px dashed #000;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="restaurant-name">ASADERO VENTILADOR</div>
            <div style="font-weight: bold; font-size: 13px;">${titleText}</div>
            ${!isToGo ? `<div>Piso ${order.floor}</div>` : '<div>ÁREA DE DESPACHO</div>'}
          </div>

          <div class="order-info">
            <div><strong>Mesero:</strong> ${order.waiterName}</div>
            <div><strong>Fecha:</strong> ${formattedDate}</div>
            <div><strong>Hora:</strong> ${formattedTime}</div>
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
            <span>${totalFormatted}</span>
          </div>

          <div class="barcode-container">
            <img class="barcode-img" src="${barcodeUrl}" alt="Código de barras Mesa ${order.tableNumber}" />
          </div>

          <div class="footer">
            ¡Gracias por su compra!<br>
            www.asaderoventilador.com
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 500);
              }, 300);
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
      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
    >
      <span>🖨️</span> Imprimir Pre-cuenta / Ticket
    </button>
  );
}