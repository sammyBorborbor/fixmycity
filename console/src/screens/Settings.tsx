import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

interface NotifState { newReports: boolean; assignments: boolean; escalations: boolean; digest: boolean }

function AdminToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`w-11 h-6 rounded-full transition relative shrink-0 ${on ? 'bg-ocean' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Row({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-gray-100 text-ocean flex items-center justify-center shrink-0"><Icon name={icon} size={17} /></span>
        <div className="min-w-0"><p className="text-sm font-medium text-ink">{title}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
      </div>
      {children}
    </div>
  );
}

/* Settings — reached from the account menu. */
export default function Settings() {
  const navigate = useNavigate();
  const [notif, setNotif] = useState<NotifState>({ newReports: true, assignments: true, escalations: true, digest: false });
  const [compact, setCompact] = useState(false);
  const [twoFA, setTwoFA] = useState(true);
  const [defaultFilter, setDefaultFilter] = useState('All');
  const [saved, setSaved] = useState(false);

  const setN = (k: keyof NotifState, v: boolean) => setNotif(n => ({ ...n, [k]: v }));
  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  return (
    <div className="p-6 max-w-[760px]">
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm font-semibold text-ocean mb-3"><Icon name="ChevronLeft" size={16} /> Back to console</button>
      <h1 className="text-2xl font-bold text-navy mb-1">Settings</h1>
      <p className="text-sm text-muted mb-5">Preferences for your console</p>

      {/* notifications */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-6 py-2 divide-y divide-gray-100">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-4 pb-1">Notifications</p>
        <Row icon="Inbox" title="New reports" sub="When a citizen submits a report"><AdminToggle on={notif.newReports} onChange={v => { setN('newReports', v); flash(); }} /></Row>
        <Row icon="UserPlus" title="Assignment updates" sub="When a crew accepts or updates a job"><AdminToggle on={notif.assignments} onChange={v => { setN('assignments', v); flash(); }} /></Row>
        <Row icon="AlertTriangle" title="Escalations" sub="Reports breaching the resolution target"><AdminToggle on={notif.escalations} onChange={v => { setN('escalations', v); flash(); }} /></Row>
        <Row icon="Mail" title="Weekly digest" sub="Summary email every Monday"><AdminToggle on={notif.digest} onChange={v => { setN('digest', v); flash(); }} /></Row>
      </div>

      {/* preferences */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-6 py-2 divide-y divide-gray-100 mt-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-4 pb-1">Preferences</p>
        <Row icon="Rows" title="Compact inbox" sub="Denser table rows"><AdminToggle on={compact} onChange={v => { setCompact(v); flash(); }} /></Row>
        <Row icon="Filter" title="Default inbox filter">
          <select value={defaultFilter} onChange={e => { setDefaultFilter(e.target.value); flash(); }}
            className="rounded-lg ring-1 ring-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean">
            {['All', 'Submitted', 'Acknowledged', 'Assigned', 'In Progress'].map(f => <option key={f}>{f}</option>)}
          </select>
        </Row>
      </div>

      {/* security */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-6 py-2 divide-y divide-gray-100 mt-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide pt-4 pb-1">Security</p>
        <Row icon="Lock" title="Password" sub="Last changed 3 months ago"><Btn variant="outline" size="sm">Change</Btn></Row>
        <Row icon="ShieldCheck" title="Two-factor authentication" sub={twoFA ? 'Enabled · SMS to 024 •• 1180' : 'Disabled'}><AdminToggle on={twoFA} onChange={v => { setTwoFA(v); flash(); }} /></Row>
        <Row icon="MonitorSmartphone" title="Active sessions" sub="2 devices signed in"><Btn variant="outline" size="sm">Manage</Btn></Row>
      </div>

      {saved && (
        <p className="mt-4 text-sm text-green-700 flex items-center gap-1.5 fade-in"><Icon name="CheckCircle2" size={15} /> Settings saved.</p>
      )}
      <p className="text-[11px] text-muted mt-6 font-mono">FixMyCity · AWMA pilot · v0.9</p>
    </div>
  );
}
