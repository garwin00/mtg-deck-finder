"use client";

import type { DeckMatch } from "@/lib/match";
import type { OwnedCommander } from "@/lib/edhrec";
import { CompletionRing } from "./CompletionRing";

type Props = {
  commander: OwnedCommander;
  matches: DeckMatch[] | null;
  loaded: number;
  total: number;
  onOpen: (match: DeckMatch) => void;
  onBack: () => void;
};

/**
 * The decks buildable with one commander, ranked by how close the collection
 * already is. Scoring every variant up front is the point — browsing blind
 * would mean opening each one to find out.
 */
export function CommanderDecks({ commander, matches, loaded, total, onOpen, onBack }: Props) {
  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted underline hover:text-foreground"
      >
        ← Back to your commanders
      </button>

      <div className="mt-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Decks for {commander.name}
        </h2>
        {total > 0 && (
          <span className="text-xs text-muted">
            {matches ? `${matches.length}` : `${loaded} / ${total}`}
          </span>
        )}
      </div>

      {!matches && (
        <p className="mt-3 text-sm text-muted">Scoring decks from EDHREC…</p>
      )}

      {matches && (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {matches.map((match) => (
            <li key={match.deck.id}>
              <button
                type="button"
                onClick={() => onOpen(match)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-2"
              >
                <CompletionRing percent={match.percent} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{match.deck.subtitle}</p>
                  <p className="text-xs text-muted">
                    {match.ownedCards}/{match.totalCards} owned ·{" "}
                    {match.missing.reduce((s, e) => s + (e.needed - e.have), 0)} to buy · bracket{" "}
                    {match.bracket.label}
                  </p>
                </div>
                <span className="shrink-0 text-muted" aria-hidden>
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
