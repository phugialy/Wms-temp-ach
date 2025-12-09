import { create } from 'zustand';
import type { ToastMessage } from '../types';

interface ToastState {
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: ToastMessage = { id, message, type, duration };
    
    set((state) => ({ toasts: [...state.toasts, toast] }));
    
    // Auto remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

