"use client";

import { useMemo, useState } from "react";
import type { DeckEntry, DeckMatch } from "@/lib/match";
import { missingAsCsv, missingAsText } from "@/lib/match";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/types";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import { ColourPips } from "./ColourPips";
import { CompletionRing } from "./CompletionRing";

/** Full decklist for one match, grouped the way a decklist writeup reads. */
export function DeckDetail({
  match,
  prices,
  onClose,
}: {
  match: DeckMatch;
  prices: PriceIndex | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Indicative only: the cheapest printing of each card, from one snapshot,
  // ignoring condition, seller and shipping.
  const estimate = useMemo(() => {
    if (!prices) return undefined;
    let total = 0;
    let unpriced = 0;
    for (const entry of match.missing) {
      const each = gbpPrice(prices, entry.cardIndex);
      if (each === undefined) {
        unpriced++;
        continue;
      }
      total += each * (entry.needed - entry.have);
    }
    return { total, unpriced };
  }, [match, prices]);

  // The commander is pulled out of its type group and pinned to the top, the
  // way a decklist writeup leads with it.
  const { commanderEntries, grouped } = useMemo(() => {
    const isCommander = new Set(match.deck.commanders);
    const buckets = new Map<Category, DeckEntry[]>();
    const commanderEntries: DeckEntry[] = [];
    for (const entry of match.entries) {
      if (isCommander.has(entry.cardIndex)) {
        commanderEntries.push(entry);
        continue;
      }
      const list = buckets.get(entry.category) ?? [];
      list.push(entry);
      buckets.set(entry.category, list);
    }
    return {
      commanderEntries,
      grouped: CATEGORY_ORDER.filter((c) => buckets.has(c)).map((category) => ({
        category,
        entries: (buckets.get(category) ?? []).sort((a, b) => a.card.n.localeCompare(b.card.n)),
      })),
    };
  }, [match]);

  const copyMissing = async () => {
    await navigator.clipboard.writeText(missingAsText(match));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    const blob = new Blob([missingAsCsv(match)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${match.deck.id}-missing.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-4">
          <CompletionRing percent={match.percent} size={72} />
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{match.deck.name}</h2>
            <p className="text-sm text-muted">
              {match.deck.subtitle} ·{" "}
              {match.commanders.map((c) => c.n).join(" & ") || "No listed commander"}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted">
              <ColourPips colours={match.colours} />
              <span>
                {match.ownedCards}/{match.totalCards} non-basic cards owned
              </span>
              {match.deck.basics > 0 && <span>+ {match.deck.basics} basics (ignored)</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            Close
          </button>
        </header>

        <section className="mt-5 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold">Estimated bracket {match.bracket.label}</h3>
          <p className="mt-1 text-xs text-muted">
            {match.bracket.gameChangers.length} Game Changer
            {match.bracket.gameChangers.length === 1 ? "" : "s"} in this decklist
            {match.bracket.gameChangers.length > 0 && `: ${match.bracket.gameChangers.join(", ")}`}. Brackets
            are a self-reported beta system — treat this as a floor, not a ruling.
          </p>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Missing cards ({match.missing.reduce((s, e) => s + (e.needed - e.have), 0)})
              {estimate && match.missing.length > 0 && (
                <span className="ml-2 font-normal text-muted">~{formatGbp(estimate.total)}</span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyMissing}
                disabled={match.missing.length === 0}
                className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent/60 disabled:opacity-40"
              >
                {copied ? "Copied" : "Copy mass-entry list"}
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={match.missing.length === 0}
                className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent/60 disabled:opacity-40"
              >
                Download CSV
              </button>
            </div>
          </div>
          {match.missing.length === 0 ? (
            <p className="mt-2 text-xs text-muted">You own every non-basic card in this deck.</p>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {[...match.missing]
                  .sort((a, b) => {
                    const pa = prices ? (gbpPrice(prices, a.cardIndex) ?? -1) : 0;
                    const pb = prices ? (gbpPrice(prices, b.cardIndex) ?? -1) : 0;
                    return pb - pa || a.card.n.localeCompare(b.card.n);
                  })
                  .map((entry) => {
                    const each = prices ? gbpPrice(prices, entry.cardIndex) : undefined;
                    const url = prices ? cardmarketUrl(prices, entry.cardIndex) : undefined;
                    const copies = entry.needed - entry.have;
                    return (
                      <li key={entry.cardIndex} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                          {each === undefined ? "—" : formatGbp(each * copies)}
                        </span>
                        <span className="w-8 shrink-0 text-xs text-muted">{copies}×</span>
                        <span className="min-w-0 flex-1 truncate">{entry.card.n}</span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs text-muted underline hover:text-foreground"
                          >
                            Cardmarket
                          </a>
                        )}
                      </li>
                    );
                  })}
              </ul>

              {prices && (
                <p className="mt-2 text-xs text-muted">
                  Cheapest printing on Cardmarket, converted at the ECB rate
                  {prices.rateDate ? ` of ${prices.rateDate}` : ""}. Excludes shipping, and EU
                  sellers add around 20% import VAT on delivery to the UK.
                  {estimate && estimate.unpriced > 0 &&
                    ` ${estimate.unpriced} card${estimate.unpriced === 1 ? " has" : "s have"} no listed price.`}
                </p>
              )}
            </>
          )}
        </section>

        <section className="mt-6 space-y-5">
          {commanderEntries.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Commander
              </h4>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {commanderEntries.map((entry) => (
                  <CardRow key={entry.cardIndex} entry={entry} />
                ))}
              </ul>
            </div>
          )}
          {grouped.map(({ category, entries }) => (
            <div key={category}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {CATEGORY_LABELS[category]} ({entries.reduce((s, e) => s + e.needed, 0)})
              </h4>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {entries.map((entry) => (
                  <CardRow key={entry.cardIndex} entry={entry} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}

/** One card in the decklist, flagged owned or missing. */
function CardRow({ entry }: { entry: DeckEntry }) {
  const owned = entry.have >= entry.needed;
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${owned ? "bg-[#7bd88f]" : "bg-[#e07a6a]"}`}
        aria-label={owned ? "Owned" : "Missing"}
      />
      <span className="w-8 shrink-0 text-xs text-muted">{entry.needed}×</span>
      <span className={`flex-1 truncate ${owned ? "" : "text-muted"}`}>{entry.card.n}</span>
      {entry.card.gc === 1 && (
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-accent">
          Game Changer
        </span>
      )}
      {!owned && entry.have > 0 && (
        <span className="text-xs text-muted">
          {entry.have} of {entry.needed}
        </span>
      )}
    </li>
  );
}
