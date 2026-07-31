import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, relTime } from '../lib/store.tsx';
import type { DuplicateReview, DuplicateReviewSide } from '../lib/store.tsx';
import { signedPhotoUrl } from '../lib/supabase.ts';
import FilterChips from '../components/FilterChips.tsx';
import StatusPill from '../components/StatusPill.tsx';
import Btn from '../components/Btn.tsx';
import Icon from '../components/Icon.tsx';

// The four DuplicateStatus values the CV service accepts, with friendly labels.
const RESOLUTIONS = [
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'possible_duplicate', label: 'Possible duplicate' },
  { value: 'supporting_evidence', label: 'Supporting evidence' },
  { value: 'new', label: 'Reject (not a duplicate)' },
];
const RES_LABEL: Record<string, string> = Object.fromEntries(RESOLUTIONS.map(r => [r.value, r.label]));

const FILTERS = ['All', 'Open', 'Resolved'];
const selCls = 'w-full rounded-xl ring-1 ring-gray-300 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ocean';

export default function DuplicateReviews() {
  const { listDuplicateReviews, resolveDuplicateReview, mergeDuplicateReview, perms } = useStore();
  // Viewers (no report actions) get a read-only view; anyone who can act on a
  // report can triage the model's review queue.
  const canAct = perms.actions.size > 0;

  const [reviews, setReviews] = useState<DuplicateReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);

  // Fetch on mount and whenever reload() bumps the key (after a resolve/merge).
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while (re)loading
    setLoading(true);
    listDuplicateReviews()
      .then(({ reviews: r, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else { setReviews(r ?? []); setError(null); }
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on reloadKey; listDuplicateReviews is stable
  }, [reloadKey]);

  const counts = useMemo(() => ({
    All: reviews.length,
    Open: reviews.filter(r => r.status === 'open').length,
    Resolved: reviews.filter(r => r.status === 'resolved').length,
  }), [reviews]);

  const shown = filter === 'All' ? reviews : reviews.filter(r => r.status === filter.toLowerCase());

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Duplicate Reviews</h1>
        <span className="text-sm text-muted">{reviews.length} total</span>
      </div>
      <p className="text-sm text-muted mb-4 max-w-[70ch]">
        The image model flags likely duplicate reports here. Resolving or merging updates the
        model's review queue only — to change a report's status, reject it as a duplicate from
        the report itself.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChips filters={FILTERS} counts={counts} active={filter} onChange={setFilter} />
      </div>

      {error && <div className="bg-red-50 text-red-700 ring-1 ring-red-200 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-8 text-center text-sm text-muted">
          No {filter === 'All' ? '' : filter.toLowerCase() + ' '}duplicate reviews.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map(rv => (
            <ReviewCard key={rv.id} review={rv} canAct={canAct}
              onResolve={resolveDuplicateReview} onMerge={mergeDuplicateReview} onDone={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

/* The report's first stored photo, signed on demand. External-only sides (not
   in our DB) have no path — their image lives on the CV service, not our storage. */
function Thumb({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (path) signedPhotoUrl(path).then(u => { if (alive) setUrl(u); }).catch(() => { /* leave placeholder */ });
    return () => { alive = false; };
  }, [path]);

  if (!path) {
    return <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"><Icon name="ImageOff" size={16} /></div>;
  }
  if (!url) return <div className="w-12 h-12 rounded-lg bg-gray-100 animate-pulse shrink-0" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0" title="Open full image">
      <img src={url} alt="report photo" className="w-12 h-12 rounded-lg object-cover ring-1 ring-black/5 hover:ring-2 hover:ring-ocean/60 transition" />
    </a>
  );
}

/* One side of a review — resolved to our report when it exists in our DB. */
function Side({ side }: { side: DuplicateReviewSide }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Thumb path={side.photoPath} />
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-navy truncate">{side.label}</p>
        {side.reportId ? (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {side.status && <StatusPill status={side.status} />}
            {side.category && <span className="text-[11px] text-muted">{side.category}</span>}
          </div>
        ) : (
          <p className="text-[11px] text-muted mt-0.5">not in our records</p>
        )}
        {side.locationName && <p className="text-[11px] text-muted truncate mt-0.5">{side.locationName}</p>}
      </div>
    </div>
  );
}

interface CardProps {
  review: DuplicateReview;
  canAct: boolean;
  onResolve: (id: number, opts: { resolution: string; duplicateOfReportId?: number | null; notes?: string }) => Promise<{ error?: string }>;
  onMerge: (id: number, targetReportId: number, notes?: string) => Promise<{ error?: string }>;
  onDone: () => void;
}

function ReviewCard({ review, canAct, onResolve, onMerge, onDone }: CardProps) {
  const [mode, setMode] = useState<null | 'resolve' | 'merge'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const menuAnchor = useRef<HTMLDivElement>(null);

  // Open the resolve menu, flipping it above the button when a downward menu
  // would overflow the viewport (e.g. the last card near the bottom).
  const toggleMenu = () => {
    setMenuOpen(o => {
      const next = !o;
      if (next && menuAnchor.current) {
        const rect = menuAnchor.current.getBoundingClientRect();
        setDropUp(window.innerHeight - rect.bottom < 240); // ~menu height + margin
      }
      return next;
    });
  };
  const [resolution, setResolution] = useState('duplicate');
  const [dupOf, setDupOf] = useState('');                                   // externalId as string; '' = none
  const [mergeInto, setMergeInto] = useState(String(review.report.externalId));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = review.status === 'open';
  const sides = [review.report, review.candidate];

  const close = () => { setMode(null); setErr(null); setNotes(''); };

  const submitResolve = async () => {
    setBusy(true); setErr(null);
    // "Duplicate of" only applies to duplicate-type resolutions; ignore any stale
    // selection when resolving as reject/supporting evidence.
    const isDup = resolution === 'duplicate' || resolution === 'possible_duplicate';
    const { error } = await onResolve(review.id, {
      resolution,
      duplicateOfReportId: isDup && dupOf ? Number(dupOf) : null,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (error) { setErr(error); return; }
    onDone();
  };
  const submitMerge = async () => {
    setBusy(true); setErr(null);
    const { error } = await onMerge(review.id, Number(mergeInto), notes.trim() || undefined);
    setBusy(false);
    if (error) { setErr(error); return; }
    onDone();
  };

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${open ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-green-50 text-green-700 ring-green-200'}`}>
            {open ? 'Open' : 'Resolved'}
          </span>
          <span className="text-xs font-semibold text-ocean bg-blue-50 ring-1 ring-blue-100 px-2 py-0.5 rounded-full">
            {Math.round(review.confidence * 100)}% match
          </span>
        </div>
        <span className="text-xs text-muted">{relTime(review.createdAt)}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0"><Side side={review.report} /></div>
        <Icon name="Copy" size={16} className="text-gray-300 shrink-0" />
        <div className="flex-1 min-w-0"><Side side={review.candidate} /></div>
      </div>

      {!open && review.resolution && (
        <p className="mt-3 text-xs text-muted">
          Resolved as <span className="font-semibold text-ink">{RES_LABEL[review.resolution] ?? review.resolution}</span>
          {review.resolvedAt && ` · ${relTime(review.resolvedAt)}`}
          {review.notes && <> — {review.notes}</>}
        </p>
      )}

      {open && canAct && mode === null && (
        <div className="mt-3 flex gap-2">
          <div className="relative" ref={menuAnchor}>
            <Btn size="sm" variant="outline" icon="Check" onClick={toggleMenu}>
              Resolve <Icon name="ChevronDown" size={14} className={`transition ${menuOpen ? 'rotate-180' : ''}`} />
            </Btn>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className={`absolute left-0 w-56 bg-white rounded-xl ring-1 ring-black/5 shadow-xl z-50 overflow-hidden fade-in ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                  {RESOLUTIONS.map(r => (
                    <button key={r.value}
                      onClick={() => { setResolution(r.value); setMode('resolve'); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-gray-50">
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Btn size="sm" variant="outline" icon="GitMerge" onClick={() => setMode('merge')}>Merge</Btn>
        </div>
      )}

      {open && mode === 'resolve' && (
        <div className="mt-3 border-t border-gray-100 pt-3 flex flex-col gap-2.5">
          <p className="text-xs text-muted">
            Resolving as <span className="font-semibold text-ink">{RES_LABEL[resolution] ?? resolution}</span>
          </p>
          {(resolution === 'duplicate' || resolution === 'possible_duplicate') && (
            <label className="text-xs font-semibold text-muted block">Duplicate of (optional)
              <select value={dupOf} onChange={e => setDupOf(e.target.value)} className={`${selCls} mt-1`}>
                <option value="">— none —</option>
                {sides.map(s => <option key={s.externalId} value={s.externalId}>{s.label}</option>)}
              </select>
            </label>
          )}
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000}
            placeholder="Notes (optional)" className={selCls} />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Btn size="sm" variant="primary" disabled={busy} onClick={submitResolve}>{busy ? 'Saving…' : 'Confirm resolve'}</Btn>
            <Btn size="sm" variant="ghost" disabled={busy} onClick={close}>Cancel</Btn>
          </div>
        </div>
      )}

      {open && mode === 'merge' && (
        <div className="mt-3 border-t border-gray-100 pt-3 flex flex-col gap-2.5">
          <label className="text-xs font-semibold text-muted block">Merge into
            <select value={mergeInto} onChange={e => setMergeInto(e.target.value)} className={`${selCls} mt-1`}>
              {sides.map(s => <option key={s.externalId} value={s.externalId}>{s.label}</option>)}
            </select>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000}
            placeholder="Notes (optional)" className={selCls} />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Btn size="sm" variant="primary" disabled={busy} onClick={submitMerge}>{busy ? 'Merging…' : 'Confirm merge'}</Btn>
            <Btn size="sm" variant="ghost" disabled={busy} onClick={close}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
