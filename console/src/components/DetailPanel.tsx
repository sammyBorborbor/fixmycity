import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from './Icon.tsx';
import Btn from './Btn.tsx';
import StatusPill from './StatusPill.tsx';
import CategoryBadge from './CategoryBadge.tsx';
import Timeline from './Timeline.tsx';
import MapPlaceholder from './MapPlaceholder.tsx';
import { useStore, CITIZEN, crewName, crewById, fmtDate } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

const REJECT_REASONS = ['Outside AWMA jurisdiction (private property)', 'Duplicate of an existing report', 'Insufficient information', 'Not a valid issue'];

/* Real, user-droppable report photo (persists via <image-slot>). */
function ReportPhoto({ report, className = '', style = {}, placeholder = 'Drop a photo' }: {
  report: Report; className?: string; style?: CSSProperties; placeholder?: string;
}) {
  return (
    <image-slot
      id={'rpt-photo-' + report.id}
      shape="rect"
      radius="0"
      placeholder={placeholder}
      class={className}
      style={{ display: 'block', background: 'repeating-linear-gradient(135deg,#E7EBF0 0 14px,#EDF1F5 14px 28px)', ...style }}
    />
  );
}

/* Slide-in report detail + action panel. */
export default function DetailPanel({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { transitionReport, crews } = useStore();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [crew, setCrew] = useState(crews[0].id);

  // reset the inline action forms whenever a different report is opened
  const reportId = report && report.id;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional form reset keyed on the open report
  useEffect(() => { setRejectOpen(false); setAssignOpen(false); }, [reportId]);

  if (!report) return null;

  const can = {
    ack: report.status === 'Submitted' || report.status === 'Reopened',
    assign: ['Acknowledged', 'Reopened', 'Submitted'].includes(report.status),
    progress: report.status === 'Assigned',
    resolve: report.status === 'In Progress',
    reject: !['Resolved', 'Rejected'].includes(report.status),
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 fade-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-paper z-50 shadow-2xl slide-in flex flex-col">
        {/* header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-100">
          <div>
            <p className="font-mono text-[13px] font-semibold text-navy">{report.id}</p>
            <p className="text-xs text-muted">Submitted {fmtDate(report.timeline[0].timestamp)}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-muted"><Icon name="X" size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ReportPhoto report={report} placeholder={`Drop a ${report.category.toLowerCase()} photo`} className="w-full" style={{ height: 200 }} />

          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CategoryBadge category={report.category} size={42} />
                <div>
                  <h2 className="font-bold text-navy leading-tight">{report.category}</h2>
                  <p className="text-sm text-muted flex items-center gap-1"><Icon name="MapPin" size={13} /> {report.location}</p>
                </div>
              </div>
              <StatusPill status={report.status} size="lg" />
            </div>

            {/* mini map */}
            <div className="mt-4"><MapPlaceholder reports={[report]} height={140} activeId={report.id} /></div>

            {/* reporter + description */}
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center">AA</span>
              <span className="text-ink font-medium">{CITIZEN.name}</span>
              <span className="text-muted">· reporter</span>
            </div>
            <p className="text-sm text-ink mt-2 bg-white rounded-xl ring-1 ring-black/5 p-3 leading-relaxed">{report.description}</p>

            {report.crew && (
              <div className="mt-3 flex items-center gap-2 text-sm bg-blue-50 ring-1 ring-blue-100 rounded-xl px-3 py-2 text-blue-800">
                <Icon name="Users" size={15} /> {crewName(report.crew)} · {crewById(report.crew)?.dept}
              </div>
            )}

            {/* timeline */}
            <h3 className="font-bold text-navy mt-6 mb-3 text-sm uppercase tracking-wide">Status timeline</h3>
            <div className="bg-white rounded-xl ring-1 ring-black/5 p-4"><Timeline report={report} compact /></div>
          </div>
        </div>

        {/* action bar */}
        <div className="shrink-0 border-t border-gray-100 bg-white p-4">
          {rejectOpen ? (
            <div className="fade-in">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Rejection reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ocean">
                {REJECT_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
              <div className="flex gap-2 mt-3">
                <Btn variant="outline" className="flex-1" onClick={() => setRejectOpen(false)}>Cancel</Btn>
                <Btn variant="danger" className="flex-1" icon="Ban" onClick={() => { transitionReport(report.id, 'reject', { reason }); setRejectOpen(false); }}>Confirm reject</Btn>
              </div>
            </div>
          ) : assignOpen ? (
            <div className="fade-in">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Assign to crew</label>
              <select value={crew} onChange={e => setCrew(e.target.value)} className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ocean">
                {crews.filter(c => c.available !== false).map(c => <option key={c.id} value={c.id}>{c.name} — {c.dept}</option>)}
              </select>
              <div className="flex gap-2 mt-3">
                <Btn variant="outline" className="flex-1" onClick={() => setAssignOpen(false)}>Cancel</Btn>
                <Btn variant="ocean" className="flex-1" icon="UserPlus" onClick={() => { transitionReport(report.id, 'assign', { crewId: crew }); setAssignOpen(false); }}>Confirm assign</Btn>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Btn variant="primary" className="flex-1" icon="CheckCircle2" disabled={!can.ack} onClick={() => transitionReport(report.id, 'acknowledge')}>Acknowledge</Btn>
                <Btn variant="ocean" className="flex-1" icon="UserPlus" disabled={!can.assign} onClick={() => setAssignOpen(true)}>Assign</Btn>
              </div>
              <div className="flex gap-2">
                {can.progress && <Btn variant="gold" className="flex-1" icon="Play" onClick={() => transitionReport(report.id, 'in_progress')}>Mark in progress</Btn>}
                {can.resolve && <Btn variant="green" className="flex-1" icon="CheckCheck" onClick={() => transitionReport(report.id, 'resolve')}>Mark resolved</Btn>}
                <Btn variant="danger" className={can.progress || can.resolve ? '' : 'flex-1'} icon="Ban" disabled={!can.reject} onClick={() => setRejectOpen(true)}>Reject</Btn>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
