import { useOutletContext } from 'react-router-dom';
import { useStore, STATUS } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';
import type { AppOutletContext } from '../App.tsx';
import MapPlaceholder from '../components/MapPlaceholder.tsx';

export default function MapView() {
  const { reports } = useStore();
  const { openRow, activeId } = useOutletContext<AppOutletContext>();

  return (
    <div className="p-6 max-w-[1100px]">
      <h1 className="text-2xl font-bold text-navy mb-1">Map</h1>
      <p className="text-sm text-muted mb-4">Live view of all reports · click a pin for details</p>
      <MapPlaceholder reports={reports} height={460} activeId={activeId} onPin={r => openRow(r.id)} />
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {(Object.keys(STATUS) as StatusName[]).map(s => <span key={s} className="flex items-center gap-1.5 text-xs text-muted"><span className="w-3 h-3 rounded-full" style={{ background: STATUS[s].solid }} />{s}</span>)}
      </div>
    </div>
  );
}
