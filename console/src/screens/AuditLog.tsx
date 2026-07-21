import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore, STATUS, crewName, fmtDate } from '../lib/store.tsx';
import type { CategoryName, LocationName, StatusName } from '../lib/store.tsx';
import type { AppOutletContext } from '../App.tsx';
import Icon from '../components/Icon.tsx';
import StatusPill from '../components/StatusPill.tsx';
import FilterChips from '../components/FilterChips.tsx';

const AUDIT_VERB: Record<StatusName, { verb: string; icon: string }> = {
  Submitted:    { verb: 'submitted a new report',  icon: 'FilePlus2' },
  Acknowledged: { verb: 'acknowledged report',     icon: 'CheckCircle2' },
  Assigned:     { verb: 'assigned report',         icon: 'UserPlus' },
  'In Progress':{ verb: 'started work on report',  icon: 'Play' },
  Resolved:     { verb: 'resolved report',         icon: 'CheckCheck' },
  Rejected:     { verb: 'rejected report',         icon: 'Ban' },
  Reopened:     { verb: 'reopened report',         icon: 'RotateCcw' },
};
const AUDIT_FILTERS = ['All', 'Submitted', 'Acknowledged', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Reopened'];

interface AuditEntry {
  key: string;
  ref: string;
  category: CategoryName;
  location: LocationName;
  status: StatusName;
  actor: string;
  timestamp: string;
  detail: string;
}

export default function AuditLog() {
  const { reports } = useStore();
  const { openRow } = useOutletContext<AppOutletContext>();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');

  // flatten every timeline event into a chronological audit entry
  const entries = useMemo(() => {
    const all: AuditEntry[] = [];
    reports.forEach(r => {
      (r.timeline || []).forEach((e, i) => {
        all.push({
          key: r.id + '-' + i + '-' + e.status,
          ref: r.id, category: r.category, location: r.location,
          status: e.status, actor: e.actor || '—', timestamp: e.timestamp,
          detail: e.status === 'Assigned' && r.crew ? `to ${crewName(r.crew)}` :
                  (e.status === 'Rejected' && r.rejectReason ? `· ${r.rejectReason}` : ''),
        });
      });
    });
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reports]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: entries.length };
    AUDIT_FILTERS.slice(1).forEach(f => c[f] = entries.filter(e => e.status === f).length);
    return c;
  }, [entries]);

  const q = query.trim().toLowerCase();
  const rows = entries.filter(e =>
    (filter === 'All' || e.status === filter) &&
    (!q || e.ref.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q) ||
     e.location.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
  );

  // group by calendar day for readable section headers
  const groups: { day: string; items: AuditEntry[] }[] = [];
  rows.forEach(e => {
    const day = new Date(e.timestamp).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    let g = groups.find(g => g.day === day);
    if (!g) { g = { day, items: [] }; groups.push(g); }
    g.items.push(e);
  });

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Audit Log</h1>
        <span className="text-sm text-muted">{entries.length} recorded events</span>
      </div>
      <p className="text-sm text-muted mb-4">Immutable record of every action taken on a report</p>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChips filters={AUDIT_FILTERS} counts={counts} active={filter} onChange={setFilter} />
        <div className="relative ml-auto">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search actor, reference, location…"
            className="bg-white rounded-xl ring-1 ring-gray-200 pl-9 pr-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ocean/40" />
        </div>
      </div>

      {/* feed */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        {groups.length === 0 && <p className="px-4 py-12 text-center text-muted">No events match your filters.</p>}
        {groups.map(g => (
          <div key={g.day}>
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">{g.day}</span>
            </div>
            {g.items.map(e => {
              const cfg = STATUS[e.status] || STATUS.Submitted;
              const v = AUDIT_VERB[e.status] || { verb: 'updated report', icon: 'Circle' };
              return (
                <button key={e.key} onClick={() => openRow(e.ref)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                  <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: cfg.dot }}>
                    <Icon name={v.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <span className="font-semibold text-navy">{e.actor}</span> {v.verb}{' '}
                      <span className="font-mono text-[13px] text-ocean">{e.ref}</span>
                      {e.detail && <span className="text-muted"> {e.detail}</span>}
                    </p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <Icon name="MapPin" size={11} /> {e.location}
                      <span className="text-gray-300">·</span> {e.category}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={e.status} />
                    <p className="text-[11px] text-muted mt-1">{fmtDate(e.timestamp)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
