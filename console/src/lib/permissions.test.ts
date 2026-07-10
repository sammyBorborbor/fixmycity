import { describe, it, expect } from 'vitest';
import { permsFor, ROLES } from './store.tsx';
import type { RoleName, TransitionAction } from './store.tsx';

// The permission matrix is the single source of truth for RBAC (nav, routes, the
// report action bar) and is re-checked server-side. These tests lock the matrix.
describe('permsFor — page access', () => {
  it('Administrator can reach every page including Users', () => {
    const p = permsFor('Administrator');
    for (const path of ['/', '/map', '/assignments', '/crews', '/analytics', '/users', '/audit', '/profile', '/settings']) {
      expect(p.pages).toContain(path);
    }
  });

  it('Supervisor reaches everything except Users', () => {
    const p = permsFor('Supervisor');
    expect(p.pages).toContain('/crews');
    expect(p.pages).toContain('/analytics');
    expect(p.pages).toContain('/audit');
    expect(p.pages).not.toContain('/users');
  });

  it('Officer is triage-only (no crews/analytics/users/audit)', () => {
    const p = permsFor('Officer');
    expect(p.pages).toEqual(expect.arrayContaining(['/', '/map', '/assignments']));
    for (const path of ['/crews', '/analytics', '/users', '/audit']) expect(p.pages).not.toContain(path);
  });

  it('Dispatcher sees Crews but not Analytics/Users/Audit', () => {
    const p = permsFor('Dispatcher');
    expect(p.pages).toContain('/crews');
    for (const path of ['/analytics', '/users', '/audit']) expect(p.pages).not.toContain(path);
  });

  it('Viewer sees Analytics/Audit but not Crews/Users', () => {
    const p = permsFor('Viewer');
    expect(p.pages).toEqual(expect.arrayContaining(['/analytics', '/audit']));
    for (const path of ['/crews', '/users']) expect(p.pages).not.toContain(path);
  });

  it('Field Crew is confined to /my-reports', () => {
    expect(permsFor('Field Crew').pages).toEqual(['/my-reports']);
  });
});

describe('permsFor — report actions', () => {
  const set = (r: RoleName) => [...permsFor(r).actions].sort();

  it('Administrator/Supervisor/Officer may perform every transition', () => {
    const all: TransitionAction[] = ['acknowledge', 'assign', 'in_progress', 'reject', 'resolve'];
    for (const r of ['Administrator', 'Supervisor', 'Officer'] as RoleName[]) {
      expect(set(r)).toEqual([...all].sort());
    }
  });

  it('Dispatcher may only acknowledge and assign', () => {
    expect(set('Dispatcher')).toEqual(['acknowledge', 'assign']);
  });

  it('Viewer is read-only (no actions)', () => {
    expect(permsFor('Viewer').actions.size).toBe(0);
  });

  it('Field Crew may only progress and resolve their jobs', () => {
    expect(set('Field Crew')).toEqual(['in_progress', 'resolve']);
  });
});

describe('permsFor — management capabilities', () => {
  it('only Administrator can manage users', () => {
    expect(ROLES.filter(r => permsFor(r).canManageUsers)).toEqual(['Administrator']);
  });

  it('Administrator, Supervisor and Dispatcher can manage crews', () => {
    expect(ROLES.filter(r => permsFor(r).canManageCrews).sort())
      .toEqual(['Administrator', 'Dispatcher', 'Supervisor']);
  });

  it('only Field Crew is flagged isCrew', () => {
    expect(ROLES.filter(r => permsFor(r).isCrew)).toEqual(['Field Crew']);
  });

  it('an unknown role falls back to the least-privileged (Viewer) perms', () => {
    const bogus = permsFor('Nope' as RoleName);
    expect(bogus.actions.size).toBe(0);
    expect(bogus.canManageUsers).toBe(false);
    expect(bogus.canManageCrews).toBe(false);
  });
});
