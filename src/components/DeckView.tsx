"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CardStat } from "@/lib/edhrec";
import type { CardIndex } from "@/lib/types";
import type { DeckMatch } from "@/lib/match";
import { missingAsCsv, missingAsText } from "@/lib/match";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import { cardImageUrl, type PrintingIndex } from "@/lib/printings";
import { BuyPanel } from "./BuyPanel";
import { CardTable } from "./CardTable";
import { ColourPips } from "./ColourPips";
import { HoverCard } from "./HoverCard";
import { ManaCurve } from "./ManaCurve";
import { backLink, buttonGhost, pageTitle, sectionHead } from "./ui";

type Props = {
  match: DeckMatch;
  index: CardIndex;
  prices: PriceIndex | null;
  printings: PrintingIndex | null;
  /** Per-card usage from EDHREC. Absent for precons. */
  stats?: Map<string, CardStat>;
  backHref: string;
  backLabel: string;
};

/**
 * A whole deck, dealt onto the table: the commander in its zone, the rest in
 * piles by role, missing cards as priced proxies, then how to buy them.
 */
export function DeckView({ match, index, prices, printings, stats, backHref, backLabel }: Props) {
  const [copied, setCopied] = useState(false);

  // The commander leads in the header rather than sitting in a pile.
  const { commanderEntries, rest } = useMemo(() => {
    const isCommander = new Set(match.deck.commanders);
    return {
      commanderEntries: match.entries.filter((e) => isCommander.has(e.cardIndex)),
      rest: match.entries.filter((e) => !isCommander.has(e.cardIndex)),
    };
  }, [match]);

  const estimate = useMemo(() => {
    if (!prices) return undefined;
    let total = 0;
    let unpriced = 0;
    for (const entry of match.missing) {
      const each = gbpPrice(prices, entry.cardIndex);
      if (each === undefined) unpriced++;
      else total += each * (entry.needed - entry.have);
    }
    return { total, unpriced };
  }, [match, prices]);

  // Basics are part of the decklist and part of the mana base, but never
  // scored — a collection holds them in bulk, so counting them would add the
  // same offset to every deck and tell the user nothing.
  const basics = useMemo(
    () =>
      match.deck.basics
        .map(([cardIndex, needed]) => ({ cardIndex, needed }))
        .sort((a, b) => b.needed - a.needed),
    [match]
  );

  const manaBase = useMemo(() => {
    const basic = basics.reduce((sum, b) => sum + b.needed, 0);
    const nonbasic = match.entries
      .filter((e) => e.category === "land")
      .reduce((sum, e) => sum + e.needed, 0);
    return { basic, nonbasic, total: basic + nonbasic };
  }, [basics, match]);

  const missingCount = match.missing.reduce((s, e) => s + (e.needed - e.have), 0);
  const commanderNames = match.commanders.map((c) => c.n.split("//")[0].trim()).join(" & ");
  // An EDHREC deck is named for its theme, so the commander is the headline;
  // a precon's own name is the headline, with its commander underneath.
  const isCommanderDeck = match.deck.kind === "commander";
  const headline = isCommanderDeck ? commanderNames || match.deck.name : match.deck.name;
  const kicker = isCommanderDeck
    ? `${match.deck.name} · ${match.deck.subtitle} on EDHREC`
    : `${match.deck.subtitle} · ${commanderNames || "No listed commander"}`;
  // From the deck's commander list: an EDHREC average deck keeps its commander
  // out of the card entries, so the entries can't be relied on for it.
  const commanderIndex = match.deck.commanders[0] ?? commanderEntries[0]?.cardIndex;
  const commanderImage =
    printings && commanderIndex !== undefined ? cardImageUrl(printings, commanderIndex) : undefined;

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
    link.download = `${match.deck.id.replace(/[^a-z0-9]+/gi, "-")}-missing.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Link href={backHref} className={backLink}>
        ← {backLabel}
      </Link>

      <header className="mt-4 grid gap-6 border-b border-ink pb-6 md:grid-cols-[140px_1fr_auto] md:items-end">
        <div className="hidden md:block">
          {commanderImage && (
            <HoverCard image={commanderImage} name={commanderNames}>
              <Image
                src={commanderImage}
                alt={commanderNames}
                width={140}
                height={195}
                unoptimized
                className="h-[195px] w-[140px] rounded-[6px] shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
              />
            </HoverCard>
          )}
        </div>

        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <ColourPips colours={match.colours} />
            <span>{kicker}</span>
          </p>
          <h1 className={`mt-2 ${pageTitle}`}>{headline}</h1>
          <div className="mt-5">
            <ManaCurve entries={rest} printings={printings} />
          </div>
        </div>

        <div className="md:text-right">
          <p className="pr-1 text-6xl font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums sm:text-[88px]">
            {match.ownedCards}
            <span className="text-quiet">/{match.totalCards}</span>
          </p>
          <p className="mt-2 text-sm text-muted">owned, basics aside</p>
          {estimate && missingCount > 0 && (
            <p className="text-sm text-muted">
              <span className="font-bold text-signal">~{formatGbp(estimate.total)}</span> of proxies
              to replace
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            <span
              className="rounded-[2px] border border-ink px-1.5 font-bold text-ink"
              title={
                match.bracket.gameChangers.length
                  ? `Game Changers: ${match.bracket.gameChangers.join(", ")}`
                  : "No Game Changers"
              }
            >
              Bracket {match.bracket.label}
            </span>
            {manaBase.total > 0 && (
              <>
                {" "}
                · {manaBase.total} lands, {manaBase.basic} basic
              </>
            )}
          </p>
        </div>
      </header>

      <CardTable
        entries={rest}
        basics={basics}
        index={index}
        printings={printings}
        prices={prices}
        stats={stats}
      />

      <section className="mt-10">
        <h2 className={sectionHead}>
          <span>Missing ({missingCount})</span>
          {estimate && missingCount > 0 && <span>~{formatGbp(estimate.total)}</span>}
        </h2>

        {missingCount === 0 ? (
          <p className="mt-3 text-sm text-muted">You own every non-basic card in this deck.</p>
        ) : (
          <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
            <ul className="max-h-[28rem] divide-y divide-rule overflow-y-auto bg-sheet outline outline-1 outline-rule">
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
                  const preview = printings ? cardImageUrl(printings, entry.cardIndex) : undefined;
                  return (
                    <li key={entry.cardIndex}>
                      <HoverCard
                        image={preview}
                        name={entry.card.n}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{copies}×</span>
                        <span className="min-w-0 flex-1 truncate">
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {entry.card.n}
                            </a>
                          ) : (
                            entry.card.n
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-signal">
                          {each === undefined ? "–" : formatGbp(each * copies)}
                        </span>
                      </HoverCard>
                    </li>
                  );
                })}
            </ul>

            <div>
              <BuyPanel match={match} prices={prices} />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={copyMissing} className={buttonGhost}>
                  {copied ? "Copied" : "Copy list"}
                </button>
                <button type="button" onClick={downloadCsv} className={buttonGhost}>
                  Download CSV
                </button>
              </div>
              {prices && (
                <p className="mt-3 text-xs text-muted">
                  Cheapest printing on Cardmarket, converted at the ECB rate
                  {prices.rateDate ? ` of ${prices.rateDate}` : ""}. Excludes shipping, and EU
                  sellers add around 20% import VAT on delivery to the UK.
                  {estimate &&
                    estimate.unpriced > 0 &&
                    ` ${estimate.unpriced} card${estimate.unpriced === 1 ? " has" : "s have"} no listed price.`}
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
