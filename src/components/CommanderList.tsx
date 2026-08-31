"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { OwnedCommander } from "@/lib/edhrec";
import { ColourPips } from "./ColourPips";

type Props = {
  commanders: OwnedCommander[];
  /** Slug currently being fetched, if any. */
  opening?: string;
  onSelect: (commander: OwnedCommander) => void;
};

/**
 * The commanders the collection can field, most-built first. Opening one
 * fetches its decks from EDHREC and scores them — decklists are never held
 * locally, so this is the only route to them.
 */
export function CommanderList({ commanders, opening, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commanders.filter((c) => c.name.toLowerCase().includes(q)) : commanders;
  }, [commanders, query]);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Your commanders
        </h2>
        <span className="text-xs text-muted">
          {visible.length === commanders.length
            ? commanders.length.toLocaleString()
            : `${visible.length.toLocaleString()} of ${commanders.length.toLocaleString()}`}
        </span>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your commanders…"
        aria-label="Search your commanders"
        className="mt-3 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent/60"
      />

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No commander matches “{query}”.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((commander) => (
            <CommanderCard
              key={commander.slug}
              commander={commander}
              busy={opening === commander.slug}
              disabled={Boolean(opening)}
              onSelect={() => onSelect(commander)}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Decklists are fetched from EDHREC when you open a commander, not stored here.
      </p>
    </section>
  );
}

function CommanderCard({
  commander,
  busy,
  disabled,
  onSelect,
}: {
  commander: OwnedCommander;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition hover:border-accent/60 disabled:opacity-50"
    >
      <div className="relative h-24 w-full bg-surface-2">
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {commander.art && (
          <Image
            src={commander.art}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover opacity-70 transition group-hover:opacity-95"
          />
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-background/70 text-xs text-muted">
            Loading decks…
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{commander.name}</h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <ColourPips colours={commander.colours} />
          <span className="text-xs text-muted">{commander.numDecks.toLocaleString()}</span>
        </div>
      </div>
    </button>
  );
}
