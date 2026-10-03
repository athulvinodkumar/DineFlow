import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Order } from '../../types';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Play,
  Flame,
  AlertCircle,
  RefreshCw,
  Volume2,
  UtensilsCrossed,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

export const KitchenDisplay: React.FC = () => {
  const { authFetch } = useAuth();
  const { socket, addToast } = useSocket();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filterTab, setFilterTab] = useState<'ACTIVE' | 'PENDING' | 'PREPARING' | 'READY'>('ACTIVE');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Fetch running active orders
  const fetchRunningOrders = async () => {
    try {
      const res = await authFetch('/api/orders/running');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Failed to fetch running kitchen orders:', err);
    }
  };

  useEffect(() => {
    fetchRunningOrders();

    // 1-second interval to update running order timers in real-time
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Listen for live Socket.IO events
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order: Order) => {
      soundFx.playKitchenChime();
      addToast('New KOT Arrived!', `Table ${order.table?.tableNumber || 'Takeaway'} - #${order.orderNumber}`, 'warning');
      fetchRunningOrders();
    };

    const handleKotAdded = (data: any) => {
      soundFx.playKitchenChime();
      addToast('KOT Addition!', `Extra items added for Table ${data.order?.table?.tableNumber || 'Order'}`, 'warning');
      fetchRunningOrders();
    };

    const handleStatusUpdated = () => {
      fetchRunningOrders();
    };

    socket.on('order:created', handleNewOrder);
    socket.on('order:kot_added', handleKotAdded);
    socket.on('order:item_status_updated', handleStatusUpdated);

    return () => {
      socket.off('order:created', handleNewOrder);
      socket.off('order:kot_added', handleKotAdded);
      socket.off('order:item_status_updated', handleStatusUpdated);
    };
  }, [socket]);

  // Update single item status
  const handleUpdateItemStatus = async (orderId: string, itemId: string, newStatus: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRunningOrders();
      }
    } catch (err) {
      console.error('Failed to update item status:', err);
    }
  };

  // Update whole batch status
  const handleBatchStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/batch-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRunningOrders();
      }
    } catch (err) {
      console.error('Failed to batch update order status:', err);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filterTab === 'ACTIVE') return true;
    return order.status === filterTab;
  });

  // Calculate elapsed time and urgency color
  const getElapsedInfo = (createdAtStr: string) => {
    const elapsedMs = currentTime - new Date(createdAtStr).getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    const formattedTime = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;

    if (elapsedMinutes < 10) {
      return {
        formattedTime,
        urgency: 'green',
        badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
        cardBorder: 'border-emerald-500/30',
      };
    } else if (elapsedMinutes < 20) {
      return {
        formattedTime,
        urgency: 'yellow',
        badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        cardBorder: 'border-amber-500/40',
      };
    } else {
      return {
        formattedTime,
        urgency: 'red',
        badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/60 animate-pulse font-extrabold',
        cardBorder: 'border-rose-500/60 ring-1 ring-rose-500/40',
      };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top KDS Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-16 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-wide">Kitchen Display System (KDS)</h1>
            <p className="text-xs text-slate-400">Live Ticket Stream • {orders.length} Active Tickets</p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            id="kdsTabActive"
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterTab === 'ACTIVE' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Active ({orders.length})
          </button>
          <button
            id="kdsTabPending"
            onClick={() => setFilterTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterTab === 'PENDING' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending ({orders.filter((o) => o.status === 'PENDING').length})
          </button>
          <button
            id="kdsTabPreparing"
            onClick={() => setFilterTab('PREPARING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterTab === 'PREPARING' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Preparing ({orders.filter((o) => o.status === 'PREPARING').length})
          </button>
          <button
            id="kdsTabReady"
            onClick={() => setFilterTab('READY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterTab === 'READY' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ready ({orders.filter((o) => o.status === 'READY').length})
          </button>
        </div>

        {/* Sound Test / Manual Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => soundFx.playKitchenChime()}
            title="Test Chime Alert"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Volume2 className="w-4 h-4 text-amber-400" /> Test Sound
          </button>
          <button
            onClick={fetchRunningOrders}
            title="Refresh Orders"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Ticket Cards Grid (Oldest Orders First!) */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-center">
            <UtensilsCrossed className="w-16 h-16 text-slate-800 mb-3" />
            <h3 className="text-xl font-bold text-slate-600">All Clear! No Pending Tickets</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              New orders sent from waiters will appear here automatically with a sound chime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => {
              const elapsed = getElapsedInfo(order.createdAt);
              const allReady = order.items.every((i) => i.status === 'READY' || i.status === 'SERVED');
              const allPreparing = order.items.every((i) => i.status === 'PREPARING');

              return (
                <div
                  key={order.id}
                  id={`kds-card-${order.orderNumber.toLowerCase()}`}
                  className={`bg-slate-900 rounded-2xl border ${elapsed.cardBorder} shadow-xl flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-2xl`}
                >
                  {/* Card Header */}
                  <div className="p-4 bg-slate-800/80 border-b border-slate-700/60 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-white tracking-tight">
                          {order.table?.tableNumber || 'Takeaway'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          #{order.orderNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Waiter: <span className="text-slate-200 font-semibold">{order.waiterName || 'Staff'}</span>
                      </p>
                    </div>

                    {/* Running Urgency Timer */}
                    <div className="flex flex-col items-end">
                      <div className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm ${elapsed.badgeClass}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsed.formattedTime}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Special Order Notes if any */}
                  {order.notes && (
                    <div className="mx-4 mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-semibold italic">{order.notes}</span>
                    </div>
                  )}

                  {/* Order Items List */}
                  <div className="p-4 space-y-2.5 flex-1 overflow-y-auto max-h-[320px]">
                    {order.items.map((item) => {
                      const isPending = item.status === 'PENDING';
                      const isPrep = item.status === 'PREPARING';
                      const isRdy = item.status === 'READY';
                      const isSrv = item.status === 'SERVED';

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isRdy
                              ? 'bg-emerald-950/40 border-emerald-500/50'
                              : isPrep
                              ? 'bg-blue-950/40 border-blue-500/40'
                              : 'bg-slate-800/80 border-slate-700/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                                {item.quantity}x
                              </span>
                              <div>
                                <h4 className="text-sm font-bold text-white leading-tight">{item.name}</h4>
                                {item.notes && (
                                  <p className="text-xs text-amber-400 font-semibold italic mt-0.5 flex items-center gap-1">
                                    ★ "{item.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Item Action Button */}
                            <div>
                              {isPending && (
                                <button
                                  id={`start-item-${item.id}`}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'PREPARING')}
                                  className="px-2.5 py-1 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  <Play className="w-3 h-3" /> Cook
                                </button>
                              )}
                              {isPrep && (
                                <button
                                  id={`ready-item-${item.id}`}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'READY')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-md shadow-emerald-600/30"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </button>
                              )}
                              {isRdy && (
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              )}
                              {isSrv && (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-lg text-[11px] font-medium">
                                  Served
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Batch Card Actions */}
                  <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2">
                    <button
                      id={`batch-prep-${order.id}`}
                      onClick={() => handleBatchStatus(order.id, 'PREPARING')}
                      disabled={allPreparing || allReady}
                      className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                    >
                      Start All
                    </button>
                    <button
                      id={`batch-ready-${order.id}`}
                      onClick={() => handleBatchStatus(order.id, 'READY')}
                      disabled={allReady}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark All Ready
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
