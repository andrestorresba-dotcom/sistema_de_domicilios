import { Order, orderStore, getFormattedTime } from '../lib/orderStore';
import { MapPin, DollarSign, CreditCard, Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface OrderCardProps {
  order: Order;
  onClick: () => void;
}

export function OrderCard({ order, onClick }: OrderCardProps) {
  const [deliveryPerson, setDeliveryPerson] = useState(order.deliveryPerson || '');
  const [showDeliveryInput, setShowDeliveryInput] = useState(false);

  const handlePrepare = (e: React.MouseEvent) => {
    e.stopPropagation();
    orderStore.updateOrderStatus(order.id, 'preparing');
  };

  const handleSendToRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deliveryPerson.trim()) {
      orderStore.setDeliveryPerson(order.id, deliveryPerson.trim());
    }
    orderStore.updateOrderStatus(order.id, 'in-route');
    setShowDeliveryInput(false);
  };

  const handleMarkDelivered = (e: React.MouseEvent) => {
    e.stopPropagation();
    orderStore.updateOrderStatus(order.id, 'delivered');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`¿Está seguro de eliminar el pedido #${order.orderNumber ?? order.id}?`)) {
      orderStore.deleteOrder(order.id);
    }
  };

  const itemsSummary = order.items.slice(0, 2).map(item => item.name).join(', ');
  const hasMoreItems = order.items.length > 2;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-400 text-gray-900">
          #{order.orderNumber ?? order.id}
        </span>
        <span className="text-xs text-gray-500">
          <Clock className="w-3 h-3 inline mr-1" />
          {getFormattedTime(order.createdAt)}
        </span>
      </div>

      {/* Customer Info */}
      {/* Customer Info */}
<h4 className="font-semibold text-gray-900 mb-1">
  {order.customerName}
</h4>

{order.deliveryPerson && (
  <div className="mb-2">
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
      🛵 {order.deliveryPerson}
    </span>
  </div>
)}
      
      
      {/* Items Summary */}
      <p className="text-sm text-gray-600 mb-2">
        {itemsSummary}
        {hasMoreItems && <span className="text-amber-600"> +{order.items.length - 2} más</span>}
      </p>

      {/* Address */}
      <div className="flex items-start gap-2 mb-3">
        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600 line-clamp-2">{order.address}</p>
      </div>

      {/* Payment & Total */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <CreditCard className="w-3 h-3" />
          {order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
        </div>
        <div className="flex items-center gap-1 font-semibold text-gray-900">
          <DollarSign className="w-4 h-4" />
          ${order.total.toLocaleString()}
        </div>
      </div>

      {/* Delivery Person Input for preparing status */}
      {order.status === 'preparing' && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            🛵 Domiciliario:
          </label>
          <input
            type="text"
            value={deliveryPerson}
            onChange={(e) => setDeliveryPerson(e.target.value)}
            placeholder="Nombre del domiciliario"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {order.status === 'pending' && (
          <button
            onClick={handlePrepare}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Preparar
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={handleSendToRoute}
            className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Enviar a Domicilio
          </button>
        )}
        {order.status === 'in-route' && (
          <button
            onClick={handleMarkDelivered}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            Marcar como Entregado
          </button>
        )}
        <button
          onClick={handleDelete}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}