"use client";

import { use, useEffect, useState } from "react";
import { DeckView } from "@/components/DeckView";
import { useRequireCollection } from "@/components/CollectionGate";
import { errorBox } from "@/components/ui";
import { buildDeck, recommend, type BuiltDeck } from "@/lib/build";
import { fetchAverageDeck, fetchCommanderData, fetchFillTiers, type CardStat } from "@/lib/edhrec";
import { matchDecks, type DeckMatch } from "@/lib/match";

export default function CommanderDeckPage({
  params,
}: {
  params: Promise<{ slug: string; theme: string }>;
}) {
  const { slug, theme } = use(params);
  const state = useRequireCollection();
  // Keyed by route so a stale deck can't render against a different one, and
  // so the effect never clears state synchronously.
  const [result, setResult] = useState<{
    key: string;
    match?: DeckMatch;
    stats?: Map<string, CardStat>;
    error?: string;
  } | null>(null);
  const key = `${slug}/${theme}`;
  // Keyed like the result, so moving to another deck starts on its original list.
  const [chosen, setChosen] = useState<{ key: string; view: "original" | "filled" } | null>(null);
  const view = chosen?.key === key ? chosen.view : "original";
  const [filled, setFilled] = useState<{ key: string; deck: BuiltDeck } | null>(null);
  const [filling, setFilling] = useState(false);

  const commander = state?.owned?.find((c) => c.slug === slug);
  const index = state?.index;
  const collection = state?.collection;
  const ensurePrices = state?.ensurePrices;
  const ensurePrintings = state?.ensurePrintings;

  useEffect(() => {
    ensurePrices?.();
    ensurePrintings?.();
  }, [ensurePrices, ensurePrintings]);

  useEffect(() => {
    if (!commander || !index || !collection) return;
    let cancelled = false;

    (async () => {
      try {
        // The variant carries the label and deck count the header shows, and a
        // deep link arrives without them.
        const { variants, stats } = await fetchCommanderData(commander);
        const variant =
          variants.find((v) => (v.theme ?? "average") === theme) ??
          (theme === "average" ? variants[0] : undefined);
        if (!variant) throw new Error(`No "${theme}" deck for this commander`);

        const source = await fetchAverageDeck(commander, variant, index);
        if (cancelled) return;
        setResult({ key, match: matchDecks([source], index, collection)[0], stats });
      } catch (err) {
        if (!cancelled) {
          setResult({ key, error: err instanceof Error ? err.message : String(err) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commander, index, collection, theme, key]);

  if (!state) return null;

  const current = result?.key === key ? result : null;
  const filledDeck = filled?.key === key ? filled.deck : null;

  // Fetched on demand: up to six more requests to EDHREC for the fill's tiers.
  const showView = async (next: "original" | "filled") => {
    setChosen({ key, view: next });
    if (next !== "filled" || filledDeck || filling) return;
    if (!commander || !state.catalogue || !state.printings || !current?.match || !current.stats) return;
    setFilling(true);
    try {
      const match = current.match;
      const tiers = await fetchFillTiers(
        commander,
        state.catalogue,
        state.index,
        theme === "average" ? undefined : theme
      );
      setFilled({
        key,
        deck: buildDeck({
          commanderIndex: commander.cardIndex,
          recommendations: recommend(current.stats, state.index, state.collection, commander.cardIndex),
          tiers,
          shape: match.deck,
          keep: match.entries.filter((e) => e.have > 0).map((e) => e.cardIndex),
          index: state.index,
          collection: state.collection,
          rank: state.printings.rank,
        }),
      });
    } finally {
      setFilling(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      {!commander ? (
        <p className="text-sm text-muted">That commander isn&apos;t in your collection.</p>
      ) : current?.error ? (
        <p className={errorBox}>
          Couldn&apos;t load that deck from EDHREC: {current.error}
        </p>
      ) : !current?.match ? (
        <p className="text-sm text-muted">Loading deck…</p>
      ) : (
        <DeckView
          match={current.match}
          index={state.index}
          prices={state.prices}
          printings={state.printings}
          stats={current.stats}
          backHref={`/commander/${slug}`}
          backLabel={`Back to ${commander.name}`}
          fill={{ commander, deck: filledDeck, filling, view, onView: showView }}
        />
      )}
    </main>
  );
}
