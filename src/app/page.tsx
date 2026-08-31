"use client";

import { useMemo, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { DeckCard } from "@/components/DeckCard";
import { DeckDetail } from "@/components/DeckDetail";
import { CsvShapeError, parseCollection, type Collection } from "@/lib/collection";
import { matchPrecons, ownedCommanders, type DeckMatch } from "@/lib/match";
import type { CardIndex, PreconIndex } from "@/lib/types";

const THRESHOLDS = [0, 50, 70, 90];

export default function Home() {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [index, setIndex] = useState<CardIndex | null>(null);
  const [matches, setMatches] = useState<DeckMatch[] | null>(null);
  const [threshold, setThreshold] = useState(50);
  const [selected, setSelected] = useState<DeckMatch | null>(null);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(undefined);
    setSelected(null);
    try {
      setStatus("Loading card database…");
      const [cards, precons] = await Promise.all([
        fetch("/data/cards.json").then((r) => r.json() as Promise<CardIndex>),
        fetch("/data/precons.json").then((r) => r.json() as Promise<PreconIndex>),
      ]);
      setIndex(cards);

      setStatus(`Reading ${file.name}…`);
      const parsed = await parseCollection(file, cards);
      setCollection(parsed);

      setStatus("Matching against precons…");
      setMatches(matchPrecons(precons, cards, parsed));
      setStatus(undefined);
    } catch (err) {
      setMatches(null);
      setCollection(null);
      setError(
        err instanceof CsvShapeError
          ? err.message
          : `Couldn't read that file: ${err instanceof Error ? err.message : String(err)}`
      );
      setStatus(undefined);
    } finally {
      setBusy(false);
    }
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

      {!matches && (
        <Dropzone onFile={handleFile} busy={busy} status={status} />
      )}

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
                setCollection(null);
              }}
              className="text-sm text-muted underline hover:text-foreground"
            >
              Upload a different file
            </button>
          </div>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((match) => (
              <DeckCard key={match.deck.id} match={match} onOpen={() => setSelected(match)} />
            ))}
          </section>

          {visible.length === 0 && (
            <p className="mt-6 text-sm text-muted">
              No precon reaches {threshold}% with this collection. Try a lower threshold.
            </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
