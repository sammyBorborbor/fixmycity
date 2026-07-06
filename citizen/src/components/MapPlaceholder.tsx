import Icon from './Icon.tsx';
import { COORDS, STATUS } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

interface MapPlaceholderProps {
  reports: Report[];
  onPin?: (r: Report) => void;
  activeId?: string | null;
  height?: number;
  rounded?: string;
}

/* Stylized Accra placeholder: striped landmass blob + faint street grid + pins. */
export default function MapPlaceholder({ reports, onPin, activeId, height = 320, rounded = 'rounded-xl' }: MapPlaceholderProps) {
  return (
    <div
      className={`relative w-full overflow-hidden ${rounded} ring-1 ring-black/5`}
      style={{ height, background: 'linear-gradient(180deg,#EAF1F6 0%, #E2ECF3 100%)' }}
    >
      {/* coast / landmass blob */}
      <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id="land" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#DDE7EE" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#D2DEE7" strokeWidth="3" />
          </pattern>
        </defs>
        <path d="M0,0 H400 V232 C350,238 320,228 280,236 C240,244 215,232 175,240 C130,249 95,238 55,246 C35,250 15,246 0,250 Z" fill="url(#land)" />
        {/* sea band at bottom */}
        <rect x="0" y="246" width="400" height="60" fill="#BFD6E6" opacity="0.6" />
        {/* faint streets */}
        <g stroke="#C7D3DC" strokeWidth="1.4" opacity="0.8">
          <line x1="40" y1="20" x2="120" y2="245" />
          <line x1="160" y1="10" x2="200" y2="245" />
          <line x1="300" y1="15" x2="250" y2="245" />
          <line x1="10" y1="90" x2="395" y2="70" />
          <line x1="10" y1="160" x2="395" y2="150" />
        </g>
      </svg>

      {/* water label */}
      <span className="absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-widest text-ocean/40">Gulf of Guinea</span>
      <span className="absolute top-2 left-3 font-mono text-[9px] uppercase tracking-widest text-navy/30">Greater Accra — map placeholder</span>

      {/* pins */}
      {reports.map(r => {
        const c = COORDS[r.location] || { x: 50, y: 50 };
        const cfg = STATUS[r.status] || STATUS.Submitted;
        const active = activeId === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onPin && onPin(r)}
            title={`${r.location} — ${r.status}`}
            className="absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-110 focus:outline-none"
            style={{ left: c.x + '%', top: c.y + '%', zIndex: active ? 30 : 10 }}
          >
            <span className="relative flex flex-col items-center">
              <Icon name="MapPin" size={active ? 32 : 26} strokeWidth={2.5}
                    style={{ color: cfg.solid, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }} />
              {active && (
                <span className="absolute -bottom-1 w-2 h-2 rounded-full ring-2 ring-white" style={{ background: cfg.solid }} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
