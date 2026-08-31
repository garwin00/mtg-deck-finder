"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LoadState } from "@/components/LoadingPanel";
import {
  CsvShapeError,
  readRows,
  resolveCollection,
  type Collection,
  type CollectionRows,
} from "@/lib/collection";
import { fetchAverageDeck, ownedFromCatalogue, type OwnedCommander } from "@/lib/edhrec";
import { fetchJsonWithProgress, type Manifest } from "@/lib/load";
import { matchDecks, matchPrecons, type DeckMatch } from "@/lib/match";
import type { PriceIndex } from "@/lib/prices";
import type { PrintingIndex } from "@/lib/printings";
import {
  fingerprint,
  forgetCollection,
  forgetScores,
  loadCollection,
  loadScores,
  rowsFrom,
  saveCollection,
  saveScores,
} from "@/lib/persist";
import type { CardIndex, CommanderCatalogue, PreconIndex } from "@/lib/types";

/**
 * "unknown" until stored data has been looked for. Routes must wait rather than
 * redirect, or every deep link flashes back to the upload screen.
 */
export type CollectionStatus = "unknown" | "empty" | "ready";

export type CollectionState = {
  status: CollectionStatus;
  /** When the stored collection was saved, if it came from storage. */
  savedAt: number | null;
  fileName: string | null;
  collection: Collection | null;
  index: CardIndex | null;
  precons: DeckMatch[] | null;
  owned: OwnedCommander[] | null;
  /** Kept so the popularity ranking can be browsed, not just the owned subset. */
  catalogue: CommanderCatalogue | null;
  prices: PriceIndex | null;
  printings: PrintingIndex | null;
  load: LoadState | null;
  error?: string;
  busy: boolean;
  /** Commander slug -> completion against its average deck, once scored. */
  completion: Map<string, number>;
  scoring: { done: number; total: number } | null;
  /**
   * Score every owned commander. One request each, so it is started by the user
   * rather than on load.
   */
  scoreCommanders: () => void;
  handleFile: (file: File) => Promise<void>;
  reset: () => void;
  /** Clear it from this device as well as from memory. */
  forget: () => void;
  /** Both load on demand: printings whenever cards are shown, prices on a deck page. */
  ensurePrices: () => void;
  ensurePrintings: () => void;
};

const Ctx = createContext<CollectionState | null>(null);

/**
 * All collection state lives here rather than in a page, so it survives
 * navigation between the commander grid and a deck, and is written to this
 * device so it survives a refresh. It is never sent anywhere — that half of the
 * promise the UI makes still holds, and `forget` erases it.
 */
export function CollectionProvider({ children }: { children: ReactNode }) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [index, setIndex] = useState<CardIndex | null>(null);
  const [precons, setPrecons] = useState<DeckMatch[] | null>(null);
  const [owned, setOwned] = useState<OwnedCommander[] | null>(null);
  const [catalogue, setCatalogue] = useState<CommanderCatalogue | null>(null);
  const [prices, setPrices] = useState<PriceIndex | null>(null);
  const [printings, setPrintings] = useState<PrintingIndex | null>(null);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pricesRequested, setPricesRequested] = useState(false);
  const [printingsRequested, setPrintingsRequested] = useState(false);
  const [completion, setCompletion] = useState<Map<string, number>>(new Map());
  const [scoring, setScoring] = useState<{ done: number; total: number } | null>(null);
  /** Identifies which collection and card index the cached scores belong to. */
  const [scoreKey, setScoreKey] = useState<string | null>(null);
  const [status, setStatus] = useState<CollectionStatus>("unknown");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCollection(null);
    setIndex(null);
    setPrecons(null);
    setOwned(null);
    setCatalogue(null);
    setLoad(null);
    setError(undefined);
    setStatus("empty");
    setSavedAt(null);
    setFileName(null);
    setCompletion(new Map());
    setScoring(null);
    setScoreKey(null);
  }, []);

  const forget = useCallback(() => {
    forgetCollection();
    forgetScores();
    reset();
  }, [reset]);

  /**
   * EDHREC's average deck is itself built from every deck for that commander,
   * so scoring against it gives the average completion for one request rather
   * than one per theme.
   */
  const scoreCommanders = useCallback(() => {
    if (!owned || !index || !collection || scoring) return;
    const queue = owned.filter((c) => !completion.has(c.slug));
    if (queue.length === 0) return;

    setScoring({ done: 0, total: queue.length });
    let done = 0;
    const found = new Map<string, number>();

    const worker = async () => {
      for (;;) {
        const commander = queue.shift();
        if (!commander) return;
        try {
          const source = await fetchAverageDeck(
            commander,
            { label: "Average deck", numDecks: commander.numDecks },
            index
          );
          found.set(commander.slug, matchDecks([source], index, collection)[0].percent);
        } catch {
          // A commander without a published average deck stays unscored.
        }
        done++;
        // Batch the repaints; 188 individual updates would thrash the grid.
        if (done % 8 === 0 || queue.length === 0) {
          setCompletion((current) => new Map([...current, ...found]));
          setScoring({ done, total: queue.length + done });
        }
      }
    };

    Promise.all(Array.from({ length: 6 }, worker)).then(() => {
      setCompletion((current) => {
        const merged = new Map([...current, ...found]);
        if (scoreKey) saveScores(scoreKey, merged);
        return merged;
      });
      setScoring(null);
    });
  }, [owned, index, collection, completion, scoring, scoreKey]);

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

  const ensurePrintings = useCallback(() => {
    if (printingsRequested) return;
    setPrintingsRequested(true);
    fetch("/data/printings.json")
      .then((r) => (r.ok ? (r.json() as Promise<PrintingIndex>) : null))
      .then((loaded) => loaded && setPrintings(loaded))
      .catch(() => {
        // Without printings, cards render as their names.
      });
  }, [printingsRequested]);

  /**
   * Download the index, resolve the rows against it and match. Shared by a
   * fresh upload and by restoring what was stored, which differ only in where
   * the rows came from.
   */
  const hydrate = useCallback(async (parsed: CollectionRows, name: string) => {
    try {
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
      setCatalogue(catalogue);
      setOwned(ownedFromCatalogue(catalogue, cards, resolved));

      // Scores are cached against the collection and the card index together,
      // so adding cards or a weekly rebuild misses the cache and recomputes.
      const key = fingerprint(parsed, cards.generatedAt);
      setScoreKey(key);
      setCompletion(loadScores(key) ?? new Map());

      setFileName(name);
      setStatus("ready");
      setLoad(null);
    } catch (err) {
      setPrecons(null);
      setOwned(null);
      setCollection(null);
      setStatus("empty");
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

  const handleFile = useCallback(
    async (file: File) => {
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
        saveCollection(file.name, parsed);
        setSavedAt(Date.now());
        await hydrate(parsed, file.name);
      } catch (err) {
        setStatus("empty");
        setError(
          err instanceof CsvShapeError
            ? err.message
            : `Couldn't read that file: ${err instanceof Error ? err.message : String(err)}`
        );
        setLoad(null);
        setBusy(false);
      }
    },
    [hydrate]
  );

  // Reading storage is exactly what an effect is for: pulling state in from an
  // external system once, after mount, where localStorage actually exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadCollection();
      if (!stored) {
        if (!cancelled) setStatus("empty");
        return;
      }
      if (cancelled) return;
      setBusy(true);
      setSavedAt(stored.savedAt);
      setLoad({
        fileName: stored.fileName,
        cardsRead: stored.totalCards,
        received: 0,
        total: 0,
        label: "Restoring your collection…",
      });
      await hydrate(rowsFrom(stored), stored.fileName);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const value = useMemo(
    () => ({
      status,
      savedAt,
      fileName,
      collection,
      index,
      precons,
      owned,
      catalogue,
      prices,
      printings,
      load,
      error,
      busy,
      completion,
      scoring,
      scoreCommanders,
      handleFile,
      reset,
      forget,
      ensurePrices,
      ensurePrintings,
    }),
    [
      completion,
      scoring,
      scoreCommanders,
      status,
      savedAt,
      fileName,
      collection,
      index,
      precons,
      owned,
      catalogue,
      prices,
      printings,
      load,
      error,
      busy,
      handleFile,
      reset,
      forget,
      ensurePrices,
      ensurePrintings,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollection(): CollectionState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCollection must be used inside CollectionProvider");
  return value;
}
