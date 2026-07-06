import Icon from './Icon.tsx';
import { STATUS, buildTimeline, fmtDate } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

/* Vertical status timeline. */
export default function Timeline({ report, compact = false }: { report: Report; compact?: boolean }) {
  const steps = buildTimeline(report);
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const cfg = STATUS[s.status] || STATUS.Submitted;
        const last = i === steps.length - 1;
        const next = steps[i + 1];
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {/* connector */}
            {!last && (
              <span
                className="absolute left-[11px] top-6 bottom-0 w-0.5"
                style={{ background: s.pending ? '#E5E7EB' : (next && next.pending ? '#E5E7EB' : cfg.dot + '55') }}
              />
            )}
            {/* node */}
            <span className="relative z-10 shrink-0 mt-0.5">
              {s.pending ? (
                <span className="block w-6 h-6 rounded-full border-2 border-dashed border-gray-300 bg-white" />
              ) : (
                <span className="flex items-center justify-center w-6 h-6 rounded-full text-white shadow-sm"
                      style={{ background: cfg.dot }}>
                  <Icon name="Check" size={14} strokeWidth={3} />
                </span>
              )}
            </span>
            {/* text */}
            <div className="min-w-0 flex-1 -mt-0.5">
              <p className={`font-semibold leading-tight ${s.pending ? 'text-gray-400' : 'text-ink'} ${compact ? 'text-sm' : 'text-[15px]'}`}>
                {cfg.label}
              </p>
              {!s.pending && (
                <p className="text-xs text-muted mt-0.5">
                  {fmtDate(s.timestamp)}{s.actor ? ` · ${s.actor}` : ''}
                </p>
              )}
              {!s.pending && s.status === 'Rejected' && report.rejectReason && (
                <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2 py-1 ring-1 ring-red-100">{report.rejectReason}</p>
              )}
              {s.pending && <p className="text-xs text-gray-300 mt-0.5">Pending</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
