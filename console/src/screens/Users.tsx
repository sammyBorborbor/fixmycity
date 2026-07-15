import { useState } from 'react';
import { useStore, ROLES, UNITS } from '../lib/store.tsx';
import type { RoleName, Staff } from '../lib/store.tsx';
import Btn from '../components/Btn.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import { useToast } from '../components/Toast.tsx';

const roleStyle: Record<RoleName, string> = {
  Administrator: 'bg-navy/10 text-navy ring-navy/20',
  Supervisor: 'bg-blue-50 text-blue-700 ring-blue-200',
  Officer: 'bg-ocean/10 text-ocean ring-ocean/20',
  Dispatcher: 'bg-amber-50 text-amber-800 ring-amber-200',
  Viewer: 'bg-gray-100 text-gray-600 ring-gray-200',
  'Field Crew': 'bg-green-50 text-green-700 ring-green-200',
};

/* "an Administrator" / "a Supervisor" — for friendlier toast copy. */
const article = (role: string) => (/^[AEIOU]/i.test(role) ? 'an' : 'a');

interface InviteForm { name: string; email: string; role: RoleName; unit: string }

/* A role change or a suspend queued behind the confirm dialog. */
type Pending =
  | { kind: 'role'; user: Staff; nextRole: RoleName }
  | { kind: 'status'; user: Staff; nextActive: boolean };

export default function Users() {
  const { user, perms, staff, inviteUser, setUserRole, setUserStatus } = useStore();
  const toast = useToast();
  const isAdmin = perms.canManageUsers;
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);          // invite form in flight
  const [busyId, setBusyId] = useState<string | null>(null); // row action in flight
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [form, setForm] = useState<InviteForm>({ name: '', email: '', role: 'Officer', unit: UNITS[0] });

  async function invite() {
    if (!form.name.trim() || !form.email.trim() || busy) return;
    setBusy(true);
    setInviteError(null);
    const { error } = await inviteUser(form);
    setBusy(false);
    if (error) { setInviteError(error); return; }
    toast.success(`Invite sent to ${form.email.trim()}`);
    setForm({ name: '', email: '', role: 'Officer', unit: UNITS[0] });
    setInviting(false);
  }

  /* Runs the queued role/suspend action once the admin confirms. */
  async function runConfirmed() {
    if (!confirm) return;
    const p = confirm;
    setBusyId(p.user.id);
    const { error } = p.kind === 'role'
      ? await setUserRole(p.user.id, p.nextRole)
      : await setUserStatus(p.user.id, p.nextActive);
    setBusyId(null);
    setConfirm(null);
    if (error) { toast.error(error); return; }
    toast.success(p.kind === 'role'
      ? `${p.user.name} is now ${article(p.nextRole)} ${p.nextRole}`
      : `${p.user.name} has been suspended`);
  }

  /* Reactivation is low-risk, so it stays one-click (no confirm dialog). */
  async function reactivate(u: Staff) {
    setBusyId(u.id);
    const { error } = await setUserStatus(u.id, true);
    setBusyId(null);
    if (error) { toast.error(error); return; }
    toast.success(`${u.name} has been reactivated`);
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-navy">Users &amp; Roles</h1>
        {isAdmin && (
          <Btn variant="primary" icon="UserPlus" onClick={() => { setInviteError(null); setInviting(i => !i); }}>Invite user</Btn>
        )}
      </div>
      <p className="text-sm text-muted mb-5">{staff.length} staff accounts · {staff.filter(u => u.active).length} active</p>

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
          {inviteError && (
            <div className="mt-3 bg-red-50 text-red-700 ring-1 ring-red-200 rounded-xl px-4 py-2.5 text-sm">{inviteError}</div>
          )}
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
            {staff.map(u => {
              const rowBusy = busyId === u.id;
              const isSelf = u.email === user?.email;
              return (
              <tr key={u.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center ${u.active ? 'bg-ocean' : 'bg-gray-300'}`}>{u.initials}</span>
                    <div className="leading-tight"><p className="font-medium text-ink">{u.name}</p><p className="text-xs text-muted">{u.email}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{u.unit}</td>
                <td className="px-4 py-3">
                  {isAdmin && !isSelf ? (
                    <select value={u.role} disabled={rowBusy}
                      onChange={e => {
                        const nextRole = e.target.value as RoleName;
                        if (nextRole !== u.role) setConfirm({ kind: 'role', user: u, nextRole });
                      }}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-wait ${roleStyle[u.role] || roleStyle.Viewer}`}>
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
                  {isSelf ? (
                    <span className="text-xs font-semibold text-muted bg-gray-100 px-2 py-0.5 rounded-full">You</span>
                  ) : isAdmin ? (
                    rowBusy ? (
                      <span className="text-xs text-muted">Saving…</span>
                    ) : (
                      <button
                        onClick={() => u.active
                          ? setConfirm({ kind: 'status', user: u, nextActive: false })
                          : reactivate(u)}
                        className="text-xs font-semibold text-ocean hover:underline">
                        {u.active ? 'Suspend' : 'Reactivate'}
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'role' ? 'Change this role?' : 'Suspend this account?'}
          variant={confirm.kind === 'status' ? 'danger' : 'primary'}
          confirmLabel={confirm.kind === 'role' ? 'Change role' : 'Suspend account'}
          busy={busyId === confirm.user.id}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirmed}
          body={confirm.kind === 'role' ? (
            <>
              <span className="font-semibold text-ink">{confirm.user.name}</span> will change from{' '}
              <span className="font-semibold">{confirm.user.role}</span> to{' '}
              <span className="font-semibold">{confirm.nextRole}</span>. This immediately updates what
              they can see and do in the console.
            </>
          ) : (
            <>
              Suspending <span className="font-semibold text-ink">{confirm.user.name}</span> immediately
              revokes their access to the console. You can reactivate them at any time.
            </>
          )}
        />
      )}
    </div>
  );
}
