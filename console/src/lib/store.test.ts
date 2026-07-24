import { describe, it, expect } from 'vitest';
import { STATUS, CANONICAL, CATEGORIES, relTime, buildTimeline, crewName, crewById } from './store.tsx';
import type { Report } from './store.tsx';

describe('status / category model', () => {
  it('defines all seven statuses and five canonical steps', () => {
    expect(Object.keys(STATUS)).toHaveLength(7);
    expect(CANONICAL).toEqual(['Submitted', 'Acknowledged', 'Assigned', 'In Progress', 'Resolved']);
    // canonical steps are a subset of the full status set
    for (const s of CANONICAL) expect(STATUS[s]).toBeDefined();
  });
  it('defines all nine CV-aligned categories', () => {
    expect(Object.keys(CATEGORIES).sort()).toEqual([
      'Blocked Drain', 'Broken Public Facility', 'Broken Streetlight', 'Flooding',
      'Illegal Dumping', 'Other', 'Pollution', 'Poor Sanitation', 'Pothole',
    ]);
  });
});

describe('relTime', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  it('minutes', () => {
    expect(relTime(ago(5 * 60_000))).toBe('5m ago');
    expect(relTime(ago(10_000))).toBe('1m ago'); // clamps to at least 1m
  });
  it('hours', () => expect(relTime(ago(2 * 3_600_000))).toBe('2h ago'));
  it('days (singular + plural)', () => {
    expect(relTime(ago(1 * 86_400_000))).toBe('1 day ago');
    expect(relTime(ago(3 * 86_400_000))).toBe('3 days ago');
  });
});

describe('buildTimeline', () => {
  const iso = '2026-07-08T10:00:00Z';
  const report = (status: string, statuses: string[]): Report =>
    ({ status, timeline: statuses.map(s => ({ status: s, timestamp: iso })) } as unknown as Report);

  it('marks completed steps done and appends the remaining canonical steps as pending', () => {
    const steps = buildTimeline(report('Acknowledged', ['Submitted', 'Acknowledged']));
    expect(steps).toHaveLength(5);
    expect(steps.filter(s => 'done' in s && s.done)).toHaveLength(2);
    expect(steps.filter(s => 'pending' in s && s.pending).map(s => s.status))
      .toEqual(['Assigned', 'In Progress', 'Resolved']);
  });

  it('a rejected report shows no pending steps', () => {
    const steps = buildTimeline(report('Rejected', ['Submitted', 'Rejected']));
    expect(steps).toHaveLength(2);
    expect(steps.some(s => 'pending' in s && s.pending)).toBe(false);
  });
});

describe('crew lookups (seed fallback)', () => {
  it('resolves seeded crew ids to names', () => {
    expect(crewName('alpha')).toBe('Crew Alpha');
    expect(crewById('beta')?.dept).toBe('Drainage');
  });
  it('returns null for unknown or null ids', () => {
    expect(crewName('nope')).toBeNull();
    expect(crewName(null)).toBeNull();
    expect(crewById('nope')).toBeNull();
  });
});
