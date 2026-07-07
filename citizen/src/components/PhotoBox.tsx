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
        <span className="font-mono text-[10px] tracking-wide opacity-70 uppercase">{label}</span>
      </div>
    </div>
  );
}

/* ---- Report photo (loaded from the private storage bucket) ------------- */
// Photos live in the report-photos bucket; viewing needs a short-lived signed
// URL, so this resolves one and falls back to the striped placeholder.
export function ReportPhoto({ report, className = '', style = {} }: {
  report: Report;
  className?: string;
  style?: CSSProperties;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (report.photoPath) {
      signedPhotoUrl(report.photoPath).then(u => { if (alive) setUrl(u); });
    }
    return () => { alive = false; };
  }, [report.photoPath]);

  if (!report.photoPath || !url) {
    return <PhotoPlaceholder label={report.photoPath ? 'loading photo' : 'no photo'} className={className} style={style} />;
  }
  return <img src={url} alt={report.category} className={`object-cover ${className}`} style={style} />;
}
