import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import { supabase } from '../lib/supabase.ts';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

/* Landing screen for a password-recovery link. The recovery link establishes a
   session (via detectSessionInUrl) and AuthCallback forwards here. We confirm a
   session is present, then let the user set a new password. */
export default function ResetPassword() {
  const { updatePassword } = useStore();
  const navigate = useNavigate();

  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setReady(session ? 'ok' : 'invalid');
    });
    return () => { cancelled = true; };
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: err } = await updatePassword(pw);
    setBusy(false);
    if (err) { setError(err); return; }
    setDone(true);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-paper">
      <div className="px-6 pt-12 pb-12 text-white shrink-0" style={{ background: 'linear-gradient(135deg,#0B2545 0%,#1E5F8E 100%)' }}>
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 mb-4">
          <Icon name="MapPin" size={28} />
        </span>
        <h1 className="text-3xl font-extrabold leading-tight">FixMyCity</h1>
        <p className="text-white/75 mt-1">Report local issues. Track every fix.</p>
      </div>

      <div className="flex-1 px-5 -mt-6">
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-lg p-5">
          {ready === 'checking' ? (
            <>
              <h2 className="font-bold text-navy text-lg">Just a moment…</h2>
              <p className="text-sm text-muted mt-1">Verifying your reset link.</p>
            </>
          ) : ready === 'invalid' ? (
            <>
              <h2 className="font-bold text-navy text-lg">Reset link problem</h2>
              <p className="text-sm text-muted mt-1">This password reset link is invalid or has expired. Request a new one from the sign-in screen.</p>
              <Btn size="lg" className="w-full mt-4" icon="ArrowLeft" onClick={() => navigate('/login', { replace: true })}>
                Back to sign in
              </Btn>
            </>
          ) : done ? (
            <>
              <h2 className="font-bold text-navy text-lg">Password updated</h2>
              <p className="text-sm text-muted mt-1">Your password has been changed. You’re all set.</p>
              <Btn size="lg" className="w-full mt-4" icon="ArrowRight" onClick={() => navigate('/', { replace: true })}>
                Continue to FixMyCity
              </Btn>
            </>
          ) : (
            <form onSubmit={submit}>
              <h2 className="font-bold text-navy text-lg">Choose a new password</h2>
              <p className="text-sm text-muted mb-4">Enter a new password for your account.</p>

              <label className="text-xs font-semibold text-muted uppercase tracking-wide">New password</label>
              <div className="mt-1.5 mb-3 relative">
                <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 6 characters"
                  className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-10 py-2.5 text-sm text-ink focus:outline-none" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
                </button>
              </div>

              <label className="text-xs font-semibold text-muted uppercase tracking-wide">Confirm password</label>
              <div className="mt-1.5 relative">
                <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                  className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-3 py-2.5 text-sm text-ink focus:outline-none" />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2 mt-3">{error}</p>}

              <Btn size="lg" className="w-full mt-4" icon="Check" type="submit" disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </Btn>
            </form>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted py-5 font-mono shrink-0">FixMyCity · AWMA pilot · Accra</p>
    </div>
  );
}
