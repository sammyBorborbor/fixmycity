import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, STATUS, relTime } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';

const NOTIF_META: Record<StatusName, { title: string; icon: string }> = {
  Submitted:     { title: 'Report received',     icon: 'Inbox' },
  Acknowledged:  { title: 'Report acknowledged',  icon: 'CheckCircle2' },
  Assigned:      { title: 'Crew assigned',        icon: 'Users' },
  'In Progress': { title: 'Work has started',     icon: 'Wrench' },
  Resolved:      { title: 'Issue resolved',       icon: 'CheckCheck' },
  Rejected:      { title: 'Report not actioned',  icon: 'Ban' },
  Reopened:      { title: 'Report reopened',      icon: 'RotateCcw' },
};

export default function Notifications() {
  const { notifications, markAllRead } = useStore();
  const navigate = useNavigate();

  // mark everything read once the feed is opened
  useEffect(() => { void markAllRead(); }, [markAllRead]);

  return (
    <div className="fade-in min-h-full flex flex-col">
      {/* header */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur px-4 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 -ml-1 rounded-full hover:bg-gray-100 flex items-center justify-center text-navy">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-navy leading-tight">Notifications</h1>
          <p className="text-xs text-muted">{notifications.length > 0 ? `${notifications.length} update${notifications.length === 1 ? '' : 's'}` : 'You’re all caught up'}</p>
        </div>
      </div>

      {/* list */}
      <div className="px-3 py-3 flex flex-col gap-1.5">
        {notifications.length === 0 && (
          <p className="text-center text-sm text-muted py-16">No notifications yet.</p>
        )}
        {notifications.map(n => {
          const meta = NOTIF_META[n.status] || NOTIF_META.Submitted;
          const cfg = STATUS[n.status] || STATUS.Submitted;
          return (
            <button key={n.id} onClick={() => n.reportRef && navigate('/reports/' + n.reportRef)}
              className={`w-full text-left rounded-xl p-3 flex gap-3 items-start transition ring-1 ${!n.read ? 'bg-white ring-ocean/20 shadow-sm' : 'bg-transparent ring-transparent hover:bg-white/60'}`}>
              <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white mt-0.5" style={{ background: cfg.dot }}>
                <Icon name={meta.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm leading-tight ${!n.read ? 'font-bold text-navy' : 'font-semibold text-ink'}`}>{meta.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-gold shrink-0" />}
                </div>
                <p className="text-xs text-muted mt-0.5">{n.body}</p>
                <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                  {n.reportRef && <><span className="font-mono text-ocean">{n.reportRef}</span><span className="text-gray-300">·</span></>}
                  {relTime(n.createdAt)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
