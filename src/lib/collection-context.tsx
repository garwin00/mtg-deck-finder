"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LoadState } from "@/components/LoadingPanel";
import { CsvShapeError, readRows, resolveCollection, type Collection } from "@/lib/collection";
import { ownedFromCatalogue, type OwnedCommander } from "@/lib/edhrec";
import { fetchJsonWithProgress, type Manifest } from "@/lib/load";
import { matchPrecons, type DeckMatch } from "@/lib/match";
import type { PriceIndex } from "@/lib/prices";
import type { CardIndex, CommanderCatalogue, PreconIndex } from "@/lib/types";

type CollectionState = {
  collection: Collection | null;
  index: CardIndex | null;
  precons: DeckMatch[] | null;
  owned: OwnedCommander[] | null;
  prices: PriceIndex | null;
  load: LoadState | null;
  error?: string;
  busy: boolean;
  handleFile: (file: File) => Promise<void>;
  reset: () => void;
  /** Prices are only needed on a deck page, so they load on demand. */
  ensurePrices: () => void;
};

const Ctx = createContext<CollectionState | null>(null);

/**
 * All collection state lives here rather than in a page, so it survives
 * navigation between the commander grid and a deck. Nothing is persisted: a
 * refresh drops it and the user is sent back to the upload screen, which keeps
 * the promise that the file never leaves the browser or gets stored.
 */
export function CollectionProvider({ children }: { children: ReactNode }) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [index, setIndex] = useState<CardIndex | null>(null);
  const [precons, setPrecons] = useState<DeckMatch[] | null>(null);
  const [owned, setOwned] = useState<OwnedCommander[] | null>(null);
  const [prices, setPrices] = useState<PriceIndex | null>(null);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pricesRequested, setPricesRequested] = useState(false);

  const reset = useCallback(() => {
    setCollection(null);
    setIndex(null);
    setPrecons(null);
    setOwned(null);
    setLoad(null);
    setError(undefined);
  }, []);

  const ensurePrices = useCallback(() => {
    if (pricesRequested) return;
    setPricesRequested(true);
    fetch("/data/prices.json")
      .then((r) => (r.ok ? (r.json() as Promise<PriceIndex>) : null))
      .then((loaded) => loaded && setPrices(loaded))
      .catch(() => {
        // Prices are an extra; a decklist still works without them.
      });
  }, [pricesRequested]);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(undefined);
    setPrecons(null);
    setOwned(null);
    setCollection(null);
    setLoad({ fileName: file.name, received: 0, total: 0, label: "Reading your collection…" });

    try {
      // Local and near-instant, so the card count is on screen before any
      // network work starts.
      const parsed = await readRows(file);
      setLoad((l) => l && { ...l, cardsRead: parsed.totalCards, label: "Loading card database…" });

      const manifest = (await fetch("/data/manifest.json").then((r) => r.json())) as Manifest;
      const total = (manifest.files.cards?.bytes ?? 0) + (manifest.files.precons?.bytes ?? 0);
      setLoad((l) => l && { ...l, total });

      // onBytes fires per chunk; coalesce so the bar doesn't drive a re-render
      // for every few kilobytes.
      const progress = { cards: 0, precons: 0 };
      let painted = 0;
      const track = (key: keyof typeof progress) => (received: number) => {
        progress[key] = received;
        const sum = progress.cards + progress.precons;
        if (sum - painted < 48_000 && sum < total) return;
        painted = sum;
        setLoad((l) => l && { ...l, received: sum });
      };

      const [cards, preconIndex] = await Promise.all([
        fetchJsonWithProgress<CardIndex>("/data/cards.json", track("cards")),
        fetchJsonWithProgress<PreconIndex>("/data/precons.json", track("precons")),
      ]);
      setLoad((l) => l && { ...l, received: total, label: "Matching precons…" });

      const resolved = resolveCollection(parsed, cards);
      setIndex(cards);
      setCollection(resolved);
      setPrecons(matchPrecons(preconIndex, cards, resolved));

      setLoad((l) => l && { ...l, label: "Loading commander list…" });
      const catalogue = (await fetch("/data/commanders.json").then((r) =>
        r.json()
      )) as CommanderCatalogue;
      setOwned(ownedFromCatalogue(catalogue, cards, resolved));
      setLoad(null);
    } catch (err) {
      setPrecons(null);
      setOwned(null);
      setCollection(null);
      setError(
        err instanceof CsvShapeError
          ? err.message
          : `Couldn't read that file: ${err instanceof Error ? err.message : String(err)}`
      );
      setLoad(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      collection,
      index,
      precons,
      owned,
      prices,
      load,
      error,
      busy,
      handleFile,
      reset,
      ensurePrices,
    }),
    [collection, index, precons, owned, prices, load, error, busy, handleFile, reset, ensurePrices]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollection(): CollectionState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCollection must be used inside CollectionProvider");
  return value;
}
