"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CardStat, FillReason, OwnedCommander } from "@/lib/edhrec";
import type { PrintingIndex } from "@/lib/printings";
import { DECK_SIZE, deckAsCsv, deckAsText, reasonLabel, type BuiltDeck } from "@/lib/build";
import type { CardIndex } from "@/lib/types";
import { CardTable } from "./CardTable";
import { ManaCurve } from "./ManaCurve";
import { buttonGhost, sectionHead } from "./ui";

const TIER_LABELS: Record<FillReason["tier"], string> = {
  deck: "Kept from this deck",
  commander: "From this commander's list",
  theme: "From its themes",
  similar: "From similar commanders",
  colours: "From the rest of your collection",
};

/**
 * The parts of a 99 built from the collection, made to drop into the slots a
 * deck page already has: the stats beside the curve, the cards on the table,
 * and where they came from in place of the missing list. A deck page swaps
 * these in when filled, so nothing new appears and nothing moves.
 */

/** Card index -> why the fill picked it, shown on hover. */
export function useFillNotes(deck: BuiltDeck): Map<number, string> {
  return useMemo(() => new Map(deck.picks.map((p) => [p.cardIndex, reasonLabel(p.reason)])), [deck]);
}

export const fillBasics = (deck: BuiltDeck) =>
  deck.basics.map(([cardIndex, needed]) => ({ cardIndex, needed }));

/** The big count and what's under it, for the right-hand side of a deck header. */
export function FilledStats({ deck }: { deck: BuiltDeck }) {
  const basicCount = deck.basics.reduce((s, [, n]) => s + n, 0);
  const landCount = basicCount + deck.picks.filter((p) => p.category === "land").length;
  // Present only when a particular deck was filled: its owned cards go in first.
  const kept = deck.picks.filter((p) => p.reason.tier === "deck").length;

  return (
    <>
      <p className="pr-1 text-6xl font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums sm:text-[88px]">
        {deck.total}
        <span className="text-quiet">/{DECK_SIZE}</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        {kept > 0 ? (
          <>
            <span className="font-semibold text-ink">{kept}</span> kept,{" "}
            <span className="font-semibold text-ink">{deck.picks.length - kept}</span> filled from
            your collection
          </>
        ) : (
          "all from your collection"
        )}
      </p>
      {/* Mirrors the original's proxy cost line, so switching keeps the header's height. */}
      {deck.total < DECK_SIZE ? (
        <p className="text-sm font-semibold text-signal">
          Your collection runs out of cards in these colours {DECK_SIZE - deck.total} short.
        </p>
      ) : (
        <p className="text-sm text-muted">nothing to buy</p>
      )}
      <p className="mt-1 text-xs text-muted">
        <span
          className="rounded-[2px] border border-ink px-1.5 font-bold text-ink"
          title={
            deck.bracket.gameChangers.length
              ? `Game Changers: ${deck.bracket.gameChangers.join(", ")}`
              : "No Game Changers"
          }
        >
          Bracket {deck.bracket.label}
        </span>{" "}
        estimated · {landCount} lands, {basicCount} basic
      </p>
    </>
  );
}

/** Where the cards came from, and the export: what sits below the table once filled. */
export function FillSummary({
  commander,
  index,
  deck,
}: {
  commander: OwnedCommander;
  index: CardIndex;
  deck: BuiltDeck;
}) {
  const [copied, setCopied] = useState(false);
  const commanderCard = index.cards[commander.cardIndex];
  const basicCount = deck.basics.reduce((s, [, n]) => s + n, 0);

  const tiers = useMemo(() => {
    const counts = new Map<FillReason["tier"], number>();
    for (const p of deck.picks) counts.set(p.reason.tier, (counts.get(p.reason.tier) ?? 0) + 1);
    return [...counts];
  }, [deck]);

  const copyList = async () => {
    await navigator.clipboard.writeText(deckAsText(commanderCard, deck, index));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    const blob = new Blob([deckAsCsv(commanderCard, deck, index)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${commander.slug}-from-collection.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-10">
      <h2 className={sectionHead}>
        <span>Where the cards came from</span>
        <span>{deck.total}</span>
      </h2>
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <ul className="divide-y divide-rule bg-sheet text-sm outline outline-1 outline-rule">
          {tiers.map(([tier, count]) => (
            <li key={tier} className="flex justify-between gap-3 px-3 py-2">
              <span className="text-muted">{TIER_LABELS[tier]}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </li>
          ))}
          {basicCount > 0 && (
            <li className="flex justify-between gap-3 px-3 py-2">
              <span className="text-muted">Basics, split as the deck splits them</span>
              <span className="font-semibold tabular-nums">{basicCount}</span>
            </li>
          )}
        </ul>

        <div>
          <div className="flex gap-2">
            <button type="button" onClick={copyList} className={buttonGhost}>
              {copied ? "Copied" : "Copy decklist"}
            </button>
            <button type="button" onClick={downloadCsv} className={buttonGhost}>
              Download CSV
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs text-muted">
            <p>One card per line, commander first: the decklist pastes into Moxfield or Archidekt.</p>
            <p>
              A starting point, not a tuned deck. The fill checks colour identity and EDHREC&apos;s
              lists, not the curve, the land count&apos;s fit or combos. Hover a card to see why it
              was picked.
            </p>
            <p>
              The bracket is our estimate from Game Changers alone: 0 suggests 1–2, 1–3 gives 3, 4
              or more gives 4. It&apos;s a floor, blind to combos, tutors, mass land denial and
              extra turns. The mix on the Decks tab is what players report, a different measure.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The Build tab's filled 99, assembled from the same parts a deck page uses. */
export function FilledDeck({
  commander,
  index,
  printings,
  stats,
  deck,
  aside,
}: {
  commander: OwnedCommander;
  index: CardIndex;
  printings: PrintingIndex | null;
  stats?: Map<string, CardStat>;
  deck: BuiltDeck;
  /** Under the curve: a way back to wherever the fill started. */
  aside?: ReactNode;
}) {
  const notes = useFillNotes(deck);

  return (
    <>
      <div className="mt-6 grid gap-6 border-b border-ink pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <ManaCurve entries={deck.picks} printings={printings} />
          {aside}
        </div>
        <div className="md:text-right">
          <FilledStats deck={deck} />
        </div>
      </div>

      {/* Kept in pick order within each pile, so the strongest evidence leads. */}
      <CardTable
        entries={deck.picks}
        basics={fillBasics(deck)}
        index={index}
        printings={printings}
        prices={null}
        stats={stats}
        notes={notes}
        keepOrder
      />

      <FillSummary commander={commander} index={index} deck={deck} />
    </>
  );
}
