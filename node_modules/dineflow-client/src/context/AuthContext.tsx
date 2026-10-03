import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Restaurant, UserRole } from '../types';

interface AuthContextType {
  token: string | null;
  user: User | null;
  restaurant: Restaurant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  loginStaff: (restaurantCode: string, userId: string, pass: string) => Promise<{ success: boolean; redirectUrl?: string; error?: string }>;
  loginAdmin: (email: string, pass: string) => Promise<{ success: boolean; redirectUrl?: string; error?: string }>;
  registerRestaurant: (data: any) => Promise<{ success: boolean; restaurant?: any; error?: string }>;
  logout: () => void;
  updateRestaurantSettings: (updated: Partial<Restaurant>) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dineflow_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dineflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [restaurant, setRestaurant] = useState<Restaurant | null>(() => {
    const saved = localStorage.getItem('dineflow_restaurant');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Helper for authenticated fetch
  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Session expired or invalid
      logout();
    }

    return response;
  };

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
            setRestaurant(data.restaurant);
            localStorage.setItem('dineflow_user', JSON.stringify(data.user));
            localStorage.setItem('dineflow_restaurant', JSON.stringify(data.restaurant));
          } else {
            logout();
          }
        } catch {
          // If offline or server error, retain cached auth
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [token]);

  const loginStaff = async (restaurantCode: string, userId: string, password: string) => {
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantCode, userId, password }),
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setToken(data.token);
      setUser(data.user);
      setRestaurant(data.restaurant);

      localStorage.setItem('dineflow_token', data.token);
      localStorage.setItem('dineflow_user', JSON.stringify(data.user));
      localStorage.setItem('dineflow_restaurant', JSON.stringify(data.restaurant));

      return { success: true, redirectUrl: data.redirectUrl };
    } catch (err: any) {
      return { success: false, error: 'Connection error to DineFlow server' };
    }
  };

  const loginAdmin = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Admin login failed' };
      }

      setToken(data.token);
      setUser(data.user);
      setRestaurant(data.restaurant);

      localStorage.setItem('dineflow_token', data.token);
      localStorage.setItem('dineflow_user', JSON.stringify(data.user));
      localStorage.setItem('dineflow_restaurant', JSON.stringify(data.restaurant));

      return { success: true, redirectUrl: data.redirectUrl };
    } catch (err: any) {
      return { success: false, error: 'Connection error to DineFlow server' };
    }
  };

  const registerRestaurant = async (formData: any) => {
    try {
      const res = await fetch('/api/auth/register-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      setToken(data.token);
      setUser({ userId: 'admin', name: data.restaurant.ownerName, role: 'ADMIN', email: data.restaurant.email });
      setRestaurant(data.restaurant);

      localStorage.setItem('dineflow_token', data.token);
      localStorage.setItem('dineflow_user', JSON.stringify({ userId: 'admin', name: data.restaurant.ownerName, role: 'ADMIN', email: data.restaurant.email }));
      localStorage.setItem('dineflow_restaurant', JSON.stringify(data.restaurant));

      return { success: true, restaurant: data.restaurant };
    } catch (err: any) {
      return { success: false, error: 'Connection error during restaurant registration' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setRestaurant(null);
    localStorage.removeItem('dineflow_token');
    localStorage.removeItem('dineflow_user');
    localStorage.removeItem('dineflow_restaurant');
    window.location.href = '/login';
  };

  const updateRestaurantSettings = (updated: Partial<Restaurant>) => {
    if (restaurant) {
      const next = { ...restaurant, ...updated };
      setRestaurant(next);
      localStorage.setItem('dineflow_restaurant', JSON.stringify(next));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        restaurant,
        isAuthenticated: !!token && !!user,
        isLoading,
        role: user?.role || null,
        loginStaff,
        loginAdmin,
        registerRestaurant,
        logout,
        updateRestaurantSettings,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
