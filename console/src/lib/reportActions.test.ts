import { describe, it, expect } from 'vitest';
import { availableActions } from './reportActions.ts';
import type { TransitionAction } from './store.tsx';

const ALL = new Set<TransitionAction>(['acknowledge', 'assign', 'reject', 'in_progress', 'resolve']);
const DISPATCHER = new Set<TransitionAction>(['acknowledge', 'assign']);
const CREW = new Set<TransitionAction>(['in_progress', 'resolve']);
const NONE = new Set<TransitionAction>();

describe('availableActions — status gating (full permissions)', () => {
  it('Submitted: acknowledge, assign, reject; not progress/resolve', () => {
    expect(availableActions('Submitted', ALL)).toEqual({ ack: true, assign: true, progress: false, resolve: false, reject: true });
  });
  it('Acknowledged: assign + reject only', () => {
    expect(availableActions('Acknowledged', ALL)).toMatchObject({ ack: false, assign: true, progress: false, resolve: false, reject: true });
  });
  it('Assigned: progress + reject', () => {
    expect(availableActions('Assigned', ALL)).toMatchObject({ progress: true, resolve: false, reject: true, ack: false, assign: false });
  });
  it('In Progress: resolve + reject', () => {
    expect(availableActions('In Progress', ALL)).toMatchObject({ progress: false, resolve: true, reject: true });
  });
  it('Resolved / Rejected are terminal: no actions', () => {
    for (const s of ['Resolved', 'Rejected'] as const) {
      expect(availableActions(s, ALL)).toEqual({ ack: false, assign: false, progress: false, resolve: false, reject: false });
    }
  });
});

describe('availableActions — role gating', () => {
  it('Dispatcher can acknowledge/assign but never reject', () => {
    expect(availableActions('Submitted', DISPATCHER)).toMatchObject({ ack: true, assign: true, reject: false });
  });
  it('Crew can progress an assigned report but not acknowledge/assign/reject', () => {
    expect(availableActions('Assigned', CREW)).toEqual({ ack: false, assign: false, progress: true, resolve: false, reject: false });
  });
  it('Crew can resolve an in-progress report', () => {
    expect(availableActions('In Progress', CREW)).toMatchObject({ resolve: true, reject: false });
  });
  it('read-only role (empty set) gets nothing regardless of status', () => {
    for (const s of ['Submitted', 'Assigned', 'In Progress'] as const) {
      const r = availableActions(s, NONE);
      expect(Object.values(r).some(Boolean)).toBe(false);
    }
  });
});
