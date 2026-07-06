import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.tsx';
import { useStore } from '../lib/store.tsx';

const NO_UNREAD = new Set<string>();

const MENU: [icon: string, title: string, to: string][] = [
  ['UserCircle', 'My profile', '/profile'],
  ['Settings', 'Settings', '/settings'],
];

/* Top header: search, notifications bell, account menu. */
export default function TopHeader() {
  const { signOut } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = NO_UNREAD;

  return (
    <header className="shrink-0 h-16 bg-white border-b border-gray-100 flex items-center gap-4 px-6">
      <div className="relative flex-1 max-w-md">
        <Icon name="Search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input placeholder="Search reports, locations, references…" className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />
      </div>
      <button className="relative w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-navy ml-auto">
        <Icon name="Bell" size={19} />
        {unread.size > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gold text-navy text-[10px] font-bold flex items-center justify-center">{unread.size}</span>}
      </button>
      <div className="relative pl-3 border-l border-gray-200">
        <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-1.5 py-1">
          <span className="w-9 h-9 rounded-full bg-ocean text-white text-sm font-bold flex items-center justify-center">AO</span>
          <div className="leading-tight text-left"><p className="text-sm font-semibold text-navy">Akua O.</p><p className="text-[11px] text-muted">AWMA Officer</p></div>
          <Icon name="ChevronDown" size={16} className={`text-gray-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl ring-1 ring-black/5 shadow-xl z-50 overflow-hidden fade-in">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-navy">Akua Osei</p>
                <p className="text-xs text-muted">akua.osei@aywma.gov.gh</p>
              </div>
              {MENU.map(([ic, t, to]) => (
                <button key={t} onClick={() => { setMenuOpen(false); navigate(to); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-gray-50">
                  <Icon name={ic} size={16} className="text-muted" /> {t}
                </button>
              ))}
              <div className="border-t border-gray-100">
                <button onClick={() => { setMenuOpen(false); signOut(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  <Icon name="LogOut" size={16} /> Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
