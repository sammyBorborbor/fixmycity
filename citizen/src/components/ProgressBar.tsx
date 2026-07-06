/* Three-segment step progress bar for the report flow. */
export default function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5 mb-5 mt-3">
      {[1, 2].map(n => (
        <span key={n} className={`h-1.5 rounded-full flex-1 ${step >= n ? 'bg-ocean' : 'bg-gray-200'}`} />
      ))}
      <span className="h-1.5 rounded-full flex-1 bg-gray-200" />
    </div>
  );
}
