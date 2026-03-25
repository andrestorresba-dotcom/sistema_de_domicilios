import { useState } from 'react';
import { useNavigate } from 'react-router';
import { orderStore, OrderItem, PaymentMethod } from '../lib/orderStore';
import { zones } from '../lib/zones';
import { Plus, Trash2, Upload, CheckCircle } from 'lucide-react';

export function NewOrder() {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedZone, setSelectedZone] = useState('Centro');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [observations, setObservations] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [items, setItems] = useState<OrderItem[]>([
    { name: '', quantity: 1, price: 0 }
  ]);

  const deliveryFee = zones.find(z => z.name === selectedZone)?.fee || 0;
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal + deliveryFee;

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !phone || !address) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    const validItems = items.filter(item => item.name.trim() !== '' && item.price > 0);
    if (validItems.length === 0) {
      alert('Agregue al menos un producto al pedido');
      return;
    }

    orderStore.addOrder({
      customerName,
      phone,
      address,
      items: validItems,
      deliveryFee,
      total,
      paymentMethod,
      status: 'pending',
      observations,
      zone: selectedZone,
      paymentProofFile: paymentProofFile || undefined
    });

    alert('Pedido creado exitosamente');
    navigate('/');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProofFile(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h2 className="font-bold text-gray-900">Nuevo Pedido</h2>
        <p className="text-sm text-gray-600">Registre un nuevo pedido manualmente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Información del Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                placeholder="Ej: María González"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                placeholder="Ej: 3001234567"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                placeholder="Ej: Calle 45 #23-10, Barrio Centro"
                required
              />
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Productos del Pedido</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Agregar Producto
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    placeholder="Nombre del producto"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    placeholder="Cant."
                    min="1"
                  />
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => updateItem(index, 'price', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    placeholder="Precio"
                    min="0"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Zone */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Zona de Domicilio</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {zones.map(zone => (
              <button
                key={zone.name}
                type="button"
                onClick={() => setSelectedZone(zone.name)}
                className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                  selectedZone === zone.name
                    ? 'border-amber-400 bg-amber-50 text-gray-900'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">{zone.name}</div>
                <div className="text-xs text-gray-600">${zone.fee.toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Método de Pago</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`px-6 py-4 rounded-lg border-2 transition-colors ${
                paymentMethod === 'cash'
                  ? 'border-amber-400 bg-amber-50 text-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold">Efectivo</div>
              <div className="text-sm text-gray-600">Pago contra entrega</div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('transfer')}
              className={`px-6 py-4 rounded-lg border-2 transition-colors ${
                paymentMethod === 'transfer'
                  ? 'border-amber-400 bg-amber-50 text-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold">Transferencia</div>
              <div className="text-sm text-gray-600">Nequi / Bancolombia</div>
            </button>
          </div>

          {paymentMethod === 'transfer' && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Datos para Transferencia</h4>
              <div className="space-y-1.5 text-sm text-gray-700 bg-white p-3 rounded-lg">
                <p className="flex justify-between"><strong>Nequi:</strong> <span className="font-mono">3012714822</span></p>
                <p className="flex justify-between"><strong>Cuenta Bancolombia:</strong> <span className="font-mono">941-22465921</span></p>
                <p className="flex justify-between"><strong>Daviplata:</strong> <span className="font-mono">3118020331</span></p>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subir Comprobante (opcional)
                </label>
                <input
                  type="file"
                  id="paymentProof"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="paymentProof"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm cursor-pointer"
                >
                  {paymentProofFile ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-600">{paymentProofFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Seleccionar Archivo
                    </>
                  )}
                </label>
                {paymentProofFile && (
                  <button
                    type="button"
                    onClick={() => setPaymentProofFile(null)}
                    className="mt-2 text-xs text-red-600 hover:text-red-700"
                  >
                    Eliminar archivo
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Observations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Observaciones</h3>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            placeholder="Ej: Sin cebolla, tocar timbre, etc."
            rows={3}
          />
        </div>

        {/* Total Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Resumen del Pedido</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Domicilio ({selectedZone})</span>
              <span className="font-medium text-gray-900">${deliveryFee.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-amber-600">${total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Crear Pedido
          </button>
        </div>
      </form>
    </div>
  );
}