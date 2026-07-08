import Icon from './Icon.tsx';
import StatusPill from './StatusPill.tsx';
import { PhotoThumb } from './PhotoBox.tsx';
import type { Report } from '../lib/store.tsx';

/* Report list item. */
export default function ReportCard({ r, onClick, unread }: { r: Report; onClick: () => void; unread: boolean }) {
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-3 flex gap-3 items-center hover:ring-ocean/30 hover:shadow transition">
      <PhotoThumb path={r.photoPaths[0] ?? null} className="rounded-lg shrink-0" style={{ width: 56, height: 56 }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-ink text-[15px] truncate">{r.category}</p>
          {unread && <span className="w-2 h-2 rounded-full bg-gold pop-dot shrink-0" title="New update" />}
        </div>
        <p className="text-xs text-muted flex items-center gap-1 mt-0.5 truncate">
          <Icon name="MapPin" size={12} /> {r.location}
        </p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <StatusPill status={r.status} />
          <span className="text-[11px] text-muted font-mono shrink-0">{r.id}</span>
        </div>
      </div>
    </button>
  );
}
