"use client";

import { useEffect, useMemo } from "react";
import { CollectionGrid } from "@/components/CollectionGrid";
import { useRequireCollection } from "@/components/CollectionGate";
import { formatGbp, gbpPrice } from "@/lib/prices";
import { lede, pageTitle } from "@/components/ui";

export default function CollectionPage() {
  const state = useRequireCollection();
  const ensurePrices = state?.ensurePrices;
  const ensurePrintings = state?.ensurePrintings;

  useEffect(() => {
    ensurePrices?.();
    ensurePrintings?.();
  }, [ensurePrices, ensurePrintings]);

  const summary = useMemo(() => {
    if (!state?.collection || !state.index) return null;
    const { collection, index, prices } = state;
    let copies = 0;
    let value = 0;
    let unpriced = 0;
    for (const [cardIndex, quantity] of collection.owned) {
      if (!index.cards[cardIndex]) continue;
      copies += quantity;
      const each = prices ? gbpPrice(prices, cardIndex) : undefined;
      if (each === undefined) unpriced += quantity;
      else value += each * quantity;
    }
    return { distinct: collection.owned.size, copies, value, unpriced, priced: Boolean(prices) };
  }, [state]);

  if (!state || !state.index || !state.collection || !summary) return null;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <header className="mb-8">
        <h1 className={pageTitle}>Your collection</h1>
        <p className={lede}>
          <span className="font-semibold text-ink">{summary.distinct.toLocaleString()}</span> distinct
          cards, {summary.copies.toLocaleString()} in total
          {summary.priced && (
            <>
              , worth about <span className="font-semibold text-ink">{formatGbp(summary.value)}</span>
            </>
          )}
          .
        </p>
        {summary.priced && (
          <p className="mt-1 max-w-2xl text-xs text-quiet">
            Value is the cheapest buyable printing of each card on Cardmarket, converted at the ECB
            rate, not what your actual printings are worth.
            {summary.unpriced > 0 && ` ${summary.unpriced} copies have no listed price.`}
          </p>
        )}
        {state.collection.unknown.length > 0 && (
          <p className="mt-1 max-w-2xl text-xs text-quiet">
            {state.collection.unknown.length.toLocaleString()} names in your file aren&apos;t shown:
            tokens, art cards and cards banned in Commander.
          </p>
        )}
      </header>

      <CollectionGrid
        index={state.index}
        collection={state.collection}
        prices={state.prices}
        printings={state.printings}
      />
    </main>
  );
}
