import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { RoleRoute } from './components/common/RoleRoute';

// Pages
import { Login } from './pages/auth/Login';
import { RegisterRestaurant } from './pages/auth/RegisterRestaurant';
import { AdminLogin } from './pages/auth/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { WaiterView } from './pages/waiter/WaiterView';
import { KitchenDisplay } from './pages/kitchen/KitchenDisplay';
import { BillingView } from './pages/billing/BillingView';
import { CustomerDisplay } from './pages/display/CustomerDisplay';

const HomeRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'BILLING') return <Navigate to="/billing" replace />;
  if (user.role === 'WAITER') return <Navigate to="/waiter" replace />;
  if (user.role === 'KITCHEN') return <Navigate to="/kitchen" replace />;
  if (user.role === 'CUSTOMER_DISPLAY') return <Navigate to="/display" replace />;

  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<RegisterRestaurant />} />
                <Route path="/admin-login" element={<AdminLogin />} />

                {/* Role Protected Routes */}
                <Route
                  path="/admin"
                  element={
                    <RoleRoute allowedRoles={['ADMIN']}>
                      <AdminDashboard />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <RoleRoute allowedRoles={['BILLING']}>
                      <BillingView />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/waiter"
                  element={
                    <RoleRoute allowedRoles={['WAITER']}>
                      <WaiterView />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/kitchen"
                  element={
                    <RoleRoute allowedRoles={['KITCHEN']}>
                      <KitchenDisplay />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/display"
                  element={
                    <RoleRoute allowedRoles={['CUSTOMER_DISPLAY', 'ADMIN']}>
                      <CustomerDisplay />
                    </RoleRoute>
                  }
                />

                {/* Home Redirect & Fallback */}
                <Route path="/" element={<HomeRedirect />} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
            </main>
            <ToastContainer />
          </div>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
