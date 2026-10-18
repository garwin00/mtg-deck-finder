"use client";

import type { DeckMatch } from "@/lib/match";
import type { BracketMix, OwnedCommander } from "@/lib/edhrec";
import type { PrintingIndex } from "@/lib/printings";
import { CommanderHeader } from "./CommanderHeader";
import { DeckCard } from "./DeckCard";

type Props = {
  commander: OwnedCommander;
  printings: PrintingIndex | null;
  brackets?: BracketMix;
  matches: DeckMatch[] | null;
  loaded: number;
  total: number;
};

/**
 * The decks buildable with one commander, each scored against the collection.
 * Scoring every variant up front is the point — browsing blind would mean
 * opening each one to find out.
 */
export function CommanderDecks({ commander, printings, brackets, matches, loaded, total }: Props) {
  return (
    <section>
      <CommanderHeader commander={commander} printings={printings} brackets={brackets} active="decks" />

      {!matches ? (
        <p className="mt-6 text-sm text-muted">
          Scoring decks from EDHREC… {total > 0 && `${loaded} of ${total}`}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <DeckCard
              key={match.deck.id}
              match={match}
              // Deck ids are "<slug>:<theme>"; the route mirrors that.
              href={`/commander/${commander.slug}/${match.deck.id.split(":")[1] ?? "average"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
