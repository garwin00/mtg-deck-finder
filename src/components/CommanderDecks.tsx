"use client";

import Link from "next/link";
import type { DeckMatch } from "@/lib/match";
import type { BracketMix, OwnedCommander } from "@/lib/edhrec";
import { DeckCard } from "./DeckCard";

type Props = {
  commander: OwnedCommander;
  brackets?: BracketMix;
  matches: DeckMatch[] | null;
  loaded: number;
  total: number;
};

/**
 * The decks buildable with one commander, ranked by how close the collection
 * already is. Scoring every variant up front is the point — browsing blind
 * would mean opening each one to find out.
 */
export function CommanderDecks({ commander, brackets, matches, loaded, total }: Props) {
  return (
    <section>
      <Link href="/" className="text-sm text-muted underline hover:text-foreground">
        ← Back to your commanders
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{commander.name}</h2>
          {brackets && (
            <p
              className="mt-0.5 text-xs text-muted"
              title={[1, 2, 3, 4, 5]
                .map(
                  (b) =>
                    `Bracket ${b}: ${Math.round(((brackets.counts[b] ?? 0) / brackets.total) * 100)}%`
                )
                .join(" · ")}
            >
              Most decks are bracket {brackets.mode} · average{" "}
              {brackets.mean.toFixed(1)} across {brackets.total.toLocaleString()} decks on EDHREC
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted">
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
