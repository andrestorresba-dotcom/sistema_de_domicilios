import { useOrders } from '../lib/hooks';
import { orderStore, getFormattedTime } from '../lib/orderStore';
import { ChefHat, Check, Truck } from 'lucide-react';
import { PrintTicket } from './PrintTicket';
import { useState } from 'react';

export function KitchenView() {
  const orders = useOrders();
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const [deliveryPersons, setDeliveryPersons] = useState<Record<string, string>>({});

  const handleMarkReady = (orderId: string) => {
    orderStore.updateOrderStatus(orderId, 'preparing');
  };

  const handleSendToRoute = (orderId: string) => {
    const deliveryPerson = deliveryPersons[orderId]?.trim();
    if (deliveryPerson) {
      orderStore.setDeliveryPerson(orderId, deliveryPerson);
    }
    orderStore.updateOrderStatus(orderId, 'in-route');
  };

  const handleDeliveryPersonChange = (orderId: string, value: string) => {
    setDeliveryPersons(prev => ({
      ...prev,
      [orderId]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ChefHat className="w-10 h-10 text-amber-400" />
            <h1 className="font-bold text-white">Vista de Cocina</h1>
          </div>
          <p className="text-gray-400">
            {activeOrders.length} pedido(s) activo(s)
          </p>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeOrders.map(order => (
            <div
              key={order.id}
              className="bg-gray-800 rounded-xl shadow-lg border-2 border-gray-700 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-amber-400 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    PEDIDO #{order.orderNumber ?? order.id}
                  </span>
                  <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {getFormattedTime(order.createdAt)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="font-semibold text-white mb-4">
                  {order.customerName}
                </h3>

                {/* Items */}
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-amber-400 mb-3">Productos:</h4>
                  <ul className="space-y-2">
                    {order.items.map((item, index) => (
                      <li key={index} className="flex justify-between text-white">
                        <span className="text-base">{item.quantity}x {item.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Observations */}
                {order.observations && (
                  <div className="bg-amber-900 bg-opacity-30 border border-amber-600 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-amber-400 mb-2">⚠️ Observaciones:</h4>
                    <p className="text-white text-base">{order.observations}</p>
                  </div>
                )}

                {/* Delivery Person Input - Only show when status is preparing */}
                {order.status === 'preparing' && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-amber-400 mb-2">
                      🛵 Domiciliario:
                    </label>
                    <input
                      type="text"
                      value={deliveryPersons[order.id] || order.deliveryPerson || ''}
                      onChange={(e) => handleDeliveryPersonChange(order.id, e.target.value)}
                      placeholder="Nombre del domiciliario"
                      className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none text-base"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 mt-6">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => handleMarkReady(order.id)}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg"
                    >
                      <Check className="w-6 h-6" />
                      Listo
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => handleSendToRoute(order.id)}
                      className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg"
                    >
                      <Truck className="w-6 h-6" />
                      Enviar a Domicilio
                    </button>
                  )}
                  
                  {/* Print Button */}
                  <PrintTicket order={order} />
                </div>
              </div>
            </div>
          ))}

          {activeOrders.length === 0 && (
            <div className="col-span-full text-center py-16">
              <ChefHat className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No hay pedidos en preparación</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}