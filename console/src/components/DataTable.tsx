import StatusPill from './StatusPill.tsx';
import CategoryBadge from './CategoryBadge.tsx';
import Icon from './Icon.tsx';
import { crewName, relTime } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

interface DataTableProps {
  rows: Report[];
  openRow: (id: string) => void;
  activeId: string | null;
  unread: Set<string>;
  compact?: boolean;
  emptyLabel?: string;
}

/* Reports table for the Inbox. `rows` is already filtered + sorted by the
   caller. `compact` (a per-user setting) tightens the row padding. */
export default function DataTable({ rows, openRow, activeId, unread, compact = false, emptyLabel = 'No reports.' }: DataTableProps) {
  const cell = compact ? 'px-4 py-1.5' : 'px-4 py-3';
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted bg-gray-50 border-b border-gray-100">
            <th className="font-semibold px-4 py-3">Reference</th>
            <th className="font-semibold px-4 py-3">Category</th>
            <th className="font-semibold px-4 py-3">Location</th>
            <th className="font-semibold px-4 py-3">Submitted</th>
            <th className="font-semibold px-4 py-3">Status</th>
            <th className="font-semibold px-4 py-3">Crew</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => openRow(r.id)}
              className={`border-b border-gray-50 last:border-0 cursor-pointer transition ${activeId === r.id ? 'bg-ocean/5' : 'hover:bg-gray-50'}`}>
              <td className={`${cell} font-mono text-[13px] text-navy font-medium whitespace-nowrap`}>
                <span className="flex items-center gap-1.5">
                  {unread.has(r.id) && <span className="w-2 h-2 rounded-full bg-gold pop-dot" title="New / updated" />}
                  {r.id}
                </span>
              </td>
              <td className={cell}>
                <span className="flex items-center gap-2 text-ink"><CategoryBadge category={r.category} size={compact ? 22 : 28} />{r.category}</span>
              </td>
              <td className={`${cell} text-muted whitespace-nowrap`}>
                <span className="inline-flex items-center gap-2">
                  {r.location}
                  {r.followerCount > 0 && (
                    <span title={`${r.followerCount} resident${r.followerCount === 1 ? '' : 's'} following`}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ocean bg-blue-50 ring-1 ring-blue-100 rounded-full px-1.5 py-0.5">
                      <Icon name="Users" size={11} /> {r.followerCount}
                    </span>
                  )}
                </span>
              </td>
              <td className={`${cell} text-muted whitespace-nowrap`}>{relTime(r.timeline[0].timestamp)}</td>
              <td className={cell}><StatusPill status={r.status} /></td>
              <td className={`${cell} text-muted whitespace-nowrap`}>{r.crew ? crewName(r.crew) : <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">{emptyLabel}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
