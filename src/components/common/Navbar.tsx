import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  UtensilsCrossed,
  LogOut,
  Copy,
  Check,
  LayoutDashboard,
  Receipt,
  ChefHat,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, restaurant, logout } = useAuth();
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  if (!user || !restaurant) return null;
  if (location.pathname === '/display' || user.role === 'CUSTOMER_DISPLAY') return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(restaurant.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Admin</span>;
      case 'BILLING':
        return <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Cashier</span>;
      case 'WAITER':
        return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Waiter</span>;
      case 'KITCHEN':
        return <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><ChefHat className="w-3.5 h-3.5" /> Kitchen</span>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Restaurant Code */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-slate-900 leading-tight">DineFlow</h1>
                <p className="text-xs font-medium text-slate-500 truncate max-w-[180px]">{restaurant.name}</p>
              </div>
            </Link>

            {/* Restaurant Code badge with Copy Button */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-slate-500 font-mono text-[11px]">ID:</span>
              <span className="font-mono font-bold text-slate-800">{restaurant.code}</span>
              <button
                onClick={handleCopyCode}
                title="Copy Restaurant ID for staff login"
                className="text-slate-400 hover:text-brand-600 transition-colors ml-1 p-0.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Center: Admin Module Navigation Switcher (for Admins) */}
          {user.role === 'ADMIN' && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith('/admin') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Admin
              </Link>
              <Link
                to="/billing"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  location.pathname === '/billing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" /> Billing POS
              </Link>
              <Link
                to="/waiter"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  location.pathname === '/waiter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Waiter View
              </Link>
              <Link
                to="/kitchen"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  location.pathname === '/kitchen' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" /> KDS
              </Link>
            </nav>
          )}

          {/* Right: User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getRoleBadge(user.role)}
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-800">{user.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">@{user.userId}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
