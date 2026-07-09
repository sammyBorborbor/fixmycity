import { useState } from 'react';
import { useStore } from '../lib/store.tsx';
import type { Crew, CrewMember } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

const DEPTS = ['Sanitation', 'Drainage', 'Electrical', 'Roads', 'General'];

export default function Crews() {
  const { crews, staff, reports, addCrew, toggleCrewAvailability, assignCrewMember, inviteCrewMember, removeCrewMember, setLead } = useStore();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', dept: 'Sanitation', lead: '' });
  const [openId, setOpenId] = useState<string | null>(null);          // which crew's roster panel is expanded
  const [assignPick, setAssignPick] = useState('');                   // selected unassigned crew user to add
  const [inv, setInv] = useState({ name: '', email: '' });            // invite-a-new-member form
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field Crew users with no crew yet — assignable to any crew.
  const unassigned = staff.filter(s => s.role === 'Field Crew' && !s.crewId);

  const load = (id: string) => reports.filter(r => r.crew === id && !['Resolved', 'Rejected'].includes(r.status)).length;
  const count = (c: Crew) => (c.roster ? c.roster.length : c.members || 0);

  function submit() {
    if (!form.name.trim()) return;
    const lead = form.lead.trim();
    addCrew({ name: form.name.trim(), dept: form.dept, lead: lead || '—', phone: '—', available: true, roster: [] });
    setForm({ name: '', dept: 'Sanitation', lead: '' });
    setAdding(false);
  }

  // Every membership action hits the network; run() guards + surfaces errors.
  async function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    if (busy) return;
    setBusy(true); setError(null);
    const { error: err } = await fn();
    setBusy(false);
    if (err) { setError(err); return; }
    after?.();
  }

  function openCrew(id: string) {
    setOpenId(openId === id ? null : id);
    setAssignPick(''); setInv({ name: '', email: '' }); setError(null);
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Crews</h1>
        <Btn variant="primary" icon="Plus" onClick={() => setAdding(a => !a)}>New crew</Btn>
      </div>
      <p className="text-sm text-muted mb-5">{crews.length} field crews · {crews.filter(c => c.available).length} available</p>

      {error && (
        <div className="bg-red-50 text-red-700 ring-1 ring-red-200 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>
      )}

      {adding && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 mb-5 fade-in">
          <h2 className="font-bold text-navy mb-3">Add a crew</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Crew name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Crew Delta"
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Department</label>
              <select value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })}
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean">
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Team lead</label>
              <input value={form.lead} onChange={e => setForm({ ...form, lead: e.target.value })} placeholder="Full name"
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2">Assign real crew members from the crew card once it's created.</p>
          <div className="flex gap-2 mt-4">
            <Btn variant="outline" onClick={() => setAdding(false)}>Cancel</Btn>
            <Btn variant="primary" icon="Check" onClick={submit}>Add crew</Btn>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 items-start">
        {crews.map(c => {
          const open = openId === c.id;
          const roster: CrewMember[] = c.roster || [];
          const otherCrews = crews.filter(o => o.id !== c.id);
          return (
            <div key={c.id} className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <span className="w-11 h-11 rounded-xl bg-navy/5 text-navy flex items-center justify-center"><Icon name="Users" size={20} /></span>
                <button onClick={() => toggleCrewAvailability(c.id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 transition ${c.available ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                  {c.available ? 'Available' : 'Unavailable'}
                </button>
              </div>
              <p className="font-bold text-navy mt-3">{c.name}</p>
              <p className="text-xs text-muted">{c.dept}</p>
              <div className="mt-4 space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-ink"><Icon name="UserCog" size={14} className="text-muted" /> {c.lead || '—'} <span className="text-[11px] text-muted">· lead</span></p>
                <p className="flex items-center gap-2 text-ink"><Icon name="Users" size={14} className="text-muted" /> {count(c)} {count(c) === 1 ? 'member' : 'members'}</p>
                <p className="flex items-center gap-2 text-ink"><Icon name="Phone" size={14} className="text-muted" /> {c.phone || '—'}</p>
              </div>

              {/* manage members */}
              <button onClick={() => openCrew(c.id)}
                className="mt-4 flex items-center justify-between w-full text-sm font-semibold text-ocean">
                <span className="flex items-center gap-1.5"><Icon name="UsersRound" size={15} /> Manage members</span>
                <Icon name="ChevronDown" size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="mt-3 fade-in">
                  <div className="flex flex-col gap-1.5">
                    {roster.length === 0 && <p className="text-xs text-muted py-1">No members yet. Assign or invite one below.</p>}
                    {roster.map(m => {
                      const isLead = m.name === c.lead;
                      return (
                        <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <span className="w-6 h-6 rounded-full bg-ocean/10 text-ocean text-[10px] font-bold flex items-center justify-center shrink-0">
                            {m.name.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block text-sm text-ink truncate">{m.name}</span>
                            {m.email && <span className="block text-[11px] text-muted truncate">{m.email}</span>}
                          </span>
                          {isLead && <span className="text-[10px] font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded shrink-0">Lead</span>}
                          {!isLead && (
                            <button onClick={() => run(() => setLead(c.id, m.name))} disabled={busy} title="Make lead"
                              className="text-[11px] font-semibold text-muted hover:text-ocean shrink-0 disabled:opacity-40">Lead</button>
                          )}
                          {otherCrews.length > 0 && (
                            <select value="" disabled={busy} title="Move to another crew"
                              onChange={e => { const to = e.target.value; if (to) run(() => assignCrewMember(m.id, to)); }}
                              className="text-[11px] text-muted bg-transparent rounded shrink-0 focus:outline-none cursor-pointer disabled:opacity-40">
                              <option value="">Move…</option>
                              {otherCrews.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          )}
                          <button onClick={() => run(() => removeCrewMember(m.id))} disabled={busy} title="Remove from crew"
                            className="text-gray-400 hover:text-red-500 shrink-0 disabled:opacity-40"><Icon name="X" size={15} /></button>
                        </div>
                      );
                    })}
                  </div>

                  {/* assign an existing unassigned crew user */}
                  {unassigned.length > 0 && (
                    <div className="flex gap-2 mt-2.5">
                      <select value={assignPick} onChange={e => setAssignPick(e.target.value)}
                        className="flex-1 rounded-lg ring-1 ring-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean">
                        <option value="">Assign an existing crew member…</option>
                        {unassigned.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <Btn variant="outline" size="sm" icon="UserCheck" disabled={busy || !assignPick}
                        onClick={() => run(() => assignCrewMember(assignPick, c.id), () => setAssignPick(''))}>Assign</Btn>
                    </div>
                  )}

                  {/* invite a brand-new crew member */}
                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Invite a new member</p>
                    <div className="flex flex-col gap-1.5">
                      <input value={inv.name} onChange={e => setInv({ ...inv, name: e.target.value })} placeholder="Full name"
                        className="w-full rounded-lg ring-1 ring-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
                      <div className="flex gap-2">
                        <input value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} placeholder="name@awma.gov.gh"
                          className="flex-1 rounded-lg ring-1 ring-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
                        <Btn variant="primary" size="sm" icon="UserPlus" disabled={busy || !inv.name.trim() || !inv.email.trim()}
                          onClick={() => run(() => inviteCrewMember(c.id, inv), () => setInv({ name: '', email: '' }))}>
                          {busy ? '…' : 'Invite'}
                        </Btn>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-muted">Active jobs</span>
                <span className="text-lg font-bold text-ocean">{load(c.id)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
