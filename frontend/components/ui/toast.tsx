'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
  link?: {
    text: string;
    href: string;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: 'success' | 'error', message: string) => void;
  removeToast: (id: string) => void;
}

// Simple toast store
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach(listener => listener([...toasts]));
}

export function addToast(
  type: 'success' | 'error',
  message: string,
  link?: { text: string; href: string }
) {
  const id = Math.random().toString(36).substring(7);
  toasts = [...toasts, { id, type, message, link }];
  notifyListeners();

  // Auto remove after 5 seconds (slightly longer if there's a link)
  setTimeout(() => {
    removeToast(id);
  }, link ? 5000 : 4000);
}

export function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
}

function useToasts() {
  const [localToasts, setLocalToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setLocalToasts);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setLocalToasts);
    };
  }, []);

  return localToasts;
}

export function ToastContainer() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-mplc-lg
            animate-in slide-in-from-right-5 duration-200
            ${toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
            }
          `}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{toast.message}</span>
            {toast.link && (
              <Link
                href={toast.link.href}
                className="text-xs font-semibold underline hover:no-underline"
                onClick={() => removeToast(toast.id)}
              >
                {toast.link.text} →
              </Link>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 p-1 hover:bg-black/5 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
