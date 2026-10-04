import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import Pusher from 'pusher-js';
import { useAuth } from './AuthContext';
import { soundFx } from '../utils/audio';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export interface IRealtimeSocket {
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
  emit: (event: string, payload?: any) => void;
  disconnect: () => void;
}

interface SocketContextType {
  socket: IRealtimeSocket | null;
  isConnected: boolean;
  notifications: AppNotification[];
  clearNotification: (id: string) => void;
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { restaurant, user, token } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Map of event listeners registered across views
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const lastPollTimestampRef = useRef<number>(Date.now());
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const addToast = useCallback(
    (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const newNotif: AppNotification = {
        id: Math.random().toString(36).substring(2, 9),
        title,
        message,
        type,
        timestamp: new Date(),
      };
      setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 5000);
    },
    []
  );

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Helper to dispatch event to all subscribers and play sounds/toasts
  const dispatchRealtimeEvent = useCallback(
    (event: string, payload: any) => {
      // 1. Play auditory and visual notifications based on station role
      if (event === 'order:created') {
        const tableLabel = payload.table?.tableNumber || 'Takeaway';
        if (user?.role === 'KITCHEN') {
          soundFx.playKitchenChime();
          addToast('New Kitchen Order!', `${tableLabel} - #${payload.orderNumber} placed`, 'warning');
        } else if (user?.role === 'BILLING' || user?.role === 'ADMIN') {
          addToast('Order Placed', `${tableLabel} has a new running order`, 'info');
        }
      } else if (event === 'order:kot_added') {
        if (user?.role === 'KITCHEN') {
          soundFx.playKitchenChime();
          addToast('New KOT Added!', `Additional items for ${payload.order?.table?.tableNumber || 'Order'}`, 'warning');
        }
      } else if (event === 'order:item_status_updated') {
        if (payload.status === 'READY') {
          if (user?.role === 'WAITER' || user?.role === 'ADMIN') {
            soundFx.playReadyChime();
            addToast(
              'Item Ready for Pickup!',
              `${payload.item?.name || 'Item'} for ${payload.tableNumber || 'table'} is ready to serve!`,
              'success'
            );
          }
        }
      } else if (event === 'bill:requested') {
        if (user?.role === 'BILLING' || user?.role === 'ADMIN') {
          soundFx.playKitchenChime();
          addToast('Bill Requested', `${payload.tableNumber} requested the bill from Waiter ${payload.waiterName}`, 'info');
        }
      } else if (event === 'bill:paid') {
        soundFx.playSuccessChime();
        addToast(
          'Payment Received!',
          `Bill ${payload.billNumber} settled via ${payload.paymentMode} (₹${payload.grandTotal})`,
          'success'
        );
      }

      // 2. Notify all component listeners registered for this event
      const handlers = listenersRef.current.get(event);
      if (handlers) {
        handlers.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error(`Error in event listener for [${event}]:`, err);
          }
        });
      }
    },
    [user?.role, addToast]
  );

  // Define the socket-compatible client interface
  const socketInterface = useRef<IRealtimeSocket>({
    on: (event: string, handler: (data: any) => void) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(handler);
    },
    off: (event: string, handler: (data: any) => void) => {
      const handlers = listenersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    },
    emit: (event: string, payload?: any) => {
      // Stub for client emits; client-to-server operations use authenticated REST endpoints
      console.log(`[Realtime Client emit] ${event}:`, payload);
    },
    disconnect: () => {
      // Handled in provider unmount
    },
  });

  useEffect(() => {
    if (!restaurant?.id) return;

    let pusherClient: Pusher | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const pusherKey = (import.meta as any).env?.VITE_PUSHER_KEY;
    const pusherCluster = (import.meta as any).env?.VITE_PUSHER_CLUSTER || 'ap2';

    if (pusherKey) {
      try {
        pusherClient = new Pusher(pusherKey, {
          cluster: pusherCluster,
          authEndpoint: '/api/realtime/auth',
          auth: {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
          },
        });

        // Connection state monitoring
        pusherClient.connection.bind('connected', () => {
          setIsConnected(true);
          const connectHandlers = listenersRef.current.get('connect');
          if (connectHandlers) connectHandlers.forEach((fn) => fn({}));
        });

        pusherClient.connection.bind('disconnected', () => setIsConnected(false));
        pusherClient.connection.bind('unavailable', () => setIsConnected(false));
        pusherClient.connection.bind('failed', () => setIsConnected(false));

        // Subscribe to restaurant private channel
        const mainChannelName = `private-restaurant-${restaurant.id}`;
        const channel = pusherClient.subscribe(mainChannelName);

        const eventsToListen = [
          'order:created',
          'order:kot_added',
          'order:item_status_updated',
          'table:status_changed',
          'bill:requested',
          'bill:paid',
          'payment:initiated',
          'payment:updated',
          'payment:confirmed',
          'payment:cancelled',
        ];

        eventsToListen.forEach((evt) => {
          channel.bind(evt, (data: any) => {
            dispatchRealtimeEvent(evt, data);
          });
        });

        // If paired display, also subscribe to cashier-specific channel
        if (user?.role === 'CUSTOMER_DISPLAY' && user.linkedBillingUserId) {
          const pairedChannel = pusherClient.subscribe(
            `private-restaurant-${restaurant.id}-cashier-${user.linkedBillingUserId}`
          );
          eventsToListen.forEach((evt) => {
            pairedChannel.bind(evt, (data: any) => {
              dispatchRealtimeEvent(evt, data);
            });
          });
        }
      } catch (err) {
        console.warn('⚠️ Pusher connection failed, enabling polling fallback:', err);
        setIsConnected(false);
      }
    } else {
      // When Pusher key is not set (e.g. local dev without keys), we default to active local polling
      setIsConnected(true);
    }

    // Automatic polling fallback every 3 seconds
    // Polls /api/realtime/poll to receive any events in case Pusher is unavailable or dropped
    const runPollingFallback = async () => {
      try {
        const since = lastPollTimestampRef.current;
        const res = await fetch(`/api/realtime/poll?since=${since}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.events)) {
            lastPollTimestampRef.current = json.timestamp || Date.now();
            if (!pusherKey) {
              setIsConnected(true);
            }

            for (const evt of json.events) {
              if (!processedEventIdsRef.current.has(evt.id)) {
                processedEventIdsRef.current.add(evt.id);
                dispatchRealtimeEvent(evt.event, evt.data);
              }
            }

            // Keep processed IDs set bounded
            if (processedEventIdsRef.current.size > 500) {
              const ids = Array.from(processedEventIdsRef.current);
              processedEventIdsRef.current = new Set(ids.slice(-200));
            }
          }
        } else if (res.status === 401) {
          // Token expired or invalid
        } else {
          if (!pusherKey) setIsConnected(false);
        }
      } catch (pollErr) {
        if (!pusherKey) setIsConnected(false);
      }
    };

    // Run fallback polling interval every 3 seconds
    fallbackInterval = setInterval(runPollingFallback, 3000);

    return () => {
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (pusherClient) {
        pusherClient.disconnect();
      }
    };
  }, [restaurant?.id, user?.role, user?.linkedBillingUserId, token, dispatchRealtimeEvent]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketInterface.current,
        isConnected,
        notifications,
        clearNotification,
        addToast,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};

export const useRealtime = useSocket;
export default SocketContext;
