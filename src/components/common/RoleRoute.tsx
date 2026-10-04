import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading DineFlow...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Admins have supervisory access to all modules, or check if user's role is permitted
  const hasAccess = user.role === 'ADMIN' || allowedRoles.includes(user.role);

  if (!hasAccess) {
    // Redirect to the module their role actually allows
    if (user.role === 'BILLING') return <Navigate to="/billing" replace />;
    if (user.role === 'WAITER') return <Navigate to="/waiter" replace />;
    if (user.role === 'KITCHEN') return <Navigate to="/kitchen" replace />;
    if (user.role === 'CUSTOMER_DISPLAY') return <Navigate to="/display" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
