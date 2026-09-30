'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (message: string, title?: string, duration?: number) =>
      addToast('success', message, title || 'Başarılı', duration),
    error: (message: string, title?: string, duration?: number) =>
      addToast('error', message, title || 'Hata', duration),
    warning: (message: string, title?: string, duration?: number) =>
      addToast('warning', message, title || 'Uyarı', duration),
    info: (message: string, title?: string, duration?: number) =>
      addToast('info', message, title || 'Bilgi', duration),
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onClose={() => removeToast(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ item: ToastItem; onClose: () => void }> = ({ item, onClose }) => {
  const configs = {
    success: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/40',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
      bar: 'bg-emerald-500',
    },
    error: {
      border: 'border-rose-500/30',
      bg: 'bg-rose-950/40',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
      bar: 'bg-rose-500',
    },
    warning: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-950/40',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
      bar: 'bg-amber-500',
    },
    info: {
      border: 'border-sky-500/30',
      bg: 'bg-sky-950/40',
      icon: <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />,
      bar: 'bg-sky-500',
    },
  };

  const config = configs[item.type];

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${config.border} ${config.bg} backdrop-blur-xl p-3.5 shadow-2xl shadow-black/50 transition-all duration-300 animate-in slide-in-from-top-2 fade-in`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1 min-w-0 pr-2">
          {item.title && (
            <p className="text-xs font-semibold text-white tracking-wide mb-0.5">{item.title}</p>
          )}
          <p className="text-xs text-gray-200 leading-relaxed break-words">{item.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded-lg hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar Animation */}
      {item.duration && item.duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 h-0.5 w-full ${config.bar} opacity-75`}
          style={{
            animation: `toast-progress ${item.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
