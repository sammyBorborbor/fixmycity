import { useState } from 'react';
import { useStore, ROLES, UNITS } from '../lib/store.tsx';
import type { RoleName } from '../lib/store.tsx';
import Btn from '../components/Btn.tsx';

const roleStyle: Record<RoleName, string> = {
  Administrator: 'bg-navy/10 text-navy ring-navy/20',
  Supervisor: 'bg-blue-50 text-blue-700 ring-blue-200',
  Officer: 'bg-ocean/10 text-ocean ring-ocean/20',
  Dispatcher: 'bg-amber-50 text-amber-800 ring-amber-200',
  Viewer: 'bg-gray-100 text-gray-600 ring-gray-200',
  'Field Crew': 'bg-green-50 text-green-700 ring-green-200',
};

interface InviteForm { name: string; email: string; role: RoleName; unit: string }

export default function Users() {
  const { user, perms, staff, inviteUser, setUserRole, setUserStatus } = useStore();
  const isAdmin = perms.canManageUsers;
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InviteForm>({ name: '', email: '', role: 'Officer', unit: UNITS[0] });

  async function invite() {
    if (!form.name.trim() || !form.email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await inviteUser(form);
    setBusy(false);
    if (error) { setError(error); return; }
    setForm({ name: '', email: '', role: 'Officer', unit: UNITS[0] });
    setInviting(false);
  }

  async function changeRole(id: string, role: RoleName) {
    setError(null);
    const { error } = await setUserRole(id, role);
    if (error) setError(error);
  }

  async function changeStatus(id: string, active: boolean) {
    setError(null);
    const { error } = await setUserStatus(id, active);
    if (error) setError(error);
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Users &amp; Roles</h1>
        {isAdmin && (
          <Btn variant="primary" icon="UserPlus" onClick={() => { setError(null); setInviting(i => !i); }}>Invite user</Btn>
        )}
      </div>
      <p className="text-sm text-muted mb-5">{staff.length} staff accounts · {staff.filter(u => u.active).length} active</p>

      {error && (
        <div className="bg-red-50 text-red-700 ring-1 ring-red-200 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>
      )}

      {inviting && isAdmin && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 mb-5 fade-in">
          <h2 className="font-bold text-navy mb-3">Invite a staff member</h2>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Full name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe"
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Work email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@awma.gov.gh"
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as RoleName })}
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Unit</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Btn variant="outline" onClick={() => setInviting(false)} disabled={busy}>Cancel</Btn>
            <Btn variant="primary" icon="Send" onClick={invite} disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</Btn>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted bg-gray-50 border-b border-gray-100">
              <th className="font-semibold px-4 py-3">Name</th>
              <th className="font-semibold px-4 py-3">Unit</th>
              <th className="font-semibold px-4 py-3">Role</th>
              <th className="font-semibold px-4 py-3">Status</th>
              <th className="font-semibold px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(u => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center ${u.active ? 'bg-ocean' : 'bg-gray-300'}`}>{u.initials}</span>
                    <div className="leading-tight"><p className="font-medium text-ink">{u.name}</p><p className="text-xs text-muted">{u.email}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{u.unit}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value as RoleName)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset focus:outline-none cursor-pointer ${roleStyle[u.role] || roleStyle.Viewer}`}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset ${roleStyle[u.role] || roleStyle.Viewer}`}>{u.role}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.active ? 'text-green-700' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-gray-300'}`} />{u.active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && u.email !== user?.email ? (
                    <button onClick={() => changeStatus(u.id, !u.active)} className="text-xs font-semibold text-ocean hover:underline">
                      {u.active ? 'Suspend' : 'Reactivate'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
