"use client";

import { manaValueOf, type PrintingIndex } from "@/lib/printings";
import type { DeckEntry } from "@/lib/match";

const BUCKETS = 8;
const TOP_BUCKET = BUCKETS - 1;

/**
 * Mana curve drawn as stacks of cards: one bar per card, ink for owned and an
 * outline in signal red for missing, so the split reads by fill as well as by
 * colour. Lands are excluded, as a curve conventionally is.
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
              <div className="flex flex-col-reverse gap-0.5">
                {Array.from({ length: bucket.owned }, (_, j) => (
                  <i key={`o${j}`} className="block h-[5px] w-[18px] bg-ink" />
                ))}
                {Array.from({ length: bucket.missing }, (_, j) => (
                  <i key={`m${j}`} className="block h-[5px] w-[18px] outline outline-1 -outline-offset-1 outline-signal" />
                ))}
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
