"use client";

import { use, useEffect, useState } from "react";
import { CommanderDecks } from "@/components/CommanderDecks";
import { useRequireCollection } from "@/components/CollectionGate";
import { fetchAverageDeck, fetchCommanderData, type BracketMix } from "@/lib/edhrec";
import { matchDecks, type DeckMatch } from "@/lib/match";

export default function CommanderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const state = useRequireCollection();
  // Keyed by slug rather than reset on each run: clearing state synchronously
  // inside the effect would cascade a render, and a stale result must not show
  // against a different commander.
  const [result, setResult] = useState<{
    slug: string;
    matches?: DeckMatch[];
    brackets?: BracketMix;
    error?: string;
  } | null>(null);
  const [progress, setProgress] = useState({ slug: "", loaded: 0, total: 0 });

  const commander = state?.owned?.find((c) => c.slug === slug);
  const index = state?.index;
  const collection = state?.collection;

  useEffect(() => {
    if (!commander || !index || !collection) return;
    let cancelled = false;

    (async () => {
      try {
        const { variants, brackets } = await fetchCommanderData(commander);
        if (cancelled) return;
        setProgress({ slug: commander.slug, loaded: 0, total: variants.length });

        const sources = [];
        let loaded = 0;
        for (const variant of variants) {
          try {
            sources.push(await fetchAverageDeck(commander, variant, index));
          } catch {
            // A theme without a published average deck just isn't offered.
          }
          if (cancelled) return;
          setProgress({ slug: commander.slug, loaded: ++loaded, total: variants.length });
        }
        if (sources.length === 0) throw new Error("EDHREC has no decklist for this commander");
        // fetchVariants returns the average deck then themes by deck count, so
        // keeping that order lists them most-built first.
        setResult({
          slug: commander.slug,
          matches: matchDecks(sources, index, collection, "given"),
          brackets,
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
  const shown = progress.slug === slug ? progress : { loaded: 0, total: 0 };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      {!commander ? (
        <p className="text-sm text-muted">That commander isn&apos;t in your collection.</p>
      ) : current?.error ? (
        <p className="rounded-lg border border-[#e07a6a]/40 bg-[#e07a6a]/10 p-4 text-sm">
          Couldn&apos;t load {commander.name} from EDHREC: {current.error}
        </p>
      ) : (
        <CommanderDecks
          commander={commander}
          brackets={current?.brackets}
          matches={current?.matches ?? null}
          loaded={shown.loaded}
          total={shown.total}
        />
      )}
    </main>
  );
}
