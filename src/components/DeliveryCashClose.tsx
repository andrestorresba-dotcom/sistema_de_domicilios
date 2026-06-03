import { useState, useEffect } from 'react';
import { X, DollarSign, User, Calendar, FileText, Printer } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Order, getDateFromTimestamp } from '../lib/orderStore';

interface DeliveryCashCloseProps {
  onClose: () => void;
}

export function DeliveryCashClose({ onClose }: DeliveryCashCloseProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<string>('');
  const [deliveryPeople, setDeliveryPeople] = useState<string[]>([]);
  
  // Obtiene la fecha actual en formato local AAAA-MM-DD sin desfase de zona horaria
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
    return localISOTime;
  });

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firebaseOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      setOrders(firebaseOrders);
  
      const uniqueDeliveryPeople = Array.from(
        new Set(
          firebaseOrders
            .filter((order: Order) => order.deliveryPerson)
            .map((order: Order) => order.deliveryPerson!)
        )
      ).sort();

      setDeliveryPeople(uniqueDeliveryPeople);
    }, (error) => {
      console.error("Error al obtener pedidos:", error);
    });

    return () => unsubscribe();
  }, []);

  const filteredOrders = orders.filter(order => {
    // 1. Filtro de domiciliario
    const matchesDeliveryPerson = selectedDeliveryPerson === '' ||
      order.deliveryPerson === selectedDeliveryPerson;

    // 2. Extracción segura de la fecha
    let dateObj: Date | null = null;

    if (order.createdAt) {
      if (typeof (order.createdAt as any).toDate === 'function') {
        dateObj = (order.createdAt as any).toDate();
      } else if (order.createdAt instanceof Date) {
        dateObj = order.createdAt;
      } else {
        dateObj = new Date(order.createdAt as any);
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return false;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const orderDate = `${year}-${month}-${day}`;

    const matchesDate = orderDate === selectedDate;

    // 3. Filtro de estado
    const statusClean = order.status ? order.status.toLowerCase().trim() : '';
    const isDelivered = statusClean === 'delivered' || statusClean === 'entregado';

    return matchesDeliveryPerson && matchesDate && isDelivered;
  });

  // CORRECCIÓN TOTALES: Limpieza numérica forzada para evitar el congelamiento en 0
  const totalCash = filteredOrders
    .filter(order => order.paymentMethod === 'cash')
    .reduce((sum, order) => {
      const val = typeof order.total === 'number' ? order.total : parseFloat(String(order.total || 0).replace(/[^0-9.-]+/g, ""));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const totalTransfer = filteredOrders
    .filter(order => order.paymentMethod === 'transfer')
    .reduce((sum, order) => {
      const val = typeof order.total === 'number' ? order.total : parseFloat(String(order.total || 0).replace(/[^0-9.-]+/g, ""));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

  const totalDelivered = filteredOrders.reduce((sum, order) => {
    const val = typeof order.total === 'number' ? order.total : parseFloat(String(order.total || 0).replace(/[^0-9.-]+/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const deliveryPersonName = selectedDeliveryPerson || 'Todos los domiciliarios';
    
    const [year, month, day] = selectedDate.split('-').map(Number);
    const printDate = new Date(year, month - 1, day).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cierre de Caja - ${deliveryPersonName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; color: #333; margin-bottom: 5px; }
          h2 { text-align: center; color: #666; font-size: 18px; margin-top: 0; }
          .info { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #FBBF24; color: #000; font-weight: bold; }
          .totals { margin-top: 30px; padding: 20px; background: #fff8e1; border-radius: 8px; border: 2px solid #FBBF24; }
          .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
          .total-row.grand { border-top: 3px solid #FBBF24; border-bottom: none; font-size: 20px; font-weight: bold; margin-top: 10px; padding-top: 15px; }
        </style>
      </head>
      <body>
        <h1>ASADERO DE POLLO VENTILADOR</h1>
        <h2>Cierre de Caja - Domicilios</h2>
        <div class="info">
          <div class="info-row"><strong>Domiciliario:</strong> <span>${deliveryPersonName}</span></div>
          <div class="info-row"><strong>Fecha:</strong> <span>${printDate}</span></div>
          <div class="info-row"><strong>Total de pedidos:</strong> <span>${filteredOrders.length}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Pedido #</th>
              <th>Cliente</th>
              <th>Dirección</th>
              <th>Método de Pago</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map(order => `
              <tr>
                <td>#${order.orderNumber}</td>
                <td>${order.customerName || ''}</td>
                <td>${order.address}</td>
                <td>${order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</td>
                <td>$${order.total.toLocaleString('es-CO')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Total en Efectivo:</span> <strong>$${totalCash.toLocaleString('es-CO')}</strong></div>
          <div class="total-row"><span>Total en Transferencia:</span> <strong>$${totalTransfer.toLocaleString('es-CO')}</strong></div>
          <div class="total-row grand"><span>TOTAL ENTREGADO:</span> <strong>$${totalDelivered.toLocaleString('es-CO')}</strong></div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-gray-900" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Cierre de Caja - Domicilios</h2>
              <p className="text-gray-700">Filtra por domiciliario y fecha para generar el cierre</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-900" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" /> Domiciliario
              </label>
              <select
                value={selectedDeliveryPerson}
                onChange={(e) => setSelectedDeliveryPerson(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Todos los domiciliarios</option>
                {deliveryPeople.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" /> Fecha
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="text-sm text-green-700 mb-1">Total Efectivo</div>
              <div className="text-2xl font-bold text-green-900">
                ${totalCash.toLocaleString('es-CO')}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm text-blue-700 mb-1">Total Transferencia</div>
              <div className="text-2xl font-bold text-blue-900">
                ${totalTransfer.toLocaleString('es-CO')}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
              <div className="text-sm text-amber-700 mb-1">Total Entregado</div>
              <div className="text-2xl font-bold text-amber-900">
                ${totalDelivered.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* CORRECCIÓN EN EL CONTADOR DE ABAJO: Usamos filteredOrders.length de forma explícita */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pedidos Entregados ({filteredOrders.length})
              </h3>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p>No hay pedidos entregados para los filtros seleccionados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pedido</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Dirección</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Método</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">#{order.orderNumber}</td>
                        <td className="px-4 py-3 text-gray-700">{order.customerName || '---'}</td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{order.address}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.paymentMethod === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          ${(typeof order.total === 'number' ? order.total : parseFloat(String(order.total || 0).replace(/[^0-9.-]+/g, ""))).toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Print Button */}
          {filteredOrders.length > 0 && (
            <div className="mt-6">
              <button
                onClick={handlePrint}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Imprimir Cierre de Caja
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}