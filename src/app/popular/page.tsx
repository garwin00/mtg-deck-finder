"use client";

import { useEffect, useMemo } from "react";
import { PopularCommanders } from "@/components/PopularCommanders";
import { useRequireCollection } from "@/components/CollectionGate";

const MILESTONES = [10, 50, 100, 250];

export default function PopularPage() {
  const state = useRequireCollection();
  const ensurePrices = state?.ensurePrices;
  const ensurePrintings = state?.ensurePrintings;

  useEffect(() => {
    ensurePrices?.();
    ensurePrintings?.();
  }, [ensurePrices, ensurePrintings]);

  const summary = useMemo(() => {
    if (!state?.catalogue || !state.collection) return null;
    const { catalogue, collection } = state;
    return {
      commanders: catalogue.decks.length,
      decks: catalogue.decks.reduce((sum, d) => sum + d.n, 0),
      // The point of showing someone else's ranking is what it says about you.
      owned: MILESTONES.map((n) => ({
        n,
        held: catalogue.decks.slice(0, n).filter((d) => collection.owned.has(d.c)).length,
      })),
    };
  }, [state]);

  if (!state || !state.catalogue || !summary) return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Popular commanders</h1>
        <p className="mt-1 text-sm text-muted">
          {summary.commanders.toLocaleString()} commanders across{" "}
          {summary.decks.toLocaleString()} decks on EDHREC.
        </p>
        <p className="mt-1 text-sm text-muted">
          You own{" "}
          {summary.owned.map(({ n, held }, i) => (
            <span key={n}>
              {i > 0 && ", "}
              <span className="text-foreground">{held}</span> of the top {n}
            </span>
          ))}
          .
        </p>
      </header>

      <PopularCommanders
        catalogue={state.catalogue}
        index={state.index}
        collection={state.collection}
        prices={state.prices}
        printings={state.printings}
        completion={state.completion}
      />
    </main>
  );
}
