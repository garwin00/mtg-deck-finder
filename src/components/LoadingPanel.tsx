"use client";

export type LoadState = {
  fileName: string;
  /** Cards counted straight off the CSV, before the index has downloaded. */
  cardsRead?: number;
  received: number;
  total: number;
  label: string;
};

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

/**
 * Progress for the one moment a wait is earned — after the user hands over a
 * file. Reading the CSV is local, so the card count lands immediately and the
 * bar only covers the download behind it.
 */
export function LoadingPanel({ state }: { state: LoadState }) {
  const percent = state.total > 0 ? Math.min((state.received / state.total) * 100, 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="truncate font-medium">{state.fileName}</p>

      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        {state.cardsRead === undefined ? (
          "Reading…"
        ) : (
          <>
            <span className="text-[#7bd88f]" aria-hidden>
              ✓
            </span>
            {state.cardsRead.toLocaleString()} cards read
          </>
        )}
      </p>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.total > 0 ? Math.round(percent) : undefined}
        aria-label={state.label}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{state.label}</span>
        {state.total > 0 && (
          <span className="tabular-nums">
            {mb(Math.min(state.received, state.total))} / {mb(state.total)}
          </span>
        )}
      </div>
    </div>
  );
}
