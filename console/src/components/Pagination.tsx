import { useEffect, useState } from 'react';
import Icon from './Icon.tsx';

/* Client-side pagination. `usePaginated` slices an already-filtered/sorted array
   into pages; pass a `resetKey` (e.g. the active filter/search) so the page jumps
   back to 1 whenever the underlying set changes. The page is clamped at render, so
   a shrinking list never strands you on an out-of-range page. */
export function usePaginated<T>(items: T[], pageSize = 20, resetKey: unknown = null) {
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the caller's filter/search changes
  useEffect(() => { setPage(1); }, [resetKey]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    setPage,
    totalPages,
    total,
    pageSize,
  };
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

/* Prev / Next controls with a "Showing X-Y of Z" summary. Renders nothing when
   everything fits on a single page. */
export default function Pagination({ page, totalPages, total, pageSize, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium ring-1 ring-inset ring-gray-300 text-navy hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center justify-between mt-3">
      <span className="text-sm text-muted">Showing {from}&ndash;{to} of {total}</span>
      <div className="flex items-center gap-3">
        <button className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <Icon name="ChevronLeft" size={15} /> Prev
        </button>
        <span className="text-sm text-muted">Page {page} of {totalPages}</span>
        <button className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next <Icon name="ChevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}
