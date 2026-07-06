import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore, crewName, crewById } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';
import StatusPill from '../components/StatusPill.tsx';
import CategoryBadge from '../components/CategoryBadge.tsx';
import Timeline from '../components/Timeline.tsx';
import { ReportPhoto } from '../components/PhotoBox.tsx';

export default function ReportDetail() {
  const { id } = useParams();
  const { reports, reopenReport } = useStore();
  const navigate = useNavigate();
  const report = reports.find(r => r.id === id);

  if (!report) return <Navigate to="/reports" replace />;

  return (
    <div className="fade-in pb-6">
      {/* photo header */}
      <div className="relative">
        <ReportPhoto report={report} shape="rect" placeholder={`Drop a ${report.category.toLowerCase()} photo`} className="w-full" style={{ height: 220 }} />
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
        <p className="font-mono text-xs text-muted mt-2">{report.id}</p>

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

        {report.status === 'Resolved' && (
          <div className="mt-4">
            <Btn variant="danger" icon="RotateCcw" className="w-full" onClick={() => reopenReport(report.id)}>Reopen — issue not fixed</Btn>
            <p className="text-center text-[11px] text-muted mt-2">This sends your report back to AWMA flagged as Reopened.</p>
          </div>
        )}
      </div>
    </div>
  );
}
