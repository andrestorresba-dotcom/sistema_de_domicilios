export type TableStatus = 'available' | 'occupied' | 'reserved';

export interface TableItem {
  name: string;
  quantity: number;
  price: number;
  customNote?: string;
}

export interface MenuItem {
  name: string;
  price: number;
  category: string;
}

export interface EditableMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  needsFlavor?: boolean;
  needsDescription?: boolean;
  isCustomizable?: boolean;
}

export interface TableOrder {
  id: string;
  tableNumber: number;
  floor: number;
  waiterName: string;
  items: TableItem[];
  total: number;
  status: TableStatus;
  createdAt: Date;
  observations?: string;
}

// Menú del restaurante
export const menuItems: MenuItem[] = [
  { name: 'Promoción Pollo y Medio', price: 42000, category: 'Promociones' },
  { name: '1 Pollo Entero Asado', price: 32000, category: 'Pollo Asado' },
  { name: '1/2 Pollo Asado', price: 18000, category: 'Pollo Asado' },
  { name: '1/4 Pollo Asado', price: 12000, category: 'Pollo Asado' },
  { name: 'Pollo Broaster', price: 42000, category: 'Broaster' },
  { name: '1/2 Medio Broaster', price: 23000, category: 'Broaster' },
  { name: '1/4 Broaster', price: 14000, category: 'Broaster' },
  { name: 'Mojarra Frita', price: 22000, category: 'Almuerzos Especiales' },
  { name: 'Churrasquito', price: 23000, category: 'Almuerzos Especiales' },
  { name: 'Churrasco', price: 35000, category: 'Almuerzos Especiales' },
  { name: 'Lomo de Cerdo a la Plancha', price: 20000, category: 'Almuerzos Especiales' },
  { name: 'Pechuga a la Plancha', price: 22000, category: 'Almuerzos Especiales' },
  { name: 'Pechuga Gratinada', price: 26000, category: 'Almuerzos Especiales' },
  { name: 'Tabla Mixta', price: 23000, category: 'Almuerzos Especiales' },
  { name: 'Lomo de Cerdo Hawaiano', price: 26000, category: 'Almuerzos Especiales' },
  { name: 'Pechuga Hawaiana', price: 26000, category: 'Almuerzos Especiales' },
  { name: 'Lomo de Cerdo Ranchero', price: 26000, category: 'Almuerzos Especiales' },
  { name: 'Pechuga Ranchera', price: 26000, category: 'Almuerzos Especiales' },
  { name: 'Costillas en BBQ', price: 26000, category: 'Almuerzos Especiales' },
  { name: 'Arroz Mixto', price: 12000, category: 'Almuerzos Especiales' },
  { name: 'Viudo de Bocachico', price: 22000, category: 'Almuerzos Especiales' },
  { name: 'Bagre en Salsa', price: 22000, category: 'Almuerzos Especiales' },
  { name: 'Bandeja Paisa', price: 18000, category: 'Almuerzos Especiales' },
  { name: 'Plato Campestre', price: 25000, category: 'Almuerzos Especiales' },
  { name: 'Sancocho de Gallina Pierna', price: 17000, category: 'Almuerzos Especiales' },
  { name: 'Sancocho de Gallina Ala', price: 14000, category: 'Almuerzos Especiales' },
  { name: 'Sancocho de Pollo Pierna/Pernil', price: 17000, category: 'Almuerzos Especiales' },
  { name: 'Papas Casco', price: 7000, category: 'Acompañantes' },
  { name: 'Ensalada', price: 7000, category: 'Acompañantes' },
  { name: 'Papa Salada', price: 3000, category: 'Acompañantes' },
  { name: 'Arroz', price: 3000, category: 'Acompañantes' },
  { name: 'Ají', price: 500, category: 'Acompañantes' },
  { name: 'Patacónas', price: 5000, category: 'Acompañantes' },
  { name: 'Maduro', price: 2000, category: 'Acompañantes' },
  { name: 'Panceta', price: 7000, category: 'Acompañantes' },
  { name: 'Jugo del Día', price: 2000, category: 'Bebidas' },
  { name: 'Botella de Agua', price: 3000, category: 'Bebidas' },
  { name: 'Cerveza', price: 4000, category: 'Bebidas' },
];

// Items especiales con campos editables
export const editableMenuItems: EditableMenuItem[] = [
  { id: 'gaseosa-1.5L', name: 'Gaseosa 1.5L', price: 8000, category: 'Bebidas', needsFlavor: true },
  { id: 'gaseosa-personal', name: 'Gaseosa Personal', price: 4000, category: 'Bebidas', needsFlavor: true },
  { id: 'gaseosa-1L', name: 'Gaseosa 1L', price: 6000, category: 'Bebidas', needsFlavor: true },
  { id: 'gaseosa-2L', name: 'Gaseosa 2L', price: 10000, category: 'Bebidas', needsFlavor: true },
  { id: 'gaseosa-3L', name: 'Gaseosa 3L', price: 14000, category: 'Bebidas', needsFlavor: true },
  { id: 'principio', name: 'Principio', price: 5000, category: 'Acompañantes', needsDescription: true },
  { id: 'almuerzo-dia', name: 'Almuerzo del Día', price: 12000, category: 'Almuerzo del Día', isCustomizable: true },
];

class TableStore {
  private tables: Map<number, TableOrder | null> = new Map();
  private listeners: Set<() => void> = new Set();
  private orderHistory: TableOrder[] = [];

  constructor() {
    // Inicializar 42 mesas (22 en primer piso, 20 en segundo piso)
    for (let i = 1; i <= 42; i++) {
      this.tables.set(i, null);
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  getTableOrder(tableNumber: number): TableOrder | null {
    return this.tables.get(tableNumber) || null;
  }

  getAllTables(): Map<number, TableOrder | null> {
    return new Map(this.tables);
  }

  getTablesByFloor(floor: number): Map<number, TableOrder | null> {
    const floorTables = new Map<number, TableOrder | null>();
    const startTable = floor === 1 ? 1 : 23;
    const endTable = floor === 1 ? 22 : 42;

    for (let i = startTable; i <= endTable; i++) {
      floorTables.set(i, this.tables.get(i) || null);
    }

    return floorTables;
  }

  createOrder(orderData: Omit<TableOrder, 'id' | 'createdAt' | 'status'>): TableOrder {
    const newOrder: TableOrder = {
      ...orderData,
      id: Date.now().toString(),
      createdAt: new Date(),
      status: 'occupied'
    };
    
    this.tables.set(orderData.tableNumber, newOrder);
    this.notify();
    return newOrder;
  }

  updateOrder(tableNumber: number, updates: Partial<TableOrder>) {
    const currentOrder = this.tables.get(tableNumber);
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, ...updates };
      this.tables.set(tableNumber, updatedOrder);
      this.notify();
    }
  }

  addItemToOrder(tableNumber: number, item: TableItem) {
    const currentOrder = this.tables.get(tableNumber);
    if (currentOrder) {
      const existingItem = currentOrder.items.find(i => i.name === item.name);
      
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        currentOrder.items.push(item);
      }
      
      currentOrder.total = currentOrder.items.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
      );
      
      this.tables.set(tableNumber, currentOrder);
      this.notify();
    }
  }

  removeItemFromOrder(tableNumber: number, itemName: string) {
    const currentOrder = this.tables.get(tableNumber);
    if (currentOrder) {
      currentOrder.items = currentOrder.items.filter(i => i.name !== itemName);
      currentOrder.total = currentOrder.items.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
      );
      
      this.tables.set(tableNumber, currentOrder);
      this.notify();
    }
  }

  completeOrder(tableNumber: number) {
    const order = this.tables.get(tableNumber);
    if (order) {
      this.orderHistory.push(order);
      this.tables.set(tableNumber, null);
      this.notify();
    }
  }

  cancelOrder(tableNumber: number) {
    this.tables.set(tableNumber, null);
    this.notify();
  }

  getOrderHistory(): TableOrder[] {
    return [...this.orderHistory];
  }

  getTableStatus(tableNumber: number): TableStatus {
    const order = this.tables.get(tableNumber);
    return order ? order.status : 'available';
  }

  // Estadísticas
  getOccupiedTablesCount(): number {
    let count = 0;
    this.tables.forEach(order => {
      if (order) count++;
    });
    return count;
  }

  getTotalRevenue(): number {
    let total = 0;
    this.tables.forEach(order => {
      if (order) total += order.total;
    });
    return total;
  }

  getTodayRevenue(): number {
    const today = new Date().toDateString();
    return this.orderHistory
      .filter(order => order.createdAt.toDateString() === today)
      .reduce((sum, order) => sum + order.total, 0);
  }
}

export const tableStore = new TableStore();

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
};
