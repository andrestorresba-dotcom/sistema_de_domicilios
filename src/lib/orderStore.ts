export type OrderStatus = 'pending' | 'preparing' | 'in-route' | 'delivered';
export type PaymentMethod = 'cash' | 'transfer';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  observations: string;
  paymentProof?: string;
  paymentProofFile?: File;
  createdAt: Date;
  deliveryPerson?: string;
  deliveredAt?: Date;
  zone?: string;
}

// Mock data
const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 56,
    customerName: 'María González',
    phone: '3001234567',
    address: 'Calle 45 #23-10, Barrio Centro',
    items: [
      { name: '1 Pollo Entero Asado', quantity: 1, price: 35000 },
      { name: 'Gaseosa 1.5L', quantity: 1, price: 5000 }
    ],
    deliveryFee: 3000,
    total: 43000,
    paymentMethod: 'cash',
    status: 'pending',
    observations: 'Sin cebolla',
    createdAt: new Date('2026-03-17T10:30:00')
  },
  {
    id: '2',
    orderNumber: 57,
    customerName: 'Carlos Pérez',
    phone: '3109876543',
    address: 'Carrera 15 #67-89, Barrio Norte',
    items: [
      { name: 'Pollo Broaster (8 piezas)', quantity: 1, price: 28000 },
      { name: 'Papas Fritas Grande', quantity: 1, price: 8000 }
    ],
    deliveryFee: 4000,
    total: 40000,
    paymentMethod: 'transfer',
    status: 'preparing',
    observations: '',
    createdAt: new Date('2026-03-17T11:00:00')
  },
  {
    id: '3',
    orderNumber: 58,
    customerName: 'Ana Martínez',
    phone: '3201237890',
    address: 'Avenida 30 #12-45, Barrio Sur',
    items: [
      { name: 'Almuerzo del Día', quantity: 2, price: 24000 },
      { name: 'Jugo Natural', quantity: 2, price: 6000 }
    ],
    deliveryFee: 3500,
    total: 33500,
    paymentMethod: 'cash',
    status: 'in-route',
    observations: 'Tocar timbre',
    createdAt: new Date('2026-03-17T11:15:00')
  },
  {
    id: '4',
    orderNumber: 59,
    customerName: 'Jorge Ramírez',
    phone: '3157894561',
    address: 'Calle 78 #34-21, Barrio Este',
    items: [
      { name: '1/2 Pollo Asado', quantity: 2, price: 38000 }
    ],
    deliveryFee: 5000,
    total: 43000,
    paymentMethod: 'transfer',
    status: 'delivered',
    observations: '',
    createdAt: new Date('2026-03-17T09:45:00')
  },
  {
    id: '5',
    orderNumber: 60,
    customerName: 'Laura Sánchez',
    phone: '3004567890',
    address: 'Carrera 8 #90-12, Barrio Oeste',
    items: [
      { name: 'Pollo Broaster (12 piezas)', quantity: 1, price: 38000 },
      { name: 'Gaseosa 2L', quantity: 1, price: 6000 }
    ],
    deliveryFee: 4500,
    total: 48500,
    paymentMethod: 'cash',
    status: 'pending',
    observations: 'Llamar al llegar',
    createdAt: new Date('2026-03-17T11:30:00')
  }
];

class OrderStore {
  private orders: Order[] = [...mockOrders];
  private listeners: Set<() => void> = new Set();
  private nextOrderNumber = 61;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  getOrders(): Order[] {
    return this.orders;
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find(order => order.id === id);
  }

  getOrderByNumber(orderNumber: number): Order | undefined {
    return this.orders.find(order => order.orderNumber === orderNumber);
  }

  addOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Order {
    const newOrder: Order = {
      ...orderData,
      id: Date.now().toString(),
      orderNumber: this.nextOrderNumber++,
      createdAt: new Date()
    };
    this.orders.unshift(newOrder);
    this.notify();
    return newOrder;
  }

  updateOrderStatus(id: string, status: OrderStatus) {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      if (status === 'delivered') {
        order.deliveredAt = new Date();
      }
      this.notify();
    }
  }

  updateOrder(id: string, updates: Partial<Order>) {
    const index = this.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      this.orders[index] = { ...this.orders[index], ...updates };
      this.notify();
    }
  }

  setDeliveryPerson(id: string, deliveryPerson: string) {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.deliveryPerson = deliveryPerson;
      this.notify();
    }
  }

  deleteOrder(id: string) {
    const index = this.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      this.orders.splice(index, 1);
      this.notify();
    }
  }
}

export const orderStore = new OrderStore();