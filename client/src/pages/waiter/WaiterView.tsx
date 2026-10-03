import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { TableItem, Category, MenuItem, Order, OrderItem } from '../../types';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  Flame,
  ChefHat,
  Receipt,
  ArrowLeft,
  ShoppingBag,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export const WaiterView: React.FC = () => {
  const { authFetch, user } = useAuth();
  const { socket, addToast } = useSocket();

  const [tables, setTables] = useState<TableItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);

  // Menu filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Cart state: items to send as next KOT
  const [cart, setCart] = useState<{ menuItem: MenuItem; quantity: number; notes: string }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'running'>('menu');

  // Item note modal
  const [noteModalItem, setNoteModalItem] = useState<MenuItem | null>(null);
  const [customNote, setCustomNote] = useState('');

  // Fetch initial data
  const fetchTables = async () => {
    try {
      const res = await authFetch('/api/tables');
      const data = await res.json();
      if (data.success) {
        setTables(data.tables);
        if (selectedTable) {
          const updated = data.tables.find((t: TableItem) => t.id === selectedTable.id);
          if (updated) setSelectedTable(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  };

  const fetchMenu = async () => {
    try {
      const [catRes, itemRes] = await Promise.all([
        authFetch('/api/menu/categories'),
        authFetch('/api/menu/items'),
      ]);
      const [catData, itemData] = await Promise.all([catRes.json(), itemRes.json()]);
      if (catData.success) setCategories(catData.categories);
      if (itemData.success) setMenuItems(itemData.items);
    } catch (err) {
      console.error('Error fetching menu:', err);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchMenu();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleTableStatus = () => fetchTables();
    const handleOrderUpdate = () => fetchTables();

    socket.on('table:status_changed', handleTableStatus);
    socket.on('order:created', handleOrderUpdate);
    socket.on('order:kot_added', handleOrderUpdate);
    socket.on('order:item_status_updated', handleOrderUpdate);
    socket.on('bill:paid', handleTableStatus);

    return () => {
      socket.off('table:status_changed', handleTableStatus);
      socket.off('order:created', handleOrderUpdate);
      socket.off('order:kot_added', handleOrderUpdate);
      socket.off('order:item_status_updated', handleOrderUpdate);
      socket.off('bill:paid', handleTableStatus);
    };
  }, [socket, selectedTable?.id]);

  // Cart operations
  const addToCart = (item: MenuItem, note: string = '') => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItem.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItem.id === item.id
            ? { ...i, quantity: i.quantity + 1, notes: note || i.notes }
            : i
        );
      }
      return [...prev, { menuItem: item, quantity: 1, notes: note }];
    });
    addToast('Item Added', `${item.name} added to cart`, 'info');
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.menuItem.id === itemId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as { menuItem: MenuItem; quantity: number; notes: string }[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.menuItem.id !== itemId));
  };

  // Send KOT to Kitchen
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSendToKitchen = async () => {
    if (!selectedTable || cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const itemsPayload = cart.map((i) => ({
        menuItemId: i.menuItem.id,
        quantity: i.quantity,
        notes: i.notes,
      }));

      if (selectedTable.currentOrderId) {
        // Add KOT to existing running order
        const res = await authFetch(`/api/orders/${selectedTable.currentOrderId}/items`, {
          method: 'POST',
          body: JSON.stringify({ items: itemsPayload }),
        });
        const data = await res.json();
        if (data.success) {
          addToast('KOT Sent!', `Additional items sent to Kitchen for ${selectedTable.tableNumber}`, 'success');
          setCart([]);
          setIsCartOpen(false);
          setActiveTab('running');
          fetchTables();
        } else {
          addToast('Error', data.error || 'Failed to add items to order', 'error');
        }
      } else {
        // Create new Order
        const res = await authFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            tableId: selectedTable.id,
            orderType: 'DINE_IN',
            items: itemsPayload,
          }),
        });
        const data = await res.json();
        if (data.success) {
          addToast('Order Placed!', `New order sent to Kitchen for ${selectedTable.tableNumber}`, 'success');
          setCart([]);
          setIsCartOpen(false);
          setActiveTab('running');
          fetchTables();
        } else {
          addToast('Error', data.error || 'Failed to place order', 'error');
        }
      }
    } catch (err) {
      addToast('Error', 'Connection error while sending to kitchen', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark item as Served
  const handleMarkServed = async (orderId: string, itemId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SERVED' }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Served', 'Item marked as served', 'success');
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Request Bill for table
  const handleRequestBill = async () => {
    if (!selectedTable) return;
    try {
      const res = await authFetch('/api/bills/request-bill', {
        method: 'POST',
        body: JSON.stringify({ tableId: selectedTable.id }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Bill Requested', `Cashier notified for ${selectedTable.tableNumber}`, 'success');
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered menu items
  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.isAvailable) return false;
    if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
    if (vegFilter === 'veg' && !item.isVeg) return false;
    if (vegFilter === 'non-veg' && item.isVeg) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const cartTotal = cart.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);

  // 1. Table Selection View
  if (!selectedTable) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Select Dining Table</h1>
            <p className="text-xs text-slate-500 mt-0.5">Floor Captain: {user?.name}</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Free</span>
            <span className="flex items-center gap-1.5 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Occupied</span>
            <span className="flex items-center gap-1.5 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Billing</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {tables.map((table) => {
            const isFree = table.status === 'FREE';
            const isBilling = table.status === 'BILLING';
            const activeOrder = table.currentOrder;
            const itemCount = activeOrder?.items?.filter((i) => i.status !== 'CANCELLED').length || 0;

            return (
              <button
                key={table.id}
                id={`table-${table.tableNumber.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => {
                  setSelectedTable(table);
                  if (table.currentOrderId) {
                    setActiveTab('running');
                  } else {
                    setActiveTab('menu');
                  }
                }}
                className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] flex flex-col justify-between min-h-[130px] ${
                  isFree
                    ? 'bg-white border-emerald-300 hover:border-emerald-500'
                    : isBilling
                    ? 'bg-blue-50 border-blue-400 hover:border-blue-600'
                    : 'bg-amber-50 border-amber-300 hover:border-amber-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{table.tableNumber}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isFree
                        ? 'bg-emerald-100 text-emerald-700'
                        : isBilling
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {table.status}
                  </span>
                </div>

                <div className="mt-2">
                  <p className="text-xs text-slate-500 font-medium">{table.capacity} Seater</p>
                  {!isFree && (
                    <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-600" /> {itemCount} Items Running
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Table Active Order & Menu View
  const activeOrder = selectedTable.currentOrder;

  return (
    <div className="max-w-4xl mx-auto pb-28">
      {/* Top sticky Table Header */}
      <div className="sticky top-16 bg-white/95 backdrop-blur-md border-b border-slate-200 z-30 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTable(null)}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{selectedTable.tableNumber}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedTable.status === 'FREE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : selectedTable.status === 'BILLING'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {selectedTable.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{selectedTable.capacity} Seats • {user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeOrder && selectedTable.status !== 'BILLING' && (
              <button
                id="requestBillButton"
                onClick={handleRequestBill}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Receipt className="w-3.5 h-3.5" /> Request Bill
              </button>
            )}

            {/* Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                id="waiterTabMenu"
                onClick={() => setActiveTab('menu')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'menu' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                + Add Items
              </button>
              <button
                id="waiterTabRunning"
                onClick={() => setActiveTab('running')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === 'running' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Running ({activeOrder?.items?.length || 0})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 py-4">
        {activeTab === 'menu' ? (
          <div>
            {/* Search and Veg Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="menuSearchInput"
                  type="text"
                  placeholder="Search dishes (e.g. Butter Chicken, Paneer)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Veg / Non-Veg Toggle Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setVegFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg ${
                    vegFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  All
                </button>
                <button
                  id="filterVegBtn"
                  onClick={() => setVegFilter('veg')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 ${
                    vegFilter === 'veg' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Veg
                </button>
                <button
                  id="filterNonVegBtn"
                  onClick={() => setVegFilter('non-veg')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 ${
                    vegFilter === 'non-veg' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span> Non-Veg
                </button>
              </div>
            </div>

            {/* Horizontal Category Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredMenuItems.map((item) => {
                const cartEntry = cart.find((i) => i.menuItem.id === item.id);

                return (
                  <div
                    key={item.id}
                    id={`menu-item-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-brand-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {/* Veg/Non-Veg icon */}
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${
                                item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                              }`}
                            ></div>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">{item.name}</h4>
                        </div>
                        <span className="text-sm font-bold text-slate-900">₹{item.price}</span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {/* Special instructions / cooking notes trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setNoteModalItem(item);
                          setCustomNote(cartEntry?.notes || '');
                        }}
                        className="text-[11px] font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {cartEntry?.notes ? (
                          <span className="text-amber-600 truncate max-w-[120px] font-semibold">"{cartEntry.notes}"</span>
                        ) : (
                          'Add Note'
                        )}
                      </button>

                      {/* Quantity / Add control */}
                      {cartEntry ? (
                        <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-2 py-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white text-brand-700 flex items-center justify-center font-bold shadow-sm"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-brand-900 w-4 text-center">
                            {cartEntry.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-6 h-6 rounded-lg bg-white text-brand-700 flex items-center justify-center font-bold shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`add-btn-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                          onClick={() => addToCart(item)}
                          className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-brand-200"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Running Orders & KOT Tab */
          <div>
            {!activeOrder || activeOrder.items.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
                <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-700">No Running Orders</h3>
                <p className="text-xs text-slate-400 mt-1">This table currently has no active KOT orders.</p>
                <button
                  onClick={() => setActiveTab('menu')}
                  className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Browse Menu & Place Order
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900">Order #{activeOrder.orderNumber}</span>
                    <p className="text-xs text-slate-600">Waiter: {activeOrder.waiterName || 'Staff'}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      activeOrder.status === 'READY'
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : activeOrder.status === 'PREPARING'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {activeOrder.status}
                  </span>
                </div>

                <div className="space-y-2">
                  {activeOrder.items.map((orderItem) => {
                    const isReady = orderItem.status === 'READY';
                    const isServed = orderItem.status === 'SERVED';
                    const isPreparing = orderItem.status === 'PREPARING';

                    return (
                      <div
                        key={orderItem.id}
                        id={`order-item-${orderItem.id}`}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                          isReady
                            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
                            : isServed
                            ? 'bg-slate-50 border-slate-200 opacity-80'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center">
                              {orderItem.quantity}x
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{orderItem.name}</h4>
                            <span className="text-xs text-slate-400 font-mono">KOT #{orderItem.kotNumber}</span>
                          </div>

                          {orderItem.notes && (
                            <p className="text-xs text-amber-700 font-medium ml-8 mt-0.5">
                              Note: {orderItem.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isReady
                                ? 'bg-emerald-100 text-emerald-800 flex items-center gap-1'
                                : isServed
                                ? 'bg-slate-200 text-slate-700'
                                : isPreparing
                                ? 'bg-blue-100 text-blue-800 flex items-center gap-1'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isReady && <Sparkles className="w-3 h-3 text-emerald-600" />}
                            {isPreparing && <ChefHat className="w-3 h-3 text-blue-600" />}
                            {orderItem.status}
                          </span>

                          {/* Waiter "Mark as Served" action */}
                          {isReady && (
                            <button
                              id={`mark-served-${orderItem.id}`}
                              onClick={() => handleMarkServed(activeOrder.id, orderItem.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Serve
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto z-40">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-slate-800">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} Items in Cart
              </p>
              <p className="text-lg font-bold text-white leading-tight">₹{cartTotal.toFixed(2)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="reviewCartBtn"
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700"
              >
                Review
              </button>
              <button
                id="sendToKitchenBtn"
                onClick={handleSendToKitchen}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send to Kitchen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl animate-slide-up">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Review KOT Order</h3>
                <p className="text-xs text-slate-500">{selectedTable.tableNumber}</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {cart.map((item) => (
                <div
                  key={item.menuItem.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{item.menuItem.name}</h4>
                    <p className="text-xs font-semibold text-brand-600">₹{item.menuItem.price * item.quantity}</p>
                    {item.notes && (
                      <p className="text-[11px] text-amber-700 italic mt-0.5">"{item.notes}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, -1)}
                        className="w-5 h-5 text-slate-600 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 w-3 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, 1)}
                        className="w-5 h-5 text-slate-600 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.menuItem.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-500">Subtotal Estimated</span>
                <span className="text-lg font-bold text-slate-900">₹{cartTotal.toFixed(2)}</span>
              </div>

              <button
                id="drawerSendToKitchenBtn"
                onClick={handleSendToKitchen}
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Confirm & Send to Kitchen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Special Kitchen Notes Modal */}
      {noteModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-1">Kitchen Note for {noteModalItem.name}</h3>
            <p className="text-xs text-slate-500 mb-4">Add cooking instructions (e.g. less spicy, no onion)</p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {['Less Spicy', 'Extra Spicy', 'No Onion/Garlic', 'Jain Prep', 'Crispy', 'Pack Separately'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomNote(preset)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              placeholder="Custom cooking note..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none mb-4"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setNoteModalItem(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                id="saveItemNoteBtn"
                onClick={() => {
                  addToCart(noteModalItem, customNote);
                  setNoteModalItem(null);
                }}
                className="flex-1 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Save & Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
