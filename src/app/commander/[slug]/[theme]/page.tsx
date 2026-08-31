"use client";

import { use, useEffect, useState } from "react";
import { DeckView } from "@/components/DeckView";
import { useRequireCollection } from "@/components/CollectionGate";
import { fetchAverageDeck, fetchVariants } from "@/lib/edhrec";
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
  const [result, setResult] = useState<{ key: string; match?: DeckMatch; error?: string } | null>(
    null
  );
  const key = `${slug}/${theme}`;

  const commander = state?.owned?.find((c) => c.slug === slug);
  const index = state?.index;
  const collection = state?.collection;
  const ensurePrices = state?.ensurePrices;

  useEffect(() => {
    ensurePrices?.();
  }, [ensurePrices]);

  useEffect(() => {
    if (!commander || !index || !collection) return;
    let cancelled = false;

    (async () => {
      try {
        // The variant carries the label and deck count the header shows, and a
        // deep link arrives without them.
        const variants = await fetchVariants(commander);
        const variant =
          variants.find((v) => (v.theme ?? "average") === theme) ??
          (theme === "average" ? variants[0] : undefined);
        if (!variant) throw new Error(`No "${theme}" deck for this commander`);

        const source = await fetchAverageDeck(commander, variant, index);
        if (cancelled) return;
        setResult({ key, match: matchDecks([source], index, collection)[0] });
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

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      {!commander ? (
        <p className="text-sm text-muted">That commander isn&apos;t in your collection.</p>
      ) : current?.error ? (
        <p className="rounded-lg border border-[#e07a6a]/40 bg-[#e07a6a]/10 p-4 text-sm">
          Couldn&apos;t load that deck from EDHREC: {current.error}
        </p>
      ) : !current?.match ? (
        <p className="text-sm text-muted">Loading deck…</p>
      ) : (
        <DeckView
          match={current.match}
          prices={state.prices}
          backHref={`/commander/${slug}`}
          backLabel={`Back to ${commander.name}`}
        />
      )}
    </main>
  );
}
