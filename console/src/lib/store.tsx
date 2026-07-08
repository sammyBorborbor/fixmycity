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

export type RoleName = 'Administrator' | 'Supervisor' | 'Officer' | 'Dispatcher' | 'Viewer';

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
  description: string;
  status: StatusName;
  crew: string | null;        // assigned crew id
  hasPhoto: boolean;
  photoPath?: string | null;  // storage path in the report-photos bucket
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

export interface Crew {
  id: string;
  name: string;
  dept: string;
  lead: string;
  phone: string;
  available: boolean;
  roster?: string[];
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
}

export interface Operator {
  name: string;
  firstName: string;
  email: string;
  role: RoleName;
  unit: string;
  initials: string;
}

export interface TransitionOpts { note?: string; crewId?: string; reason?: string; duplicateOfId?: string }

export interface StoreValue {
  authReady: boolean;
  user: Operator | null;
  reports: Report[];
  crews: Crew[];
  staff: Staff[];
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  transitionReport: (reportId: string, action: TransitionAction, opts?: TransitionOpts) => Promise<{ error?: string }>;
  checkDuplicates: (reportId: string) => Promise<{ candidates?: DuplicateCandidate[]; error?: string }>;
  addCrew: (c: Omit<Crew, 'id'>) => void;
  toggleCrewAvailability: (id: string) => void;
  addMember: (id: string, name: string) => void;
  removeMember: (id: string, name: string) => void;
  setLead: (id: string, name: string) => void;
  inviteUser: (u: { name: string; email: string; role?: RoleName; unit?: string }) => void;
  setUserRole: (id: string, role: RoleName) => void;
  setUserStatus: (id: string, active: boolean) => void;
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
  'Blocked Drain':      { icon: 'Waves',     blurb: 'Clogged gutters & storm drains',     accent: '#1E5F8E' },
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

/* ---- Crews (seed) ------------------------------------------------------ */
const SEED_CREWS: Crew[] = [
  { id: 'alpha', name: 'Crew Alpha', dept: 'Sanitation',  lead: 'Yaw Boateng',   phone: '024 118 0042', available: true,  roster: ['Yaw Boateng', 'Adwoa Mensah', 'Kwabena Osei', 'Abena Owusu'] },
  { id: 'beta',  name: 'Crew Beta',  dept: 'Drainage',    lead: 'Esi Addo',      phone: '020 776 5510', available: true,  roster: ['Esi Addo', 'Kofi Darko', 'Yaa Asantewaa', 'Kwame Nkansah', 'Akosua Frimpong'] },
  { id: 'gamma', name: 'Crew Gamma', dept: 'Electrical',  lead: 'Kojo Annan',    phone: '055 309 8821', available: false, roster: ['Kojo Annan', 'Ama Boadu', 'Fiifi Tetteh'] },
];

/* ---- AWMA staff users -------------------------------------------------- */
export const ROLES: RoleName[] = ['Administrator', 'Supervisor', 'Officer', 'Dispatcher', 'Viewer'];
const SEED_USERS: Staff[] = [
  { id: 'u1', name: 'Akua Osei',     email: 'akua.osei@awma.gov.gh',     role: 'Administrator', unit: 'Operations',  active: true,  initials: 'AO' },
  { id: 'u2', name: 'Kofi Mensah',   email: 'kofi.mensah@awma.gov.gh',   role: 'Supervisor',    unit: 'Sanitation',  active: true,  initials: 'KM' },
  { id: 'u3', name: 'Ama Darko',     email: 'ama.darko@awma.gov.gh',     role: 'Officer',       unit: 'Drainage',    active: true,  initials: 'AD' },
  { id: 'u4', name: 'Nii Lartey',    email: 'nii.lartey@awma.gov.gh',    role: 'Dispatcher',    unit: 'Control room', active: true, initials: 'NL' },
  { id: 'u5', name: 'Efua Sarpong',  email: 'efua.sarpong@awma.gov.gh',  role: 'Officer',       unit: 'Electrical',  active: false, initials: 'ES' },
];

/* ---- Map coordinates (percent within map frame) ------------------------ */
export const COORDS: Record<LocationName, { x: number; y: number }> = {
  'East Legon':                    { x: 63, y: 71 },
  'Okponglo':                      { x: 50, y: 52 },
  'Dzorwulu':                      { x: 47, y: 45 },
  'Abelemkpe':                     { x: 76, y: 20 },
  'Airport Residential Area':      { x: 38, y: 24 },
  'Roman Ridge':                   { x: 33, y: 56 },
  'Shiashie':                      { x: 73, y: 73 },
  'Legon (near University of Ghana)': { x: 41, y: 67 },
};

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
    description: row.description,
    status: DB_TO_STATUS[row.status],
    crew: row.assigned_crew_id,
    hasPhoto: row.photo_urls.length > 0,
    photoPath: row.photo_urls[0] ?? null,
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
  // Staff directory stays demo-only this milestone (needs a schema addition to
  // model AWMA's 5 console roles + invite-via-admin-API). Seeded, in-memory.
  const [staff, setStaff] = useState<Staff[]>(() => SEED_USERS.map(u => ({ ...u })));

  // keep crew lookups (used across views) in sync with live crew state
  // eslint-disable-next-line react-hooks/globals -- module-level mirror for crewName/crewById
  _liveCrews = crews;
  useEffect(() => { _liveCrews = crews; }, [crews]);

  /* Load crews + reports (+ profile names for actor labels). Staff RLS returns
     every report and profile, so the console sees the whole operation. */
  const loadData = useCallback(async () => {
    const [{ data: crewRows }, { data: profileRows }] = await Promise.all([
      supabase.from('crews').select('*').order('name'),
      supabase.from('profiles').select('id, full_name'),
    ]);
    const mappedCrews = (crewRows ?? []).map(mapCrew);
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
  }, []);

  /* Session bootstrap + role gate: only officer/admin may use the console. */
  const applySession = useCallback(async (userId: string, email: string): Promise<boolean> => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    const p = profile as ProfileRow | null;
    if (!p || (p.role !== 'officer' && p.role !== 'admin')) return false;
    const name = p.full_name || email;
    setUser({
      name,
      firstName: name.split(/\s+/)[0],
      email,
      role: p.role === 'admin' ? 'Administrator' : 'Officer',
      unit: 'Operations',
      initials: initialsOf(name),
    });
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

  /* ---- Crew actions (demo-only, session-local; assignment uses live crews) ---- */
  const addCrew = useCallback((c: Omit<Crew, 'id'>) => {
    setCrews(prev => [...prev, { ...c, id: 'crew_' + Date.now() }]);
  }, []);
  const toggleCrewAvailability = useCallback((id: string) => {
    setCrews(prev => prev.map(c => c.id === id ? { ...c, available: !c.available } : c));
  }, []);
  const addMember = useCallback((id: string, name: string) => {
    setCrews(prev => prev.map(c => c.id === id ? { ...c, roster: [...(c.roster || []), name] } : c));
  }, []);
  const removeMember = useCallback((id: string, name: string) => {
    setCrews(prev => prev.map(c => {
      if (c.id !== id) return c;
      const roster = (c.roster || []).filter(m => m !== name);
      const lead = c.lead === name ? (roster[0] || '—') : c.lead;
      return { ...c, roster, lead };
    }));
  }, []);
  const setLead = useCallback((id: string, name: string) => {
    setCrews(prev => prev.map(c => c.id === id ? { ...c, lead: name } : c));
  }, []);

  /* ---- Staff / user actions (demo-only, session-local) ---- */
  const inviteUser = useCallback((u: { name: string; email: string; role?: RoleName; unit?: string }) => {
    setStaff(prev => [...prev, {
      id: 'u_' + Date.now(),
      name: u.name.trim(),
      email: u.email.trim(),
      role: u.role || 'Officer',
      unit: (u.unit && u.unit.trim()) || '—',
      active: true,
      initials: initialsOf(u.name),
    }]);
  }, []);
  const setUserRole = useCallback((id: string, role: RoleName) => {
    setStaff(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  }, []);
  const setUserStatus = useCallback((id: string, active: boolean) => {
    setStaff(prev => prev.map(u => u.id === id ? { ...u, active } : u));
  }, []);

  const value = useMemo<StoreValue>(() => ({
    authReady, user, reports, crews, staff,
    signIn, signOut,
    transitionReport, checkDuplicates,
    addCrew, toggleCrewAvailability, addMember, removeMember, setLead,
    inviteUser, setUserRole, setUserStatus,
  }), [authReady, user, reports, crews, staff, signIn, signOut, transitionReport, checkDuplicates,
       addCrew, toggleCrewAvailability, addMember, removeMember, setLead,
       inviteUser, setUserRole, setUserStatus]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
