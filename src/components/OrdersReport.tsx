import { useMemo, useState } from 'react';
import { useOrders } from '../lib/hooks';
import { Order } from '../lib/orderStore';
import { FileText, Search, Download, Filter } from 'lucide-react';

export function OrdersReport() {
  const orders = useOrders();
  const [filter, setFilter] = useState<'today' | 'month' | 'all'>('today');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let filtered = orders;

    // Filter by time period
    if (filter === 'today') {
      filtered = orders.filter(o => o.createdAt >= today);
    } else if (filter === 'month') {
      filtered = orders.filter(o => o.createdAt >= thisMonth);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(o => 
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.phone.includes(searchTerm) ||
        o.orderNumber.toString().includes(searchTerm)
      );
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [orders, filter, searchTerm]);

  const getStatusLabel = (status: Order['status']) => {
    const labels = {
      'pending': 'Pendiente',
      'preparing': 'En Preparación',
      'in-route': 'En Ruta',
      'delivered': 'Entregado'
    };
    return labels[status];
  };

  const getStatusColor = (status: Order['status']) => {
    const colors = {
      'pending': 'bg-gray-100 text-gray-800',
      'preparing': 'bg-blue-100 text-blue-800',
      'in-route': 'bg-amber-100 text-amber-800',
      'delivered': 'bg-green-100 text-green-800'
    };
    return colors[status];
  };

  const exportToCSV = () => {
    const headers = ['#', 'Fecha', 'Cliente', 'Teléfono', 'Dirección', 'Zona', 'Productos', 'Subtotal', 'Domicilio', 'Total', 'Pago', 'Estado', 'Domiciliario', 'Entregado'];
    const rows = filteredOrders.map(order => [
      order.orderNumber,
      order.createdAt.toLocaleString('es-CO'),
      order.customerName,
      order.phone,
      order.address,
      order.zone || 'N/A',
      order.items.map(i => `${i.name} (${i.quantity})`).join('; '),
      order.total - order.deliveryFee,
      order.deliveryFee,
      order.total,
      order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia',
      getStatusLabel(order.status),
      order.deliveryPerson || 'N/A',
      order.deliveredAt ? order.deliveredAt.toLocaleString('es-CO') : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalSales = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalDeliveryFees = filteredOrders.reduce((sum, o) => sum + o.deliveryFee, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h2 className="font-bold text-gray-900">Desglose Detallado de Pedidos</h2>
        <p className="text-sm text-gray-600">Historial completo con toda la información</p>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Filter Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'today'
                  ? 'bg-amber-400 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hoy ({orders.filter(o => {
                const today = new Date();
                const orderDate = new Date(o.createdAt);
                return orderDate.toDateString() === today.toDateString();
              }).length})
            </button>
            <button
              onClick={() => setFilter('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'month'
                  ? 'bg-amber-400 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Este Mes ({orders.filter(o => {
                const now = new Date();
                const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return o.createdAt >= thisMonth;
              }).length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-amber-400 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos ({orders.length})
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o #pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
          <p className="text-sm opacity-90 mb-1">Total Pedidos</p>
          <p className="text-2xl font-bold">{filteredOrders.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 text-white">
          <p className="text-sm opacity-90 mb-1">Total Ventas</p>
          <p className="text-2xl font-bold">${totalSales.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg shadow-lg p-4 text-white">
          <p className="text-sm opacity-90 mb-1">Total Domicilios</p>
          <p className="text-2xl font-bold">${totalDeliveryFees.toLocaleString()}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Fecha/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Dirección</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Zona</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Productos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Pago</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Domiciliario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay pedidos para mostrar</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        #{order.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span className="font-medium">{order.createdAt.toLocaleDateString('es-CO')}</span>
                        <span className="text-xs text-gray-500">{order.createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={order.address}>
                      {order.address}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.zone || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between gap-2">
                            <span className="text-xs">{item.name}</span>
                            <span className="text-xs text-gray-500">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      ${order.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">
                        {order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {order.deliveryPerson || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Summary */}
      {filteredOrders.length > 0 && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Subtotal Productos</p>
              <p className="font-semibold text-gray-900">${(totalSales - totalDeliveryFees).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600">Subtotal Domicilios</p>
              <p className="font-semibold text-gray-900">${totalDeliveryFees.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600">Total General</p>
              <p className="font-semibold text-amber-600 text-lg">${totalSales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600">Ticket Promedio</p>
              <p className="font-semibold text-gray-900">
                ${filteredOrders.length > 0 ? Math.round(totalSales / filteredOrders.length).toLocaleString() : '0'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
