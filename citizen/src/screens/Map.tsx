import { useNavigate } from 'react-router-dom';
import { useStore, STATUS } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';
import LeafletMap from '../components/LeafletMap.tsx';

export default function Map() {
  const { reports } = useStore();
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-5 pb-4 fade-in h-full flex flex-col">
      <h1 className="text-xl font-bold text-navy mb-1">Issue map</h1>
      <p className="text-sm text-muted mb-3">All reports across Accra</p>
      <div className="flex-1 min-h-0">
        <LeafletMap reports={reports} height="100%" activeId={null} onPin={r => navigate('/reports/' + r.id)} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 shrink-0">
        {(Object.keys(STATUS) as StatusName[]).map(s => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[s].solid }} />{s}</span>
        ))}
      </div>
    </div>
  );
}
