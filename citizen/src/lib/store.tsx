/* =========================================================================
   FixMyCity — data store, status model & transition helpers
   ALL app state + seed data live here, exposed through one React context.
   Screens/components read state and call the exposed functions; they never
   mutate `reports`/`user` directly.
   ========================================================================= */
/* eslint-disable react-refresh/only-export-components --
   deliberately a context module: constants + hooks + one provider component */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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

export interface ReportDraft {
  category: CategoryName;
  location: LocationName;
  hasPhoto: boolean;
  description: string;
}

export interface CitizenUser { name: string; firstName: string; email: string }

export interface StoreValue {
  user: CitizenUser | null;
  reports: Report[];
  crews: Crew[];
  signIn: () => void;
  signOut: () => void;
  submitReport: (draft: ReportDraft) => Report;
  reopenReport: (id: string) => void;
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

/* ---- Crews ------------------------------------------------------------- */
export const CREWS: Crew[] = [
  { id: 'alpha', name: 'Crew Alpha', dept: 'Sanitation',  lead: 'Yaw Boateng',   phone: '024 118 0042', available: true,  roster: ['Yaw Boateng', 'Adwoa Mensah', 'Kwabena Osei', 'Abena Owusu'] },
  { id: 'beta',  name: 'Crew Beta',  dept: 'Drainage',    lead: 'Esi Addo',      phone: '020 776 5510', available: true,  roster: ['Esi Addo', 'Kofi Darko', 'Yaa Asantewaa', 'Kwame Nkansah', 'Akosua Frimpong'] },
  { id: 'gamma', name: 'Crew Gamma', dept: 'Electrical',  lead: 'Kojo Annan',    phone: '055 309 8821', available: false, roster: ['Kojo Annan', 'Ama Boadu', 'Fiifi Tetteh'] },
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

export const CITIZEN: CitizenUser = { name: 'Ama Asante', firstName: 'Ama', email: 'ama.asante@gmail.com' };

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

/* ---- Transition logic -------------------------------------------------- */
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

export function crewName(id: string | null): string | null { const c = CREWS.find(c => c.id === id); return c ? c.name : null; }
export function crewById(id: string | null): Crew | null { return CREWS.find(c => c.id === id) || null; }

/* ---- Context ----------------------------------------------------------- */
const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within <StoreProvider>');
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CitizenUser | null>(null);
  const [reports, setReports] = useState<Report[]>(() => SEED_REPORTS.map(r => ({ ...r })));

  const signIn = useCallback(() => {
    // TODO: replace with supabase
    setUser(CITIZEN);
  }, []);

  const signOut = useCallback(() => {
    // TODO: replace with supabase
    setUser(null);
  }, []);

  const submitReport = useCallback((draft: ReportDraft): Report => {
    // TODO: replace with supabase
    const id = 'FMC-2026-0' + (430 + Math.floor(Math.random() * 60));
    const report: Report = {
      id,
      category: draft.category,
      location: draft.location,
      hasPhoto: !!draft.hasPhoto,
      description: draft.description || 'No description provided.',
      status: 'Submitted',
      crew: null,
      timeline: [{ status: 'Submitted', timestamp: nowISO(), actor: CITIZEN.name }],
    };
    setReports(prev => [report, ...prev]);
    return report;
  }, []);

  const reopenReport = useCallback((id: string) => {
    // TODO: replace with supabase
    setReports(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: 'Reopened' as const, timeline: [...r.timeline, { status: 'Reopened' as const, timestamp: nowISO(), actor: CITIZEN.name }] }
        : r
    ));
  }, []);

  const value = useMemo<StoreValue>(() => ({
    user, reports, crews: CREWS, signIn, signOut, submitReport, reopenReport,
  }), [user, reports, signIn, signOut, submitReport, reopenReport]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
