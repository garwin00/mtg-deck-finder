"use client";

import type { CardDetail } from "@/lib/images";
import type { DeckEntry } from "@/lib/match";

const BUCKETS = 8;
const TOP_BUCKET = BUCKETS - 1;

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
  details,
}: {
  entries: DeckEntry[];
  details: Map<string, CardDetail>;
}) {
  const buckets: Bucket[] = Array.from({ length: BUCKETS }, () => ({ owned: 0, missing: 0 }));
  let cards = 0;
  let totalCmc = 0;
  let unknown = 0;

  for (const entry of entries) {
    if (entry.category === "land") continue;
    const cmc = details.get(entry.card.n)?.cmc;
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
        <div className="flex h-24 items-end gap-1.5">
          {buckets.map((bucket, i) => {
            const total = bucket.owned + bucket.missing;
            const label = i === TOP_BUCKET ? `${TOP_BUCKET}+` : String(i);
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-muted">{total || ""}</span>
                <div
                  className="flex w-full flex-col justify-end gap-[2px]"
                  style={{ height: `${(total / tallest) * 100}%` }}
                  title={`${label} mana: ${total} card${total === 1 ? "" : "s"} — ${bucket.owned} owned, ${bucket.missing} missing`}
                >
                  {/* Missing sits above owned in every bar, so the split reads
                      by position as well as by colour. */}
                  {bucket.missing > 0 && (
                    <div
                      className="w-full rounded-t"
                      style={{
                        background: MISSING,
                        flexGrow: bucket.missing,
                        borderRadius: bucket.owned > 0 ? "4px 4px 0 0" : "4px",
                      }}
                    />
                  )}
                  {bucket.owned > 0 && (
                    <div
                      className="w-full"
                      style={{
                        background: OWNED,
                        flexGrow: bucket.owned,
                        borderRadius: bucket.missing > 0 ? "0 0 2px 2px" : "4px 4px 2px 2px",
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
