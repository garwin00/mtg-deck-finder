"use client";

import { use, useEffect } from "react";
import { DeckView } from "@/components/DeckView";
import { useRequireCollection } from "@/components/CollectionGate";

export default function PreconPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useRequireCollection();
  const ensurePrices = state?.ensurePrices;

  useEffect(() => {
    ensurePrices?.();
  }, [ensurePrices]);

  if (!state) return null;
  const match = state.precons?.find((m) => m.deck.id === decodeURIComponent(id));

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      {!match ? (
        <p className="text-sm text-muted">That precon isn&apos;t in the index.</p>
      ) : (
        <DeckView match={match} prices={state.prices} backHref="/" backLabel="Back to your decks" />
      )}
    </main>
  );
}
