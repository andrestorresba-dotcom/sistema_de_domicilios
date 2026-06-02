import { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, Edit3 } from 'lucide-react';
import { tableStore, TableItem, menuItems, editableMenuItems, TableOrder } from './lib/tableStore';
import { PrintTableTicket } from './components/PrintTableTicket';

interface TableOrderModalProps {
  tableNumber: number;
  floor: number;
  onClose: () => void;
}

export function TableOrderModal({ tableNumber, floor, onClose }: TableOrderModalProps) {
  const [waiterName, setWaiterName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [items, setItems] = useState<TableItem[]>([]);
  const [observations, setObservations] = useState('');
  const [currentOrder, setCurrentOrder] = useState<TableOrder | null>(null);
  const [showEditableModal, setShowEditableModal] = useState(false);
  const [selectedEditableItem, setSelectedEditableItem] = useState<typeof editableMenuItems[0] | null>(null);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customNote, setCustomNote] = useState('');

  useEffect(() => {
    const existingOrder = tableStore.getTableOrder(tableNumber);
    if (existingOrder) {
      setCurrentOrder(existingOrder);
      setWaiterName(existingOrder.waiterName);
      setItems([...existingOrder.items]);
      setObservations(existingOrder.observations || '');
    }
  }, [tableNumber]);

  const categories = ['Todos', ...Array.from(new Set(menuItems.map(item => item.category)))];

  const filteredMenuItems = selectedCategory === 'Todos' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleAddItem = (menuItem: typeof menuItems[0]) => {
    const existingItem = items.find(item => item.name === menuItem.name);

    if (existingItem) {
      setItems(items.map(item =>
        item.name === menuItem.name
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setItems([...items, {
        name: menuItem.name,
        quantity: 1,
        price: menuItem.price
      }]);
    }
  };

  const handleOpenEditableModal = (editableItem: typeof editableMenuItems[0]) => {
    setSelectedEditableItem(editableItem);
    setCustomName(editableItem.name);
    setCustomPrice(editableItem.price.toString());
    setCustomNote('');
    setShowEditableModal(true);
  };

  const handleAddEditableItem = () => {
    if (!customName.trim()) {
      alert('Por favor ingresa un nombre');
      return;
    }

    const price = parseInt(customPrice);
    if (isNaN(price) || price <= 0) {
      alert('Por favor ingresa un precio válido');
      return;
    }

    let itemName = customName;
    if (customNote.trim()) {
      itemName = `${customName} (${customNote.trim()})`;
    }

    setItems([...items, {
      name: itemName,
      quantity: 1,
      price: price,
      customNote: customNote.trim() || undefined
    }]);

    setShowEditableModal(false);
    setSelectedEditableItem(null);
    setCustomName('');
    setCustomPrice('');
    setCustomNote('');
  };

  const handleUpdateQuantity = (itemName: string, delta: number) => {
    setItems(items.map(item => {
      if (item.name === itemName) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleRemoveItem = (itemName: string) => {
    setItems(items.filter(item => item.name !== itemName));
  };

  const handleSaveOrder = () => {
    if (!waiterName.trim()) {
      alert('Por favor ingresa el nombre del mesero');
      return;
    }

    if (items.length === 0) {
      alert('Por favor agrega al menos un producto');
      return;
    }

    const orderData = {
      tableNumber,
      floor,
      waiterName: waiterName.trim(),
      items,
      total,
      observations: observations.trim()
    };

    if (currentOrder) {
      tableStore.updateOrder(tableNumber, orderData);
    } else {
      tableStore.createOrder(orderData);
    }

    onClose();
  };

  const handleCompleteOrder = () => {
    if (window.confirm('¿Deseas marcar esta mesa como pagada y completar el pedido?')) {
      tableStore.completeOrder(tableNumber);
      onClose();
    }
  };

  const handleCancelOrder = () => {
    if (window.confirm('¿Estás seguro de cancelar este pedido?')) {
      tableStore.cancelOrder(tableNumber);
      onClose();
    }
  };

  const orderForPrint: TableOrder | null = currentOrder ? {
    ...currentOrder,
    waiterName,
    items,
    total,
    observations
  } : (waiterName && items.length > 0) ? {
    id: Date.now().toString(),
    tableNumber,
    floor,
    waiterName,
    items,
    total,
    observations,
    status: 'occupied',
    createdAt: new Date()
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Mesa #{tableNumber} - Piso {floor}
            </h2>
            <p className="text-gray-700">
              {currentOrder ? 'Actualizar pedido' : 'Nuevo pedido'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-900" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Menu */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre del Mesero
                </label>
                <input
                  type="text"
                  value={waiterName}
                  onChange={(e) => setWaiterName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Category Filter */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Categoría
                </label>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === category
                          ? 'bg-amber-400 text-gray-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Menú</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredMenuItems.map(item => (
                    <button
                      key={item.name}
                      onClick={() => handleAddItem(item)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-amber-50 rounded-lg transition-colors border border-gray-200 hover:border-amber-300"
                    >
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">
                          ${item.price.toLocaleString('es-CO')}
                        </span>
                        <Plus className="w-5 h-5 text-amber-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Items */}
              <div className="space-y-2 mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Items Personalizables</h3>
                <div className="grid grid-cols-1 gap-2">
                  {editableMenuItems
                    .filter(item =>
                      selectedCategory === 'Todos' || item.category === selectedCategory
                    )
                    .map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleOpenEditableModal(item)}
                        className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 hover:border-blue-400"
                      >
                        <div className="text-left">
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {item.name}
                            <Edit3 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.needsFlavor && 'Especificar sabor • '}
                            {item.needsDescription && 'Especificar tipo • '}
                            {item.isCustomizable && 'Precio editable • '}
                            {item.category}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            ${item.price.toLocaleString('es-CO')}
                          </span>
                          <Plus className="w-5 h-5 text-blue-600" />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Resumen del Pedido</h3>
              
              {items.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">No hay productos agregados</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Selecciona productos del menú
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-600">
                          ${item.price.toLocaleString('es-CO')} × {item.quantity}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.name, -1)}
                          className="p-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          <Minus className="w-4 h-4 text-gray-700" />
                        </button>
                        <span className="w-8 text-center font-semibold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.name, 1)}
                          className="p-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          <Plus className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>

                      <div className="font-semibold text-gray-900 w-24 text-right">
                        ${(item.price * item.quantity).toLocaleString('es-CO')}
                      </div>

                      <button
                        onClick={() => handleRemoveItem(item.name)}
                        className="p-2 bg-red-50 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Observations */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ej: Sin sal, extra picante..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>

              {/* Total */}
              <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-lg">TOTAL:</span>
                  <span className="font-bold text-gray-900 text-2xl">
                    ${total.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleSaveOrder}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {currentOrder ? 'Actualizar Pedido' : 'Guardar Pedido'}
                </button>

                {currentOrder && (
                  <PrintTableTicket order={currentOrder} />
                )}

                {currentOrder && (
                  <button
                    onClick={handleCompleteOrder}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Completar y Pagar
                  </button>
                )}

                {currentOrder && (
                  <button
                    onClick={handleCancelOrder}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Cancelar Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Item Modal */}
      {showEditableModal && selectedEditableItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="bg-gradient-to-r from-blue-400 to-blue-500 px-6 py-4 rounded-t-xl">
              <h3 className="text-xl font-bold text-white">
                {selectedEditableItem.name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {!selectedEditableItem.isCustomizable && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    value={customName}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              )}

              {selectedEditableItem.isCustomizable && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre del Almuerzo
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ej: Arroz con pollo"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}

              {(selectedEditableItem.needsFlavor || selectedEditableItem.needsDescription) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {selectedEditableItem.needsFlavor && 'Sabor'}
                    {selectedEditableItem.needsDescription && '¿Qué principio?'}
                  </label>
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder={
                      selectedEditableItem.needsFlavor
                        ? 'Ej: Coca Cola'
                        : 'Ej: Papa criolla'
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Precio {selectedEditableItem.isCustomizable && '(Editable)'}
                </label>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  readOnly={!selectedEditableItem.isCustomizable}
                  className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    !selectedEditableItem.isCustomizable ? 'bg-gray-50' : ''
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditableModal(false);
                    setSelectedEditableItem(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddEditableItem}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
