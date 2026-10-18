"use client";

import { use, useEffect, useState } from "react";
import { BuildView } from "@/components/BuildView";
import { useRequireCollection } from "@/components/CollectionGate";
import { errorBox } from "@/components/ui";
import { buildDeck, recommend, type BuiltDeck, type Recommendation } from "@/lib/build";
import {
  fetchAverageDeck,
  fetchCommanderData,
  fetchFillTiers,
  type CardStat,
} from "@/lib/edhrec";
import type { DeckSource } from "@/lib/match";

export default function CommanderBuildPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const state = useRequireCollection();
  // Keyed by slug so a stale result can't render against a different commander.
  const [result, setResult] = useState<{
    slug: string;
    recommendations?: Recommendation[];
    stats?: Map<string, CardStat>;
    average?: DeckSource;
    error?: string;
  } | null>(null);
  const [built, setBuilt] = useState<{ slug: string; deck: BuiltDeck } | null>(null);
  const [filling, setFilling] = useState(false);

  const commander = state?.owned?.find((c) => c.slug === slug);
  const index = state?.index;
  const collection = state?.collection;
  const ensurePrintings = state?.ensurePrintings;

  // Printings carry the images and the EDHREC rank the last fill tier sorts by.
  useEffect(() => {
    ensurePrintings?.();
  }, [ensurePrintings]);

  useEffect(() => {
    if (!commander || !index || !collection) return;
    let cancelled = false;

    (async () => {
      try {
        const { variants, stats } = await fetchCommanderData(commander);
        // The average deck sets the fill's land count and basics split.
        const average = await fetchAverageDeck(commander, variants[0], index);
        if (cancelled) return;
        setResult({
          slug: commander.slug,
          recommendations: recommend(stats, index, collection, commander.cardIndex),
          stats,
          average,
        });
      } catch (err) {
        if (!cancelled) {
          setResult({ slug: commander.slug, error: err instanceof Error ? err.message : String(err) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commander, index, collection]);

  if (!state) return null;

  const current = result?.slug === slug ? result : null;
  const deck = built?.slug === slug ? built.deck : null;

  // Up to six more requests, so the fill's sources are only fetched on demand.
  const fill = async () => {
    if (!commander || !state.catalogue || !state.printings || !current?.recommendations || !current.average) {
      return;
    }
    setFilling(true);
    try {
      const tiers = await fetchFillTiers(commander, state.catalogue, state.index);
      setBuilt({
        slug: commander.slug,
        deck: buildDeck({
          commanderIndex: commander.cardIndex,
          recommendations: current.recommendations,
          tiers,
          shape: current.average,
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
          Couldn&apos;t load {commander.name} from EDHREC: {current.error}
        </p>
      ) : (
        <BuildView
          commander={commander}
          index={state.index}
          printings={state.printings}
          recommendations={current?.recommendations ?? null}
          stats={current?.stats}
          deck={deck}
          filling={filling}
          onFill={fill}
          onUnfill={() => setBuilt(null)}
        />
      )}
    </main>
  );
}
