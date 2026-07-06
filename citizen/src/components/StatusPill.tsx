import { STATUS } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';

/* Status pill. */
export default function StatusPill({ status, size = 'sm' }: { status: StatusName; size?: 'sm' | 'lg' }) {
  const cfg = STATUS[status] || STATUS.Submitted;
  const pad = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap ${cfg.pill} ${pad}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}
