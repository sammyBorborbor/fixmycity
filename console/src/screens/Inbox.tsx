import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useStore, CATEGORIES } from '../lib/store.tsx';
import type { AppOutletContext } from '../App.tsx';
import FilterChips from '../components/FilterChips.tsx';
import DataTable from '../components/DataTable.tsx';

const FILTERS = ['All', 'Submitted', 'Acknowledged', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Reopened'];
const CATEGORY_OPTS = Object.keys(CATEGORIES);
const NO_UNREAD = new Set<string>();
const selCls = 'rounded-lg ring-1 ring-gray-300 bg-white px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ocean cursor-pointer';

export default function Inbox() {
  const { reports, crews, settings } = useStore();
  const { openRow, activeId } = useOutletContext<AppOutletContext>();
  const [filter, setFilter] = useState(() => settings.defaultFilter || 'All');
  const [category, setCategory] = useState('All');
  const [location, setLocation] = useState('All');
  const [crew, setCrew] = useState('All'); // 'All' | 'unassigned' | crewId
  const unread = NO_UNREAD;

  // neighbourhoods actually present in the data (avoids empty options)
  const locationOpts = useMemo(
    () => Array.from(new Set(reports.map(r => r.location))).sort(),
    [reports],
  );

  // reports narrowed by the secondary (non-status) filters; the status-chip
  // counts are computed over this so they stay meaningful as you filter.
  const base = useMemo(() => reports.filter(r =>
    (category === 'All' || r.category === category)
    && (location === 'All' || r.location === location)
    && (crew === 'All' || (crew === 'unassigned' ? !r.crew : r.crew === crew)),
  ), [reports, category, location, crew]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: base.length };
    FILTERS.slice(1).forEach(f => c[f] = base.filter(r => r.status === f).length);
    return c;
  }, [base]);

  const rows = filter === 'All' ? base : base.filter(r => r.status === filter);
  const sorted = [...rows].sort((a, b) => new Date(b.timeline[0].timestamp).getTime() - new Date(a.timeline[0].timestamp).getTime());

  const anySecondary = category !== 'All' || location !== 'All' || crew !== 'All';
  const clearAll = () => { setCategory('All'); setLocation('All'); setCrew('All'); };

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Inbox</h1>
        <span className="text-sm text-muted">{reports.length} total reports</span>
      </div>
      <p className="text-sm text-muted mb-4">Incoming citizen reports across Greater Accra</p>

      {/* status filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <FilterChips filters={FILTERS} counts={counts} active={filter} onChange={setFilter} />
      </div>

      {/* category / location / crew filters (combine with the status chips) */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)} className={selCls}>
          <option value="All">All categories</option>
          {CATEGORY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by area" value={location} onChange={e => setLocation(e.target.value)} className={selCls}>
          <option value="All">All areas</option>
          {locationOpts.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select aria-label="Filter by crew" value={crew} onChange={e => setCrew(e.target.value)} className={selCls}>
          <option value="All">All crews</option>
          <option value="unassigned">Unassigned</option>
          {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {anySecondary && (
          <button onClick={clearAll} className="text-xs font-semibold text-ocean hover:underline">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-muted">{sorted.length} shown</span>
      </div>

      {/* table */}
      <DataTable rows={sorted} openRow={openRow} activeId={activeId} unread={unread} compact={settings.compact}
        emptyLabel="No reports match these filters." />
    </div>
  );
}
