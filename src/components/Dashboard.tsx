import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import { Order, OrderStatus } from '../lib/orderStore';

export function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Escucha en tiempo real de la colección 'pedidos' de Firebase
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
      {/* Header con Logo */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src="/src/assets/f9bf657c82e7c182c31f3345965439fef56d541e.png" 
            alt="Logo" 
            className="h-24 w-auto"
          />
          <div>
            <h2 className="font-bold text-2xl text-gray-900">Tablero de Pedidos</h2>
            <p className="text-sm text-gray-600">Vista general del estado de todos los pedidos.</p>
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
                  No hay pedidos {column.status}
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