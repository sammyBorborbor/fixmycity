import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import ReportCard from '../components/ReportCard.tsx';

const NO_UNREAD = new Set<string>();

function bySubmittedDesc(a: Report, b: Report) {
  return new Date(b.timeline[0].timestamp).getTime() - new Date(a.timeline[0].timestamp).getTime();
}

export default function MyReports() {
  const { reports } = useStore();
  const navigate = useNavigate();
  const unread = NO_UNREAD;
  const sorted = [...reports].sort(bySubmittedDesc);

  return (
    <div className="px-4 pt-5 pb-4 fade-in">
      <h1 className="text-xl font-bold text-navy mb-1">My reports</h1>
      <p className="text-sm text-muted mb-4">{reports.length === 0 ? 'No reports yet' : `${reports.length} reports · sorted by most recent`}</p>
      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-4 py-8 flex flex-col items-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/5 text-muted mb-3">
            <Icon name="ClipboardList" size={22} />
          </span>
          <p className="font-semibold text-navy">No reports yet</p>
          <p className="text-sm text-muted mt-1 max-w-[15rem]">Reports you submit will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map(r => <ReportCard key={r.id} r={r} unread={unread.has(r.id)} onClick={() => navigate('/reports/' + r.id)} />)}
        </div>
      )}
    </div>
  );
}
