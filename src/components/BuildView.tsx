"use client";

import { useMemo } from "react";
import type { CardStat, OwnedCommander } from "@/lib/edhrec";
import type { DeckEntry } from "@/lib/match";
import type { PrintingIndex } from "@/lib/printings";
import { DECK_SIZE, type BuiltDeck, type Recommendation } from "@/lib/build";
import type { CardIndex } from "@/lib/types";
import { CardGroup } from "./CardGroup";
import { CommanderHeader } from "./CommanderHeader";
import { FilledDeck } from "./FilledDeck";
import { button } from "./ui";

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
        <FilledDeck
          commander={props.commander}
          index={props.index}
          printings={props.printings}
          stats={props.stats}
          deck={deck}
          aside={
            <button
              type="button"
              onClick={props.onUnfill}
              className="mt-5 text-sm text-muted underline hover:text-ink"
            >
              Back to the synergy list
            </button>
          }
        />
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
