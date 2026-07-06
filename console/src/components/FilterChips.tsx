interface FilterChipsProps {
  filters: string[];
  counts: Record<string, number>;
  active: string;
  onChange: (f: string) => void;
}

/* Status filter chips. Renders a fragment of chip buttons (no wrapper) so the
   caller controls the surrounding layout — Inbox wraps them alone, the Audit
   Log places a search box alongside them. Only "All", chips with a count, and
   the currently-active chip are shown. */
export default function FilterChips({ filters, counts, active, onChange }: FilterChipsProps) {
  return (
    <>
      {filters.filter(f => f === 'All' || counts[f] > 0 || f === active).map(f => {
        const isActive = active === f;
        return (
          <button key={f} onClick={() => onChange(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ring-1 transition flex items-center gap-1.5 ${isActive ? 'bg-navy text-white ring-navy' : 'bg-white text-ink ring-gray-200 hover:ring-gray-300'}`}>
            {f}
            <span className={`text-[11px] font-semibold ${isActive ? 'text-white/70' : 'text-muted'}`}>{counts[f] ?? 0}</span>
          </button>
        );
      })}
    </>
  );
}
