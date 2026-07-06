import { useNavigate } from 'react-router-dom';
import { useStore, STATUS, crewName, relTime } from '../lib/store.tsx';
import type { Report, StatusName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';

const NO_UNREAD = new Set<string>();

const NOTIF_META: Record<StatusName, { title: string; icon: string; body: (r: Report) => string }> = {
  Submitted:     { title: 'Report received',     icon: 'Inbox',        body: () => 'We’ve logged your report and sent it to AWMA.' },
  Acknowledged:  { title: 'Report acknowledged',  icon: 'CheckCircle2', body: () => 'AWMA has reviewed your report.' },
  Assigned:      { title: 'Crew assigned',        icon: 'Users',        body: (r) => `Assigned to ${crewName(r.crew) || 'a field crew'}.` },
  'In Progress': { title: 'Work has started',     icon: 'Wrench',       body: () => 'A crew is now working on your issue.' },
  Resolved:      { title: 'Issue resolved',       icon: 'CheckCheck',   body: () => 'Your report has been marked resolved.' },
  Rejected:      { title: 'Report not actioned',  icon: 'Ban',          body: (r) => r.rejectReason || 'This report could not be actioned.' },
  Reopened:      { title: 'Report reopened',      icon: 'RotateCcw',    body: () => 'You sent this report back to AWMA.' },
};

interface NotifItem { key: string; report: Report; status: StatusName; ts: string; isUnread: boolean }

export default function Notifications() {
  const { reports } = useStore();
  const navigate = useNavigate();
  const unread = NO_UNREAD;

  const items: NotifItem[] = [];
  reports.forEach(r => {
    const tl = r.timeline || [];
    tl.forEach((e, i) => {
      items.push({
        key: r.id + '-' + i, report: r, status: e.status, ts: e.timestamp,
        isUnread: unread.has(r.id) && i === tl.length - 1,
      });
    });
  });
  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const unreadCount = items.filter(i => i.isUnread).length;

  return (
    <div className="fade-in min-h-full flex flex-col">
      {/* header */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur px-4 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 -ml-1 rounded-full hover:bg-gray-100 flex items-center justify-center text-navy">
          <Icon name="ChevronLeft" size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-navy leading-tight">Notifications</h1>
          <p className="text-xs text-muted">{unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}</p>
        </div>
      </div>

      {/* list */}
      <div className="px-3 py-3 flex flex-col gap-1.5">
        {items.map(n => {
          const meta = NOTIF_META[n.status] || NOTIF_META.Submitted;
          const cfg = STATUS[n.status] || STATUS.Submitted;
          return (
            <button key={n.key} onClick={() => navigate('/reports/' + n.report.id)}
              className={`w-full text-left rounded-xl p-3 flex gap-3 items-start transition ring-1 ${n.isUnread ? 'bg-white ring-ocean/20 shadow-sm' : 'bg-transparent ring-transparent hover:bg-white/60'}`}>
              <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white mt-0.5" style={{ background: cfg.dot }}>
                <Icon name={meta.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm leading-tight ${n.isUnread ? 'font-bold text-navy' : 'font-semibold text-ink'}`}>{meta.title}</p>
                  {n.isUnread && <span className="w-2 h-2 rounded-full bg-gold shrink-0" />}
                </div>
                <p className="text-xs text-muted mt-0.5">{meta.body(n.report)}</p>
                <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-ocean">{n.report.id}</span>
                  <span className="text-gray-300">·</span>{n.report.category}
                  <span className="text-gray-300">·</span>{relTime(n.ts)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
