import { useState } from 'react';
import { useStore, CITIZEN } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className={`w-11 h-6 rounded-full transition relative ${on ? 'bg-ocean' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function Profile() {
  const { signOut } = useStore();
  const [notif, setNotif] = useState(true);
  const [push, setPush] = useState(true);

  return (
    <div className="px-4 pt-5 pb-4 fade-in">
      <h1 className="text-xl font-bold text-navy mb-4">Profile</h1>
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 flex items-center gap-3">
        <span className="w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center text-xl font-bold">AA</span>
        <div>
          <p className="font-bold text-navy text-lg leading-tight">{CITIZEN.name}</p>
          <p className="text-sm text-muted">{CITIZEN.email}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><Icon name="BadgeCheck" size={12} /> Verified resident</span>
        </div>
      </div>

      <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mt-6 mb-2">Notifications</h2>
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-gray-100">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3"><Icon name="Bell" size={18} className="text-ocean" /><div><p className="text-sm font-medium text-ink">Status updates</p><p className="text-xs text-muted">When AMA acts on your reports</p></div></div>
          <Toggle on={notif} set={setNotif} />
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3"><Icon name="Smartphone" size={18} className="text-ocean" /><div><p className="text-sm font-medium text-ink">Push notifications</p><p className="text-xs text-muted">Alerts on this device</p></div></div>
          <Toggle on={push} set={setPush} />
        </div>
      </div>

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm divide-y divide-gray-100 mt-4">
        {[['Globe', 'Language', 'English'], ['Shield', 'Privacy', ''], ['HelpCircle', 'Help & support', '']].map(([ic, t, v]) => (
          <button key={t} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3"><Icon name={ic} size={18} className="text-muted" /><span className="text-sm font-medium text-ink">{t}</span></div>
            <span className="flex items-center gap-1 text-sm text-muted">{v}<Icon name="ChevronRight" size={16} /></span>
          </button>
        ))}
      </div>

      <Btn variant="danger" icon="LogOut" className="w-full mt-6" onClick={signOut}>Sign out</Btn>
      <p className="text-center text-[11px] text-muted mt-4 font-mono">FixMyCity · v0.9 demo · AWMA pilot</p>
    </div>
  );
}
