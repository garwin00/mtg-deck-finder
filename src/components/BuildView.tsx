"use client";

import { useMemo, useState } from "react";
import type { CardStat, FillReason, OwnedCommander } from "@/lib/edhrec";
import type { DeckEntry } from "@/lib/match";
import type { PrintingIndex } from "@/lib/printings";
import {
  DECK_SIZE,
  deckAsCsv,
  deckAsText,
  reasonLabel,
  type BuiltDeck,
  type Recommendation,
} from "@/lib/build";
import type { CardIndex } from "@/lib/types";
import { CardGroup } from "./CardGroup";
import { CardTable } from "./CardTable";
import { CommanderHeader } from "./CommanderHeader";
import { ManaCurve } from "./ManaCurve";
import { button, buttonGhost, sectionHead } from "./ui";

type Props = {
  commander: OwnedCommander;
  index: CardIndex;
  printings: PrintingIndex | null;
  recommendations: Recommendation[] | null;
  stats?: Map<string, CardStat>;
  deck: BuiltDeck | null;
  filling: boolean;
  onFill: () => void;
  onUnfill: () => void;
};

const TIER_LABELS: Record<FillReason["tier"], string> = {
  commander: "From this commander's list",
  theme: "From its themes",
  similar: "From similar commanders",
  colours: "From the rest of your collection",
};

const asEntry = (r: Recommendation): DeckEntry => ({
  card: r.card,
  cardIndex: r.cardIndex,
  needed: 1,
  have: 1,
  category: r.card.cat,
});

/**
 * Cards from the collection for one commander: first the ones EDHREC lists for
 * it, by synergy, then on request a full 99 filled down the weaker tiers.
 */
export function BuildView(props: Props) {
  const { commander, printings, recommendations, deck } = props;

  return (
    <section>
      <CommanderHeader commander={commander} printings={printings} active="build" />

      {!recommendations ? (
        <p className="mt-6 text-sm text-muted">Finding cards from your collection…</p>
      ) : deck ? (
        <FilledDeck {...props} deck={deck} />
      ) : (
        <Picks {...props} recommendations={recommendations} />
      )}
    </section>
  );
}

function Picks({
  commander,
  index,
  printings,
  recommendations,
  stats,
  filling,
  onFill,
}: Props & { recommendations: Recommendation[] }) {
  const notes = useMemo(
    () =>
      new Map(
        recommendations.map((r) => [
          r.cardIndex,
          `${r.stat.synergy >= 0 ? "+" : ""}${Math.round(r.stat.synergy * 100)}% synergy`,
        ])
      ),
    [recommendations]
  );
  const short = DECK_SIZE - recommendations.length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p>
            {recommendations.length === 0
              ? `None of the cards EDHREC lists for ${commander.name} are in your collection.`
              : `${recommendations.length} cards you own that players run with ${commander.name}, highest synergy first.`}
          </p>
          <p className="mt-1 text-xs text-muted">
            Only cards EDHREC lists for this commander, so this isn&apos;t everything that would
            work. Synergy is how much more often a card appears here than in other decks that
            could play it.
          </p>
        </div>
        {short > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              <span className="font-bold text-ink">{short}</span> short of a deck
            </span>
            <button type="button" onClick={onFill} disabled={filling || !printings} className={button}>
              {filling ? "Filling…" : `Fill to ${DECK_SIZE}`}
            </button>
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className="mt-8">
          <CardGroup
            title="From your collection"
            entries={recommendations.map(asEntry)}
            printings={printings}
            prices={null}
            stats={stats}
            notes={notes}
            index={index}
          />
        </div>
      )}
    </>
  );
}

function FilledDeck({
  commander,
  index,
  printings,
  stats,
  deck,
  onUnfill,
}: Props & { deck: BuiltDeck }) {
  const [copied, setCopied] = useState(false);
  const commanderCard = index.cards[commander.cardIndex];

  const notes = useMemo(
    () => new Map(deck.picks.map((p) => [p.cardIndex, reasonLabel(p.reason)])),
    [deck]
  );

  const tiers = useMemo(() => {
    const counts = new Map<FillReason["tier"], number>();
    for (const p of deck.picks) counts.set(p.reason.tier, (counts.get(p.reason.tier) ?? 0) + 1);
    return [...counts];
  }, [deck]);

  const basics = deck.basics.map(([cardIndex, needed]) => ({ cardIndex, needed }));
  const basicCount = basics.reduce((s, b) => s + b.needed, 0);
  const landCount = basicCount + deck.picks.filter((p) => p.category === "land").length;

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
    <>
      <div className="mt-6 grid gap-6 border-b border-ink pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <ManaCurve entries={deck.picks} printings={printings} />
          <button
            type="button"
            onClick={onUnfill}
            className="mt-5 text-sm text-muted underline hover:text-ink"
          >
            Back to the synergy list
          </button>
        </div>
        <div className="md:text-right">
          <p className="pr-1 text-6xl font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums sm:text-[88px]">
            {deck.total}
            <span className="text-quiet">/{DECK_SIZE}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            all from your collection · {landCount} lands, {basicCount} basic
          </p>
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
            estimated · {deck.bracket.gameChangers.length} Game Changer
            {deck.bracket.gameChangers.length === 1 ? "" : "s"}
          </p>
          {deck.total < DECK_SIZE && (
            <p className="text-sm font-semibold text-signal">
              Your collection runs out of cards in these colours {DECK_SIZE - deck.total} short.
            </p>
          )}
          <div className="mt-3 flex gap-2 md:justify-end">
            <button type="button" onClick={copyList} className={buttonGhost}>
              {copied ? "Copied" : "Copy decklist"}
            </button>
            <button type="button" onClick={downloadCsv} className={buttonGhost}>
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Kept in pick order within each pile, so the strongest evidence leads. */}
      <CardTable
        entries={deck.picks}
        basics={basics}
        index={index}
        printings={printings}
        prices={null}
        stats={stats}
        notes={notes}
        keepOrder
      />

      <section className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className={sectionHead}>
            <span>Where the cards came from</span>
            <span>{deck.total}</span>
          </h2>
          <ul className="mt-2 divide-y divide-rule text-sm">
            {tiers.map(([tier, count]) => (
              <li key={tier} className="flex justify-between gap-3 py-1.5">
                <span className="text-muted">{TIER_LABELS[tier]}</span>
                <span className="font-semibold tabular-nums">{count}</span>
              </li>
            ))}
            {basicCount > 0 && (
              <li className="flex justify-between gap-3 py-1.5">
                <span className="text-muted">Basics, split as the average deck does</span>
                <span className="font-semibold tabular-nums">{basicCount}</span>
              </li>
            )}
          </ul>
        </div>
        <div className="text-xs text-muted md:pt-7">
          <p>
            A starting point, not a tuned deck. The fill checks colour identity and EDHREC&apos;s
            lists, not the curve, the land count&apos;s fit or combos. Hover a card to see why it
            was picked.
          </p>
          <p className="mt-2">
            The bracket is our estimate from Game Changers alone: 0 suggests 1–2, 1–3 gives 3, 4 or
            more gives 4. It&apos;s a floor, blind to combos, tutors, mass land denial and extra
            turns, so the deck may play above it. The mix on the Decks tab is what players report
            for this commander, a different measure.
          </p>
          <p className="mt-2">One card per line, commander first: the decklist pastes into Moxfield or Archidekt.</p>
        </div>
      </section>
    </>
  );
}
