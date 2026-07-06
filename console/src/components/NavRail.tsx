import { NavLink } from 'react-router-dom';
import Icon from './Icon.tsx';
import { useStore } from '../lib/store.tsx';

interface NavItem { to: string; label: string; icon: string; end?: boolean }

const NAV: NavItem[] = [
  { to: '/',            label: 'Inbox',       icon: 'Inbox',      end: true },
  { to: '/map',         label: 'Map',         icon: 'Map' },
  { to: '/assignments', label: 'Assignments', icon: 'ListChecks' },
  { to: '/crews',       label: 'Crews',       icon: 'Users' },
  { to: '/analytics',   label: 'Analytics',   icon: 'BarChart3' },
  { to: '/users',       label: 'Users',       icon: 'UserCog' },
  { to: '/audit',       label: 'Audit Log',   icon: 'ScrollText' },
];

/* Left navigation rail. */
export default function NavRail() {
  const { reports } = useStore();
  const inboxCount = reports.filter(r => ['Submitted', 'Reopened'].includes(r.status)).length;

  return (
    <nav className="shrink-0 w-60 bg-navy text-white flex flex-col">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-white/10">
        <span className="w-9 h-9 rounded-lg bg-gold text-navy font-extrabold flex items-center justify-center text-sm">AWMA</span>
        <div><p className="font-bold leading-tight">FixMyCity</p><p className="text-[11px] text-white/50">Operations console</p></div>
      </div>
      <div className="flex-1 py-3">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition relative ${isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gold" />}
                <Icon name={n.icon} size={18} /> {n.label}
                {n.to === '/' && inboxCount > 0 && <span className="ml-auto text-[11px] font-bold bg-gold text-navy px-1.5 rounded-full">{inboxCount}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="px-5 py-4 border-t border-white/10 text-[11px] text-white/40 font-mono">v0.9 · pilot build</div>
    </nav>
  );
}
