import { RouterProvider } from 'react-router';
import { router } from './routes';
import { useEffect } from 'react';
import { subscribeToOrders } from './lib/orderStore';
import { orderStore } from './lib/orderStore';

function App() {
  useEffect(() => {
    // Subscribe to Firebase orders on app mount
    const unsubscribe = subscribeToOrders((orders) => {
      orderStore.setOrders(orders);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
