import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UtensilsCrossed, ShieldAlert, ArrowRight, Building2, User, KeyRound } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginStaff } = useAuth();

  const [restaurantCode, setRestaurantCode] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!restaurantCode.trim() || !userId.trim() || !password) {
      setError('Please fill in Restaurant ID, User ID and Password');
      return;
    }

    setIsLoading(true);
    const result = await loginStaff(restaurantCode.trim(), userId.trim(), password);
    setIsLoading(false);

    if (result.success && result.redirectUrl) {
      navigate(result.redirectUrl);
    } else {
      setError(result.error || 'Authentication failed. Please verify credentials.');
    }
  };

  // Demo shortcut helper for fast testing
  const fillCredentials = (rCode: string, uId: string, pWord: string) => {
    setRestaurantCode(rCode);
    setUserId(uId);
    setPassword(pWord);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500 to-amber-400 flex items-center justify-center text-white shadow-xl shadow-brand-500/25 mb-4 transform hover:scale-105 transition-transform">
          <UtensilsCrossed className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">DineFlow</h2>
        <p className="mt-1 text-sm text-slate-400">Multi-Tenant Restaurant Operating System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-800/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-700/60 sm:px-10">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Staff Login</h3>
            <p className="text-xs text-slate-400 mt-0.5">Enter your restaurant ID and station credentials to begin</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Restaurant ID (Code)
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  id="restaurantCodeInput"
                  type="text"
                  required
                  placeholder="e.g. RST-10101"
                  value={restaurantCode}
                  onChange={(e) => setRestaurantCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                User ID
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="userIdInput"
                  type="text"
                  required
                  placeholder="e.g. Root, waiter1, kitchen1"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="passwordInput"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                />
              </div>
            </div>

            <button
              id="loginSubmitButton"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-brand-500 transition-all disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Log In to Workstation <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Autofill Pills */}
          <div className="mt-6 pt-5 border-t border-slate-700/60">
            <p className="text-[11px] font-medium text-slate-400 mb-2">Demo Credentials (Click to Autofill):</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('RST-10101', 'Root', 'password123')}
                className="px-2 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] font-medium transition-colors text-center"
              >
                Billing (Root)
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('RST-10101', 'waiter1', 'password123')}
                className="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition-colors text-center"
              >
                Waiter (waiter1)
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('RST-10101', 'kitchen1', 'password123')}
                className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition-colors text-center"
              >
                Kitchen (kitchen1)
              </button>
            </div>
          </div>

          {/* Account Creation & Admin Links */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <Link
              to="/register"
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              + Create Restaurant
            </Link>
            <Link
              to="/admin-login"
              className="text-slate-300 hover:text-white font-medium transition-colors"
            >
              Owner / Admin Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
