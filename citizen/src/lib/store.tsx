/* =========================================================================
   FixMyCity — data store backed by Supabase.
   ALL app state lives here, exposed through one React context. Screens read
   state and call the exposed functions; they never talk to supabase-js for
   reports directly. Status values are written ONLY by the transition-report /
   submit-report edge functions — this client is read-only on reports.
   ========================================================================= */
/* eslint-disable react-refresh/only-export-components --
   deliberately a context module: constants + hooks + one provider component */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';
import { compressImage } from './image.ts';
import type { Tables } from './database.types.ts';

/* ---- Domain types (UI-facing; display names, not DB enum values) -------- */
export type StatusName =
  | 'Submitted' | 'Acknowledged' | 'Assigned' | 'In Progress'
  | 'Resolved' | 'Rejected' | 'Reopened';

export type CategoryName =
  | 'Illegal Dumping' | 'Blocked Drain' | 'Broken Streetlight'
  | 'Flooding' | 'Pothole' | 'Pollution' | 'Broken Public Facility'
  | 'Poor Sanitation' | 'Other';

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
  id: string;                 // public reference, e.g. FMC-2026-0432 (used in routes)
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
  rejectReason?: string;
  timeline: TimelineEvent[];
  following?: boolean;        // true if this is someone else's report the user follows
  followerCount?: number;     // how many citizens follow this report (never who)
}

/* A candidate the CV service flagged the citizen's submission as a duplicate of.
   Returned by submitReport instead of creating a report, so the citizen can
   choose to follow it. Owner identity is never included. */
export interface DuplicateCandidate {
  uuid: string;               // report row id (for follow-report)
  reference: string;          // FMC-YYYY-NNNN
  category: CategoryName;
  location: string;
  status: StatusName;
  followerCount: number;
}

/* What a submission attempt produced: a created report, or a blocked duplicate —
   `duplicate` (someone else's report, offer to follow) or `alreadyReported` (the
   citizen's own still-open report). The blocked cases carry `photoPaths` so the
   citizen can override without re-uploading. */
export interface SubmitOutcome {
  report?: Report;
  duplicate?: DuplicateCandidate;
  alreadyReported?: DuplicateCandidate;
  photoPaths?: string[];
  error?: string;
}

export interface Crew {
  id: string;
  name: string;
  dept: string;
  lead: string;
  phone: string;
  available: boolean;
  members?: number;
}

export interface ReportDraft {
  category: CategoryName;
  location: LocationName;
  lat: number;
  lng: number;
  description: string;
  photos: File[];             // 1-5 photos
}

export interface CitizenUser { name: string; firstName: string; email: string }

export interface Notification {
  id: number;
  reportRef: string | null;   // report reference for navigation
  status: StatusName;         // drives title/icon (row `type` is the new status)
  body: string;
  read: boolean;
  createdAt: string;
}

export interface StoreValue {
  authReady: boolean;
  user: CitizenUser | null;
  reports: Report[];
  crews: Crew[];
  notifications: Notification[];
  unreadCount: number;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; pendingConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  // submitReport either creates the report, or — when the CV service flags it as a
  // duplicate — returns a candidate plus the already-uploaded `photoPaths`.
  // `duplicate` is someone else's report (offer to follow it); `alreadyReported` is
  // the citizen's own still-open report (nothing to follow, just view it). Either
  // way submitAnyway overrides.
  submitReport: (draft: ReportDraft) => Promise<SubmitOutcome>;
  submitAnyway: (draft: ReportDraft, photoPaths: string[]) => Promise<{ report?: Report; error?: string }>;
  followReport: (candidate: DuplicateCandidate, photoPaths: string[]) => Promise<{ error?: string }>;
  unfollowReport: (id: string) => Promise<{ error?: string }>;
  reopenReport: (id: string) => Promise<{ error?: string }>;
  cancelReport: (id: string) => Promise<{ error?: string }>;
  markAllRead: () => Promise<void>;
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
  'Illegal Dumping':        { icon: 'Trash2',         blurb: 'Waste dumped in unauthorised areas',       accent: '#1E5F8E' },
  'Blocked Drain':          { icon: 'WavesHorizontal', blurb: 'Clogged gutters & storm drains',           accent: '#1E5F8E' },
  'Broken Streetlight':     { icon: 'Lightbulb',      blurb: 'Faulty or dark street lighting',           accent: '#C8932F' },
  'Flooding':               { icon: 'Droplets',       blurb: 'Standing water or flooded roads & homes',  accent: '#1E5F8E' },
  'Pothole':                { icon: 'Construction',   blurb: 'Damaged road surface or potholes',         accent: '#C8932F' },
  'Pollution':              { icon: 'Factory',        blurb: 'Air, water or ground pollution',           accent: '#0B2545' },
  'Broken Public Facility': { icon: 'Wrench',         blurb: 'Damaged public property or facilities',    accent: '#1E5F8E' },
  'Poor Sanitation':        { icon: 'Biohazard',      blurb: 'Open sewage, waste or sanitation hazards', accent: '#C8932F' },
  'Other':                  { icon: 'CircleHelp',     blurb: 'Another public issue not listed above',    accent: '#6B7280' },
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
  flooding: 'Flooding', pothole: 'Pothole', pollution: 'Pollution',
  broken_public_facility: 'Broken Public Facility', sanitation: 'Poor Sanitation', other: 'Other',
};
const CATEGORY_TO_DB: Record<CategoryName, ReportRow['category']> = {
  'Illegal Dumping': 'dumping', 'Blocked Drain': 'drain', 'Broken Streetlight': 'streetlight',
  'Flooding': 'flooding', 'Pothole': 'pothole', 'Pollution': 'pollution',
  'Broken Public Facility': 'broken_public_facility', 'Poor Sanitation': 'sanitation', 'Other': 'other',
};
const DEPT_LABEL: Record<CrewRow['department'], string> = {
  sanitation: 'Sanitation', drainage: 'Drainage', electrical: 'Electrical',
};

/* ---- Map coordinates ---------------------------------------------------- */
// real-world coordinates submitted with a report (PostGIS geography)
export const GEO: Record<LocationName, { lat: number; lng: number }> = {
  'East Legon':                    { lat: 5.6360, lng: -0.1610 },
  'Okponglo':                      { lat: 5.6350, lng: -0.1850 },
  'Dzorwulu':                      { lat: 5.6060, lng: -0.1900 },
  'Abelemkpe':                     { lat: 5.6010, lng: -0.2030 },
  'Airport Residential Area':      { lat: 5.6000, lng: -0.1780 },
  'Roman Ridge':                   { lat: 5.5930, lng: -0.1920 },
  'Shiashie':                      { lat: 5.6260, lng: -0.1740 },
  'Legon (near University of Ghana)': { lat: 5.6500, lng: -0.1870 },
};

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

/* ---- Timeline display helper ------------------------------------------- */
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

/* Crew lookups reflect the fetched crew list (module mirror so plain helpers
   stay usable outside the provider). */
let _liveCrews: Crew[] = [];
export function crewName(id: string | null): string | null { const c = _liveCrews.find(c => c.id === id); return c ? c.name : null; }
export function crewById(id: string | null): Crew | null { return _liveCrews.find(c => c.id === id) || null; }

/* ---- Row mappers --------------------------------------------------------- */
function mapCrew(row: CrewRow): Crew {
  return {
    id: row.id,
    name: row.name,
    dept: DEPT_LABEL[row.department],
    lead: row.lead_name,
    phone: row.phone,
    available: row.available,
    members: row.member_count,
  };
}

/* Citizens cannot read staff profiles under RLS (by design), so timeline
   actors resolve to the user's own name or a role label. */
function actorLabel(t: TransitionRow, uid: string, userName: string, crewId: string | null): string {
  if (t.actor_id === uid) return userName;
  if (t.actor_role === 'crew') return crewName(crewId) ?? 'Field crew';
  if (t.actor_role === 'officer' || t.actor_role === 'admin') return 'AWMA';
  // a citizen actor who isn't the current user = the original reporter of a
  // report we follow. Stay anonymous (their profile is unreadable under RLS).
  if (t.actor_role === 'citizen') return 'Reporter';
  return 'AWMA';
}

function mapReport(row: ReportRow & { status_transitions: TransitionRow[] }, uid: string, userName: string): Report {
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
    rejectReason: rejected?.note ?? undefined,
    following: row.reporter_id !== uid,
    followerCount: row.follower_count,
    timeline: transitions.map(t => ({
      status: DB_TO_STATUS[t.to_status],
      timestamp: t.created_at,
      actor: actorLabel(t, uid, userName, row.assigned_crew_id),
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

async function describeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body && typeof body.error === 'string') return body.error;
    } catch { /* fall through */ }
    return 'The request was refused.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

type NotificationRow = Tables<'notifications'>;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<CitizenUser | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  /* Load profile + crews + reports + notifications for the signed-in user. */
  const loadAll = useCallback(async (userId: string, email: string) => {
    const [{ data: profile }, { data: crewRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('crews').select('*').order('name'),
    ]);
    const name = (profile as ProfileRow | null)?.full_name || email;
    const citizen: CitizenUser = { name, firstName: name.split(/\s+/)[0], email };
    setUser(citizen);
    const mappedCrews = (crewRows ?? []).map(mapCrew);
    _liveCrews = mappedCrews;
    setCrews(mappedCrews);

    const { data: reportRows } = await supabase
      .from('reports')
      .select('*, status_transitions!status_transitions_report_id_fkey(*)')
      .order('created_at', { ascending: false });
    const mapped = (reportRows ?? []).map(r => mapReport(r, userId, name));
    setReports(mapped);

    // notifications reference reports by uuid; resolve to the public reference
    const uuidToRef = new Map(mapped.map(r => [r.uuid!, r.id]));
    const { data: notifRows } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    setNotifications((notifRows ?? []).map((n: NotificationRow) => ({
      id: n.id,
      reportRef: n.report_id ? uuidToRef.get(n.report_id) ?? null : null,
      status: DB_TO_STATUS[n.type as ReportRow['status']] ?? 'Submitted',
      body: n.body,
      read: n.read,
      createdAt: n.created_at,
    })));
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadAll(session.user.id, session.user.email ?? '');
  }, [loadAll]);

  /* Session bootstrap + auth state changes. */
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        setUid(session.user.id);
        await loadAll(session.user.id, session.user.email ?? '');
      }
      if (!cancelled) setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUid(null); setUser(null); setReports([]); setNotifications([]);
      } else if (event === 'SIGNED_IN' && session.user) {
        setUid(session.user.id);
        void loadAll(session.user.id, session.user.email ?? '');
      }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [loadAll]);

  /* Realtime: a new notification row means one of my reports changed status, so
     refetch everything (bell + reports + feed). Debounced to coalesce a burst of
     staff actions. RLS scopes delivery to my own rows; the filter narrows further. */
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('citizen-notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => { void refresh(); }, 300);
        })
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [uid, refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    // with email confirmation enabled there is no session yet
    return data.session ? {} : { pendingConfirmation: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /* Send the password-reset email. The recovery link lands directly on
     /reset-password, where the recovered session lets the user set a new one. */
  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? { error: error.message } : {};
  }, []);

  /* Set a new password for the current (recovery or signed-in) session. */
  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : {};
  }, []);

  /* Map a freshly-created report row from submit-report into local state. */
  const acceptNewReport = useCallback((row: ReportRow, uidArg: string, userName: string): Report => {
    const report = mapReport({ ...row, status_transitions: [] }, uidArg, userName);
    report.timeline = [{ status: 'Submitted', timestamp: row.created_at, actor: userName }];
    setReports(prev => [report, ...prev]);
    void refresh();
    return report;
  }, [refresh]);

  const submitReport = useCallback(async (draft: ReportDraft): Promise<SubmitOutcome> => {
    if (!uid || !user) return { error: 'You are signed out. Please sign in again.' };
    try {
      // compress + upload each photo (1-5); the report row is only created by the
      // edge function afterwards, so a failed upload just aborts before any row exists
      const paths: string[] = [];
      for (const photo of draft.photos) {
        const blob = await compressImage(photo);
        const path = `${uid}/${crypto.randomUUID()}.webp`;
        const { error: uploadErr } = await supabase.storage
          .from('report-photos')
          .upload(path, blob, { contentType: 'image/webp' });
        if (uploadErr) return { error: uploadErr.message };
        paths.push(path);
      }

      const { data, error } = await supabase.functions.invoke('submit-report', {
        body: {
          category: CATEGORY_TO_DB[draft.category],
          location_name: draft.location,
          lat: draft.lat,
          lng: draft.lng,
          description: draft.description,
          photo_paths: paths,
        },
      });
      if (error) return { error: await describeError(error) };

      // the CV service flagged this as a duplicate: no report was created — hand
      // the candidate + uploaded photos back so the citizen can choose. Which key
      // it comes back under decides the screen: someone else's report can be
      // followed, the citizen's own can only be viewed.
      if ((data?.status === 'duplicate_detected' || data?.status === 'already_reported') && data.candidate) {
        const c = data.candidate;
        const candidate: DuplicateCandidate = {
          uuid: c.id,
          reference: c.reference,
          category: DB_TO_CATEGORY[c.category as ReportRow['category']],
          location: c.location_name,
          status: DB_TO_STATUS[c.status as ReportRow['status']],
          followerCount: c.follower_count ?? 0,
        };
        return data.status === 'already_reported'
          ? { photoPaths: paths, alreadyReported: candidate }
          : { photoPaths: paths, duplicate: candidate };
      }

      return { report: acceptNewReport(data.report, uid, user.name) };
    } catch (e) {
      return { error: await describeError(e) };
    }
  }, [uid, user, acceptNewReport]);

  /* "No, mine is different": re-submit after a duplicate was detected, reusing the
     already-uploaded photos and telling the server to skip the CV check. */
  const submitAnyway = useCallback(async (draft: ReportDraft, photoPaths: string[]): Promise<{ report?: Report; error?: string }> => {
    if (!uid || !user) return { error: 'You are signed out. Please sign in again.' };
    try {
      const { data, error } = await supabase.functions.invoke('submit-report', {
        body: {
          category: CATEGORY_TO_DB[draft.category],
          location_name: draft.location,
          lat: draft.lat,
          lng: draft.lng,
          description: draft.description,
          photo_paths: photoPaths,
          force_create: true,
        },
      });
      if (error) return { error: await describeError(error) };
      return { report: acceptNewReport(data.report, uid, user.name) };
    } catch (e) {
      return { error: await describeError(e) };
    }
  }, [uid, user, acceptNewReport]);

  /* Follow an existing report the citizen's submission duplicated. The uploaded
     photos for the report they chose NOT to file are cleaned up server-side. */
  const followReport = useCallback(async (candidate: DuplicateCandidate, photoPaths: string[]): Promise<{ error?: string }> => {
    const { error } = await supabase.functions.invoke('follow-report', {
      body: { report_id: candidate.uuid, photo_paths: photoPaths },
    });
    if (error) return { error: await describeError(error) };
    await refresh();
    return {};
  }, [refresh]);

  const unfollowReport = useCallback(async (id: string): Promise<{ error?: string }> => {
    const target = reports.find(r => r.id === id);
    if (!target?.uuid) return { error: 'Report not found.' };
    const { error } = await supabase.functions.invoke('unfollow-report', {
      body: { report_id: target.uuid },
    });
    if (error) return { error: await describeError(error) };
    setReports(prev => prev.filter(r => r.id !== id));
    void refresh();
    return {};
  }, [reports, refresh]);

  // AI feature 1 (auto-categorisation) now runs server-side at submission time
  // via the external CV service (see submit-report); there is no longer a
  // stateless pre-submission classify call. The inferred category is stored on
  // the report (ai_suggested_category) and surfaced to officers in the console.

  const reopenReport = useCallback(async (id: string): Promise<{ error?: string }> => {
    const target = reports.find(r => r.id === id);
    if (!target?.uuid) return { error: 'Report not found.' };
    const { error } = await supabase.functions.invoke('transition-report', {
      body: { report_id: target.uuid, action: 'reopen' },
    });
    if (error) return { error: await describeError(error) };
    await refresh();
    return {};
  }, [reports, refresh]);

  // withdraw an own report while still Submitted (before acknowledgement) —
  // a hard delete via the cancel-report edge function
  const cancelReport = useCallback(async (id: string): Promise<{ error?: string }> => {
    const target = reports.find(r => r.id === id);
    if (!target?.uuid) return { error: 'Report not found.' };
    const { error } = await supabase.functions.invoke('cancel-report', {
      body: { report_id: target.uuid },
    });
    if (error) return { error: await describeError(error) };
    setReports(prev => prev.filter(r => r.id !== id));
    void refresh();
    return {};
  }, [reports, refresh]);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
  }, [uid]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const value = useMemo<StoreValue>(() => ({
    authReady, user, reports, crews, notifications, unreadCount,
    signIn, signUp, signOut, sendPasswordReset, updatePassword,
    submitReport, submitAnyway, followReport, unfollowReport, reopenReport, cancelReport, markAllRead,
  }), [authReady, user, reports, crews, notifications, unreadCount,
       signIn, signUp, signOut, sendPasswordReset, updatePassword,
       submitReport, submitAnyway, followReport, unfollowReport, reopenReport, cancelReport, markAllRead]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
