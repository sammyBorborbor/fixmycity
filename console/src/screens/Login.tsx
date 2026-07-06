import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

/* AWMA staff login — full-viewport, no nav shell. */
export default function Login() {
  const { user, signIn } = useStore();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/', { replace: true }); }, [user, navigate]);

  const [email, setEmail] = useState('akua.osei@aywma.gov.gh');
  const [pw, setPw] = useState('awma-ops-2026');
  const [show, setShow] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); signIn(); navigate('/', { replace: true }); }

  return (
    <div className="w-full h-[100dvh] flex items-center justify-center p-6 overflow-y-auto"
         style={{ background: 'radial-gradient(circle at 50% -10%, #16386a 0%, #0B2545 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <span className="w-14 h-14 rounded-2xl bg-gold text-navy font-extrabold flex items-center justify-center text-lg shadow-lg">AWMA</span>
          <h1 className="text-white text-xl font-bold mt-4">FixMyCity Operations</h1>
          <p className="text-white/55 text-sm mt-1">Ayawaso West Municipal Assembly · staff access</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl p-6">
          <h2 className="font-bold text-navy">Sign in</h2>
          <p className="text-sm text-muted mb-4">Use your AWMA staff account</p>

          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Work email</label>
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

          <Btn size="lg" className="w-full mt-4" icon="LogIn" type="submit">Sign in</Btn>
        </form>

        <p className="text-center text-white/40 text-[11px] mt-5 font-mono">Authorised personnel only · v0.9 pilot</p>
      </div>
    </div>
  );
}
