import type { Report } from './store.tsx';

const DAY = 86_400_000;

export interface ResolutionMetrics {
  avgResLabel: string;      // e.g. "4.9d" or "—" when nothing is resolved yet
  resolvedThisWeek: number; // reports resolved in the last 7 days
  resolvedDelta: number;    // this week minus the previous 7-day window
}

const submittedTs = (r: Report) =>
  new Date((r.timeline.find(t => t.status === 'Submitted') ?? r.timeline[0]).timestamp).getTime();
const resolvedTs = (r: Report) => {
  const e = r.timeline.find(t => t.status === 'Resolved');
  return e ? new Date(e.timestamp).getTime() : null;
};

/* Live resolution KPIs from the status timeline: average submitted→resolved span
   and resolved-count this week vs last. `now` is injectable for testing. */
export function resolutionMetrics(reports: Report[], now: number = Date.now()): ResolutionMetrics {
  const resolved = reports.filter(r => r.status === 'Resolved');

  const spans = resolved
    .map(r => { const rt = resolvedTs(r); return rt === null ? null : (rt - submittedTs(r)) / DAY; })
    .filter((x): x is number => x !== null && x >= 0);
  const avg = spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null;

  const inWindow = (lo: number, hi: number) => resolved.filter(r => {
    const rt = resolvedTs(r); if (rt === null) return false;
    const age = (now - rt) / DAY; return age >= lo && age < hi;
  }).length;
  const thisWeek = inWindow(0, 7);

  return {
    avgResLabel: avg === null ? '—' : avg.toFixed(1) + 'd',
    resolvedThisWeek: thisWeek,
    resolvedDelta: thisWeek - inWindow(7, 14),
  };
}
