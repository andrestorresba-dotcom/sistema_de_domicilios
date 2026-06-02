import { useMemo, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Order, getDateFromTimestamp } from '../lib/orderStore';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Calendar, CreditCard, Package, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export function Statistics() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firebaseOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      setOrders(firebaseOrders);
    }, (error) => {
      console.error("Error al obtener pedidos:", error);
    });

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter orders by date
    const todayOrders = orders.filter(o => getDateFromTimestamp(o.createdAt) >= today);
    const monthOrders = orders.filter(o => getDateFromTimestamp(o.createdAt) >= thisMonth);
    const deliveredOrders = orders.filter(o => o.status === 'delivered');

    // Daily stats
    const dailySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const dailyOrderCount = todayOrders.length;
    const dailyDelivered = todayOrders.filter(o => o.status === 'delivered').length;

    // Monthly stats
    const monthlySales = monthOrders.reduce((sum, o) => sum + o.total, 0);
    const monthlyOrderCount = monthOrders.length;
    const monthlyDelivered = monthOrders.filter(o => o.status === 'delivered').length;

    // Payment methods
    const cashOrders = deliveredOrders.filter(o => o.paymentMethod === 'cash').length;
    const transferOrders = deliveredOrders.filter(o => o.paymentMethod === 'transfer').length;

    // Products stats
    const productStats = new Map<string, { count: number; revenue: number }>();
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        const current = productStats.get(item.name) || { count: 0, revenue: 0 };
        productStats.set(item.name, {
          count: current.count + item.quantity,
          revenue: current.revenue + item.price
        });
      });
    });

    const topProducts = Array.from(productStats.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Daily sales trend (last 7 days)
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayOrders = orders.filter(o => {
        const orderDate = getDateFromTimestamp(o.createdAt);
        return orderDate.toDateString() === date.toDateString() && o.status === 'delivered';
      });
      const sales = dayOrders.reduce((sum, o) => sum + o.total, 0);
      dailyTrend.push({
        date: date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
        sales: sales / 1000, // Convert to thousands
        orders: dayOrders.length
      });
    }

    // Orders by status
    const statusData = [
      { name: 'Pendientes', value: orders.filter(o => o.status === 'pending').length, color: '#9CA3AF' },
      { name: 'En Preparación', value: orders.filter(o => o.status === 'preparing').length, color: '#3B82F6' },
      { name: 'En Ruta', value: orders.filter(o => o.status === 'in-route').length, color: '#FBBF24' },
      { name: 'Entregados', value: orders.filter(o => o.status === 'delivered').length, color: '#10B981' }
    ];

    return {
      dailySales,
      dailyOrderCount,
      dailyDelivered,
      monthlySales,
      monthlyOrderCount,
      monthlyDelivered,
      cashOrders,
      transferOrders,
      topProducts,
      dailyTrend,
      statusData
    };
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h2 className="font-bold text-gray-900">Estadísticas y Reportes</h2>
        <p className="text-sm text-gray-600">Vista general de ventas y rendimiento</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Today's Sales */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Hoy</span>
          </div>
          <p className="font-bold text-white mb-1">${stats.dailySales.toLocaleString()}</p>
          <p className="text-sm opacity-90">{stats.dailyOrderCount} pedidos</p>
        </div>

        {/* Monthly Sales */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Este Mes</span>
          </div>
          <p className="font-bold text-white mb-1">${stats.monthlySales.toLocaleString()}</p>
          <p className="text-sm opacity-90">{stats.monthlyOrderCount} pedidos</p>
        </div>

        {/* Delivered Today */}
        <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Entregados Hoy</span>
          </div>
          <p className="font-bold text-white mb-1">{stats.dailyDelivered}</p>
          <p className="text-sm opacity-90">
            {stats.dailyOrderCount > 0 
              ? `${Math.round((stats.dailyDelivered / stats.dailyOrderCount) * 100)}%` 
              : '0%'} completados
          </p>
        </div>

        {/* Average Order */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Promedio</span>
          </div>
          <p className="font-bold text-white mb-1">
            ${stats.monthlyOrderCount > 0 
              ? Math.round(stats.monthlySales / stats.monthlyOrderCount).toLocaleString() 
              : '0'}
          </p>
          <p className="text-sm opacity-90">Por pedido</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Sales Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tendencia de Ventas (Últimos 7 Días)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFF', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => `$${(value * 1000).toLocaleString()}`}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line 
                type="monotone" 
                dataKey="sales" 
                name="Ventas (miles)" 
                stroke="#FBBF24" 
                strokeWidth={3}
                dot={{ fill: '#FBBF24', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de Pedidos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            Productos Más Vendidos
          </h3>
          {stats.topProducts.length > 0 ? (
            <div className="space-y-3">
              {stats.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.count} unidades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${product.revenue.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No hay datos disponibles</p>
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-500" />
            Métodos de Pago
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={[
                { name: 'Efectivo', value: stats.cashOrders },
                { name: 'Transferencia', value: stats.transferOrders }
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFF', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="value" name="Pedidos" fill="#FBBF24" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="mt-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-lg p-6 text-white">
        <h3 className="font-semibold mb-4">Resumen del Mes</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm opacity-80 mb-1">Total Ventas</p>
            <p className="font-bold">${stats.monthlySales.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm opacity-80 mb-1">Total Pedidos</p>
            <p className="font-bold">{stats.monthlyOrderCount}</p>
          </div>
          <div>
            <p className="text-sm opacity-80 mb-1">Entregados</p>
            <p className="font-bold">{stats.monthlyDelivered}</p>
          </div>
          <div>
            <p className="text-sm opacity-80 mb-1">Tasa de Éxito</p>
            <p className="font-bold">
              {stats.monthlyOrderCount > 0 
                ? `${Math.round((stats.monthlyDelivered / stats.monthlyOrderCount) * 100)}%` 
                : '0%'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}