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
  id: string;
  category: CategoryName;
  location: LocationName;
  description: string;
  status: StatusName;
  crew: string | null;
  hasPhoto: boolean;
  rejectReason?: string;
  timeline: TimelineEvent[];
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

export interface TransitionOpts { note?: string; crewId?: string; reason?: string }

export interface StoreValue {
  user: Operator | null;
  reports: Report[];
  crews: Crew[];
  staff: Staff[];
  signIn: () => void;
  signOut: () => void;
  transitionReport: (reportId: string, action: TransitionAction, opts?: TransitionOpts) => void;
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

/* The signed-in operator (set on sign-in). */
export const OPERATOR: Operator = { name: 'Akua Osei', firstName: 'Akua', email: 'akua.osei@aywma.gov.gh', role: 'Administrator', unit: 'Operations', initials: 'AO' };
const OFFICER = 'Akua O. · AWMA';

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
// "now" for the demo is fixed for deterministic seed timestamps
export const NOW = new Date('2026-06-09T14:30:00');
function daysAgo(d: number, h = 0): string { const t = new Date(NOW); t.setDate(t.getDate() - d); t.setHours(t.getHours() - h); return t.toISOString(); }

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
         d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function relTime(iso: string): string {
  const diff = (NOW.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  const days = Math.round(diff / 86400);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

export function nowISO(): string { return new Date().toISOString(); }

/* ---- Seed reports ------------------------------------------------------ */
const ev = (status: StatusName, iso: string, actor: string): TimelineEvent => ({ status, timestamp: iso, actor });

const SEED_REPORTS: Report[] = [
  {
    id: 'FMC-2026-0419', category: 'Illegal Dumping', location: 'East Legon',
    description: 'Pile of household waste dumped at the corner of Oxford Street, blocking the pedestrian walkway. Bad smell, growing each day.',
    status: 'Submitted', crew: null, hasPhoto: true,
    timeline: [ev('Submitted', daysAgo(0, 3), CITIZEN.name)],
  },
  {
    id: 'FMC-2026-0411', category: 'Blocked Drain', location: 'Okponglo',
    description: 'Storm drain near the overhead completely blocked with silt and plastic. Floods the road whenever it rains.',
    status: 'Acknowledged', crew: null, hasPhoto: true,
    timeline: [
      ev('Submitted', daysAgo(1, 5), CITIZEN.name),
      ev('Acknowledged', daysAgo(1, 1), 'Akua O. · AWMA'),
    ],
  },
  {
    id: 'FMC-2026-0402', category: 'Broken Streetlight', location: 'Dzorwulu',
    description: 'Three consecutive streetlights out on Kojo Thompson Road. Very dark and unsafe at night.',
    status: 'Assigned', crew: 'gamma', hasPhoto: true,
    timeline: [
      ev('Submitted', daysAgo(3, 2), CITIZEN.name),
      ev('Acknowledged', daysAgo(2, 6), 'Akua O. · AWMA'),
      ev('Assigned', daysAgo(2, 1), 'Akua O. · AWMA'),
    ],
  },
  {
    id: 'FMC-2026-0398', category: 'Illegal Dumping', location: 'Abelemkpe',
    description: 'Traders dumping refuse behind the market stalls. Attracting flies and rodents near food vendors.',
    status: 'Assigned', crew: 'alpha', hasPhoto: true,
    timeline: [
      ev('Submitted', daysAgo(4, 1), CITIZEN.name),
      ev('Acknowledged', daysAgo(3, 8), 'Akua O. · AWMA'),
      ev('Assigned', daysAgo(3, 2), 'Akua O. · AWMA'),
    ],
  },
  {
    id: 'FMC-2026-0381', category: 'Blocked Drain', location: 'Airport Residential Area',
    description: 'Culvert under the access road is choked. Standing water is becoming a mosquito breeding ground.',
    status: 'In Progress', crew: 'beta', hasPhoto: true,
    timeline: [
      ev('Submitted', daysAgo(6, 4), CITIZEN.name),
      ev('Acknowledged', daysAgo(6, 1), 'Kofi M. · AWMA'),
      ev('Assigned', daysAgo(5, 5), 'Kofi M. · AWMA'),
      ev('In Progress', daysAgo(1, 2), 'Crew Beta'),
    ],
  },
  {
    id: 'FMC-2026-0355', category: 'Broken Streetlight', location: 'Roman Ridge',
    description: 'Streetlight pole leaning and light not working at the Kaneshie First Light junction.',
    status: 'Resolved', crew: 'gamma', hasPhoto: true,
    timeline: [
      ev('Submitted', daysAgo(11, 3), CITIZEN.name),
      ev('Acknowledged', daysAgo(11, 0), 'Akua O. · AWMA'),
      ev('Assigned', daysAgo(10, 4), 'Akua O. · AWMA'),
      ev('In Progress', daysAgo(8, 2), 'Crew Gamma'),
      ev('Resolved', daysAgo(6, 6), 'Crew Gamma'),
    ],
  },
  {
    id: 'FMC-2026-0340', category: 'Illegal Dumping', location: 'Shiashie',
    description: 'Construction debris dumped on the beach road shoulder. Cleared after report — thank you AWMA.',
    status: 'Resolved', crew: 'alpha', hasPhoto: true,
    timeline: [
      ev('Submitted', daysAgo(14, 2), CITIZEN.name),
      ev('Acknowledged', daysAgo(13, 7), 'Kofi M. · AWMA'),
      ev('Assigned', daysAgo(13, 1), 'Kofi M. · AWMA'),
      ev('In Progress', daysAgo(11, 3), 'Crew Alpha'),
      ev('Resolved', daysAgo(9, 5), 'Crew Alpha'),
    ],
  },
  {
    id: 'FMC-2026-0327', category: 'Blocked Drain', location: 'Legon (near University of Ghana)',
    description: 'Reported a blocked drain but the photo shows a private compound, not a public drain.',
    status: 'Rejected', crew: null, hasPhoto: true, rejectReason: 'Outside AWMA jurisdiction (private property)',
    timeline: [
      ev('Submitted', daysAgo(16, 1), CITIZEN.name),
      ev('Rejected', daysAgo(15, 4), 'Akua O. · AWMA'),
    ],
  },
];

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
   crews array so crewName/crewById resolve newly-added crews too (same role
   the prototype's window.FMC_CREWS played). */
let _liveCrews: Crew[] = SEED_CREWS;
export function crewName(id: string | null): string | null { const c = _liveCrews.find(c => c.id === id); return c ? c.name : null; }
export function crewById(id: string | null): Crew | null { return _liveCrews.find(c => c.id === id) || null; }

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

// Append a timestamped timeline entry and update the report head status.
function pushEvent(report: Report, status: StatusName, actor: string | null, extra: Partial<Report> = {}, note?: string): Report {
  return {
    ...report, status, ...extra,
    timeline: [...report.timeline, { status, timestamp: nowISO(), actor, ...(note ? { note } : {}) }],
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
  const [user, setUser] = useState<Operator | null>(null);
  const [reports, setReports] = useState<Report[]>(() => SEED_REPORTS.map(r => ({ ...r })));
  const [crews, setCrews] = useState<Crew[]>(() => SEED_CREWS.map(c => ({ ...c })));
  const [staff, setStaff] = useState<Staff[]>(() => SEED_USERS.map(u => ({ ...u })));

  // keep crew lookups (used across views) in sync with live crew state
  // eslint-disable-next-line react-hooks/globals -- module-level mirror so crewName/crewById resolve newly-added crews
  _liveCrews = crews;
  useEffect(() => { _liveCrews = crews; }, [crews]);

  /* ---- Auth ---- */
  const signIn = useCallback(() => {
    // TODO: replace with supabase edge function
    setUser(OPERATOR);
  }, []);

  const signOut = useCallback(() => {
    // TODO: replace with supabase edge function
    setUser(null);
  }, []);

  /* ---- Report state machine ----
     action: 'acknowledge' | 'assign' | 'reject' | 'in_progress' | 'resolve'
     opts:   { note, crewId, reason } */
  const transitionReport = useCallback((reportId: string, action: TransitionAction, opts: TransitionOpts = {}) => {
    // TODO: replace with supabase edge function
    const { note, crewId, reason } = opts;
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      switch (action) {
        case 'acknowledge':
          return pushEvent(r, 'Acknowledged', OFFICER, {}, note);
        case 'assign': {
          // available crews only
          const crew = _liveCrews.find(c => c.id === crewId && c.available !== false);
          if (!crew) return r;
          return pushEvent(r, 'Assigned', OFFICER, { crew: crewId }, note);
        }
        case 'reject': {
          // reason required
          if (!reason) return r;
          return pushEvent(r, 'Rejected', OFFICER, { rejectReason: reason }, note);
        }
        case 'in_progress': {
          const actor = r.crew ? crewName(r.crew) : OFFICER;
          return pushEvent(r, 'In Progress', actor, {}, note);
        }
        case 'resolve': {
          const actor = r.crew ? crewName(r.crew) : OFFICER;
          return pushEvent(r, 'Resolved', actor, {}, note);
        }
        default:
          return r;
      }
    }));
  }, []);

  /* ---- Crew actions ---- */
  const addCrew = useCallback((c: Omit<Crew, 'id'>) => {
    // TODO: replace with supabase edge function
    setCrews(prev => [...prev, { ...c, id: 'crew_' + Date.now() }]);
  }, []);

  const toggleCrewAvailability = useCallback((id: string) => {
    // TODO: replace with supabase edge function
    setCrews(prev => prev.map(c => c.id === id ? { ...c, available: !c.available } : c));
  }, []);

  // Crew roster management — backs the "Manage members" panel on the Crews
  // screen (an existing interaction that must be preserved).
  const addMember = useCallback((id: string, name: string) => {
    // TODO: replace with supabase edge function
    setCrews(prev => prev.map(c => c.id === id ? { ...c, roster: [...(c.roster || []), name] } : c));
  }, []);

  const removeMember = useCallback((id: string, name: string) => {
    // TODO: replace with supabase edge function
    setCrews(prev => prev.map(c => {
      if (c.id !== id) return c;
      const roster = (c.roster || []).filter(m => m !== name);
      const lead = c.lead === name ? (roster[0] || '—') : c.lead;
      return { ...c, roster, lead };
    }));
  }, []);

  const setLead = useCallback((id: string, name: string) => {
    // TODO: replace with supabase edge function
    setCrews(prev => prev.map(c => c.id === id ? { ...c, lead: name } : c));
  }, []);

  /* ---- Staff / user actions ---- */
  const inviteUser = useCallback((u: { name: string; email: string; role?: RoleName; unit?: string }) => {
    // TODO: replace with supabase edge function
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
    // TODO: replace with supabase edge function
    setStaff(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  }, []);

  const setUserStatus = useCallback((id: string, active: boolean) => {
    // TODO: replace with supabase edge function
    setStaff(prev => prev.map(u => u.id === id ? { ...u, active } : u));
  }, []);

  const value = useMemo<StoreValue>(() => ({
    user, reports, crews, staff,
    signIn, signOut,
    transitionReport,
    addCrew, toggleCrewAvailability, addMember, removeMember, setLead,
    inviteUser, setUserRole, setUserStatus,
  }), [user, reports, crews, staff, signIn, signOut, transitionReport,
       addCrew, toggleCrewAvailability, addMember, removeMember, setLead,
       inviteUser, setUserRole, setUserStatus]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
