"use client";

import Link from "next/link";
import type { DeckMatch } from "@/lib/match";
import type { OwnedCommander } from "@/lib/edhrec";
import { DeckCard } from "./DeckCard";

type Props = {
  commander: OwnedCommander;
  matches: DeckMatch[] | null;
  loaded: number;
  total: number;
};

/**
 * The decks buildable with one commander, ranked by how close the collection
 * already is. Scoring every variant up front is the point — browsing blind
 * would mean opening each one to find out.
 */
export function CommanderDecks({ commander, matches, loaded, total }: Props) {
  return (
    <section>
      <Link href="/" className="text-sm text-muted underline hover:text-foreground">
        ← Back to your commanders
      </Link>

      <div className="mt-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{commander.name}</h2>
        <span className="text-xs text-muted">
          {matches ? `${matches.length} decks` : `${loaded} / ${total}`}
        </span>
      </div>

      {!matches ? (
        <p className="mt-4 text-sm text-muted">Scoring decks from EDHREC…</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
