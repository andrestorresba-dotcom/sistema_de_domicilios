import { useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { Order, OrderItem, orderStore } from '../lib/orderStore';

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
}

export function EditOrderModal({ order, onClose }: EditOrderModalProps) {
  const [customerName, setCustomerName] = useState(order.customerName || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [address, setAddress] = useState(order.address || '');
  const [observations, setObservations] = useState(order.observations || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>(order.paymentMethod || 'cash');
  const [deliveryFee, setDeliveryFee] = useState<number>(Number(order.deliveryFee) || 0);
  const [items, setItems] = useState<OrderItem[]>(order.items ? [...order.items] : []);
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  const total = subtotal + (Number(deliveryFee) || 0);

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }
    if (items.length === 0) {
      alert('El pedido debe tener al menos un producto');
      return;
    }

    setSaving(true);
    try {
      await orderStore.updateOrder(order.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        observations: observations.trim(),
        paymentMethod,
        deliveryFee: Number(deliveryFee) || 0,
        items,
        total,
      });
      onClose();
    } catch (error) {
      alert('Ocurrió un error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Editar Pedido</h2>
            <p className="text-gray-700 text-sm">#{order.orderNumber ?? order.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-900" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Cliente</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Dirección</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">Productos</label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar producto
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    placeholder="Producto"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-center"
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 bg-red-50 hover:bg-red-100 rounded-md"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No hay productos, agrega uno</p>
              )}
            </div>
          </div>

          {/* Domicilio y pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Valor Domicilio</label>
              <input
                type="number"
                min={0}
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 rounded-lg border-2 text-sm font-semibold ${paymentMethod === 'cash' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-500'}`}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`py-2 rounded-lg border-2 text-sm font-semibold ${paymentMethod === 'transfer' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-500'}`}
                >
                  Transferencia
                </button>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Total */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200 flex items-center justify-between">
            <span className="font-bold text-gray-900">TOTAL:</span>
            <span className="font-bold text-gray-900 text-xl">${total.toLocaleString('es-CO')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}