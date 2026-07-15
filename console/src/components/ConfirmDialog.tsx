import type { ReactNode } from 'react';
import Btn from './Btn.tsx';

/* ---------------------------------------------------------------------------
   Reusable confirm modal: dimmed backdrop + centered card, mirroring the
   DetailPanel overlay convention. Used to guard impactful actions (role change,
   suspend) before they fire. Backdrop click or Cancel dismisses.
--------------------------------------------------------------------------- */

interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, body, confirmLabel, variant = 'primary', busy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[55] fade-in" onClick={busy ? undefined : onCancel} />
      <div className="fixed inset-0 z-[56] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[420px] bg-white rounded-xl ring-1 ring-black/5 shadow-2xl p-5 fade-in">
          <h2 className="font-bold text-navy text-lg">{title}</h2>
          <div className="mt-2 text-sm text-ink leading-relaxed">{body}</div>
          <div className="flex gap-2 mt-5">
            <Btn variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>Cancel</Btn>
            <Btn variant={variant} className="flex-1" onClick={onConfirm} disabled={busy}>
              {busy ? 'Working…' : confirmLabel}
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}
