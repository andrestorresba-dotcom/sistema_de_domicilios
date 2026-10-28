import { RouterProvider } from 'react-router';
import { router } from './routes';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { subscribeToOrders } from './lib/orderStore';
import { orderStore } from './lib/orderStore';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginScreen, NoAccessScreen } from './components/pos/LoginScreen';

function AuthenticatedApp() {
  useEffect(() => {
    // Subscribe to Firebase orders once the user is signed in
    const unsubscribe = subscribeToOrders((orders) => {
      orderStore.setOrders(orders);
    });
    return () => unsubscribe();
  }, []);

  return <RouterProvider router={router} />;
}

function Gate() {
  const { loading, firebaseUser, profile, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Cargando…</div>
    );
  }
  if (!firebaseUser) return <LoginScreen />;
  if (!profile || !profile.active) return <NoAccessScreen inactive={!!profile && !profile.active} onLogout={logout} />;
  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <Gate />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;
