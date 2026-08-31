"use client";

import { manaValueOf, type PrintingIndex } from "@/lib/printings";
import type { DeckEntry } from "@/lib/match";

const BUCKETS = 8;
const TOP_BUCKET = BUCKETS - 1;
/**
 * Bars are sized in pixels, not percentages. A percentage height inside an
 * auto-height flex column has nothing definite to resolve against and collapses
 * to zero, which left the curve showing only its numbers.
 */
const PLOT_HEIGHT = 76;
const MIN_BAR = 3;

/** Owned and missing use the same green and red as the rest of the app. */
const OWNED = "#7bd88f";
const MISSING = "#e07a6a";

type Bucket = { owned: number; missing: number };

/**
 * Mana curve, split into what the collection covers and what it doesn't.
 *
 * Lands are excluded, as a curve conventionally is — they would pile into the
 * zero bucket and flatten everything else.
 */
export function ManaCurve({
  entries,
  printings,
}: {
  entries: DeckEntry[];
  printings: PrintingIndex | null;
}) {
  const buckets: Bucket[] = Array.from({ length: BUCKETS }, () => ({ owned: 0, missing: 0 }));
  let cards = 0;
  let totalCmc = 0;
  let unknown = 0;

  for (const entry of entries) {
    if (entry.category === "land") continue;
    const cmc = printings ? manaValueOf(printings, entry.cardIndex) : undefined;
    if (cmc === undefined) {
      unknown += entry.needed;
      continue;
    }
    const bucket = buckets[Math.min(Math.round(cmc), TOP_BUCKET)];
    bucket.owned += Math.min(entry.have, entry.needed);
    bucket.missing += entry.needed - Math.min(entry.have, entry.needed);
    cards += entry.needed;
    totalCmc += cmc * entry.needed;
  }

  if (cards === 0) return null;

  const tallest = Math.max(...buckets.map((b) => b.owned + b.missing), 1);
  const average = totalCmc / cards;

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Mana curve</h2>
        <span className="text-xs text-muted">avg {average.toFixed(2)}</span>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-end gap-1.5" style={{ height: PLOT_HEIGHT + 16 }}>
          {buckets.map((bucket, i) => {
            const total = bucket.owned + bucket.missing;
            const label = i === TOP_BUCKET ? `${TOP_BUCKET}+` : String(i);
            const barHeight = total === 0 ? 0 : Math.max(Math.round((total / tallest) * PLOT_HEIGHT), MIN_BAR);
            const ownedHeight = total === 0 ? 0 : Math.round((bucket.owned / total) * barHeight);
            const missingHeight = barHeight - ownedHeight;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${label} mana: ${total} card${total === 1 ? "" : "s"} — ${bucket.owned} owned, ${bucket.missing} missing`}
              >
                <span className="text-[10px] tabular-nums text-muted">{total || ""}</span>
                <div className="flex w-full flex-col justify-end" style={{ height: barHeight }}>
                  {/* Missing sits above owned in every bar, so the split reads
                      by position as well as by colour. */}
                  {missingHeight > 0 && (
                    <div
                      className="w-full"
                      style={{
                        background: MISSING,
                        height: missingHeight,
                        borderRadius: "4px 4px 0 0",
                        marginBottom: ownedHeight > 0 ? 2 : 0,
                      }}
                    />
                  )}
                  {ownedHeight > 0 && (
                    <div
                      className="w-full"
                      style={{
                        background: OWNED,
                        height: ownedHeight,
                        borderRadius: missingHeight > 0 ? "0 0 2px 2px" : "4px 4px 2px 2px",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-1.5 flex gap-1.5">
          {buckets.map((_, i) => (
            <span key={i} className="flex-1 text-center text-[10px] tabular-nums text-muted">
              {i === TOP_BUCKET ? `${TOP_BUCKET}+` : i}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 border-t border-border pt-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: OWNED }} /> Owned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: MISSING }} /> Missing
          </span>
          <span className="ml-auto">Lands excluded</span>
        </div>

        {unknown > 0 && (
          <p className="mt-1 text-[11px] text-muted">{unknown} cards still loading</p>
        )}
      </div>
    </section>
  );
}
