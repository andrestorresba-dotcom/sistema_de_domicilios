import { useState } from 'react';
import { useOrders } from '../lib/hooks';
import { orderStore } from '../lib/orderStore';
import { Truck, MapPin, DollarSign, CreditCard, Search, CheckCircle } from 'lucide-react';

export function DeliveryView() {
  const orders = useOrders();
  const [searchQuery, setSearchQuery] = useState('');

  const deliveryOrders = orders.filter(o => o.status === 'in-route');

  const filteredOrders = deliveryOrders.filter(order => {
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toString().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.address.toLowerCase().includes(query)
    );
  });

  const handleMarkDelivered = (orderId: string) => {
    if (confirm('¿Confirmar entrega del pedido?')) {
      orderStore.updateOrderStatus(orderId, 'delivered');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-8 h-8 text-amber-400" />
          <div>
            <h2 className="font-bold text-gray-900">Vista de Domicilios</h2>
            <p className="text-sm text-gray-600">
              {deliveryOrders.length} pedido(s) en ruta
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número de pedido, cliente o dirección..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map(order => (
          <div
            key={order.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left Side - Order Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-base font-bold bg-amber-400 text-gray-900">
                    #{order.orderNumber}
                  </span>
                  <h3 className="font-semibold text-gray-900">{order.customerName}</h3>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.address}</p>
                    <p className="text-sm text-gray-600">Tel: {order.phone}</p>
                  </div>
                </div>

                {/* Payment & Delivery Fee */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">
                      {order.paymentMethod === 'cash' ? (
                        <span className="font-medium text-green-600">💵 Efectivo: ${order.total.toLocaleString()}</span>
                      ) : (
                        <span className="font-medium text-blue-600">💳 Transferencia (Pagado)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">
                      Domicilio: <span className="font-medium">${order.deliveryFee.toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">Pedido:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {order.items.map((item, index) => (
                      <li key={index}>• {item.quantity}x {item.name}</li>
                    ))}
                  </ul>
                </div>

                {/* Observations */}
                {order.observations && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>⚠️ Obs:</strong> {order.observations}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Side - Action Button */}
              <div className="md:w-48">
                <button
                  onClick={() => handleMarkDelivered(order.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Entregado
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchQuery ? 'No se encontraron pedidos con esa búsqueda' : 'No hay pedidos en ruta'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
