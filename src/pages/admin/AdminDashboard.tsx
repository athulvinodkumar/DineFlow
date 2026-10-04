import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Category,
  MenuItem,
  TableItem,
  StaffMember,
  DashboardMetrics,
  SalesChartDay,
} from '../../types';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid,
  Users,
  Settings as SettingsIcon,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Download,
  KeyRound,
  ShieldCheck,
  QrCode,
  Flame,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { authFetch, restaurant, updateRestaurantSettings } = useAuth();
  const { addToast } = useSocket();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MENU' | 'TABLES' | 'STAFF' | 'SETTINGS' | 'REPORTS'>('OVERVIEW');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesChart, setSalesChart] = useState<SalesChartDay[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; totalQuantity: number }[]>([]);

  // Menu state
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newItemData, setNewItemData] = useState({
    name: '',
    categoryId: '',
    price: 0,
    isVeg: true,
    description: '',
    taxPercent: 5.0,
  });

  // Table state
  const [tables, setTables] = useState<TableItem[]>([]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);

  // Staff state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    userId: '',
    name: '',
    role: 'WAITER' as 'BILLING' | 'WAITER' | 'KITCHEN' | 'CUSTOMER_DISPLAY',
    linkedBillingUserId: '',
    password: '',
  });
  const [resetStaffModal, setResetStaffModal] = useState<StaffMember | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: restaurant?.name || '',
    ownerName: restaurant?.ownerName || '',
    phone: restaurant?.phone || '',
    address: restaurant?.address || '',
    gstin: restaurant?.gstin || '',
    upiId: restaurant?.upiId || '',
    serviceChargePercent: restaurant?.serviceChargePercent ?? 5,
    taxPercent: restaurant?.taxPercent ?? 5,
    billHeader: restaurant?.billHeader || '',
    billFooter: restaurant?.billFooter || '',
    showItemizedBillOnDisplay: Boolean(restaurant?.showItemizedBillOnDisplay),
  });

  // Fetch Dashboard metrics
  const fetchDashboardData = async () => {
    try {
      const res = await authFetch('/api/reports/dashboard');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setSalesChart(data.salesChart);
        setTopItems(data.topSellingItems);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenuData = async () => {
    try {
      const [catRes, itemRes] = await Promise.all([
        authFetch('/api/menu/categories'),
        authFetch('/api/menu/items'),
      ]);
      const [catData, itemData] = await Promise.all([catRes.json(), itemRes.json()]);
      if (catData.success) setCategories(catData.categories);
      if (itemData.success) setMenuItems(itemData.items);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTables = async () => {
    try {
      const res = await authFetch('/api/tables');
      const data = await res.json();
      if (data.success) setTables(data.tables);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await authFetch('/api/staff');
      const data = await res.json();
      if (data.success) setStaffList(data.staff);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchMenuData();
    fetchTables();
    fetchStaff();
  }, []);

  // Category & Menu Item handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await authFetch('/api/menu/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Category added', 'success');
        setNewCatName('');
        setIsAddCatModalOpen(false);
        fetchMenuData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/menu/items', {
        method: 'POST',
        body: JSON.stringify(newItemData),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', `Menu item "${newItemData.name}" created`, 'success');
        setIsAddItemModalOpen(false);
        setNewItemData({
          name: '',
          categoryId: categories[0]?.id || '',
          price: 0,
          isVeg: true,
          description: '',
          taxPercent: 5.0,
        });
        fetchMenuData();
      } else {
        addToast('Error', data.error || 'Failed to create item', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const res = await authFetch(`/api/menu/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      const data = await res.json();
      if (data.success) {
        fetchMenuData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const res = await authFetch(`/api/menu/items/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('Deleted', 'Menu item removed', 'info');
        fetchMenuData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Table handlers
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;
    try {
      const res = await authFetch('/api/tables', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: newTableNumber.trim(),
          capacity: Number(newTableCapacity),
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', `${newTableNumber} added`, 'success');
        setNewTableNumber('');
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Remove this dining table?')) return;
    try {
      const res = await authFetch(`/api/tables/${tableId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('Removed', 'Table removed from floor plan', 'info');
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Staff handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...newStaffData };
      if (payload.role !== 'CUSTOMER_DISPLAY') {
        delete payload.linkedBillingUserId;
      }
      const res = await authFetch('/api/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', `Staff member @${newStaffData.userId} created`, 'success');
        setIsAddStaffModalOpen(false);
        setNewStaffData({ userId: '', name: '', role: 'WAITER', linkedBillingUserId: '', password: '' });
        fetchStaff();
      } else {
        addToast('Error', data.error || 'Failed to create staff', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaffModal) return;
    try {
      const res = await authFetch(`/api/staff/${resetStaffModal.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPasswordValue }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Password Reset', `Password reset for @${resetStaffModal.userId}`, 'success');
        setResetStaffModal(null);
        setResetPasswordValue('');
      } else {
        addToast('Error', data.error || 'Failed to reset password', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStaffActive = async (staff: StaffMember) => {
    try {
      const res = await authFetch(`/api/staff/${staff.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !staff.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Updated', `User status changed to ${!staff.isActive ? 'Active' : 'Inactive'}`, 'info');
        fetchStaff();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Delete this staff member?')) return;
    try {
      const res = await authFetch(`/api/staff/${staffId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('Deleted', 'Staff member removed', 'info');
        fetchStaff();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Settings update handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (data.success) {
        addToast('Settings Saved', 'Restaurant profile and tax configuration updated', 'success');
        updateRestaurantSettings(data.restaurant);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Maximum sales for SVG chart normalization
  const maxSales = Math.max(...salesChart.map((d) => d.sales), 100);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Banner with Restaurant Name & ID */}
      <div className="bg-gradient-to-r from-slate-900 to-brand-950 text-white rounded-3xl p-6 mb-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-brand-400">Management Console</span>
          <h1 className="text-2xl font-black mt-0.5">{restaurant?.name}</h1>
          <p className="text-xs text-slate-400 mt-1">{restaurant?.address} • UPI: {restaurant?.upiId}</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 flex items-center gap-3">
          <div>
            <p className="text-[10px] text-slate-400 font-medium">RESTAURANT CODE</p>
            <p className="text-xl font-extrabold font-mono text-brand-400 tracking-wider">{restaurant?.code}</p>
          </div>
          <button
            onClick={() => {
              if (restaurant?.code) {
                navigator.clipboard.writeText(restaurant.code);
                addToast('Copied', 'Restaurant code copied to clipboard', 'info');
              }
            }}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-colors"
            title="Copy ID"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-200 no-scrollbar">
        {[
          { id: 'OVERVIEW', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'MENU', label: 'Menu & Categories', icon: UtensilsCrossed },
          { id: 'TABLES', label: 'Tables & Floor', icon: Grid },
          { id: 'STAFF', label: 'Staff Logins', icon: Users },
          { id: 'SETTINGS', label: 'Restaurant Settings', icon: SettingsIcon },
          { id: 'REPORTS', label: 'Reports & Export', icon: FileSpreadsheet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id.toLowerCase()}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: OVERVIEW DASHBOARD */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-fade-in">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Today's Sales</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹{metrics?.todaySales?.toFixed(2) || '0.00'}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Live Gross Revenue
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Orders Today</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {metrics?.todayOrders || 0}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Dine-in & Takeaway tickets</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Active Tables</span>
              <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono">
                {metrics?.activeTables || 0} / {metrics?.totalTables || 0}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Occupied / Billing floor</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Avg Order Value</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹{metrics?.averageOrderValue?.toFixed(2) || '0.00'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Per seated customer check</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sales Chart (Last 7 Days) */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">7-Day Sales Trend</h3>
                  <p className="text-xs text-slate-500">Daily gross turnover in INR (₹)</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200">
                  Last 7 Days
                </span>
              </div>

              {/* Responsive SVG Bar Chart */}
              <div className="h-56 flex items-end justify-between gap-3 pt-6 px-2">
                {salesChart.map((day) => {
                  const barHeightPct = Math.max(12, (day.sales / maxSales) * 100);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="text-[10px] font-mono font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        ₹{day.sales}
                      </div>
                      <div className="w-full max-w-[48px] bg-slate-100 rounded-xl overflow-hidden h-36 flex items-end">
                        <div
                          style={{ height: `${barHeightPct}%` }}
                          className="w-full bg-gradient-to-t from-brand-600 to-amber-500 rounded-t-xl transition-all duration-500 group-hover:from-brand-500 group-hover:to-amber-400"
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600">{day.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Selling Dishes */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Top Selling Items</h3>
                <p className="text-xs text-slate-500 mb-4">Customer favorites by ordered volume</p>

                <div className="space-y-3">
                  {topItems.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No sales recorded yet</p>
                  ) : (
                    topItems.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-800 text-xs font-extrabold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-900">{item.totalQuantity} orders</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: MENU & CATEGORIES MANAGEMENT */}
      {activeTab === 'MENU' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Menu Catalog Management</h2>
              <p className="text-xs text-slate-500">Add dishes, set prices, toggle veg/non-veg tags & availability</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="addCategoryBtn"
                onClick={() => setIsAddCatModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Category
              </button>
              <button
                id="addMenuItemBtn"
                onClick={() => {
                  setNewItemData((prev) => ({
                    ...prev,
                    categoryId: categories[0]?.id || '',
                  }));
                  setIsAddItemModalOpen(true);
                }}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Menu Item
              </button>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 flex items-center gap-2 shadow-sm shrink-0"
              >
                <span>{cat.name}</span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                  {cat._count?.menuItems || 0}
                </span>
              </div>
            ))}
          </div>

          {/* Menu Items Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Diet</th>
                  <th className="py-3 px-4">Price (INR)</th>
                  <th className="py-3 px-4">Tax %</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 text-slate-600">{item.category?.name || 'General'}</td>
                    <td className="py-3 px-4">
                      {item.isVeg ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Veg
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          Non-Veg
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">₹{item.price}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.taxPercent}%</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          item.isAvailable
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.isAvailable ? 'Available' : 'Out of Stock'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: TABLES & FLOOR PLAN */}
      {activeTab === 'TABLES' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Floor Layout & Tables</h2>
              <p className="text-xs text-slate-500">Configure dining tables and guest seating capacities</p>
            </div>

            {/* Quick Add Table Form */}
            <form onSubmit={handleCreateTable} className="flex items-center gap-2">
              <input
                id="newTableNumberInput"
                type="text"
                placeholder="Table Number (e.g. Table 11)"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
              />
              <input
                id="newTableCapacityInput"
                type="number"
                min="1"
                placeholder="Seats"
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
              />
              <button
                id="createTableSubmitBtn"
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Table
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tables.map((t) => (
              <div
                key={t.id}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between min-h-[120px]"
              >
                <div className="flex items-start justify-between">
                  <span className="text-base font-bold text-slate-900">{t.tableNumber}</span>
                  <button
                    onClick={() => handleDeleteTable(t.id)}
                    className="text-slate-300 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2">
                  <p className="text-xs text-slate-500 font-medium">{t.capacity} Guests</p>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      t.status === 'FREE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : t.status === 'BILLING'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: STAFF CREDENTIAL MANAGEMENT */}
      {activeTab === 'STAFF' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Station Staff Credentials</h2>
              <p className="text-xs text-slate-500">
                Create User IDs for Waiter, Kitchen, and Billing modules. User IDs are unique to your restaurant.
              </p>
            </div>

            <button
              id="addStaffUserBtn"
              onClick={() => setIsAddStaffModalOpen(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Staff User
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">User ID (Login ID)</th>
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Module Access</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">@{staff.userId}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{staff.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                            staff.role === 'BILLING'
                              ? 'bg-blue-100 text-blue-700'
                              : staff.role === 'WAITER'
                              ? 'bg-emerald-100 text-emerald-700'
                              : staff.role === 'KITCHEN'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {staff.role === 'CUSTOMER_DISPLAY' ? (
                            <>
                              <QrCode className="w-3 h-3" /> Customer Display
                            </>
                          ) : (
                            staff.role
                          )}
                        </span>
                        {staff.role === 'CUSTOMER_DISPLAY' && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {staff.linkedBillingUserId
                              ? `Linked to @${staff.linkedBillingUserId}`
                              : 'All Counters (Unlinked)'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStaffActive(staff)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          staff.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {staff.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{new Date(staff.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Reset Password"
                          onClick={() => {
                            setResetStaffModal(staff);
                            setResetPasswordValue('');
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete User"
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: RESTAURANT PROFILE & SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="max-w-2xl bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Restaurant Profile & Tax Settings</h2>
          <p className="text-xs text-slate-500 mb-6">Update your UPI ID, GST rates, service charge and invoice templates.</p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Restaurant Name</label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  value={settingsForm.ownerName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, ownerName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UPI ID (VPA for QR)</label>
                <input
                  id="settingsUpiInput"
                  type="text"
                  value={settingsForm.upiId}
                  onChange={(e) => setSettingsForm({ ...settingsForm, upiId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-brand-600 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={settingsForm.address}
                onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={settingsForm.gstin}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gstin: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax %</label>
                <input
                  type="number"
                  step="0.5"
                  value={settingsForm.taxPercent}
                  onChange={(e) => setSettingsForm({ ...settingsForm, taxPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Charge %</label>
                <input
                  type="number"
                  step="0.5"
                  value={settingsForm.serviceChargePercent}
                  onChange={(e) => setSettingsForm({ ...settingsForm, serviceChargePercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Header Text</label>
              <input
                type="text"
                value={settingsForm.billHeader}
                onChange={(e) => setSettingsForm({ ...settingsForm, billHeader: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Footer Note</label>
              <textarea
                rows={2}
                value={settingsForm.billFooter}
                onChange={(e) => setSettingsForm({ ...settingsForm, billFooter: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  id="showItemizedBillToggle"
                  type="checkbox"
                  checked={Boolean(settingsForm.showItemizedBillOnDisplay)}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, showItemizedBillOnDisplay: e.target.checked })
                  }
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Show itemised bill summary on customer display
                  </span>
                  <p className="text-[11px] text-slate-500">
                    When enabled, the Customer Display lists ordered items alongside the UPI QR code.
                  </p>
                </div>
              </label>
            </div>

            <button
              id="saveSettingsSubmitBtn"
              type="submit"
              className="py-3 px-6 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20"
            >
              Save Configuration
            </button>
          </form>
        </div>
      )}

      {/* Tab 6: REPORTS & EXPORT */}
      {activeTab === 'REPORTS' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historical Reports & Analytics</h2>
            <p className="text-xs text-slate-500">Download CSV export of settled bills, tax records, and revenue</p>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Export All Bills & Tax Ledger (CSV)</h4>
              <p className="text-xs text-slate-500 mt-0.5">Compatible with Excel, Tally, and accounting software</p>
            </div>

            <a
              id="downloadCsvBtn"
              href="/api/reports/export-csv"
              download
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Bills CSV
            </a>
          </div>
        </div>
      )}

      {/* Modal: Add Menu Item */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-4">Add Menu Item</h3>
            <form onSubmit={handleCreateMenuItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                <input
                  id="newItemNameInput"
                  type="text"
                  required
                  placeholder="e.g. Kadai Paneer"
                  value={newItemData.name}
                  onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    id="newItemCategorySelect"
                    value={newItemData.categoryId}
                    onChange={(e) => setNewItemData({ ...newItemData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    id="newItemPriceInput"
                    type="number"
                    min="0"
                    required
                    placeholder="250"
                    value={newItemData.price || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Diet Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemData({ ...newItemData, isVeg: true })}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border ${
                      newItemData.isVeg ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemData({ ...newItemData, isVeg: false })}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border ${
                      !newItemData.isVeg ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients or description..."
                  value={newItemData.description}
                  onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="saveNewItemBtn"
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-3">Create Menu Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  id="newCatNameInput"
                  type="text"
                  required
                  placeholder="e.g. Sizzlers, Mocktails"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCatModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="saveNewCategoryBtn"
                  type="submit"
                  className="flex-1 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Staff User */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Staff Workstation Login</h3>
            <p className="text-xs text-slate-500 mb-4">User ID only needs to be unique within this restaurant</p>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">User ID *</label>
                <input
                  id="newStaffUserIdInput"
                  type="text"
                  required
                  placeholder="e.g. Root, waiter2, kitchen2"
                  value={newStaffData.userId}
                  onChange={(e) => setNewStaffData({ ...newStaffData, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Full Name *</label>
                <input
                  id="newStaffNameInput"
                  type="text"
                  required
                  placeholder="e.g. Sunita Devi"
                  value={newStaffData.name}
                  onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Station / Role *</label>
                <select
                  id="newStaffRoleSelect"
                  value={newStaffData.role}
                  onChange={(e) => setNewStaffData({ ...newStaffData, role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="BILLING">Billing Cashier (POS)</option>
                  <option value="WAITER">Floor Waiter (PWA)</option>
                  <option value="KITCHEN">Kitchen Cook (KDS)</option>
                  <option value="CUSTOMER_DISPLAY">Customer Display (QR Display)</option>
                </select>
              </div>

              {newStaffData.role === 'CUSTOMER_DISPLAY' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pair with Billing Counter (Optional)
                  </label>
                  <select
                    id="newStaffLinkedBillingSelect"
                    value={newStaffData.linkedBillingUserId}
                    onChange={(e) =>
                      setNewStaffData({ ...newStaffData, linkedBillingUserId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="">No pairing (Shows all restaurant pending payments)</option>
                    {staffList
                      .filter((s) => s.role === 'BILLING')
                      .map((b) => (
                        <option key={b.id} value={b.userId}>
                          Pair with Counter @{b.userId} ({b.name})
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    If linked, this display screen only shows payments initiated by that cashier counter.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  id="newStaffPasswordInput"
                  type="password"
                  required
                  placeholder="At least 4 characters"
                  value={newStaffData.password}
                  onChange={(e) => setNewStaffData({ ...newStaffData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="saveNewStaffBtn"
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20"
                >
                  Create Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Staff Password */}
      {resetStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Set new password for <span className="font-mono font-bold text-slate-800">@{resetStaffModal.userId}</span> ({resetStaffModal.name})
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
                <input
                  id="resetStaffPasswordInput"
                  type="password"
                  required
                  placeholder="At least 4 characters"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetStaffModal(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="submitResetPasswordBtn"
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
