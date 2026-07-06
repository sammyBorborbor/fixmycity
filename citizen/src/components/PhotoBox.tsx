import type { CSSProperties } from 'react';
import Icon from './Icon.tsx';
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

/* ---- Report photo (real, user-droppable image keyed by report id) ------ */
// Wraps <image-slot> so a dropped photo persists and syncs across every view
// that shows the same report. readOnly slots are display-only (clicks pass
// through to the row).
export function ReportPhoto({ report, className = '', style = {}, shape = 'rounded', radius = 12, placeholder = 'Drop a photo', readOnly = false }: {
  report: Report;
  className?: string;
  style?: CSSProperties;
  shape?: string;
  radius?: number;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const id = 'rpt-photo-' + report.id;
  return (
    <image-slot
      id={id}
      shape={shape}
      radius={String(radius)}
      placeholder={placeholder}
      class={className}
      style={{
        display: 'block',
        background: 'repeating-linear-gradient(135deg,#E7EBF0 0 14px,#EDF1F5 14px 28px)',
        ...style,
        ...(readOnly ? { pointerEvents: 'none' as const } : {}),
      }}
    />
  );
}
