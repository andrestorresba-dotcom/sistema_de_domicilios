import { useState, useEffect } from 'react';
import { orderStore, Order } from './orderStore';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(orderStore.getOrders());

  useEffect(() => {
    const unsubscribe = orderStore.subscribe(() => {
      setOrders(orderStore.getOrders());
    });
    return unsubscribe;
  }, []);

  return orders;
}
