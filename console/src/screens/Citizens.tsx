import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Pagination, { usePaginated } from '../components/Pagination.tsx';

/* Read-only directory of registered citizens (Administrator/Supervisor only).
   Data comes from the store's `citizens` (profiles where role='citizen', with an
   embedded report count). No writes — citizen accounts are self-registered. */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Citizens() {
  const { citizens } = useStore();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return citizens;
    return citizens.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [citizens, query]);

  const activeCount = citizens.filter(c => c.active).length;
  const { pageItems, page, setPage, totalPages, total, pageSize } = usePaginated(shown, 20, query);

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Citizens</h1>
        <div className="relative w-64">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="w-full bg-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />
        </div>
      </div>
      <p className="text-sm text-muted mb-5">
        {citizens.length} registered {citizens.length === 1 ? 'citizen' : 'citizens'} · {activeCount} active
      </p>

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted bg-gray-50 border-b border-gray-100">
              <th className="font-semibold px-4 py-3">Name</th>
              <th className="font-semibold px-4 py-3">Joined</th>
              <th className="font-semibold px-4 py-3 text-right">Reports</th>
              <th className="font-semibold px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center ${c.active ? 'bg-ocean' : 'bg-gray-300'}`}>{c.initials}</span>
                    <div className="leading-tight"><p className="font-medium text-ink">{c.name}</p><p className="text-xs text-muted">{c.email}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{fmtDate(c.joinedAt)}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">{c.reportCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.active ? 'text-green-700' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-green-500' : 'bg-gray-300'}`} />{c.active ? 'Active' : 'Suspended'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            {citizens.length === 0 ? 'No registered citizens yet.' : `No citizens match “${query.trim()}”.`}
          </p>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
