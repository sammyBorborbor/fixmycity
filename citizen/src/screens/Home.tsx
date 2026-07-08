import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import ReportCard from '../components/ReportCard.tsx';
import InstallPrompt from '../components/InstallPrompt.tsx';

function bySubmittedDesc(a: Report, b: Report) {
  return new Date(b.timeline[0].timestamp).getTime() - new Date(a.timeline[0].timestamp).getTime();
}

export default function Home() {
  const { reports, user, unreadCount } = useStore();
  const navigate = useNavigate();

  const recent = [...reports].sort(bySubmittedDesc).slice(0, 3);
  const openCount = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status)).length;

  return (
    <div className="fade-up px-4 pt-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm">Good afternoon,</p>
          <h1 className="text-2xl font-bold text-navy leading-tight">Hello, {user?.firstName} 👋</h1>
        </div>
        <button onClick={() => navigate('/notifications')} className="relative w-10 h-10 rounded-full bg-white ring-1 ring-black/5 shadow-sm flex items-center justify-center text-navy">
          <Icon name="Bell" size={18} />
          {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gold text-white text-[10px] font-bold flex items-center justify-center pop-dot">{unreadCount}</span>}
        </button>
      </div>

      {/* CTA */}
      <button onClick={() => navigate('/report')}
        className="mt-5 w-full rounded-xl p-5 text-left text-white shadow-md relative overflow-hidden active:scale-[.99] transition"
        style={{ background: 'linear-gradient(135deg,#0B2545 0%,#1E5F8E 100%)' }}>
        <div className="relative z-10">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 mb-3">
            <Icon name="Camera" size={24} />
          </span>
          <p className="text-xl font-bold leading-tight">Report an issue</p>
          <p className="text-white/75 text-sm mt-1 max-w-[16rem]">Snap a photo, drop a pin and notify AWMA in under a minute.</p>
          <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-gold">
            Start a report <Icon name="ArrowRight" size={16} />
          </span>
        </div>
        <Icon name="Megaphone" size={120} className="absolute -right-5 -bottom-6 opacity-10" />
      </button>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-3">
          <p className="text-2xl font-bold text-navy">{reports.length}</p>
          <p className="text-xs text-muted">Total reports</p>
        </div>
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-3">
          <p className="text-2xl font-bold text-gold">{openCount}</p>
          <p className="text-xs text-muted">In progress</p>
        </div>
      </div>

      <InstallPrompt className="mt-4" />

      {/* recent */}
      <div className="flex items-center justify-between mt-6 mb-2">
        <h2 className="font-bold text-navy">Your recent reports</h2>
        <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-ocean">View all</button>
      </div>
      <div className="flex flex-col gap-2.5">
        {recent.map(r => <ReportCard key={r.id} r={r} unread={false} onClick={() => navigate('/reports/' + r.id)} />)}
      </div>
    </div>
  );
}
