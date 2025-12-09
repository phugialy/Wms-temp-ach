import { useEffect } from 'react';
import { useToastStore } from '../../stores/toastStore';
import type { ToastMessage } from '../../types';

const Toast = ({ toast }: { toast: ToastMessage }) => {
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500 text-white border-green-600';
      case 'error':
        return 'bg-red-500 text-white border-red-600';
      case 'warning':
        return 'bg-yellow-500 text-white border-yellow-600';
      case 'info':
        return 'bg-blue-500 text-white border-blue-600';
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-2 ${getStyles()} min-w-80 animate-slide-in flex items-center justify-between gap-4`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">{getIcon()}</span>
        <span>{toast.message}</span>
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-white hover:text-gray-200 font-bold"
      >
        ×
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default Toast;

