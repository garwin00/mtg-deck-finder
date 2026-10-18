/** Completion as a thin bar: ink for what's owned, the rule for the rest. */
export function Meter({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div
      className={`relative h-1 bg-rule ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}
