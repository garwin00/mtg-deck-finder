"use client";

import { useMemo, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { DeckCard } from "@/components/DeckCard";
import { DeckDetail } from "@/components/DeckDetail";
import { LoadingPanel, type LoadState } from "@/components/LoadingPanel";
import { CsvShapeError, readRows, resolveCollection, type Collection } from "@/lib/collection";
import { CommanderList } from "@/components/CommanderList";
import { CommanderDecks } from "@/components/CommanderDecks";
import {
  fetchAverageDeck,
  fetchVariants,
  ownedFromCatalogue,
  type OwnedCommander,
} from "@/lib/edhrec";
import { fetchJsonWithProgress, type Manifest } from "@/lib/load";
import { matchDecks, matchPrecons, ownedCommanders, type DeckMatch } from "@/lib/match";
import type { CardIndex, CommanderCatalogue, PreconIndex } from "@/lib/types";

const THRESHOLDS = [0, 50, 70, 90];

export default function Home() {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [index, setIndex] = useState<CardIndex | null>(null);
  const [matches, setMatches] = useState<DeckMatch[] | null>(null);
  const [owned, setOwned] = useState<OwnedCommander[] | null>(null);
  const [opening, setOpening] = useState<string>();
  const [commander, setCommander] = useState<OwnedCommander | null>(null);
  const [deckMatches, setDeckMatches] = useState<DeckMatch[] | null>(null);
  const [deckProgress, setDeckProgress] = useState({ loaded: 0, total: 0 });
  const [threshold, setThreshold] = useState(50);
  const [selected, setSelected] = useState<DeckMatch | null>(null);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(undefined);
    setSelected(null);
    setMatches(null);
    setOwned(null);
    setCommander(null);
    setDeckMatches(null);
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

      const [cards, precons] = await Promise.all([
        fetchJsonWithProgress<CardIndex>("/data/cards.json", track("cards")),
        fetchJsonWithProgress<PreconIndex>("/data/precons.json", track("precons")),
      ]);
      setLoad((l) => l && { ...l, received: total, label: "Matching precons…" });

      const resolved = resolveCollection(parsed, cards);
      setIndex(cards);
      setCollection(resolved);
      setMatches(matchPrecons(precons, cards, resolved));

      // Precon results are on screen from here. The catalogue is just slugs and
      // deck counts — decklists come from EDHREC only when one is opened.
      setLoad((l) => l && { ...l, label: "Loading commander list…" });
      const catalogue = (await fetch("/data/commanders.json").then((r) =>
        r.json()
      )) as CommanderCatalogue;
      setOwned(ownedFromCatalogue(catalogue, cards, resolved));
      setLoad(null);
    } catch (err) {
      setMatches(null);
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
  };

  /**
   * Open a commander: pull its deck variants from EDHREC and score every one,
   * so the list that appears is ranked by how close the collection already is.
   */
  const handleOpenCommander = async (picked: OwnedCommander) => {
    if (!index || !collection) return;
    setOpening(picked.slug);
    setError(undefined);
    setDeckMatches(null);
    try {
      const variants = await fetchVariants(picked);
      setCommander(picked);
      setDeckProgress({ loaded: 0, total: variants.length });

      const sources = [];
      let loaded = 0;
      for (const variant of variants) {
        try {
          sources.push(await fetchAverageDeck(picked, variant, index));
        } catch {
          // A theme without a published average deck just isn't offered.
        }
        setDeckProgress({ loaded: ++loaded, total: variants.length });
      }
      if (sources.length === 0) throw new Error("EDHREC has no decklist for this commander");
      setDeckMatches(matchDecks(sources, index, collection));
    } catch (err) {
      setCommander(null);
      setError(
        `Couldn't load ${picked.name} from EDHREC: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setOpening(undefined);
    }
  };

  const backToCommanders = () => {
    setCommander(null);
    setDeckMatches(null);
  };

  const commanders = useMemo(
    () => (index && collection ? ownedCommanders(index, collection) : []),
    [index, collection]
  );

  const visible = useMemo(
    () => (matches ?? []).filter((m) => m.percent >= threshold),
    [matches, threshold]
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Deck Finder</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Upload a collection export and find out which official Commander precons you are closest
          to already owning — ranked by completion, with a list of what is missing.
        </p>
      </header>

      {load && <LoadingPanel state={load} />}

      {!matches && !load && <Dropzone onFile={handleFile} busy={busy} />}

      {error && (
        <p className="mt-4 rounded-lg border border-[#e07a6a]/40 bg-[#e07a6a]/10 p-4 text-sm">
          {error}
        </p>
      )}

      {collection && matches && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Cards in collection" value={collection.totalCards.toLocaleString()} />
            <Stat label="Distinct cards matched" value={collection.distinctMatched.toLocaleString()} />
            <Stat label="Legal commanders owned" value={commanders.length.toLocaleString()} />
            <Stat
              label="Precons over 50%"
              value={matches.filter((m) => m.percent >= 50).length.toLocaleString()}
            />
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Show precons at least</span>
              {THRESHOLDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setThreshold(value)}
                  className={`rounded-md border px-2.5 py-1 ${
                    threshold === value
                      ? "border-accent text-accent"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setMatches(null);
                setOwned(null);
                setCommander(null);
                setDeckMatches(null);
                setCollection(null);
                setIndex(null);
              }}
              className="text-sm text-muted underline hover:text-foreground"
            >
              Upload a different file
            </button>
          </div>

          <DeckSection
            title="Precons"
            matches={visible}
            empty={`No precon reaches ${threshold}% with this collection.`}
            onOpen={setSelected}
          />

          {owned && !commander && (
            <CommanderList
              commanders={owned}
              opening={opening}
              onSelect={handleOpenCommander}
            />
          )}

          {commander && (
            <CommanderDecks
              commander={commander}
              matches={deckMatches}
              loaded={deckProgress.loaded}
              total={deckProgress.total}
              onOpen={setSelected}
              onBack={backToCommanders}
            />
          )}

          <footer className="mt-10 space-y-1 text-xs text-muted">
            <p>
              Basic lands are excluded from both sides of every percentage. Card data from Scryfall,
              decklists from MTGJSON. Bracket estimates count Game Changers only.
            </p>
            {collection.unknown.length > 0 && (
              <p>
                {collection.unknown.length.toLocaleString()} name
                {collection.unknown.length === 1 ? "" : "s"} in your file didn&apos;t match a card in
                the index — mostly tokens, art cards and cards no precon uses.
              </p>
            )}
          </footer>
        </>
      )}

      {selected && <DeckDetail match={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

function DeckSection({
  title,
  matches,
  empty,
  onOpen,
}: {
  title: string;
  matches: DeckMatch[];
  empty: string;
  onOpen: (match: DeckMatch) => void;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        <span className="text-xs text-muted">{matches.length}</span>
      </div>
      {matches.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <DeckCard key={`${match.deck.kind}:${match.deck.id}`} match={match} onOpen={() => onOpen(match)} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
