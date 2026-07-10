import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.tsx';
import StatusPill from './StatusPill.tsx';
import { useStore } from '../lib/store.tsx';

const NO_UNREAD = new Set<string>();

const MENU: [icon: string, title: string, to: string][] = [
  ['UserCircle', 'My profile', '/profile'],
  ['Settings', 'Settings', '/settings'],
];

/* Top header: report search, notifications bell, account menu.
   Search matches by reference / location / category / reporter and opens the
   report's detail panel (owned by AppShell) via onOpenReport, from any page. */
export default function TopHeader({ onOpenReport }: { onOpenReport: (id: string) => void }) {
  const { user, reports, signOut } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const unread = NO_UNREAD;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return reports.filter(r =>
      r.id.toLowerCase().includes(q)
      || r.location.toLowerCase().includes(q)
      || r.category.toLowerCase().includes(q)
      || (r.reporterName ?? '').toLowerCase().includes(q),
    ).slice(0, 7);
  }, [query, reports]);

  function open(id: string) {
    onOpenReport(id);
    setQuery('');
    setFocused(false);
  }

  const showResults = focused && query.trim().length > 0;

  return (
    <header className="shrink-0 h-16 bg-white border-b border-gray-100 flex items-center gap-4 px-6">
      <div className="relative flex-1 max-w-md">
        <Icon name="Search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
            if (e.key === 'Enter' && matches[0]) open(matches[0].id);
          }}
          placeholder="Search reports, locations, references…"
          className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />

        {showResults && (
          <>
            {/* click-away catcher (delayed close so a result click registers) */}
            <div className="fixed inset-0 z-40" onClick={() => setFocused(false)} />
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl ring-1 ring-black/5 shadow-xl z-50 overflow-hidden fade-in">
              {matches.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted">No reports match “{query.trim()}”.</p>
              ) : matches.map(r => (
                <button key={r.id} onMouseDown={e => { e.preventDefault(); open(r.id); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-[12px] font-semibold text-navy shrink-0">{r.id}</span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm text-ink truncate">{r.category}</span>
                    <span className="block text-xs text-muted truncate">{r.location}</span>
                  </span>
                  <StatusPill status={r.status} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button className="relative w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-navy ml-auto">
        <Icon name="Bell" size={19} />
        {unread.size > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gold text-navy text-[10px] font-bold flex items-center justify-center">{unread.size}</span>}
      </button>
      <div className="relative pl-3 border-l border-gray-200">
        <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-1.5 py-1">
          <span className="w-9 h-9 rounded-full bg-ocean text-white text-sm font-bold flex items-center justify-center">{user?.initials}</span>
          <div className="leading-tight text-left"><p className="text-sm font-semibold text-navy">{user?.name}</p><p className="text-[11px] text-muted">{user?.role}</p></div>
          <Icon name="ChevronDown" size={16} className={`text-gray-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl ring-1 ring-black/5 shadow-xl z-50 overflow-hidden fade-in">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-navy">{user?.name}</p>
                <p className="text-xs text-muted">{user?.email}</p>
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
