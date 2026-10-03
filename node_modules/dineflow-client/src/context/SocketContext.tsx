import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { soundFx } from '../utils/audio';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: AppNotification[];
  clearNotification: (id: string) => void;
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { restaurant, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      timestamp: new Date(),
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    setTimeout(() => {
      clearNotification(newNotif.id);
    }, 5000);
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    if (!restaurant?.id) return;

    const s = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      setIsConnected(true);
      s.emit('join:restaurant', {
        restaurantId: restaurant.id,
        role: user?.role,
        userId: user?.userId,
      });
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time events
    s.on('order:created', (order: any) => {
      const tableLabel = order.table?.tableNumber || 'Takeaway';
      if (user?.role === 'KITCHEN') {
        soundFx.playKitchenChime();
        addToast('New Kitchen Order!', `${tableLabel} - #${order.orderNumber} placed`, 'warning');
      } else if (user?.role === 'BILLING' || user?.role === 'ADMIN') {
        addToast('Order Placed', `${tableLabel} has a new running order`, 'info');
      }
    });

    s.on('order:kot_added', (data: any) => {
      if (user?.role === 'KITCHEN') {
        soundFx.playKitchenChime();
        addToast('New KOT Added!', `Additional items for ${data.order?.table?.tableNumber || 'Order'}`, 'warning');
      }
    });

    s.on('order:item_status_updated', (data: any) => {
      if (data.status === 'READY') {
        if (user?.role === 'WAITER' || user?.role === 'ADMIN') {
          soundFx.playReadyChime();
          addToast('Item Ready for Pickup!', `${data.item?.name || 'Item'} for ${data.tableNumber || 'table'} is ready to serve!`, 'success');
        }
      }
    });

    s.on('bill:requested', (data: any) => {
      if (user?.role === 'BILLING' || user?.role === 'ADMIN') {
        soundFx.playKitchenChime();
        addToast('Bill Requested', `${data.tableNumber} requested the bill from Waiter ${data.waiterName}`, 'info');
      }
    });

    s.on('bill:paid', (data: any) => {
      soundFx.playSuccessChime();
      addToast('Payment Received!', `Bill ${data.billNumber} settled via ${data.paymentMode} (₹${data.grandTotal})`, 'success');
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [restaurant?.id, user?.role, user?.userId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, notifications, clearNotification, addToast }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
