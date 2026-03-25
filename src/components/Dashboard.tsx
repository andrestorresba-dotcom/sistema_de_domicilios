import { useState } from 'react';
import { useOrders } from '../lib/hooks';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import { Order, OrderStatus } from '../lib/orderStore';
import logo from 'figma:asset/f9bf657c82e7c182c31f3345965439fef56d541e.png';

export function Dashboard() {
  const orders = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => order.status === status);
  };

  const columns = [
    { status: 'pending' as OrderStatus, title: 'Pedidos Pendientes', color: 'bg-gray-100' },
    { status: 'preparing' as OrderStatus, title: 'En Preparación', color: 'bg-blue-50' },
    { status: 'in-route' as OrderStatus, title: 'En Ruta', color: 'bg-amber-50' },
    { status: 'delivered' as OrderStatus, title: 'Entregados', color: 'bg-green-50' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header with Logo */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Asadero de Pollo Ventilador" className="h-16 w-auto" />
          <div>
            <h2 className="font-bold text-gray-900">Tablero de Pedidos</h2>
            <p className="text-sm text-gray-600">Vista general del estado de todos los pedidos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(column => (
          <div key={column.status} className="flex flex-col">
            <div className={`${column.color} rounded-t-lg px-4 py-3 border-b-2 border-gray-200`}>
              <h3 className="font-semibold text-gray-900">{column.title}</h3>
              <p className="text-sm text-gray-600">
                {getOrdersByStatus(column.status).length} pedido(s)
              </p>
            </div>
            <div className="bg-white rounded-b-lg shadow-sm border border-t-0 border-gray-200 p-3 space-y-3 min-h-[400px]">
              {getOrdersByStatus(column.status).map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
              {getOrdersByStatus(column.status).length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">
                  No hay pedidos en esta columna
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}