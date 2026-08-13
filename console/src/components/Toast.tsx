import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon.tsx';
import { ToastContext } from '../lib/toastContext.ts';
import type { ToastApi, ToastKind } from '../lib/toastContext.ts';

/* ---------------------------------------------------------------------------
   Lightweight, dependency-free toast system.

   Deliberately kept in its own context (not folded into the big store value)
   so firing a toast doesn't re-render every store consumer. Mount <ToastProvider>
   once (see main.tsx) and call useToast() (lib/useToast.ts) anywhere below it:

     const toast = useToast();
     toast.success('Ama Darko is now an Administrator');
     toast.error('Could not update the role.');

   Split across three files (this component, lib/toastContext.ts, lib/useToast.ts)
   so each file exports only one kind of thing, which is what React Fast Refresh
   needs to hot-reload a component edit without a full page reload.
--------------------------------------------------------------------------- */

interface Toast { id: number; kind: ToastKind; message: string }

const style: Record<ToastKind, { icon: string; tint: string }> = {
  success: { icon: 'CheckCircle2', tint: 'text-green-600' },
  error:   { icon: 'AlertCircle',  tint: 'text-red-600' },
  info:    { icon: 'Info',         tint: 'text-ocean' },
};

const DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts(list => [...list, { id, kind, message }]);
    setTimeout(() => dismiss(id), DURATION);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: m => push('success', m),
    error:   m => push('error', m),
    info:    m => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2.5rem)]">
        {toasts.map(t => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="fade-in flex items-start gap-3 text-left bg-white rounded-xl ring-1 ring-black/5 shadow-lg px-4 py-3 hover:bg-gray-50 transition"
          >
            <Icon name={style[t.kind].icon} size={18} className={`${style[t.kind].tint} shrink-0 mt-0.5`} />
            <span className="text-sm text-ink leading-snug">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
