import { create } from 'zustand';

export type ToastTone = 'info' | 'good' | 'bad' | 'uno';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  icon?: string;
}

interface ToastStore {
  toasts: Toast[];
  push(message: string, tone?: ToastTone, icon?: string): void;
  dismiss(id: number): void;
}

let nextId = 1;
const MAX_TOASTS = 4;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push(message, tone = 'info', icon) {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, tone, icon }].slice(-MAX_TOASTS) });
    setTimeout(() => get().dismiss(id), tone === 'bad' ? 3600 : 2800);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (message: string, tone?: ToastTone, icon?: string): void =>
  useToastStore.getState().push(message, tone, icon);
