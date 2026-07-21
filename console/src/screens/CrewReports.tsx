import { useCallback, useState } from 'react';
import { useStore, crewName } from '../lib/store.tsx';
import DataTable from '../components/DataTable.tsx';
import DetailPanel from '../components/DetailPanel.tsx';
import Icon from '../components/Icon.tsx';

/* Restricted shell for field crew: their assigned reports only (RLS already
   limits `reports` to assigned_crew_id = the crew), read-only. No office nav. */
export default function CrewReports() {
  const { user, reports, signOut } = useStore();
  const [detailId, setDetailId] = useState<string | null>(null);
  const openRow = useCallback((id: string) => setDetailId(id), []);
  const detail = reports.find(r => r.id === detailId);

  const crew = crewName(user?.crewId ?? null);
  const sorted = [...reports].sort(
    (a, b) => new Date(b.timeline[0].timestamp).getTime() - new Date(a.timeline[0].timestamp).getTime(),
  );

  return (
    <div className="w-full h-[100dvh] bg-paper text-ink flex flex-col">
      {/* header */}
      <header className="shrink-0 bg-navy text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-gold text-navy font-extrabold flex items-center justify-center text-sm">AWMA</span>
          <div>
            <p className="font-bold leading-tight">FixMyCity Field Crew</p>
            <p className="text-[11px] text-white/55">{crew ?? 'Your crew'} · {user?.name}</p>
          </div>
        </div>
        <button onClick={() => void signOut()} className="text-sm font-medium text-white/70 hover:text-white flex items-center gap-1.5">
          <Icon name="LogOut" size={16} /> Sign out
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1000px] mx-auto">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-navy">My assigned reports</h1>
            <span className="text-sm text-muted">{reports.length} assigned</span>
          </div>
          <p className="text-sm text-muted mb-4">Reports dispatched to {crew ?? 'your crew'}</p>
          <DataTable rows={sorted} openRow={openRow} activeId={detailId} unread={new Set()}
            emptyLabel="No reports are assigned to your crew yet." />
        </div>
      </main>

      {detail && <DetailPanel report={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}
