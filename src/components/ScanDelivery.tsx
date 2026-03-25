import { useState } from 'react';
import { orderStore } from '../lib/orderStore';
import { ScanLine, CheckCircle, AlertCircle } from 'lucide-react';

export function ScanDelivery() {
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const num = parseInt(orderNumber);
    if (isNaN(num)) {
      setMessage({ type: 'error', text: 'Por favor ingrese un número de pedido válido' });
      return;
    }

    const order = orderStore.getOrderByNumber(num);
    
    if (!order) {
      setMessage({ type: 'error', text: `No se encontró el pedido #${num}` });
      return;
    }

    if (order.status === 'delivered') {
      setMessage({ type: 'error', text: `El pedido #${num} ya fue entregado` });
      return;
    }

    orderStore.updateOrderStatus(order.id, 'delivered');
    setMessage({ type: 'success', text: `✅ Pedido #${num} marcado como entregado` });
    setOrderNumber('');

    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-amber-100 rounded-full p-4">
              <ScanLine className="w-12 h-12 text-amber-600" />
            </div>
          </div>
          <h2 className="font-bold text-gray-900 mb-2">Escanear / Entrega</h2>
          <p className="text-sm text-gray-600">
            Ingrese el número de pedido para marcar como entregado
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Pedido
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-center font-mono"
              placeholder="Ej: 56"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-6 h-6" />
            Marcar como Entregado
          </button>
        </form>

        {/* Message */}
        {message && (
          <div
            className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p
              className={`font-medium ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Quick Reference */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Referencia Rápida</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-900 mb-1">Método 1</div>
              <div className="text-gray-600">Escribir número manualmente</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-900 mb-1">Método 2</div>
              <div className="text-gray-600">Escanear código de barras</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
