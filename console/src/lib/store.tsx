/* =========================================================================
   FixMyCity Operations Console — data store, status model & state machine.
   ALL app state + seed data live here, exposed through one React context.
   Screens/components read state and call the exposed functions; they never
   mutate state directly.
   ========================================================================= */
/* eslint-disable react-refresh/only-export-components --
   deliberately a context module: constants + hooks + one provider component */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';
import type { Tables } from './database.types.ts';

/* ---- Domain types ------------------------------------------------------ */
export type StatusName =
  | 'Submitted' | 'Acknowledged' | 'Assigned' | 'In Progress'
  | 'Resolved' | 'Rejected' | 'Reopened';

export type CategoryName = 'Illegal Dumping' | 'Blocked Drain' | 'Broken Streetlight';

export type LocationName =
  | 'East Legon' | 'Okponglo' | 'Dzorwulu' | 'Abelemkpe'
  | 'Airport Residential Area' | 'Roman Ridge' | 'Shiashie'
  | 'Legon (near University of Ghana)';

export type RoleName = 'Administrator' | 'Supervisor' | 'Officer' | 'Dispatcher' | 'Viewer' | 'Field Crew';

export type TransitionAction = 'acknowledge' | 'assign' | 'reject' | 'in_progress' | 'resolve';

export interface StatusInfo { label: string; pill: string; dot: string; solid: string }
export interface CategoryInfo { icon: string; blurb: string; accent: string }

export interface TimelineEvent {
  status: StatusName;
  timestamp: string;
  actor?: string | null;
  note?: string;
}

/* Display step: a completed timeline event, or a greyed pending canonical
   step (no timestamp/actor). `pending` discriminates the two arms. */
export type TimelineStep =
  | (TimelineEvent & { done: true; pending?: false })
  | { status: StatusName; pending: true };

export interface Report {
  id: string;                 // public reference, e.g. FMC-2026-0432
  uuid?: string;              // database row id (used for API calls)
  category: CategoryName;
  location: LocationName;
  lat: number;
  lng: number;
  description: string;
  status: StatusName;
  crew: string | null;        // assigned crew id
  hasPhoto: boolean;
  photoPaths: string[];       // storage paths in the report-photos bucket (1-5)
  reporterName?: string;      // reporter's display name
  rejectReason?: string;
  aiSuggestedCategory?: CategoryName | null;
  aiConfidence?: number | null;
  timeline: TimelineEvent[];
}

export interface DuplicateCandidate {
  id: string;
  reference: string;
  category: CategoryName;
  locationName: LocationName;
  status: StatusName;
  photoPath: string | null;
  similarity: number;
  distanceM: number;
}

// One side of a CV duplicate-review, resolved to our report when it exists in
// our DB (otherwise `reportId` is null and `label` is "External #<id>").
export interface DuplicateReviewSide {
  externalId: number;
  reportId: string | null;
  reference: string | null;
  category: CategoryName | null;
  status: StatusName | null;
  locationName: LocationName | null;
  label: string;
}

// A review from the CV service's own duplicate-review queue (see the
// duplicate-reviews edge function). Advisory only — never touches our statuses.
export interface DuplicateReview {
  id: number;
  confidence: number;           // 0..1
  status: string;               // 'open' | 'resolved'
  resolution: string | null;    // a DuplicateStatus value once resolved
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  report: DuplicateReviewSide;
  candidate: DuplicateReviewSide;
}

export interface CrewMember { id: string; name: string; email: string }

export interface Crew {
  id: string;
  name: string;
  dept: string;
  lead: string;
  phone: string;
  available: boolean;
  roster?: CrewMember[];
  members?: number;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  unit: string;
  active: boolean;
  initials: string;
  crewId: string | null;
}

export interface Operator {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  role: RoleName;
  unit: string;
  initials: string;
  crewId: string | null;
}

/* ---- Console preferences (persisted per-user on profiles.settings) --------- */
export interface ConsoleSettings {
  newReports: boolean;
  assignments: boolean;
  escalations: boolean;
  digest: boolean;
  compact: boolean;
  defaultFilter: string;
}
export const DEFAULT_SETTINGS: ConsoleSettings = {
  newReports: true, assignments: true, escalations: true, digest: false,
  compact: false, defaultFilter: 'All',
};

/* ---- Permissions (single source of truth; consumed by nav, routes, the report
   action bar, and re-checked server-side in the edge functions) -------------- */
export interface Perms {
  pages: string[];                       // nav/route paths this role may open
  actions: Set<TransitionAction>;        // report transitions allowed (empty = read-only)
  canManageUsers: boolean;
  canManageCrews: boolean;
  isCrew: boolean;
}

const ALL_ACTIONS: TransitionAction[] = ['acknowledge', 'assign', 'reject', 'in_progress', 'resolve'];
// personal pages every office role can reach
const BASE_PAGES = ['/', '/map', '/assignments', '/duplicates', '/profile', '/settings'];

const ROLE_PERMS: Record<RoleName, Perms> = {
  Administrator: { pages: [...BASE_PAGES, '/crews', '/analytics', '/users', '/audit'], actions: new Set(ALL_ACTIONS), canManageUsers: true,  canManageCrews: true,  isCrew: false },
  Supervisor:    { pages: [...BASE_PAGES, '/crews', '/analytics', '/audit'],           actions: new Set(ALL_ACTIONS), canManageUsers: false, canManageCrews: true,  isCrew: false },
  Officer:       { pages: [...BASE_PAGES],                                             actions: new Set(ALL_ACTIONS), canManageUsers: false, canManageCrews: false, isCrew: false },
  Dispatcher:    { pages: [...BASE_PAGES, '/crews'],                                   actions: new Set(['acknowledge', 'assign'] as TransitionAction[]), canManageUsers: false, canManageCrews: true, isCrew: false },
  Viewer:        { pages: [...BASE_PAGES, '/analytics', '/audit'],                     actions: new Set(),            canManageUsers: false, canManageCrews: false, isCrew: false },
  'Field Crew':  { pages: ['/my-reports'],                                             actions: new Set(['in_progress', 'resolve'] as TransitionAction[]), canManageUsers: false, canManageCrews: false, isCrew: true },
};

export function permsFor(role: RoleName): Perms {
  return ROLE_PERMS[role] ?? ROLE_PERMS.Viewer;
}

export interface TransitionOpts { note?: string; crewId?: string; reason?: string; duplicateOfId?: string }

export interface StoreValue {
  authReady: boolean;
  user: Operator | null;
  perms: Perms;
  settings: ConsoleSettings;
  reports: Report[];
  crews: Crew[];
  staff: Staff[];
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  updateProfile: (fields: { full_name?: string; phone?: string }) => Promise<{ error?: string }>;
  saveSettings: (partial: Partial<ConsoleSettings>) => Promise<{ error?: string }>;
  transitionReport: (reportId: string, action: TransitionAction, opts?: TransitionOpts) => Promise<{ error?: string }>;
  checkDuplicates: (reportId: string) => Promise<{ candidates?: DuplicateCandidate[]; error?: string }>;
  listDuplicateReviews: () => Promise<{ reviews?: DuplicateReview[]; error?: string }>;
  resolveDuplicateReview: (reviewId: number, opts: { resolution: string; duplicateOfReportId?: number | null; notes?: string }) => Promise<{ error?: string }>;
  mergeDuplicateReview: (reviewId: number, targetReportId: number, notes?: string) => Promise<{ error?: string }>;
  createCrew: (c: { name: string; dept: string; lead?: string }) => Promise<{ error?: string }>;
  setCrewAvailability: (crewId: string, available: boolean) => Promise<{ error?: string }>;
  assignCrewMember: (userId: string, crewId: string) => Promise<{ error?: string }>;
  inviteCrewMember: (crewId: string, m: { name: string; email: string }) => Promise<{ error?: string }>;
  removeCrewMember: (userId: string) => Promise<{ error?: string }>;
  setLead: (crewId: string, name: string) => Promise<{ error?: string }>;
  inviteUser: (u: { name: string; email: string; role?: RoleName; unit?: string }) => Promise<{ error?: string }>;
  setUserRole: (id: string, role: RoleName) => Promise<{ error?: string }>;
  setUserStatus: (id: string, active: boolean) => Promise<{ error?: string }>;
}

/* ---- Status model ------------------------------------------------------ */
export const STATUS: Record<StatusName, StatusInfo> = {
  Submitted:    { label: 'Submitted',    pill: 'bg-gray-100 text-gray-600 ring-gray-200',     dot: '#9CA3AF', solid: '#9CA3AF' },
  Acknowledged: { label: 'Acknowledged', pill: 'bg-blue-50 text-blue-700 ring-blue-200',      dot: '#2563EB', solid: '#3B82F6' },
  Assigned:     { label: 'Assigned',     pill: 'bg-blue-100 text-blue-900 ring-blue-300',     dot: '#1D4ED8', solid: '#1D4ED8' },
  'In Progress':{ label: 'In Progress',  pill: 'bg-amber-50 text-amber-800 ring-amber-200',   dot: '#C8932F', solid: '#C8932F' },
  Resolved:     { label: 'Resolved',     pill: 'bg-green-50 text-green-700 ring-green-200',    dot: '#16A34A', solid: '#16A34A' },
  Rejected:     { label: 'Rejected',     pill: 'bg-red-50 text-red-700 ring-red-200',          dot: '#DC2626', solid: '#DC2626' },
  Reopened:     { label: 'Reopened',     pill: 'bg-orange-50 text-orange-700 ring-orange-200', dot: '#EA580C', solid: '#EA580C' },
};

export const CANONICAL: StatusName[] = ['Submitted', 'Acknowledged', 'Assigned', 'In Progress', 'Resolved'];

/* ---- Categories -------------------------------------------------------- */
export const CATEGORIES: Record<CategoryName, CategoryInfo> = {
  'Illegal Dumping':    { icon: 'Trash2',    blurb: 'Waste dumped in unauthorised areas', accent: '#1E5F8E' },
  'Blocked Drain':      { icon: 'WavesHorizontal', blurb: 'Clogged gutters & storm drains', accent: '#1E5F8E' },
  'Broken Streetlight': { icon: 'Lightbulb', blurb: 'Faulty or dark street lighting',     accent: '#C8932F' },
};

/* ---- DB <-> UI mapping -------------------------------------------------- */
type ReportRow = Tables<'reports'>;
type TransitionRow = Tables<'status_transitions'>;
type CrewRow = Tables<'crews'>;
type ProfileRow = Tables<'profiles'>;

const DB_TO_STATUS: Record<ReportRow['status'], StatusName> = {
  submitted: 'Submitted', acknowledged: 'Acknowledged', assigned: 'Assigned',
  in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Rejected', reopened: 'Reopened',
};
const DB_TO_CATEGORY: Record<ReportRow['category'], CategoryName> = {
  dumping: 'Illegal Dumping', drain: 'Blocked Drain', streetlight: 'Broken Streetlight',
};
const DEPT_LABEL: Record<CrewRow['department'], string> = {
  sanitation: 'Sanitation', drainage: 'Drainage', electrical: 'Electrical',
};
// CLAUDE.md's canonical transition verbs; the console UI keeps its own naming.
const ACTION_TO_API: Record<TransitionAction, string> = {
  acknowledge: 'acknowledge', assign: 'assign', reject: 'reject',
  in_progress: 'start', resolve: 'resolve',
};

/* ---- Crews (seed fallback; real crews + rosters load from the DB) ------- */
const SEED_CREWS: Crew[] = [
  { id: 'alpha', name: 'Crew Alpha', dept: 'Sanitation',  lead: 'Yaw Boateng',   phone: '024 118 0042', available: true,  roster: [] },
  { id: 'beta',  name: 'Crew Beta',  dept: 'Drainage',    lead: 'Esi Addo',      phone: '020 776 5510', available: true,  roster: [] },
  { id: 'gamma', name: 'Crew Gamma', dept: 'Electrical',  lead: 'Kojo Annan',    phone: '055 309 8821', available: false, roster: [] },
];

/* ---- AWMA staff users -------------------------------------------------- */
export const ROLES: RoleName[] = ['Administrator', 'Supervisor', 'Officer', 'Dispatcher', 'Viewer', 'Field Crew'];
// AWMA office units shown on the staff directory (distinct from field-crew
// departments — see Crews). Free-text before; now a fixed picklist.
export const UNITS: string[] = ['Operations', 'Sanitation', 'Drainage', 'Electrical', 'Control room'];

export const CITIZEN = { name: 'Ama Asante', firstName: 'Ama', email: 'ama.asante@gmail.com' };

/* ---- Date helpers ------------------------------------------------------ */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
         d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  const days = Math.round(diff / 86400);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

export function nowISO(): string { return new Date().toISOString(); }

/* ---- Timeline helper --------------------------------------------------- */
// Build display timeline: completed events + greyed pending canonical steps
export function buildTimeline(report: Report): TimelineStep[] {
  const steps: TimelineStep[] = report.timeline.map(e => ({ ...e, done: true as const }));
  if (report.status === 'Rejected') return steps;
  const doneStatuses = new Set(report.timeline.map(e => e.status));
  let maxIdx = -1;
  CANONICAL.forEach((s, i) => { if (doneStatuses.has(s)) maxIdx = Math.max(maxIdx, i); });
  if (report.status === 'Reopened') maxIdx = Math.max(maxIdx, CANONICAL.indexOf('Assigned'));
  for (let i = maxIdx + 1; i < CANONICAL.length; i++) {
    steps.push({ status: CANONICAL[i], pending: true });
  }
  return steps;
}

/* Crew lookups reflect live crew state. `_liveCrews` mirrors the provider's
   crews array so crewName/crewById resolve against the fetched crews. */
let _liveCrews: Crew[] = SEED_CREWS;
export function crewName(id: string | null): string | null { const c = _liveCrews.find(c => c.id === id); return c ? c.name : null; }
export function crewById(id: string | null): Crew | null { return _liveCrews.find(c => c.id === id) || null; }

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

/* ---- Row mappers -------------------------------------------------------- */
function mapCrew(row: CrewRow): Crew {
  return {
    id: row.id, name: row.name, dept: DEPT_LABEL[row.department],
    lead: row.lead_name, phone: row.phone, available: row.available, members: row.member_count,
  };
}

// A profiles row is a "staff" account when it can reach the console (officer /
// admin access role) or carries an org-chart label. console_role is the display
// role; fall back to deriving it from the access role for legacy rows.
function mapStaff(row: ProfileRow): Staff {
  const name = row.full_name || row.email || 'Unknown';
  const consoleRole = (row.console_role as RoleName | null)
    ?? (row.role === 'admin' ? 'Administrator' : 'Officer');
  return {
    id: row.id,
    name,
    email: row.email ?? '',
    role: consoleRole,
    unit: row.unit || '—',
    active: row.status === 'active',
    initials: initialsOf(name),
    crewId: row.crew_id ?? null,
  };
}

// Resolve a transition's actor to a display name using lookup maps the console
// can read (staff see all profiles; crews are readable by any signed-in user).
function actorLabel(t: TransitionRow, names: Map<string, string>, crewId: string | null): string {
  if (t.actor_id && names.has(t.actor_id)) return names.get(t.actor_id)!;
  if (t.actor_role === 'crew') return crewName(crewId) ?? 'Field crew';
  return 'AWMA';
}

function mapReport(
  row: ReportRow & { status_transitions: TransitionRow[] },
  names: Map<string, string>,
): Report {
  const transitions = [...row.status_transitions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const rejected = transitions.find(t => t.to_status === 'rejected');
  return {
    id: row.reference,
    uuid: row.id,
    category: DB_TO_CATEGORY[row.category],
    location: row.location_name as LocationName,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    status: DB_TO_STATUS[row.status],
    crew: row.assigned_crew_id,
    hasPhoto: row.photo_urls.length > 0,
    photoPaths: row.photo_urls,
    reporterName: (row.reporter_id && names.get(row.reporter_id)) || 'Resident',
    rejectReason: rejected?.note ?? undefined,
    aiSuggestedCategory: row.ai_suggested_category ? DB_TO_CATEGORY[row.ai_suggested_category] : null,
    aiConfidence: row.ai_confidence,
    timeline: transitions.map(t => ({
      status: DB_TO_STATUS[t.to_status],
      timestamp: t.created_at,
      actor: actorLabel(t, names, row.assigned_crew_id),
      note: t.note ?? undefined,
    })),
  };
}

/* ---- Context ----------------------------------------------------------- */
const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within <StoreProvider>');
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<Operator | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  // Real staff directory, loaded from `profiles` (see loadStaff). Writes go
  // through the manage-users edge function, mirroring the report state machine.
  const [staff, setStaff] = useState<Staff[]>([]);
  // per-user console preferences, loaded from profiles.settings on sign-in
  const [settings, setSettings] = useState<ConsoleSettings>(DEFAULT_SETTINGS);

  // keep crew lookups (used across views) in sync with live crew state
  // eslint-disable-next-line react-hooks/globals -- module-level mirror for crewName/crewById
  _liveCrews = crews;
  useEffect(() => { _liveCrews = crews; }, [crews]);

  /* Staff directory: every profile with console access or an org-chart label.
     Read via the client's plain `select` grant; writes go through manage-users. */
  const loadStaff = useCallback(async () => {
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, full_name, email, console_role, unit, status, role, crew_id')
      .or('role.in.(officer,admin),console_role.not.is.null')
      .order('full_name');
    setStaff((rows ?? []).map(r => mapStaff(r as ProfileRow)));
  }, []);

  /* Load crews + reports (+ profile names for actor labels). Staff RLS returns
     every report and profile, so the console sees the whole operation. */
  const loadData = useCallback(async () => {
    await loadStaff();
    const [{ data: crewRows }, { data: profileRows }, { data: memberRows }] = await Promise.all([
      supabase.from('crews').select('*').order('name'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('profiles').select('id, full_name, email, crew_id').eq('role', 'crew'),
    ]);
    // group real crew members (profiles.role='crew') onto their crew's roster
    const rosters = new Map<string, CrewMember[]>();
    (memberRows ?? []).forEach((m: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'crew_id'>) => {
      if (!m.crew_id) return;
      const list = rosters.get(m.crew_id) ?? [];
      list.push({ id: m.id, name: m.full_name || m.email || 'Crew member', email: m.email ?? '' });
      rosters.set(m.crew_id, list);
    });
    const mappedCrews = (crewRows ?? []).map(row => {
      const crew = mapCrew(row);
      crew.roster = rosters.get(row.id) ?? [];
      return crew;
    });
    _liveCrews = mappedCrews;
    setCrews(mappedCrews);

    const names = new Map<string, string>();
    (profileRows ?? []).forEach((p: Pick<ProfileRow, 'id' | 'full_name'>) => {
      if (p.full_name) names.set(p.id, p.full_name);
    });

    const { data: reportRows } = await supabase
      .from('reports')
      .select('*, status_transitions!status_transitions_report_id_fkey(*)')
      .order('created_at', { ascending: false });
    setReports((reportRows ?? []).map(r => mapReport(r, names)));
  }, [loadStaff]);

  /* Session bootstrap + role gate: active office staff (officer/admin) and field
     crew may use the console; citizens and suspended accounts are rejected. Crew
     land on a restricted assigned-reports view (see App shell + perms). */
  const applySession = useCallback(async (userId: string, email: string): Promise<boolean> => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    const p = profile as ProfileRow | null;
    if (!p || (p.role !== 'officer' && p.role !== 'admin' && p.role !== 'crew')) return false;
    if (p.status === 'suspended') return false;
    const name = p.full_name || email;
    const role: RoleName = (p.console_role as RoleName | null)
      ?? (p.role === 'admin' ? 'Administrator' : p.role === 'crew' ? 'Field Crew' : 'Officer');
    setUser({
      id: userId,
      name,
      firstName: name.split(/\s+/)[0],
      email,
      phone: p.phone ?? '',
      role,
      unit: p.unit || 'Operations',
      initials: initialsOf(name),
      crewId: p.crew_id ?? null,
    });
    setSettings({ ...DEFAULT_SETTINGS, ...(p.settings as Partial<ConsoleSettings> ?? {}) });
    await loadData();
    return true;
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        const ok = await applySession(session.user.id, session.user.email ?? '');
        if (!ok) await supabase.auth.signOut();
      }
      if (!cancelled) setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) { setUser(null); setReports([]); }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [applySession]);

  /* Realtime: any report change (new citizen submission, reopen, or another
     operator's action) refetches the live data so the Inbox/Map/Assignments stay
     current without a reload. Staff RLS delivers all reports. Debounced. */
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('console-reports')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => { void loadData(); }, 300);
        })
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [user, loadData]);

  /* ---- Auth ---- */
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    const ok = data.user ? await applySession(data.user.id, data.user.email ?? '') : false;
    if (!ok) {
      await supabase.auth.signOut();
      return { error: 'This account does not have console access. Staff only.' };
    }
    return {};
  }, [applySession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /* Set a password for the current session — used by the invite /set-password
     landing, where clicking the invite link established a session. */
  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : {};
  }, []);

  /* ---- Report state machine (server-side; this client only invokes it) ---- */
  const transitionReport = useCallback(async (reportId: string, action: TransitionAction, opts: TransitionOpts = {}) => {
    const target = reports.find(r => r.id === reportId);
    if (!target?.uuid) return { error: 'Report not found.' };
    const { error } = await supabase.functions.invoke('transition-report', {
      body: {
        report_id: target.uuid,
        action: ACTION_TO_API[action],
        crew_id: opts.crewId,
        reason: opts.reason,
        note: opts.note,
        duplicate_of_report_id: opts.duplicateOfId,
      },
    });
    if (error) {
      let msg = 'The action was refused.';
      if (error instanceof FunctionsHttpError) {
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      } else if (error instanceof Error) { msg = error.message; }
      return { error: msg };
    }
    await loadData();
    return {};
  }, [reports, loadData]);

  // AI feature 2 (CLAUDE.md): PostGIS proximity+time filter, then pgvector
  // cosine similarity, so the detail panel can show "possible duplicate of
  // FMC-..." chips. Read-only — unlike transitionReport, does not reload data.
  const checkDuplicates = useCallback(async (reportId: string): Promise<{ candidates?: DuplicateCandidate[]; error?: string }> => {
    const target = reports.find(r => r.id === reportId);
    if (!target?.uuid) return { error: 'Report not found.' };
    const { data, error } = await supabase.functions.invoke('check-duplicates', {
      body: { report_id: target.uuid },
    });
    if (error) {
      let msg = 'Could not check for duplicates.';
      if (error instanceof FunctionsHttpError) {
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      } else if (error instanceof Error) { msg = error.message; }
      return { error: msg };
    }
    type CandidateRow = {
      id: string; reference: string; category: ReportRow['category']; location_name: string;
      status: ReportRow['status']; photo_path: string | null; similarity: number; distance_m: number;
    };
    const candidates: DuplicateCandidate[] = ((data?.candidates ?? []) as CandidateRow[]).map(c => ({
      id: c.id,
      reference: c.reference,
      category: DB_TO_CATEGORY[c.category],
      locationName: c.location_name as LocationName,
      status: DB_TO_STATUS[c.status],
      photoPath: c.photo_path,
      similarity: c.similarity,
      distanceM: c.distance_m,
    }));
    return { candidates };
  }, [reports]);

  /* ---- CV duplicate-review queue (staff-gated duplicate-reviews function) ---- */
  // Pure proxy over the CV service's own review queue. `list` is read-only;
  // `resolve`/`merge` drive the CV service only and never touch our reports, so
  // the page re-fetches itself rather than reloading the global report list.
  const listDuplicateReviews = useCallback(async (): Promise<{ reviews?: DuplicateReview[]; error?: string }> => {
    const { data, error } = await supabase.functions.invoke('duplicate-reviews', { body: { action: 'list' } });
    if (error) {
      let msg = 'Could not load duplicate reviews.';
      if (error instanceof FunctionsHttpError) {
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      } else if (error instanceof Error) { msg = error.message; }
      return { error: msg };
    }
    type SideRow = {
      externalId: number; ourId: string | null; reference: string | null;
      category: ReportRow['category'] | null; status: ReportRow['status'] | null;
      locationName: string | null; label: string;
    };
    type ReviewRow = {
      id: number; confidence: number; status: string; resolution: string | null;
      notes: string | null; createdAt: string; resolvedAt: string | null;
      report: SideRow; candidate: SideRow;
    };
    const mapSide = (s: SideRow): DuplicateReviewSide => ({
      externalId: s.externalId,
      reportId: s.ourId,
      reference: s.reference,
      category: s.category ? DB_TO_CATEGORY[s.category] : null,
      status: s.status ? DB_TO_STATUS[s.status] : null,
      locationName: (s.locationName as LocationName) ?? null,
      label: s.label,
    });
    const reviews: DuplicateReview[] = ((data?.reviews ?? []) as ReviewRow[]).map(r => ({
      id: r.id,
      confidence: r.confidence,
      status: r.status,
      resolution: r.resolution,
      notes: r.notes,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      report: mapSide(r.report),
      candidate: mapSide(r.candidate),
    }));
    return { reviews };
  }, []);

  const runDuplicateReview = useCallback(async (body: Record<string, unknown>, fallback: string) => {
    const { error } = await supabase.functions.invoke('duplicate-reviews', { body });
    if (error) {
      let msg = fallback;
      if (error instanceof FunctionsHttpError) {
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      } else if (error instanceof Error) { msg = error.message; }
      return { error: msg };
    }
    return {};
  }, []);

  const resolveDuplicateReview = useCallback((reviewId: number, opts: { resolution: string; duplicateOfReportId?: number | null; notes?: string }) =>
    runDuplicateReview({
      action: 'resolve', review_id: reviewId, resolution: opts.resolution,
      duplicate_of_report_id: opts.duplicateOfReportId ?? undefined, notes: opts.notes,
    }, 'Could not resolve the review.'), [runDuplicateReview]);
  const mergeDuplicateReview = useCallback((reviewId: number, targetReportId: number, notes?: string) =>
    runDuplicateReview({ action: 'merge', review_id: reviewId, target_report_id: targetReportId, notes },
      'Could not merge the review.'), [runDuplicateReview]);

  /* ---- Crew CRUD + membership (server-side; staff-gated manage-crews function) ---- */
  // Members are real users (profiles.role='crew'/crew_id). Assigning or moving
  // one fires a branded email; every action refetches so rosters stay in sync.
  const runManageCrews = useCallback(async (body: Record<string, unknown>, fallback: string) => {
    const { error } = await supabase.functions.invoke('manage-crews', { body });
    if (error) {
      let msg = fallback;
      if (error instanceof FunctionsHttpError) {
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      } else if (error instanceof Error) { msg = error.message; }
      return { error: msg };
    }
    await loadData();
    return {};
  }, [loadData]);

  const assignCrewMember = useCallback((userId: string, crewId: string) =>
    runManageCrews({ action: 'add_member', user_id: userId, crew_id: crewId }, 'Could not assign the member.'),
    [runManageCrews]);
  const inviteCrewMember = useCallback((crewId: string, m: { name: string; email: string }) =>
    runManageCrews({ action: 'add_member', crew_id: crewId, full_name: m.name.trim(), email: m.email.trim() },
      'Could not add the member.'), [runManageCrews]);
  const removeCrewMember = useCallback((userId: string) =>
    runManageCrews({ action: 'remove_member', user_id: userId }, 'Could not remove the member.'),
    [runManageCrews]);
  const setLead = useCallback((crewId: string, name: string) =>
    runManageCrews({ action: 'set_lead', crew_id: crewId, name }, 'Could not set the lead.'),
    [runManageCrews]);
  const createCrew = useCallback((c: { name: string; dept: string; lead?: string }) =>
    runManageCrews({ action: 'create_crew', name: c.name, department: c.dept, lead_name: c.lead ?? '' },
      'Could not create the crew.'), [runManageCrews]);
  const setCrewAvailability = useCallback((crewId: string, available: boolean) =>
    runManageCrews({ action: 'set_availability', crew_id: crewId, available }, 'Could not update availability.'),
    [runManageCrews]);

  /* ---- Profile + settings (owner-writable columns via the client grant) ---- */
  const updateProfile = useCallback(async (fields: { full_name?: string; phone?: string }) => {
    if (!user) return { error: 'Not signed in.' };
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id);
    if (error) return { error: error.message };
    setUser(u => u && ({
      ...u,
      name: fields.full_name?.trim() || u.name,
      firstName: (fields.full_name?.trim() || u.name).split(/\s+/)[0],
      initials: initialsOf(fields.full_name?.trim() || u.name),
      phone: fields.phone ?? u.phone,
    }));
    return {};
  }, [user]);

  const saveSettings = useCallback(async (partial: Partial<ConsoleSettings>) => {
    if (!user) return { error: 'Not signed in.' };
    const next = { ...settings, ...partial };
    setSettings(next);
    const { error } = await supabase.from('profiles').update({ settings: next }).eq('id', user.id);
    return error ? { error: error.message } : {};
  }, [user, settings]);

  /* ---- Staff / user actions (server-side; admin-gated manage-users function) ---- */
  // All three write through the edge function (the client can't touch role /
  // status / console_role directly), then refetch the directory.
  const runManageUsers = useCallback(async (body: Record<string, unknown>, fallback: string) => {
    const { error } = await supabase.functions.invoke('manage-users', { body });
    if (error) {
      let msg = fallback;
      if (error instanceof FunctionsHttpError) {
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      } else if (error instanceof Error) { msg = error.message; }
      return { error: msg };
    }
    await loadStaff();
    return {};
  }, [loadStaff]);

  const inviteUser = useCallback((u: { name: string; email: string; role?: RoleName; unit?: string }) =>
    runManageUsers({
      action: 'invite',
      email: u.email.trim(),
      full_name: u.name.trim(),
      console_role: u.role ?? 'Officer',
      unit: u.unit?.trim() ?? '',
      redirect_to: `${window.location.origin}/set-password`,
    }, 'Could not send the invite.'), [runManageUsers]);

  const setUserRole = useCallback((id: string, role: RoleName) =>
    runManageUsers({ action: 'set_role', user_id: id, console_role: role }, 'Could not update the role.'),
    [runManageUsers]);

  const setUserStatus = useCallback((id: string, active: boolean) =>
    runManageUsers({ action: 'set_status', user_id: id, active }, 'Could not update the status.'),
    [runManageUsers]);

  const perms = useMemo(() => permsFor(user?.role ?? 'Viewer'), [user?.role]);

  const value = useMemo<StoreValue>(() => ({
    authReady, user, perms, settings, reports, crews, staff,
    signIn, signOut, updatePassword, updateProfile, saveSettings,
    transitionReport, checkDuplicates, listDuplicateReviews, resolveDuplicateReview, mergeDuplicateReview,
    createCrew, setCrewAvailability, assignCrewMember, inviteCrewMember, removeCrewMember, setLead,
    inviteUser, setUserRole, setUserStatus,
  }), [authReady, user, perms, settings, reports, crews, staff, signIn, signOut, updatePassword, updateProfile, saveSettings,
       transitionReport, checkDuplicates, listDuplicateReviews, resolveDuplicateReview, mergeDuplicateReview,
       createCrew, setCrewAvailability, assignCrewMember, inviteCrewMember, removeCrewMember, setLead,
       inviteUser, setUserRole, setUserStatus]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
