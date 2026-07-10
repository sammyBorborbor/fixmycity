import { describe, it, expect } from 'vitest';
import { resolutionMetrics } from './metrics.ts';
import type { Report } from './store.tsx';

const NOW = Date.parse('2026-07-10T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

// minimal Report — resolutionMetrics only reads `status` + `timeline`
function rep(status: string, submittedDaysAgo: number, resolvedDaysAgo?: number): Report {
  const timeline = [{ status: 'Submitted', timestamp: daysAgo(submittedDaysAgo) }];
  if (resolvedDaysAgo !== undefined) timeline.push({ status: 'Resolved', timestamp: daysAgo(resolvedDaysAgo) });
  return { status, timeline } as unknown as Report;
}

describe('resolutionMetrics', () => {
  it('returns a dash and zeros when nothing is resolved', () => {
    const m = resolutionMetrics([rep('Submitted', 2), rep('Assigned', 3)], NOW);
    expect(m).toEqual({ avgResLabel: '—', resolvedThisWeek: 0, resolvedDelta: 0 });
  });

  it('averages the submitted→resolved span in days', () => {
    // resolved 2 days ago, submitted 6 days ago => 4.0d span
    const m = resolutionMetrics([rep('Resolved', 6, 2)], NOW);
    expect(m.avgResLabel).toBe('4.0d');
  });

  it('averages across multiple resolved reports', () => {
    const m = resolutionMetrics([rep('Resolved', 6, 2), rep('Resolved', 5, 1)], NOW); // spans 4d and 4d
    expect(m.avgResLabel).toBe('4.0d');
    const mixed = resolutionMetrics([rep('Resolved', 8, 2), rep('Resolved', 4, 2)], NOW); // 6d and 2d => 4.0
    expect(mixed.avgResLabel).toBe('4.0d');
  });

  it('counts resolved-this-week and the week-over-week delta', () => {
    const reports = [
      rep('Resolved', 5, 3),   // resolved 3d ago -> this week
      rep('Resolved', 4, 1),   // resolved 1d ago -> this week
      rep('Resolved', 12, 10), // resolved 10d ago -> last week
    ];
    const m = resolutionMetrics(reports, NOW);
    expect(m.resolvedThisWeek).toBe(2);
    expect(m.resolvedDelta).toBe(1); // 2 this week - 1 last week
  });

  it('ignores reopened reports (current status not Resolved)', () => {
    const m = resolutionMetrics([rep('Reopened', 5, 2)], NOW);
    expect(m.resolvedThisWeek).toBe(0);
    expect(m.avgResLabel).toBe('—');
  });
});
