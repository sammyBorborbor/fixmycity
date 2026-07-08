import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';
import InstallPrompt from '../components/InstallPrompt.tsx';

/* Login / Sign-in — its own minimal status bar, no bottom nav. */
export default function Login() {
  const { user, signIn, signUp } = useStore();
  const navigate = useNavigate();

  // already signed in? bounce to home
  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user, navigate]);

  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('ama.asante@gmail.com');
  const [pw, setPw] = useState('accra2026');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // signup-only fields
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [agree, setAgree] = useState(false);

  async function submitSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setInfo(null);
    const { error: err } = await signIn(email, pw);
    setBusy(false);
    if (err) { setError(err); return; }
    navigate('/', { replace: true });
  }

  async function submitSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setInfo(null);
    const { error: err, pendingConfirmation } = await signUp(name, signupEmail, signupPw);
    setBusy(false);
    if (err) { setError(err); return; }
    if (pendingConfirmation) {
      setInfo('Check your email and tap the confirmation link to finish setting up your account.');
      setView('signin');
      setEmail(signupEmail);
      setPw('');
      return;
    }
    navigate('/', { replace: true });
  }

  const canCreate = name.trim() && signupEmail.trim() && signupPw.length >= 6 && agree;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-paper">
      <div className="flex-1 min-h-0">
        <div className="relative w-full h-full flex flex-col bg-paper overflow-y-auto no-scrollbar">
          {/* brand header */}
          <div className="px-6 pt-12 pb-12 text-white shrink-0" style={{ background: 'linear-gradient(135deg,#0B2545 0%,#1E5F8E 100%)' }}>
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 mb-4">
              <Icon name="MapPin" size={28} />
            </span>
            <h1 className="text-3xl font-extrabold leading-tight">FixMyCity</h1>
            <p className="text-white/75 mt-1">Report local issues. Track every fix.</p>
          </div>

          {/* form card */}
          <div className="flex-1 px-5 -mt-6">
            {view === 'signin' ? (
              <form onSubmit={submitSignIn} className="bg-white rounded-xl ring-1 ring-black/5 shadow-lg p-5">
                <h2 className="font-bold text-navy text-lg">Welcome back</h2>
                <p className="text-sm text-muted mb-4">Sign in to continue</p>

                <label className="text-xs font-semibold text-muted uppercase tracking-wide">Email or phone</label>
                <div className="mt-1.5 mb-3 relative">
                  <Icon name="Mail" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-3 py-2.5 text-sm text-ink focus:outline-none" />
                </div>

                <label className="text-xs font-semibold text-muted uppercase tracking-wide">Password</label>
                <div className="mt-1.5 relative">
                  <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
                    className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-10 py-2.5 text-sm text-ink focus:outline-none" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
                  </button>
                </div>

                <div className="flex justify-end mt-2">
                  <button type="button" className="text-xs font-semibold text-ocean">Forgot password?</button>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2 mt-3">{error}</p>}
                {info && <p className="text-sm text-green-700 bg-green-50 ring-1 ring-green-100 rounded-xl px-3 py-2 mt-3">{info}</p>}

                <Btn size="lg" className="w-full mt-4" icon="LogIn" type="submit" disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Btn>
              </form>
            ) : (
              <form onSubmit={submitSignUp} className="bg-white rounded-xl ring-1 ring-black/5 shadow-lg p-5">
                <h2 className="font-bold text-navy text-lg">Create your account</h2>
                <p className="text-sm text-muted mb-4">Join FixMyCity to report and track issues</p>

                <label className="text-xs font-semibold text-muted uppercase tracking-wide">Full name</label>
                <div className="mt-1.5 mb-3 relative">
                  <Icon name="User" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ama Asante"
                    className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-3 py-2.5 text-sm text-ink focus:outline-none" />
                </div>

                <label className="text-xs font-semibold text-muted uppercase tracking-wide">Email</label>
                <div className="mt-1.5 mb-3 relative">
                  <Icon name="Mail" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-3 py-2.5 text-sm text-ink focus:outline-none" />
                </div>

                <label className="text-xs font-semibold text-muted uppercase tracking-wide">Password</label>
                <div className="mt-1.5 relative">
                  <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={show ? 'text' : 'password'} value={signupPw} onChange={e => setSignupPw(e.target.value)} placeholder="At least 6 characters"
                    className="w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean pl-9 pr-10 py-2.5 text-sm text-ink focus:outline-none" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
                  </button>
                </div>

                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-ocean shrink-0" />
                  <span className="text-xs text-muted">I agree to the <span className="text-ocean font-semibold">Terms</span> and <span className="text-ocean font-semibold">Privacy Policy</span>.</span>
                </label>

                {error && <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2 mt-3">{error}</p>}

                <Btn size="lg" className="w-full mt-4" icon="UserPlus" type="submit" disabled={!canCreate || busy}>
                  {busy ? 'Creating account…' : 'Create account'}
                </Btn>
                {!canCreate && <p className="text-center text-[11px] text-muted mt-2">Fill in your details and accept the terms to continue</p>}
              </form>
            )}

            <p className="text-center text-sm text-muted mt-5">
              {view === 'signin' ? (
                <>New to FixMyCity? <button onClick={() => { setView('signup'); setError(null); setInfo(null); }} className="font-semibold text-ocean">Create account</button></>
              ) : (
                <>Already have an account? <button onClick={() => { setView('signin'); setError(null); setInfo(null); }} className="font-semibold text-ocean">Sign in</button></>
              )}
            </p>

            <InstallPrompt className="mt-5" />
          </div>

          <p className="text-center text-[11px] text-muted py-5 font-mono shrink-0">FixMyCity · AWMA pilot · Accra</p>
        </div>
      </div>
    </div>
  );
}
