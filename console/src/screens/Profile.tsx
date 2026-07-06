import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import type { StatusName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

interface ProfileForm { name: string; email: string; phone: string; unit: string }

function ProfileField({ label, k, type, editing, draft, setDraft, form }: {
  label: string;
  k: keyof ProfileForm;
  type?: string;
  editing: boolean;
  draft: ProfileForm;
  setDraft: (d: ProfileForm) => void;
  form: ProfileForm;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</label>
      {editing ? (
        <input type={type || 'text'} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })}
          className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ocean" />
      ) : (
        <p className="mt-1.5 text-sm text-ink py-2.5">{form[k]}</p>
      )}
    </div>
  );
}

/* My profile — reached from the account menu. */
export default function Profile() {
  const { reports } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>({
    name: 'Akua Osei', email: 'akua.osei@aywma.gov.gh', phone: '024 550 1180', unit: 'Operations',
  });
  const [draft, setDraft] = useState(form);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // derive real activity from the audit trail (events actioned by Akua O.)
  const acted = (verb: StatusName) => reports.reduce((n, r) => n + (r.timeline || []).filter(e => (e.actor || '').startsWith('Akua O.') && e.status === verb).length, 0);
  const stats = [
    { label: 'Acknowledged', value: acted('Acknowledged'), icon: 'CheckCircle2', accent: '#1E5F8E' },
    { label: 'Assigned',     value: acted('Assigned'),     icon: 'UserPlus',     accent: '#1D4ED8' },
    { label: 'Rejected',     value: acted('Rejected'),     icon: 'Ban',          accent: '#DC2626' },
  ];

  function save() { setForm(draft); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2200); }
  function cancel() { setDraft(form); setEditing(false); }
  const fieldProps = { editing, draft, setDraft, form };

  return (
    <div className="p-6 max-w-[900px]">
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm font-semibold text-ocean mb-3"><Icon name="ChevronLeft" size={16} /> Back to console</button>
      <h1 className="text-2xl font-bold text-navy mb-1">My profile</h1>
      <p className="text-sm text-muted mb-5">Manage your AWMA staff account</p>

      {/* identity card */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6 flex items-center gap-5">
        <span className="w-20 h-20 rounded-full bg-ocean text-white text-2xl font-bold flex items-center justify-center shrink-0">AO</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-navy">{form.name}</h2>
          <p className="text-sm text-muted">{form.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy bg-navy/10 px-2.5 py-1 rounded-full"><Icon name="ShieldCheck" size={13} /> Administrator</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ocean bg-ocean/10 px-2.5 py-1 rounded-full"><Icon name="Building2" size={13} /> {form.unit}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full"><Icon name="BadgeCheck" size={13} /> Verified</span>
          </div>
        </div>
      </div>

      {/* activity */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: s.accent + '1a', color: s.accent }}><Icon name={s.icon} size={18} /></span>
            <p className="text-2xl font-bold text-navy mt-3 leading-none">{s.value}</p>
            <p className="text-sm text-muted mt-1">{s.label} by you</p>
          </div>
        ))}
      </div>

      {/* personal info */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy">Personal information</h3>
          {!editing ? (
            <Btn variant="outline" size="sm" icon="Pencil" onClick={() => { setDraft(form); setEditing(true); }}>Edit</Btn>
          ) : (
            <div className="flex gap-2">
              <Btn variant="outline" size="sm" onClick={cancel}>Cancel</Btn>
              <Btn variant="primary" size="sm" icon="Check" onClick={save}>Save changes</Btn>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <ProfileField label="Full name" k="name" {...fieldProps} />
          <ProfileField label="Work email" k="email" type="email" {...fieldProps} />
          <ProfileField label="Phone" k="phone" {...fieldProps} />
          <ProfileField label="Unit" k="unit" {...fieldProps} />
        </div>
        {saved && <p className="mt-4 text-sm text-green-700 flex items-center gap-1.5 fade-in"><Icon name="CheckCircle2" size={15} /> Profile updated.</p>}
      </div>

      {/* role & access (read-only) */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6 mt-4">
        <h3 className="font-bold text-navy mb-1">Role &amp; access</h3>
        <p className="text-sm text-muted mb-4">Set by your system administrator</p>
        <div className="flex flex-col divide-y divide-gray-100">
          {[['Administrator', 'Full access to all modules'], ['Inbox & dispatch', 'Acknowledge, assign, reject, resolve'], ['User management', 'Invite and manage staff accounts']].map(([t, d]) => (
            <div key={t} className="flex items-center gap-3 py-3">
              <Icon name="Check" size={16} className="text-green-600" />
              <div><p className="text-sm font-medium text-ink">{t}</p><p className="text-xs text-muted">{d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
