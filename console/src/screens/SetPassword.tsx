import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import { supabase } from '../lib/supabase.ts';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

/* Landing for the staff invite link. The invite link establishes a session
   (via detectSessionInUrl during client init), so we confirm a session is
   present, then let the newly-invited staffer choose their password. */
export default function SetPassword() {
  const { updatePassword } = useStore();
  const navigate = useNavigate();

  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase encodes link failures in the URL hash (#error=...&error_description=...).
  const [linkError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('error_description')?.replace(/\+/g, ' ') ?? params.get('error');
  });

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
    <div className="w-full h-[100dvh] flex items-center justify-center p-6 overflow-y-auto"
         style={{ background: 'radial-gradient(circle at 50% -10%, #16386a 0%, #0B2545 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <span className="w-14 h-14 rounded-2xl bg-gold text-navy font-extrabold flex items-center justify-center text-lg shadow-lg">AWMA</span>
          <h1 className="text-white text-xl font-bold mt-4">FixMyCity Operations</h1>
          <p className="text-white/55 text-sm mt-1">Ayawaso West Municipal Assembly · staff access</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-6">
          {ready === 'checking' ? (
            <>
              <h2 className="font-bold text-navy text-lg">Just a moment…</h2>
              <p className="text-sm text-muted mt-1">Verifying your invite link.</p>
            </>
          ) : ready === 'invalid' ? (
            <>
              <h2 className="font-bold text-navy text-lg">Invite link problem</h2>
              <p className="text-sm text-muted mt-1">
                {linkError ?? 'This invite link is invalid or has expired. Ask an administrator to invite you again.'}
              </p>
              <Btn size="lg" className="w-full mt-4" icon="LogIn" onClick={() => navigate('/login', { replace: true })}>
                Go to sign in
              </Btn>
            </>
          ) : done ? (
            <>
              <h2 className="font-bold text-navy text-lg">You’re all set</h2>
              <p className="text-sm text-muted mt-1">Your password has been saved. Welcome to the Operations Console.</p>
              <Btn size="lg" className="w-full mt-4" icon="ArrowRight" onClick={() => navigate('/', { replace: true })}>
                Continue to the console
              </Btn>
            </>
          ) : (
            <form onSubmit={submit}>
              <h2 className="font-bold text-navy text-lg">Set your password</h2>
              <p className="text-sm text-muted mb-4">Choose a password to activate your AWMA staff account.</p>

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
                {busy ? 'Saving…' : 'Set password'}
              </Btn>
            </form>
          )}
        </div>

        <p className="text-center text-white/40 text-[11px] mt-5 font-mono">Authorised personnel only · v0.9 pilot</p>
      </div>
    </div>
  );
}
