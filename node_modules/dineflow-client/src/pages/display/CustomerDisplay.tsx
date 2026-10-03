import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  UtensilsCrossed,
  CheckCircle2,
  Maximize2,
  Minimize2,
  LogOut,
  WifiOff,
  ShoppingBag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface DisplayPaymentItem {
  name: string;
  quantity: number;
  price: number;
}

interface PendingPayment {
  billId: string;
  billNumber: string;
  tableName?: string | null;
  amount: number;
  subtotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  discountAmount: number;
  discountType: string;
  discountValue: number;
  cashierUserId?: string | null;
  upiUri: string;
  items?: DisplayPaymentItem[];
  initiatedAt?: string | null;
}

export const CustomerDisplay: React.FC = () => {
  const { user, restaurant, logout, authFetch } = useAuth();
  const { socket, isConnected } = useSocket();

  const [displayState, setDisplayState] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [successPayment, setSuccessPayment] = useState<{ billNumber: string; amount: number } | null>(null);
  const [showItemizedToggle, setShowItemizedToggle] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [longPressProgress, setLongPressProgress] = useState<number>(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  const wakeLockRef = useRef<any>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch current pending payment from REST endpoint
  const fetchCurrentPayment = async () => {
    try {
      const res = await authFetch('/api/display/current');
      const data = await res.json();
      if (data.success) {
        if (data.pendingPayment) {
          setPendingPayment(data.pendingPayment);
          setDisplayState('PENDING');
        } else {
          setPendingPayment(null);
          // Only drop to IDLE if not currently displaying the 5s SUCCESS screen
          setDisplayState((prev) => (prev === 'SUCCESS' ? 'SUCCESS' : 'IDLE'));
        }
      }
    } catch (err) {
      console.error('Failed to fetch display state:', err);
    }
  };

  useEffect(() => {
    fetchCurrentPayment();
  }, []);

  // 2. Screen Wake Lock API to keep screen awake on tablets/phones
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request skipped or unavailable:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        fetchCurrentPayment(); // Fresh fetch whenever phone/tablet is unlocked
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // 3. Socket.IO Real-time Events with Cashier Pairing
  useEffect(() => {
    if (!socket) return;

    // Filter helper: check if event belongs to this paired display
    const isEventForThisDisplay = (payloadCashierId?: string | null) => {
      const linkedCashier = user?.linkedBillingUserId;
      // If display is linked to a cashier, only accept if cashierUserId matches
      if (linkedCashier) {
        return payloadCashierId === linkedCashier;
      }
      // If not linked, accept all payments for this restaurant
      return true;
    };

    const handlePaymentInitiated = (data: any) => {
      if (!isEventForThisDisplay(data.cashierUserId)) return;
      setPendingPayment({
        billId: data.billId,
        billNumber: data.billNumber,
        tableName: data.tableName,
        amount: data.amount,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        serviceChargeAmount: data.serviceChargeAmount,
        discountAmount: data.discountAmount,
        discountType: data.discountType,
        discountValue: data.discountValue,
        cashierUserId: data.cashierUserId,
        upiUri: data.upiUri,
        items: data.items,
        initiatedAt: data.initiatedAt,
      });
      setDisplayState('PENDING');
    };

    const handlePaymentUpdated = (data: any) => {
      if (!isEventForThisDisplay(data.cashierUserId)) return;
      setPendingPayment({
        billId: data.billId,
        billNumber: data.billNumber,
        tableName: data.tableName,
        amount: data.amount,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        serviceChargeAmount: data.serviceChargeAmount,
        discountAmount: data.discountAmount,
        discountType: data.discountType,
        discountValue: data.discountValue,
        cashierUserId: data.cashierUserId,
        upiUri: data.upiUri,
        items: data.items,
        initiatedAt: data.initiatedAt,
      });
      setDisplayState('PENDING');
    };

    const handlePaymentConfirmed = (data: any) => {
      if (!isEventForThisDisplay(data.cashierUserId)) return;
      setSuccessPayment({
        billNumber: data.billNumber,
        amount: data.amount,
      });
      setPendingPayment(null);
      setDisplayState('SUCCESS');

      // Return automatically to IDLE after ~5 seconds
      const timer = setTimeout(() => {
        setDisplayState('IDLE');
        setSuccessPayment(null);
      }, 5000);

      return () => clearTimeout(timer);
    };

    const handlePaymentCancelled = (data: any) => {
      if (!isEventForThisDisplay(data.cashierUserId)) return;
      setPendingPayment(null);
      setDisplayState('IDLE');
    };

    // If socket reconnects, re-fetch state
    const handleReconnect = () => {
      fetchCurrentPayment();
    };

    socket.on('payment:initiated', handlePaymentInitiated);
    socket.on('payment:updated', handlePaymentUpdated);
    socket.on('payment:confirmed', handlePaymentConfirmed);
    socket.on('payment:cancelled', handlePaymentCancelled);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('payment:initiated', handlePaymentInitiated);
      socket.off('payment:updated', handlePaymentUpdated);
      socket.off('payment:confirmed', handlePaymentConfirmed);
      socket.off('payment:cancelled', handlePaymentCancelled);
      socket.off('connect', handleReconnect);
    };
  }, [socket, user?.linkedBillingUserId]);

  // 4. 15-minute Auto-expiry timer for abandoned payments
  useEffect(() => {
    if (displayState !== 'PENDING' || !pendingPayment?.initiatedAt) return;

    const checkExpiry = () => {
      const startTime = new Date(pendingPayment.initiatedAt!).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / (1000 * 60);

      if (elapsedMinutes >= 15) {
        setPendingPayment(null);
        setDisplayState('IDLE');
      }
    };

    const interval = setInterval(checkExpiry, 10000);
    return () => clearInterval(interval);
  }, [displayState, pendingPayment?.initiatedAt]);

  // 5. Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 6. Discreet Long-press Logout Handler (on brand name)
  const startLongPress = () => {
    setLongPressProgress(0);
    const start = Date.now();
    longPressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / 2000) * 100);
      setLongPressProgress(progress);
    }, 50);

    longPressTimerRef.current = setTimeout(() => {
      setShowLogoutConfirm(true);
      cancelLongPress();
    }, 2000);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
    setLongPressProgress(0);
  };

  const restaurantName = restaurant?.name || 'Restaurant';
  const showItemized = Boolean(restaurant?.showItemizedBillOnDisplay);

  return (
    <div
      id="customerDisplayRoot"
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 text-white select-none flex flex-col justify-between"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Top Discreet Control Bar */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3 bg-slate-900/60 backdrop-blur-md border-b border-white/5">
        {/* Brand & Linked Counter Status (Discreet Long-press Logout) */}
        <div
          id="displayBrandSection"
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          className="flex items-center gap-3 cursor-pointer group py-1"
          title="Press & hold 2 seconds to logout display"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              {restaurantName}
              {longPressProgress > 0 && (
                <span className="text-[10px] font-mono text-brand-400 bg-brand-950 px-1.5 py-0.5 rounded border border-brand-500/30 animate-pulse">
                  Hold {Math.round(longPressProgress)}%
                </span>
              )}
            </h1>
            <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
              <span>Customer Display</span>
              {user?.linkedBillingUserId ? (
                <span className="text-amber-400 font-mono text-[10px] bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  Counter: {user.linkedBillingUserId}
                </span>
              ) : (
                <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                  All Counters
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Status Badges: Reconnecting status & Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          {!isConnected && (
            <div
              id="displayReconnectingBadge"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Reconnecting...</span>
            </div>
          )}

          <button
            id="displayFullscreenBtn"
            onClick={toggleFullscreen}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Display Body - Switches among IDLE, PAYMENT PENDING, and PAYMENT SUCCESS */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-y-auto">
        {/* ======================================================== */}
        {/* STATE A: IDLE (No pending payment)                       */}
        {/* ======================================================== */}
        {displayState === 'IDLE' && (
          <div
            id="displayIdleState"
            className="flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 animate-fade-in"
          >
            {/* Ambient Glowing Brand Icon */}
            <div className="relative mb-6">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-tr from-brand-600/30 to-amber-500/20 border border-brand-500/20 flex items-center justify-center text-brand-400 shadow-2xl shadow-brand-500/10">
                <UtensilsCrossed className="w-14 h-14 sm:w-18 sm:h-18 stroke-[1.5]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center shadow">
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></div>
              </div>
            </div>

            <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
              Ready for Billing
            </span>

            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
              Welcome to {restaurantName}
            </h2>

            <p className="text-slate-400 text-sm sm:text-base font-medium max-w-sm mb-8 leading-relaxed">
              No pending payment. Your dynamic UPI QR code and bill will appear here instantly when the cashier begins settlement.
            </p>

            <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-900/60 px-4 py-2.5 rounded-2xl border border-white/5 shadow-inner">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Instant UPI Payments • GPay • PhonePe • Paytm • Any Bank App</span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STATE B: PAYMENT PENDING (Dynamic High-Contrast UPI QR)  */}
        {/* ======================================================== */}
        {displayState === 'PENDING' && pendingPayment && (
          <div
            id="displayPendingState"
            className="w-full max-w-4xl flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-10 my-auto py-2 animate-fade-in"
          >
            {/* Left Column: High-Contrast Dynamic QR Container */}
            <div className="flex flex-col items-center justify-center text-center">
              {/* Brightness-safe, Black-on-White QR Code with quiet-zone padding */}
              <div
                id="customerDisplayQrContainer"
                className="bg-white p-5 sm:p-7 rounded-3xl shadow-2xl shadow-brand-500/20 border-4 border-white flex flex-col items-center justify-center relative transition-transform hover:scale-[1.02]"
              >
                <QRCodeSVG
                  id="displayUpiQrSvg"
                  value={pendingPayment.upiUri}
                  size={window.innerWidth < 640 ? 240 : 290}
                  level="M"
                  includeMargin={true}
                  className="rounded-lg"
                />

                {/* Sub-label under QR */}
                <div className="mt-3 flex items-center justify-center gap-1.5 text-slate-900 font-extrabold text-[13px] tracking-tight">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified NPCI UPI Payment</span>
                </div>
              </div>

              {/* UPI Logo Badges */}
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
                <span className="bg-slate-900/80 px-2 py-1 rounded-lg border border-white/5">Google Pay</span>
                <span className="bg-slate-900/80 px-2 py-1 rounded-lg border border-white/5">PhonePe</span>
                <span className="bg-slate-900/80 px-2 py-1 rounded-lg border border-white/5">Paytm</span>
                <span className="bg-slate-900/80 px-2 py-1 rounded-lg border border-white/5">BHIM UPI</span>
              </div>
            </div>

            {/* Right Column: Amount, Bill Metadata & Optional Itemized Summary */}
            <div className="flex-1 w-full max-w-md flex flex-col justify-center">
              {/* Bill Details Header */}
              <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Invoice
                    </span>
                    <h3 id="displayBillNumber" className="text-base sm:text-lg font-black font-mono text-white">
                      {pendingPayment.billNumber}
                    </h3>
                  </div>

                  {pendingPayment.tableName && (
                    <div className="text-right">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Table / Mode
                      </span>
                      <p id="displayTableName" className="text-base font-bold text-amber-400">
                        {pendingPayment.tableName}
                      </p>
                    </div>
                  )}
                </div>

                {/* Big Grand Total Text */}
                <div className="py-2 text-center sm:text-left">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Total Amount to Pay
                  </span>
                  <div
                    id="displayGrandTotal"
                    className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 font-mono tracking-tight my-1"
                  >
                    ₹{pendingPayment.amount.toFixed(2)}
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    UPI VPA: <span className="text-slate-200">{restaurant?.upiId || 'dineflow@upi'}</span>
                  </p>
                </div>

                {/* Scan Callout */}
                <div className="mt-5 p-3.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                  <p className="text-xs sm:text-sm font-medium text-emerald-200">
                    Scan to pay with any UPI app on your phone.
                  </p>
                </div>

                {/* Optional Itemized Summary Toggle (if enabled in Admin Settings) */}
                {showItemized && pendingPayment.items && pendingPayment.items.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <button
                      id="displayToggleItemizedBtn"
                      onClick={() => setShowItemizedToggle(!showItemizedToggle)}
                      className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Itemised Bill Summary ({pendingPayment.items.length} items)</span>
                      </span>
                      {showItemizedToggle ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showItemizedToggle && (
                      <div id="displayItemizedList" className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1 animate-fade-in">
                        {pendingPayment.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/5 border border-white/5"
                          >
                            <span className="text-slate-300 truncate max-w-[200px]">
                              <span className="font-bold text-white mr-1.5">{item.quantity}x</span>
                              {item.name}
                            </span>
                            <span className="font-mono font-semibold text-slate-200">
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}

                        {pendingPayment.discountAmount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-400 px-2 py-0.5 font-semibold">
                            <span>Discount</span>
                            <span className="font-mono">-₹{pendingPayment.discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STATE C: PAYMENT SUCCESS (Green tick celebration screen) */}
        {/* ======================================================== */}
        {displayState === 'SUCCESS' && successPayment && (
          <div
            id="displaySuccessState"
            className="flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 animate-fade-in"
          >
            {/* Animated Celebration Icon */}
            <div className="relative mb-6">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 animate-bounce">
                <CheckCircle2 className="w-20 h-20 sm:w-24 sm:h-24 stroke-[2.5]" />
              </div>
              <Sparkles className="w-8 h-8 text-amber-300 absolute -top-2 -right-2 animate-spin" />
            </div>

            <span className="px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
              Payment Successful
            </span>

            <h2 id="displaySuccessTitle" className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2">
              Payment Received, Thank You!
            </h2>

            <div className="my-4 py-3 px-6 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 inline-block shadow-inner">
              <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider block">
                Amount Received
              </span>
              <div id="displaySuccessAmount" className="text-4xl sm:text-5xl font-black text-white font-mono mt-1">
                ₹{successPayment.amount.toFixed(2)}
              </div>
              <p className="text-xs text-emerald-300 font-mono mt-0.5">
                Invoice #{successPayment.billNumber}
              </p>
            </div>

            <p className="text-slate-400 text-xs sm:text-sm font-medium mt-4">
              We appreciate your visit. Returning to home screen shortly...
            </p>
          </div>
        )}
      </main>

      {/* Bottom Quiet Footer */}
      <footer className="px-4 sm:px-8 py-2.5 bg-slate-900/40 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
        <div>
          <span>{restaurantName} • Powered by DineFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Live Display Station</span>
        </div>
      </footer>

      {/* Discreet Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Exit Customer Display?</h3>
            <p className="text-xs text-slate-400 mb-6">
              This will log out the display device ({user?.userId}). Customers will no longer see QR codes.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="displayLogoutCancelBtn"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
              >
                Stay Active
              </button>
              <button
                id="displayLogoutConfirmBtn"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDisplay;
