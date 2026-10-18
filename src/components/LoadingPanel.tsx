"use client";

export type LoadState = {
  fileName: string;
  /** Cards counted straight off the CSV, before the index has downloaded. */
  cardsRead?: number;
  received: number;
  total: number;
  label: string;
  /** Set instead of bytes when the stage is many small files. */
  count?: { done: number; total: number };
};

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

/**
 * Progress for the one moment a wait is earned — after the user hands over a
 * file. Reading the CSV is local, so the card count lands immediately and the
 * bar only covers the download behind it.
 */
export function LoadingPanel({ state }: { state: LoadState }) {
  const percent = state.count
    ? state.count.total > 0
      ? (state.count.done / state.count.total) * 100
      : 0
    : state.total > 0
      ? Math.min((state.received / state.total) * 100, 100)
      : 0;
  const measured = state.count ? state.count.total > 0 : state.total > 0;

  return (
    <div className="bg-sheet p-6 outline outline-1 outline-rule">
      <p className="truncate font-bold">{state.fileName}</p>

      <p className="mt-1 text-sm text-muted">
        {state.cardsRead === undefined
          ? "Reading…"
          : `${state.cardsRead.toLocaleString()} cards read`}
      </p>

      <div
        className="relative mt-5 h-1 bg-rule"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={measured ? Math.round(percent) : undefined}
        aria-label={state.label}
      >
        <div
          className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{state.label}</span>
        {measured && (
          <span className="tabular-nums">
            {state.count
              ? `${state.count.done} / ${state.count.total} decks`
              : `${mb(Math.min(state.received, state.total))} / ${mb(state.total)}`}
          </span>
        )}
      </div>
    </div>
  );
}
