import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, clearNotification } = useSocket();

  if (notifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-xl p-3.5 border border-slate-800 flex items-start gap-3 transform transition-all duration-300 animate-slide-up"
        >
          <div className="mt-0.5">{getIcon(notif.type)}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{notif.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5">{notif.message}</p>
          </div>
          <button
            onClick={() => clearNotification(notif.id)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
