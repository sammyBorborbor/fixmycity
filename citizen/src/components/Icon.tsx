import { icons } from 'lucide-react';
import type { LucideIcon as LucideIconType } from 'lucide-react';
import type { CSSProperties } from 'react';

interface IconProps {
  name?: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

/* Thin wrapper preserving the prototype's <Icon name="..." /> API, backed by
   lucide-react. `name` is a PascalCase lucide icon key (e.g. "MapPin"). */
export default function Icon({ name, size = 20, className = '', strokeWidth = 2, style }: IconProps) {
  const LucideIcon = name ? (icons as Record<string, LucideIconType | undefined>)[name] : undefined;
  if (!LucideIcon) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      absoluteStrokeWidth={false}
    />
  );
}
