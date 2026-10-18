"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { CATEGORY_LABELS, CATEGORY_ORDER, type CardIndex, type Category } from "@/lib/types";
import { CardGroup } from "./CardGroup";
import { CommanderTabs } from "./CommanderTabs";
import { ManaCurve } from "./ManaCurve";

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
  commander: "from this commander's list",
  theme: "from its themes",
  similar: "from similar commanders",
  colours: "from the rest of your collection",
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
  const { commander, recommendations, deck } = props;

  return (
    <section>
      <Link href="/" className="text-sm text-muted underline hover:text-foreground">
        ← Back to your commanders
      </Link>
      <h2 className="mt-3 text-lg font-semibold">{commander.name}</h2>
      <CommanderTabs slug={commander.slug} active="build" />

      {!recommendations ? (
        <p className="mt-4 text-sm text-muted">Finding cards from your collection…</p>
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
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm">
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
            <span className="text-xs text-muted">{short} short of a deck</span>
            <button
              type="button"
              onClick={onFill}
              disabled={filling || !printings}
              className="rounded-md border border-accent/60 px-3 py-1.5 text-sm hover:bg-accent/10 disabled:opacity-50"
            >
              {filling ? "Filling…" : `Fill to ${DECK_SIZE}`}
            </button>
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className="mt-6">
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

  // Kept in pick order within each category, so the strongest evidence leads.
  const grouped = useMemo(() => {
    const buckets = new Map<Category, DeckEntry[]>();
    for (const pick of deck.picks) {
      const list = buckets.get(pick.category) ?? [];
      list.push(pick);
      buckets.set(pick.category, list);
    }
    return CATEGORY_ORDER.filter((c) => buckets.has(c) || c === "land").map((category) => ({
      category,
      entries: buckets.get(category) ?? [],
    }));
  }, [deck]);

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
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm">
          {deck.total}/{DECK_SIZE} cards · {landCount} lands, {basicCount} of them basic
        </p>
        <button
          type="button"
          onClick={onUnfill}
          className="text-sm text-muted underline hover:text-foreground"
        >
          Back to the synergy list
        </button>
      </div>
      {deck.total < DECK_SIZE && (
        <p className="mt-2 text-sm text-[#e07a6a]">
          Your collection runs out of cards in these colours {DECK_SIZE - deck.total} short.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-8">
          <CardGroup
            title="Commander"
            entries={[
              { card: commanderCard, cardIndex: commander.cardIndex, needed: 1, have: 1, category: commanderCard.cat },
            ]}
            printings={printings}
            prices={null}
            index={index}
          />
          {grouped
            .filter(({ category, entries }) => entries.length > 0 || category === "land")
            .map(({ category, entries }) => (
              <CardGroup
                key={category}
                title={CATEGORY_LABELS[category]}
                entries={entries}
                printings={printings}
                prices={null}
                stats={stats}
                notes={notes}
                basics={category === "land" ? basics : undefined}
                index={index}
              />
            ))}
        </div>

        <aside className="w-full shrink-0 lg:w-80">
          <div className="space-y-6 lg:sticky lg:top-6">
            <ManaCurve entries={deck.picks} printings={printings} />

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Where the cards came from
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {tiers.map(([tier, count]) => (
                  <li key={tier} className="flex justify-between gap-3">
                    <span className="text-muted">{TIER_LABELS[tier]}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
                {basicCount > 0 && (
                  <li className="flex justify-between gap-3">
                    <span className="text-muted">basics, split as the average deck does</span>
                    <span className="tabular-nums">{basicCount}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-muted">
                A starting point, not a tuned deck. The fill checks colour identity and EDHREC&apos;s
                lists, not the curve, the land count&apos;s fit or combos.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Export</h2>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={copyList}
                  className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent/60"
                >
                  {copied ? "Copied" : "Copy decklist"}
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent/60"
                >
                  Download CSV
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                One card per line, commander first: pastes into Moxfield or Archidekt.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
