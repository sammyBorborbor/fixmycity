import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

/* Email-confirmation landing.
   The Supabase client (detectSessionInUrl) parses the tokens from the redirect
   hash during init, so by the time the store reports authReady we either have a
   session (user set) or the link was invalid/expired. */
export default function AuthCallback() {
  const { user, authReady } = useStore();
  const navigate = useNavigate();

  // Supabase encodes verify failures in the URL hash (#error=...&error_description=...).
  const [linkError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('error_description')?.replace(/\+/g, ' ') ?? params.get('error');
  });

  useEffect(() => {
    if (authReady && user) navigate('/', { replace: true });
  }, [authReady, user, navigate]);

  const failed = authReady && !user;

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
          {!failed ? (
            <>
              <h2 className="font-bold text-navy text-lg">Confirming your account…</h2>
              <p className="text-sm text-muted mt-1">Just a moment while we sign you in.</p>
            </>
          ) : (
            <>
              <h2 className="font-bold text-navy text-lg">Confirmation link problem</h2>
              <p className="text-sm text-muted mt-1">
                {linkError ?? 'This confirmation link is invalid or has expired.'}
              </p>
              <p className="text-sm text-muted mt-1">Please sign in, or request a new link by signing up again.</p>
              <Btn size="lg" className="w-full mt-4" icon="LogIn" onClick={() => navigate('/login', { replace: true })}>
                Go to sign in
              </Btn>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted py-5 font-mono shrink-0">FixMyCity · AWMA pilot · Accra</p>
    </div>
  );
}
