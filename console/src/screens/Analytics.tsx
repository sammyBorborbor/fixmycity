import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useStore, CATEGORIES } from '../lib/store.tsx';
import type { CategoryName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';

function Kpi({ label, value, sub, icon, accent }: {
  label: string; value: ReactNode; sub?: string; icon: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: accent + '1a', color: accent }}><Icon name={icon} size={18} /></span>
      </div>
      <p className="text-3xl font-bold text-navy mt-3 leading-none">{value}</p>
      <p className="text-sm font-medium text-ink mt-1">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const { reports } = useStore();

  const byCat = (Object.keys(CATEGORIES) as CategoryName[]).map(c => ({ name: c, n: reports.filter(r => r.category === c).length }));
  const maxCat = Math.max(1, ...byCat.map(c => c.n));
  const backlog = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status)).length;

  // Real resolution metrics from the status timeline: submitted -> resolved span
  // (avg resolution time), and resolved-count this week vs last (week-over-week).
  const DAY = 86_400_000;
  const { avgResLabel, resolvedThisWeek, resolvedDelta } = useMemo(() => {
    const submittedTs = (r: typeof reports[number]) =>
      new Date((r.timeline.find(t => t.status === 'Submitted') ?? r.timeline[0]).timestamp).getTime();
    const resolvedTs = (r: typeof reports[number]) => {
      const e = r.timeline.find(t => t.status === 'Resolved');
      return e ? new Date(e.timestamp).getTime() : null;
    };
    const resolved = reports.filter(r => r.status === 'Resolved');
    const spans = resolved.map(r => { const rt = resolvedTs(r); return rt ? (rt - submittedTs(r)) / DAY : null; })
      .filter((x): x is number => x !== null && x >= 0);
    const avg = spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null;
    const resolvedInWindow = (lo: number, hi: number) => resolved.filter(r => {
      const rt = resolvedTs(r); if (rt === null) return false;
      const age = (Date.now() - rt) / DAY; return age >= lo && age < hi;
    }).length;
    const thisWeek = resolvedInWindow(0, 7);
    const delta = thisWeek - resolvedInWindow(7, 14);
    return { avgResLabel: avg === null ? '—' : avg.toFixed(1) + 'd', resolvedThisWeek: thisWeek, resolvedDelta: delta };
  }, [reports]);
  const deltaLabel = `${resolvedDelta >= 0 ? '+' : ''}${resolvedDelta} vs last week`;

  // reports over last 6 "weeks" buckets from submitted timestamps
  const weeks = useMemo(() => [0, 1, 2, 3, 4, 5].map(w => {
    const hi = w * 3, lo = (w + 1) * 3; // 3-day buckets
    return reports.filter(r => { const d = (Date.now() - new Date(r.timeline[0].timestamp).getTime()) / 86400000; return d >= hi && d < lo; }).length;
  }).reverse(), [reports]);
  const maxW = Math.max(1, ...weeks);
  const pts = weeks.map((n, i) => `${(i / (weeks.length - 1)) * 100},${40 - (n / maxW) * 34}`).join(' ');

  return (
    <div className="p-6 max-w-[1100px]">
      <h1 className="text-2xl font-bold text-navy mb-1">Analytics</h1>
      <p className="text-sm text-muted mb-5">Operational overview · Greater Accra pilot</p>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Total reports" value={reports.length} sub="All time" icon="FileText" accent="#1E5F8E" />
        <Kpi label="Resolved this week" value={resolvedThisWeek} sub={deltaLabel} icon="CheckCheck" accent="#16A34A" />
        <Kpi label="Avg. resolution time" value={avgResLabel} sub="Target: 5 days" icon="Clock" accent="#C8932F" />
        <Kpi label="Open backlog" value={backlog} sub="Needs action" icon="Layers" accent="#0B2545" />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* bar chart */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <h2 className="font-bold text-navy mb-4">Reports by category</h2>
          <div className="flex flex-col gap-4">
            {byCat.map(c => (
              <div key={c.name}>
                <div className="flex justify-between text-sm mb-1"><span className="text-ink flex items-center gap-2"><Icon name={CATEGORIES[c.name].icon} size={15} className="text-ocean" />{c.name}</span><span className="font-semibold text-navy">{c.n}</span></div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: (c.n / maxCat) * 100 + '%', background: 'linear-gradient(90deg,#1E5F8E,#0B2545)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* line chart */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <h2 className="font-bold text-navy mb-4">Reports over time</h2>
          <svg viewBox="0 0 100 44" className="w-full" style={{ height: 150 }} preserveAspectRatio="none">
            {[10, 20, 30].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#F1F5F9" strokeWidth="0.5" />)}
            <polyline points={pts} fill="none" stroke="#C8932F" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            {weeks.map((n, i) => <circle key={i} cx={(i / (weeks.length - 1)) * 100} cy={40 - (n / maxW) * 34} r="1.4" fill="#0B2545" />)}
          </svg>
          <div className="flex justify-between text-[11px] text-muted mt-1"><span>18d ago</span><span>today</span></div>
        </div>
      </div>
    </div>
  );
}
