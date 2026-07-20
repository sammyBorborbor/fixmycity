import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore, crewName, crewById } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';
import StatusPill from '../components/StatusPill.tsx';
import CategoryBadge from '../components/CategoryBadge.tsx';
import Timeline from '../components/Timeline.tsx';
import { ReportPhotos } from '../components/PhotoBox.tsx';

export default function ReportDetail() {
  const { id } = useParams();
  const { reports, reopenReport, cancelReport, unfollowReport } = useStore();
  const navigate = useNavigate();
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [unfollowing, setUnfollowing] = useState(false);
  const [unfollowError, setUnfollowError] = useState<string | null>(null);
  const report = reports.find(r => r.id === id);

  if (!report) return <Navigate to="/reports" replace />;

  async function reopen() {
    if (!report || reopening) return;
    setReopening(true);
    setReopenError(null);
    const { error } = await reopenReport(report.id);
    setReopening(false);
    if (error) setReopenError(error);
  }

  async function cancel() {
    if (!report || cancelling) return;
    if (!window.confirm('Cancel this report? This permanently removes it and cannot be undone.')) return;
    setCancelling(true);
    setCancelError(null);
    const { error } = await cancelReport(report.id);
    if (error) { setCancelling(false); setCancelError(error); return; }
    navigate('/reports', { replace: true });
  }

  async function unfollow() {
    if (!report || unfollowing) return;
    setUnfollowing(true);
    setUnfollowError(null);
    const { error } = await unfollowReport(report.id);
    if (error) { setUnfollowing(false); setUnfollowError(error); return; }
    navigate('/reports', { replace: true });
  }

  return (
    <div className="fade-in pb-6">
      {/* photo header */}
      <div className="relative">
        <ReportPhotos report={report} className="w-full" style={{ height: 220 }} />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/95 shadow flex items-center justify-center text-navy">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <div className="absolute top-4 right-4"><StatusPill status={report.status} size="lg" /></div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <CategoryBadge category={report.category} size={44} />
          <div>
            <h1 className="text-lg font-bold text-navy leading-tight">{report.category}</h1>
            <p className="text-sm text-muted flex items-center gap-1"><Icon name="MapPin" size={13} /> {report.location}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className="font-mono text-xs text-muted">{report.id}</p>
          {(report.followerCount ?? 0) > 0 && (
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Icon name="Users" size={12} />
              {report.followerCount} {report.followerCount === 1 ? 'person' : 'people'} following
            </span>
          )}
        </div>
        {report.following && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-ocean/5 ring-1 ring-ocean/15 rounded-xl px-3 py-2 text-ocean">
            <Icon name="Bell" size={15} /> You're following this report — we'll notify you of every update.
          </div>
        )}

        <p className="text-sm text-ink mt-3 bg-white rounded-xl ring-1 ring-black/5 p-3 leading-relaxed">{report.description}</p>

        {report.crew && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-blue-50 ring-1 ring-blue-100 rounded-xl px-3 py-2 text-blue-800">
            <Icon name="Users" size={15} /> Assigned to <span className="font-semibold">{crewName(report.crew)}</span>
            <span className="text-blue-500">· {crewById(report.crew)?.dept}</span>
          </div>
        )}

        <h2 className="font-bold text-navy mt-6 mb-3">Status timeline</h2>
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4">
          <Timeline report={report} />
        </div>

        {/* reporter-only actions: hidden on reports the user merely follows */}
        {!report.following && report.status === 'Resolved' && (
          <div className="mt-4">
            <Btn variant="danger" icon="RotateCcw" className="w-full" onClick={reopen} disabled={reopening}>
              {reopening ? 'Reopening…' : 'Reopen — issue not fixed'}
            </Btn>
            {reopenError && <p className="text-center text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2 mt-2">{reopenError}</p>}
            <p className="text-center text-[11px] text-muted mt-2">This sends your report back to AWMA flagged as Reopened.</p>
          </div>
        )}

        {!report.following && report.status === 'Submitted' && (
          <div className="mt-4">
            <Btn variant="danger" icon="Trash2" className="w-full" onClick={cancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel report'}
            </Btn>
            {cancelError && <p className="text-center text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2 mt-2">{cancelError}</p>}
            <p className="text-center text-[11px] text-muted mt-2">You can cancel while it is still Submitted, before AWMA acknowledges it.</p>
          </div>
        )}

        {/* unfollow: only on reports the user follows (not their own) */}
        {report.following && (
          <div className="mt-4">
            <Btn variant="outline" icon="BellOff" className="w-full" onClick={unfollow} disabled={unfollowing}>
              {unfollowing ? 'Unfollowing…' : 'Unfollow this report'}
            </Btn>
            {unfollowError && <p className="text-center text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2 mt-2">{unfollowError}</p>}
            <p className="text-center text-[11px] text-muted mt-2">You'll stop receiving updates about this report.</p>
          </div>
        )}
      </div>
    </div>
  );
}
