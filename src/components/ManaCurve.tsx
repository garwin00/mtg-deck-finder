"use client";

import { manaValueOf, type PrintingIndex } from "@/lib/printings";
import type { DeckEntry } from "@/lib/match";

const BUCKETS = 8;
const TOP_BUCKET = BUCKETS - 1;
/**
 * The plot is a fixed height and bars scale to the tallest, so the header
 * doesn't change height between decks, or when a deck is filled.
 */
const PLOT_HEIGHT = 120;
/** Room above the tallest bar for its count. */
const LABEL_ROOM = 16;

/**
 * Mana curve as one bar per mana value: owned in ink at the foot, missing
 * outlined in signal red above it, so the split reads by fill and position as
 * well as by colour. Lands are excluded, as a curve conventionally is.
 */
export function ManaCurve({
  entries,
  printings,
}: {
  entries: DeckEntry[];
  printings: PrintingIndex | null;
}) {
  const buckets = Array.from({ length: BUCKETS }, () => ({ owned: 0, missing: 0 }));
  let cards = 0;
  let totalCmc = 0;

  for (const entry of entries) {
    if (entry.category === "land") continue;
    const cmc = printings ? manaValueOf(printings, entry.cardIndex) : undefined;
    if (cmc === undefined) continue;
    const bucket = buckets[Math.min(Math.round(cmc), TOP_BUCKET)];
    const have = Math.min(entry.have, entry.needed);
    bucket.owned += have;
    bucket.missing += entry.needed - have;
    cards += entry.needed;
    totalCmc += cmc * entry.needed;
  }

  if (cards === 0) return null;

  const tallest = Math.max(...buckets.map((b) => b.owned + b.missing), 1);
  const scale = (PLOT_HEIGHT - LABEL_ROOM) / tallest;

  return (
    <div className="flex items-end gap-4">
      <div className="flex items-end gap-2.5" role="img" aria-label="Mana curve, lands excluded">
        {buckets.map((bucket, i) => {
          const label = i === TOP_BUCKET ? `${TOP_BUCKET}+` : String(i);
          return (
            <div
              key={i}
              className="flex flex-col items-center"
              title={`${label} mana: ${bucket.owned} owned, ${bucket.missing} missing`}
            >
              <div className="flex w-[18px] flex-col justify-end" style={{ height: PLOT_HEIGHT }}>
                {bucket.owned + bucket.missing > 0 && (
                  <span className="mb-1 text-center text-[10px] tabular-nums text-muted">
                    {bucket.owned + bucket.missing}
                  </span>
                )}
                {bucket.missing > 0 && (
                  <i
                    className="block outline outline-1 -outline-offset-1 outline-signal"
                    style={{ height: bucket.missing * scale }}
                  />
                )}
                {bucket.owned > 0 && (
                  <i className="block bg-ink" style={{ height: bucket.owned * scale }} />
                )}
              </div>
              <span className="mt-1.5 text-[10px] font-semibold tabular-nums text-muted">{label}</span>
            </div>
          );
        })}
      </div>
      <span className="pb-px text-xs text-muted">avg {(totalCmc / cards).toFixed(2)}</span>
    </div>
  );
}
