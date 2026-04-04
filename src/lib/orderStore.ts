import { db } from './firebase'; // Importamos tu conexión
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';

export type OrderStatus = 'pending' | 'preparing' | 'in-route' | 'delivered';

// Función helper para convertir timestamps de Firebase a Date
export const getDateFromTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp) {
    return new Date(timestamp);
  }
  return new Date();
};

// Función helper para obtener hora formateada
export const getFormattedTime = (timestamp: any): string => {
  try {
    const date = getDateFromTimestamp(timestamp);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Sin hora';
  }
};

// Función helper para obtener fecha formateada
export const getFormattedDate = (timestamp: any): string => {
  try {
    const date = getDateFromTimestamp(timestamp);
    return date.toLocaleDateString('es-CO');
  } catch {
    return 'Sin fecha';
  }
};

export const formatCurrency = (value: any): string => {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0';
  return amount.toLocaleString('es-CO');
};

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber?: number | string;
  createdAt: Date | any;
  status: OrderStatus;
  total: number;
  paymentMethod: 'cash' | 'transfer';
  items: OrderItem[];
  [key: string]: any;
}

const collectionRef = collection(db, 'pedidos');

let ordersState: Order[] = [];
const subscribers: Array<() => void> = [];

export const orderStore = {
  getOrders(): Order[] {
    return ordersState;
  },
  setOrders(orders: Order[]): void {
    ordersState = orders;
    subscribers.forEach(callback => callback());
  },
  subscribe(callback: () => void): () => void {
    subscribers.push(callback);
    return () => {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  },
  async updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      console.error("Error al actualizar estado del pedido:", error);
    }
  },
  async updatePaymentMethod(orderId: string, paymentMethod: 'cash' | 'transfer'): Promise<void> {
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      await updateDoc(orderRef, { paymentMethod });
    } catch (error) {
      console.error("Error al actualizar método de pago:", error);
    }
  },
  async setDeliveryPerson(orderId: string, deliveryPerson: string): Promise<void> {
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      await updateDoc(orderRef, { deliveryPerson });
    } catch (error) {
      console.error("Error al asignar domiciliario:", error);
    }
  },
  async deleteOrder(orderId: string): Promise<void> {
    try {
      const orderRef = doc(db, 'pedidos', orderId);
      await deleteDoc(orderRef);
    } catch (error) {
      console.error("Error al eliminar pedido:", error);
    }
  }
};

// 1. ESCUCHAR PEDIDOS (Para que aparezcan en el Tablero automáticamente)
export const subscribeToOrders = (setOrders: (orders: Order[]) => void) => {
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const ordersData: Order[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Order));
    orderStore.setOrders(ordersData);
    setOrders(ordersData);
  });
};

// 2. CREAR NUEVO PEDIDO (Con consecutivo PED-0000)
export const createOrder = async (order: Partial<Order>) => {
  const counterRef = doc(db, 'config', 'counters');
  
  try {
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists()) {
        throw new Error("El documento 'config/counters' no existe en Firestore.");
      }

      // 1. Obtener el número actual y sumar 1
      const currentNumber = counterDoc.data().lastOrderNumber || 0;
      const nextNumber = currentNumber + 1;

      // 2. Formatear el ID (ej: PED-0001)
      const formattedId = `PED-${nextNumber.toString().padStart(4, '0')}`;
      
      // 3. Crear la referencia del nuevo pedido con ese ID manual
      const newOrderRef = doc(db, 'pedidos', formattedId);

      // 4. Actualizar el contador en la DB
      transaction.update(counterRef, { lastOrderNumber: nextNumber });

      // 5. Guardar el pedido
      transaction.set(newOrderRef, {
        ...order,
        orderNumber: nextNumber, // Guardamos el número para ordenar
        displayId: formattedId,  // El ID bonito para mostrar
        createdAt: serverTimestamp(),
        status: 'pending'
      });
    });
    
    console.log("Pedido creado con éxito");
  } catch (error) {
    console.error("Error al crear pedido con consecutivo:", error);
    throw error;
  }
};