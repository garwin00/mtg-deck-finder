"use client";

import { useEffect, useState } from "react";
import { CommanderList } from "@/components/CommanderList";
import { DeckCard } from "@/components/DeckCard";
import { Dropzone } from "@/components/Dropzone";
import { LoadingPanel } from "@/components/LoadingPanel";
import { useCollection } from "@/lib/collection-context";
import { buttonGhost, errorBox, lede, pageTitle, segment, segmented } from "@/components/ui";

const THRESHOLDS = [0, 50, 70, 90];

export default function Home() {
  const {
    collection,
    precons,
    owned,
    load,
    error,
    busy,
    completion,
    scoring,
    scoreCommanders,
    printings,
    handleFile,
    ensurePrintings,
  } = useCollection();

  // Only once there is something to hover; this never delays the upload path.
  useEffect(() => {
    if (collection) ensurePrintings();
  }, [collection, ensurePrintings]);
  const [threshold, setThreshold] = useState(50);
  const [showPrecons, setShowPrecons] = useState(false);

  const visible = (precons ?? []).filter((m) => m.percent >= threshold);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      {/* The collection's details and its Replace and Forget live in the header. */}
      {!collection && (
        <header className="mb-10">
          <h1 className={pageTitle}>Which Commander decks are you closest to?</h1>
          <p className={lede}>
            Drop a collection export and see every deck your cards already go a long way towards,
            with what&apos;s missing and what it costs.
          </p>
        </header>
      )}

      {load && <LoadingPanel state={load} />}

      {!collection && !load && <Dropzone onFile={handleFile} busy={busy} />}

      {error && <p className={`mt-4 ${errorBox}`}>{error}</p>}

      {collection && precons && (
        <>
          {owned && (
            <CommanderList
              commanders={owned}
              printings={printings}
              completion={completion}
              scoring={scoring}
              onScore={scoreCommanders}
            />
          )}

          <section className="mt-14 border-t border-ink pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Official precons</h2>
                <p className="text-sm text-muted">
                  {precons.filter((m) => m.percent >= 90).length} of {precons.length}{" "}
                  near-complete, mostly ones you already own.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrecons((open) => !open)}
                className={buttonGhost}
              >
                {showPrecons ? "Hide" : "Show"}
              </button>
            </div>

            {showPrecons && (
              <>
                <div className="mt-5 flex items-center gap-3 text-sm">
                  <span className="text-muted">At least</span>
                  <div className={segmented}>
                    {THRESHOLDS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setThreshold(value)}
                        className={segment(threshold === value)}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>

                {visible.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">
                    No precon reaches {threshold}% with this collection.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

          <footer className="mt-14 max-w-3xl space-y-1 text-xs text-quiet">
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
