import { useContext } from 'react';
import { ToastContext } from './toastContext.ts';
import type { ToastApi } from './toastContext.ts';

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
