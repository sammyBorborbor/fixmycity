import Icon from './Icon.tsx';
import { CATEGORIES } from '../lib/store.tsx';
import type { CategoryName } from '../lib/store.tsx';

/* Category icon badge. */
export default function CategoryBadge({ category, size = 44 }: { category: CategoryName; size?: number }) {
  const cfg = CATEGORIES[category];
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: '#F1F5F9', color: cfg.accent }}
    >
      <Icon name={cfg.icon} size={size * 0.5} strokeWidth={2} />
    </span>
  );
}
