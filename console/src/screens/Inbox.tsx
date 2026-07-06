import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import type { AppOutletContext } from '../App.tsx';
import FilterChips from '../components/FilterChips.tsx';
import DataTable from '../components/DataTable.tsx';

const FILTERS = ['All', 'Submitted', 'Acknowledged', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Reopened'];
const NO_UNREAD = new Set<string>();

export default function Inbox() {
  const { reports } = useStore();
  const { openRow, activeId } = useOutletContext<AppOutletContext>();
  const [filter, setFilter] = useState('All');
  const unread = NO_UNREAD;

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: reports.length };
    FILTERS.slice(1).forEach(f => c[f] = reports.filter(r => r.status === f).length);
    return c;
  }, [reports]);

  const rows = filter === 'All' ? reports : reports.filter(r => r.status === filter);
  const sorted = [...rows].sort((a, b) => new Date(b.timeline[0].timestamp).getTime() - new Date(a.timeline[0].timestamp).getTime());

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Inbox</h1>
        <span className="text-sm text-muted">{reports.length} total reports</span>
      </div>
      <p className="text-sm text-muted mb-4">Incoming citizen reports across Greater Accra</p>

      {/* filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChips filters={FILTERS} counts={counts} active={filter} onChange={setFilter} />
      </div>

      {/* table */}
      <DataTable rows={sorted} openRow={openRow} activeId={activeId} unread={unread} emptyLabel={`No reports in “${filter}”.`} />
    </div>
  );
}
