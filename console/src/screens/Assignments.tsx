import { useOutletContext } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import type { AppOutletContext } from '../App.tsx';
import StatusPill from '../components/StatusPill.tsx';
import CategoryBadge from '../components/CategoryBadge.tsx';

export default function Assignments() {
  const { reports, crews } = useStore();
  const { openRow } = useOutletContext<AppOutletContext>();

  const assigned = reports.filter(r => r.crew);
  const byCrew = crews.map(c => ({ crew: c, items: assigned.filter(r => r.crew === c.id) }));

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <h1 className="text-2xl font-bold text-navy mb-1">Assignments</h1>
      <p className="text-sm text-muted mb-5">Work assigned across field crews</p>
      <div className="grid grid-cols-3 gap-4">
        {byCrew.map(({ crew, items }) => (
          <div key={crew.id} className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div><p className="font-bold text-navy">{crew.name}</p><p className="text-xs text-muted">{crew.dept} · {(crew.roster ? crew.roster.length : crew.members || 0)} members</p></div>
              <span className="text-2xl font-bold text-ocean">{items.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.length === 0 && <p className="p-4 text-sm text-muted">No active assignments.</p>}
              {items.map(r => (
                <button key={r.id} onClick={() => openRow(r.id)} className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3">
                  <CategoryBadge category={r.category} size={32} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink truncate">{r.location}</p><p className="font-mono text-[11px] text-muted">{r.id}</p></div>
                  <StatusPill status={r.status} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
