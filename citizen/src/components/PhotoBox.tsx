import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from './Icon.tsx';
import { signedPhotoUrl } from '../lib/supabase.ts';
import type { Report } from '../lib/store.tsx';

/* ---- Photo placeholder (striped, with mono label) ---------------------- */
export function PhotoPlaceholder({ label = 'photo', className = '', style = {} }: {
  label?: string; className?: string; style?: CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{
        background: 'repeating-linear-gradient(135deg, #E7EBF0 0 14px, #EDF1F5 14px 28px)',
        ...style,
      }}
    >
      <div className="flex flex-col items-center gap-1.5 text-muted">
        <Icon name="Image" size={26} className="opacity-50" />
        {label && <span className="font-mono text-[10px] tracking-wide opacity-70 uppercase">{label}</span>}
      </div>
    </div>
  );
}

/* ---- Single thumbnail from the private bucket (signed URL) ------------- */
// Used by list cards; resolves one short-lived signed URL for one path.
export function PhotoThumb({ path, className = '', style = {} }: {
  path: string | null; className?: string; style?: CSSProperties;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset while the new signed URL resolves, keyed on path
    setUrl(null);
    if (path) signedPhotoUrl(path).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);

  if (!path || !url) return <PhotoPlaceholder label="" className={className} style={style} />;
  return <img src={url} alt="" className={`object-cover ${className}`} style={style} />;
}

/* ---- Report photos gallery (main image + thumbnail strip) -------------- */
// Photos live in the private report-photos bucket, so each needs a short-lived
// signed URL. One photo → just the main image; several → a tappable strip.
export function ReportPhotos({ report, className = '', style = {} }: {
  report: Report;
  className?: string;
  style?: CSSProperties;
}) {
  const paths = report.photoPaths;
  const [urls, setUrls] = useState<Array<string | null>>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset while the new signed URLs resolve, keyed on the photo set
    setUrls(paths.map(() => null));
    setActive(0);
    Promise.all(paths.map(p => signedPhotoUrl(p)))
      .then(res => { if (alive) setUrls(res); })
      .catch(() => { /* keep placeholders */ });
    return () => { alive = false; };
  }, [paths]);

  if (paths.length === 0) {
    return <PhotoPlaceholder label="no photo" className={className} style={style} />;
  }

  const mainUrl = urls[active];
  return (
    <div>
      {mainUrl
        ? <img src={mainUrl} alt={report.category} className={`object-cover ${className}`} style={style} />
        : <PhotoPlaceholder label="loading photo" className={className} style={style} />}
      {paths.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto">
          {paths.map((p, i) => (
            <button key={p} onClick={() => setActive(i)} aria-label={`View photo ${i + 1}`}
              className={`shrink-0 rounded-lg overflow-hidden ring-2 transition ${i === active ? 'ring-ocean' : 'ring-transparent'}`}>
              {urls[i]
                ? <img src={urls[i]!} alt={`photo ${i + 1}`} className="h-14 w-14 object-cover" />
                : <PhotoPlaceholder label="" className="h-14 w-14" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
