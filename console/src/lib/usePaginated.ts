import { useState } from 'react';

/* Client-side pagination. Slices an already-filtered/sorted array into pages;
   pass a `resetKey` (e.g. the active filter/search) so the page jumps back to 1
   whenever the underlying set changes. The page is clamped at render, so a
   shrinking list never strands you on an out-of-range page.

   Resets `page` by comparing `resetKey` against its previous value during
   render (React's documented pattern for "adjusting state when a prop
   changes") rather than in a useEffect, which would cause an extra render
   pass for what is otherwise a synchronous derivation. */
export function usePaginated<T>(items: T[], pageSize = 20, resetKey: unknown = null) {
  const [page, setPage] = useState(1);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

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
