import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { TableItem, Order, Bill } from '../../types';
import {
  Receipt,
  QrCode,
  CreditCard,
  Banknote,
  Printer,
  CheckCircle2,
  Clock,
  Search,
  Sparkles,
  ArrowRight,
  X,
  Plus,
  Percent,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

export const BillingView: React.FC = () => {
  const { authFetch, restaurant } = useAuth();
  const { socket, addToast } = useSocket();

  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [billCalculation, setBillCalculation] = useState<any>(null);

  // Discount state
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FLAT'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Modals
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [upiUri, setUpiUri] = useState<string>('');
  const [currentBill, setCurrentBill] = useState<Bill | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);

  // Bill History tab
  const [viewTab, setViewTab] = useState<'POS' | 'HISTORY'>('POS');
  const [pastBills, setPastBills] = useState<Bill[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // Fetch tables and bills
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
      console.error(err);
    }
  };

  const fetchTableBill = async (tableId: string) => {
    try {
      const res = await authFetch(`/api/bills/table/${tableId}`);
      const data = await res.json();
      if (data.success) {
        setActiveOrder(data.order);
        setBillCalculation(data.billPreview);
        if (data.existingBill) {
          setCurrentBill(data.existingBill);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBillHistory = async () => {
    try {
      const res = await authFetch('/api/bills');
      const data = await res.json();
      if (data.success) {
        setPastBills(data.bills);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchBillHistory();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableBill(selectedTable.id);
    } else {
      setActiveOrder(null);
      setBillCalculation(null);
      setCurrentBill(null);
    }
  }, [selectedTable?.id]);

  // Listen for real-time events
  useEffect(() => {
    if (!socket) return;

    const handleTableChange = () => {
      fetchTables();
      if (selectedTable) fetchTableBill(selectedTable.id);
    };

    socket.on('table:status_changed', handleTableChange);
    socket.on('order:created', handleTableChange);
    socket.on('order:kot_added', handleTableChange);
    socket.on('order:item_status_updated', handleTableChange);
    socket.on('bill:requested', handleTableChange);
    socket.on('bill:paid', () => {
      fetchTables();
      fetchBillHistory();
    });

    return () => {
      socket.off('table:status_changed', handleTableChange);
      socket.off('order:created', handleTableChange);
      socket.off('order:kot_added', handleTableChange);
      socket.off('order:item_status_updated', handleTableChange);
      socket.off('bill:requested', handleTableChange);
    };
  }, [socket, selectedTable?.id]);

  // Generate or regenerate bill calculation with discount
  const generateOfficialBill = async () => {
    if (!activeOrder) return null;
    try {
      const res = await authFetch('/api/bills/generate', {
        method: 'POST',
        body: JSON.stringify({
          orderId: activeOrder.id,
          discountType,
          discountValue: Number(discountValue) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBill(data.bill);
        setUpiUri(data.upiUri);
        return data;
      }
    } catch (err) {
      console.error('Failed to generate bill:', err);
    }
    return null;
  };

  // If payment is pending (isUpiModalOpen), live regenerate when discount changes
  useEffect(() => {
    if (isUpiModalOpen && activeOrder) {
      const timer = setTimeout(() => {
        generateOfficialBill();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [discountType, discountValue, isUpiModalOpen]);

  // Open UPI QR modal
  const handleOpenUpiModal = async () => {
    const data = await generateOfficialBill();
    if (data) {
      setIsUpiModalOpen(true);
    }
  };

  // Cancel pending UPI payment session (reverts display to IDLE)
  const handleCancelUpiModal = async () => {
    if (currentBill?.id) {
      try {
        await authFetch(`/api/bills/${currentBill.id}/cancel-payment`, {
          method: 'POST',
        });
      } catch (err) {
        console.error('Cancel payment error:', err);
      }
    }
    setIsUpiModalOpen(false);
  };

  // Confirm payment settlement (UPI, Cash, Card)
  const handleConfirmPayment = async (mode: 'UPI' | 'CASH' | 'CARD') => {
    let billId = currentBill?.id;
    if (!billId) {
      const gen = await generateOfficialBill();
      if (gen) billId = gen.bill.id;
    }
    if (!billId) return;

    try {
      const res = await authFetch(`/api/bills/${billId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMode: mode }),
      });
      const data = await res.json();
      if (data.success) {
        soundFx.playSuccessChime();
        setPaymentSuccessData(data.bill);
        setIsUpiModalOpen(false);
        setIsInvoiceModalOpen(true); // Open invoice for instant printing
        setSelectedTable(null);
        fetchTables();
        fetchBillHistory();
      } else {
        addToast('Payment Error', data.error || 'Failed to settle bill', 'error');
      }
    } catch (err) {
      addToast('Error', 'Connection error during payment processing', 'error');
    }
  };

  // Calculated numbers with current local discount
  const rawSubtotal = billCalculation?.subtotal || 0;
  let computedDiscount = 0;
  if (discountType === 'PERCENT') {
    computedDiscount = (rawSubtotal * (Number(discountValue) || 0)) / 100;
  } else if (discountType === 'FLAT') {
    computedDiscount = Math.min(Number(discountValue) || 0, rawSubtotal);
  }
  const discountedSubtotal = Math.max(0, rawSubtotal - computedDiscount);
  const taxPct = restaurant?.taxPercent ?? 5.0;
  const servicePct = restaurant?.serviceChargePercent ?? 5.0;
  const computedTax = (discountedSubtotal * taxPct) / 100;
  const computedServiceCharge = (discountedSubtotal * servicePct) / 100;
  const grandTotal = discountedSubtotal + computedTax + computedServiceCharge;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Bar Switcher: POS Tables vs Historical Invoices */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Billing & Cashier Station</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live Table Settlement • UPI QR Integration • Tax Invoices</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              id="billingTabPos"
              onClick={() => setViewTab('POS')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'POS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Tables POS
            </button>
            <button
              id="billingTabHistory"
              onClick={() => setViewTab('HISTORY')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Bill History ({pastBills.length})
            </button>
          </div>
        </div>
      </div>

      {viewTab === 'POS' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Table Status Grid (7 cols) */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Dining Tables</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Free</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Occupied</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span> Bill Requested</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                const isFree = table.status === 'FREE';
                const isBilling = table.status === 'BILLING';
                const isOccupied = table.status === 'OCCUPIED';

                return (
                  <button
                    key={table.id}
                    id={`pos-table-${table.tableNumber.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => setSelectedTable(table)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between min-h-[120px] ${
                      isSelected
                        ? 'border-brand-600 ring-2 ring-brand-500/20 shadow-md'
                        : isFree
                        ? 'bg-white border-slate-200 hover:border-emerald-400'
                        : isBilling
                        ? 'bg-blue-50 border-blue-400 hover:border-blue-600 shadow-sm animate-pulse'
                        : 'bg-amber-50/60 border-amber-300 hover:border-amber-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-base font-bold text-slate-900">{table.tableNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isFree
                            ? 'bg-emerald-100 text-emerald-700'
                            : isBilling
                            ? 'bg-blue-100 text-blue-800 font-extrabold'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {table.status}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-slate-500">{table.capacity} Seater</p>
                      {table.currentOrder && (
                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                          {table.currentOrder.items?.filter((i) => i.status !== 'CANCELLED').length || 0} items active
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Active Order Details & Bill Settlement Panel (5 cols) */}
          <div className="lg:col-span-5">
            {!selectedTable ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <h3 className="text-base font-bold text-slate-700">Select a Table</h3>
                <p className="text-xs mt-1">Click any active table on the left to review its bill and collect payment.</p>
              </div>
            ) : !activeOrder || activeOrder.items.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <h3 className="text-base font-bold text-slate-900 mb-1">{selectedTable.tableNumber}</h3>
                <p className="text-xs text-emerald-600 font-medium mb-4">Table is currently FREE</p>
                <p className="text-xs text-slate-400">No active orders running on this table.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                {/* Panel Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedTable.tableNumber}</h3>
                      <span className="text-xs font-mono font-bold text-slate-500">#{activeOrder.orderNumber}</span>
                    </div>
                    <p className="text-xs text-slate-500">Waiter: {activeOrder.waiterName || 'Staff'}</p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      selectedTable.status === 'BILLING'
                        ? 'bg-blue-100 text-blue-700 animate-pulse'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedTable.status}
                  </span>
                </div>

                {/* Items List */}
                <div className="p-4 space-y-2 max-h-56 overflow-y-auto border-b border-slate-100">
                  {activeOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-slate-800 w-5">{item.quantity}x</span>
                        <span className="text-slate-700 font-medium truncate">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Discount Inputs */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-brand-600" /> Apply Discount
                    </span>
                    <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
                      <button
                        onClick={() => {
                          setDiscountType('NONE');
                          setDiscountValue(0);
                        }}
                        className={`px-2 py-0.5 rounded-md ${discountType === 'NONE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                      >
                        None
                      </button>
                      <button
                        id="discountPercentBtn"
                        onClick={() => setDiscountType('PERCENT')}
                        className={`px-2 py-0.5 rounded-md ${discountType === 'PERCENT' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'}`}
                      >
                        %
                      </button>
                      <button
                        id="discountFlatBtn"
                        onClick={() => setDiscountType('FLAT')}
                        className={`px-2 py-0.5 rounded-md ${discountType === 'FLAT' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'}`}
                      >
                        ₹ Flat
                      </button>
                    </div>
                  </div>

                  {discountType !== 'NONE' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        id="discountValueInput"
                        type="number"
                        min="0"
                        placeholder={discountType === 'PERCENT' ? 'e.g. 10 (%)' : 'e.g. 100 (₹)'}
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  )}
                </div>

                {/* Calculation Breakdown */}
                <div className="p-4 space-y-1.5 text-xs text-slate-600 bg-white">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{rawSubtotal.toFixed(2)}</span>
                  </div>

                  {computedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount ({discountType === 'PERCENT' ? `${discountValue}%` : 'Flat'})</span>
                      <span className="font-mono">-₹{computedDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>CGST ({taxPct / 2}%)</span>
                    <span className="font-mono">₹{(computedTax / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST ({taxPct / 2}%)</span>
                    <span className="font-mono">₹{(computedTax / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge ({servicePct}%)</span>
                    <span className="font-mono">₹{computedServiceCharge.toFixed(2)}</span>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold text-slate-900">
                    <span>Grand Total</span>
                    <span id="posGrandTotal" className="text-xl text-brand-600 font-mono">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Action Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
                  {/* UPI QR Code Trigger (Big & Vibrant) */}
                  <button
                    id="payViaUpiBtn"
                    onClick={handleOpenUpiModal}
                    className="w-full py-3.5 bg-gradient-to-r from-brand-600 via-amber-600 to-brand-600 hover:from-brand-500 hover:to-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all"
                  >
                    <QrCode className="w-5 h-5" /> Pay via UPI (Dynamic QR)
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="payCashBtn"
                      onClick={() => handleConfirmPayment('CASH')}
                      className="py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Banknote className="w-4 h-4 text-emerald-600" /> Cash Settlement
                    </button>
                    <button
                      id="payCardBtn"
                      onClick={() => handleConfirmPayment('CARD')}
                      className="py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-4 h-4 text-blue-600" /> Card Settlement
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Bill History View */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Historical Invoices</h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice or table..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Grand Total</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Payment Mode</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastBills
                  .filter((b) =>
                    !historySearch ||
                    b.billNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
                    (b.tableName && b.tableName.toLowerCase().includes(historySearch.toLowerCase()))
                  )
                  .map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-600">{bill.billNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{bill.tableName || 'Takeaway'}</td>
                      <td className="py-2.5 px-3 font-bold font-mono text-slate-900">₹{bill.grandTotal.toFixed(2)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          {bill.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{bill.paymentMode || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{new Date(bill.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setPaymentSuccessData(bill);
                            setIsInvoiceModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 ml-auto"
                        >
                          <Printer className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. UPI QR Code Modal (Customer-Facing & Cashier Confirmation) */}
      {isUpiModalOpen && currentBill && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center relative animate-fade-in">
            <button
              onClick={handleCancelUpiModal}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              title="Close and cancel pending display"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-3">
              <span className="px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full text-xs font-bold uppercase tracking-wider">
                UPI Instant Payment
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2">{restaurant?.name}</h3>
              <p className="text-xs text-slate-500 font-mono">Invoice: {currentBill.billNumber}</p>
            </div>

            {/* High-Resolution Dynamic QR Code */}
            <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-200 inline-block shadow-inner mb-3 relative">
              <QRCodeSVG
                id="upiQrCodeSvg"
                value={upiUri}
                size={210}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Grand Total Display */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase">Amount to Pay</span>
              <div id="upiModalAmount" className="text-3xl font-black text-brand-600 font-mono tracking-tight">
                ₹{currentBill.grandTotal.toFixed(2)}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">VPA: {restaurant?.upiId || 'dineflow@upi'}</p>
            </div>

            {/* Customer Prompt */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 mb-4 flex items-center justify-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
              <span>QR code is live on paired Customer Display</span>
            </div>

            {/* Cashier Action Buttons: Cancel or Confirm */}
            <div className="flex gap-2">
              <button
                id="cancelUpiPaymentBtn"
                onClick={handleCancelUpiModal}
                className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirmUpiReceivedBtn"
                onClick={() => handleConfirmPayment('UPI')}
                className="w-2/3 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Printable Bill / Tax Invoice Modal */}
      {isInvoiceModalOpen && paymentSuccessData && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsInvoiceModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 no-print"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Thermal Receipt Container */}
            <div id="printable-receipt" className="font-mono text-xs text-slate-900">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-base font-extrabold uppercase">{restaurant?.name}</h2>
                <p className="text-[10px] text-slate-600 mt-0.5">{restaurant?.address}</p>
                <p className="text-[10px] text-slate-600">Ph: {restaurant?.phone}</p>
                {restaurant?.gstin && <p className="text-[10px] text-slate-600">GSTIN: {restaurant.gstin}</p>}
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Bill No: <b>{paymentSuccessData.billNumber}</b></span>
                  <span>Table: <b>{paymentSuccessData.tableName || 'Takeaway'}</b></span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>Date: {new Date().toLocaleDateString()}</span>
                  <span>Time: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-2 border-b border-dashed border-slate-300 space-y-1">
                {paymentSuccessData.order?.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[150px]">{item.quantity}x {item.name}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{paymentSuccessData.subtotal?.toFixed(2)}</span>
                </div>
                {paymentSuccessData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-₹{paymentSuccessData.discountAmount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>CGST (2.5%):</span>
                  <span>₹{(paymentSuccessData.taxAmount / 2)?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST (2.5%):</span>
                  <span>₹{(paymentSuccessData.taxAmount / 2)?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge:</span>
                  <span>₹{paymentSuccessData.serviceChargeAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                  <span>GRAND TOTAL:</span>
                  <span>₹{paymentSuccessData.grandTotal?.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 text-center text-[10px] text-slate-600 space-y-1">
                <p className="font-bold uppercase text-emerald-700">PAID VIA {paymentSuccessData.paymentMode}</p>
                <p className="text-[9px] text-slate-400">Ref: {paymentSuccessData.transactionRef || 'N/A'}</p>
                {restaurant?.billFooter && (
                  <p className="whitespace-pre-line mt-2 italic text-slate-500">{restaurant.billFooter}</p>
                )}
              </div>
            </div>

            {/* Print and Close buttons */}
            <div className="mt-6 flex items-center gap-2 no-print">
              <button
                id="printReceiptBtn"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
