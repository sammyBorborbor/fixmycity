import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.tsx';

interface Tab { id: string; label: string; icon: string; path: string }

const TABS: Tab[] = [
  { id: 'home',    label: 'Home',       icon: 'House',         path: '/' },
  { id: 'report',  label: 'Report',     icon: 'PlusCircle',    path: '/report' },
  { id: 'reports', label: 'My Reports', icon: 'ClipboardList', path: '/reports' },
  { id: 'map',     label: 'Map',        icon: 'Map',           path: '/map' },
  { id: 'profile', label: 'Profile',    icon: 'User',          path: '/profile' },
];

/* Bottom tab bar. A tab is active only on an exact path match, so detail and
   notifications routes show no active tab (matching the prototype). */
export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <div className="shrink-0 bg-white border-t border-gray-200 grid grid-cols-5 px-1 pt-1.5 pb-2">
      {TABS.map(t => {
        const active = pathname === t.path;
        const isReport = t.id === 'report';
        return (
          <button key={t.id} onClick={() => navigate(t.path)} className="flex flex-col items-center gap-0.5 py-1">
            {isReport ? (
              <span className="w-11 h-11 -mt-5 rounded-full bg-gold text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                <Icon name="Plus" size={24} strokeWidth={2.5} />
              </span>
            ) : (
              <Icon name={t.icon} size={21} className={active ? 'text-navy' : 'text-gray-400'} strokeWidth={active ? 2.4 : 2} />
            )}
            <span className={`text-[10px] font-medium ${active ? 'text-navy' : 'text-gray-400'} ${isReport ? '-mt-1' : ''}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
