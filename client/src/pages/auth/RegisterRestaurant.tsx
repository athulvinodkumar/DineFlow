import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  UtensilsCrossed,
  Copy,
  Check,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  QrCode,
  KeyRound,
  FileText,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const RegisterRestaurant: React.FC = () => {
  const navigate = useNavigate();
  const { registerRestaurant } = useAuth();

  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    upiId: '',
    adminPassword: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdRestaurant, setCreatedRestaurant] = useState<{ id: string; code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !formData.restaurantName ||
      !formData.ownerName ||
      !formData.email ||
      !formData.phone ||
      !formData.address ||
      !formData.upiId ||
      !formData.adminPassword
    ) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    const result = await registerRestaurant(formData);
    setIsLoading(false);

    if (result.success && result.restaurant) {
      setCreatedRestaurant(result.restaurant);
    } else {
      setError(result.error || 'Failed to create restaurant account');
    }
  };

  const handleCopyCode = () => {
    if (createdRestaurant?.code) {
      navigator.clipboard.writeText(createdRestaurant.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProceedToAdmin = () => {
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-100 flex items-center justify-center">
      {/* Success Modal / Display of newly created Restaurant ID */}
      {createdRestaurant ? (
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center animate-fade-in">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Restaurant Created!</h2>
          <p className="text-sm text-slate-400 mb-6">{createdRestaurant.name}</p>

          <div className="bg-slate-900/90 border-2 border-brand-500/40 rounded-2xl p-5 mb-6 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-bl-xl">
              Save This ID
            </div>
            <p className="text-xs text-slate-400 mb-1 font-medium">Your Unique Restaurant ID (Code):</p>
            <div className="flex items-center justify-between mt-2">
              <span id="generatedRestaurantCode" className="text-3xl font-extrabold font-mono text-brand-400 tracking-wider">
                {createdRestaurant.code}
              </span>
              <button
                id="copyRestaurantCodeBtn"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-brand-400" /> Copy ID
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-800 pt-2 leading-relaxed">
              Your staff (waiters, kitchen cooks, cashiers) will use this Restaurant ID to log in to their respective stations.
            </p>
          </div>

          <button
            id="proceedToAdminBtn"
            onClick={handleProceedToAdmin}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/25 transition-all text-sm"
          >
            Open Admin Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="max-w-xl w-full bg-slate-800/90 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create Restaurant Account</h2>
              <p className="text-xs text-slate-400">Launch your multi-station restaurant in 60 seconds</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Restaurant Name *</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    name="restaurantName"
                    type="text"
                    required
                    placeholder="e.g. Royal Punjab Dhaba"
                    value={formData.restaurantName}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner Name *</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    name="ownerName"
                    type="text"
                    required
                    placeholder="e.g. Gurdeep Singh"
                    value={formData.ownerName}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="owner@restaurant.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    name="phone"
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Restaurant Address *</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  name="address"
                  type="text"
                  required
                  placeholder="Plot 10, MG Road, Sector 14, Delhi NCR"
                  value={formData.address}
                  onChange={handleChange}
                  className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">UPI ID (VPA for QR) *</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <input
                    name="upiId"
                    type="text"
                    required
                    placeholder="myrestaurant@okaxis"
                    value={formData.upiId}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">GSTIN (Optional)</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <input
                    name="gstin"
                    type="text"
                    placeholder="07AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={handleChange}
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Admin Password *</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  name="adminPassword"
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              id="registerSubmitButton"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white rounded-xl font-semibold shadow-md shadow-brand-500/25 transition-all text-sm disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Register & Generate Restaurant ID <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold ml-1">
              Log In to Workstation
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
