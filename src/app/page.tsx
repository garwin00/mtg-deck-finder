"use client";

import { useState } from "react";
import { CommanderList } from "@/components/CommanderList";
import { DeckCard } from "@/components/DeckCard";
import { Dropzone } from "@/components/Dropzone";
import { LoadingPanel } from "@/components/LoadingPanel";
import { useCollection } from "@/lib/collection-context";

const THRESHOLDS = [0, 50, 70, 90];

export default function Home() {
  const {
    collection,
    precons,
    owned,
    load,
    error,
    busy,
    savedAt,
    completion,
    scoring,
    scoreCommanders,
    handleFile,
    reset,
    forget,
  } = useCollection();
  const [threshold, setThreshold] = useState(50);
  const [showPrecons, setShowPrecons] = useState(false);

  const visible = (precons ?? []).filter((m) => m.percent >= threshold);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Deck Finder</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Upload a collection export and find out which Commander decks you are closest to
            already owning — ranked by completion, with a list of what is missing.
          </p>
        </div>
        {collection && (
          <div className="shrink-0 text-right">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-accent/60 hover:text-foreground"
              >
                Upload a different file
              </button>
              <button
                type="button"
                onClick={forget}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-[#e07a6a]/60 hover:text-foreground"
              >
                Forget
              </button>
            </div>
            {savedAt && (
              // Stored collections go stale as cards are bought; saying when
              // makes that visible rather than quietly wrong.
              <p className="mt-1.5 text-xs text-muted">
                Saved on this device{" "}
                {new Date(savedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            )}
          </div>
        )}
      </header>

      {load && <LoadingPanel state={load} />}

      {!collection && !load && <Dropzone onFile={handleFile} busy={busy} />}

      {error && (
        <p className="mt-4 rounded-lg border border-[#e07a6a]/40 bg-[#e07a6a]/10 p-4 text-sm">
          {error}
        </p>
      )}

      {collection && precons && (
        <>
          {owned && (
            <CommanderList
              commanders={owned}
              completion={completion}
              scoring={scoring}
              onScore={scoreCommanders}
            />
          )}

          <section className="mt-10 border-t border-border pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Official precons
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {precons.filter((m) => m.percent >= 90).length} of {precons.length}{" "}
                  near-complete — mostly ones you already own.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrecons((open) => !open)}
                className="rounded-md border border-border px-3 py-1 text-sm text-muted hover:text-foreground"
              >
                {showPrecons ? "Hide" : "Show"}
              </button>
            </div>

            {showPrecons && (
              <>
                <div className="mt-4 flex items-center gap-2 text-sm">
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

                {visible.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">
                    No precon reaches {threshold}% with this collection.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((match) => (
                      <DeckCard
                        key={match.deck.id}
                        match={match}
                        href={`/precon/${encodeURIComponent(match.deck.id)}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <footer className="mt-10 space-y-1 text-xs text-muted">
            <p>
              Basic lands are excluded from both sides of every percentage. Card data from Scryfall,
              decklists from MTGJSON and EDHREC. Bracket estimates count Game Changers only. Card
              images and card names are copyright Wizards of the Coast; artists are credited on
              each image.
            </p>
            {collection.unknown.length > 0 && (
              <p>
                {collection.unknown.length.toLocaleString()} name
                {collection.unknown.length === 1 ? "" : "s"} in your file didn&apos;t match a card in
                the index — mostly tokens, art cards and cards banned in Commander.
              </p>
            )}
          </footer>
        </>
      )}
    </main>
  );
}
