import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';
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
      <p className="text-sm text-muted mb-4">{reports.length} reports · sorted by most recent</p>
      <div className="flex flex-col gap-2.5">
        {sorted.map(r => <ReportCard key={r.id} r={r} unread={unread.has(r.id)} onClick={() => navigate('/reports/' + r.id)} />)}
      </div>
    </div>
  );
}
