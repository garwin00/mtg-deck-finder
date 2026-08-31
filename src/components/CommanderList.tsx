"use client";

import { useMemo, useState } from "react";
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
 * fetches that deck from EDHREC and scores it — decklists are never held
 * locally, so this is the only place they are pulled.
 */
export function CommanderList({ commanders, opening, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commanders.filter((c) => c.name.toLowerCase().includes(q)) : commanders;
  }, [commanders, query]);

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your commanders</h2>
        <span className="text-xs text-muted">{commanders.length.toLocaleString()}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your commanders…"
          aria-label="Search your commanders"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted focus:bg-surface-2"
        />

        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {visible.map((commander) => {
            const busy = opening === commander.slug;
            return (
              <li key={commander.slug}>
                <button
                  type="button"
                  disabled={Boolean(opening)}
                  onClick={() => onSelect(commander)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  <ColourPips colours={commander.colours} />
                  <span className="min-w-0 flex-1 truncate">{commander.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {commander.numDecks.toLocaleString()} decks
                  </span>
                  <span className="w-4 shrink-0 text-center text-muted" aria-hidden>
                    {busy ? "…" : "→"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {visible.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">No commander matches “{query}”.</p>
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        Decklists are fetched from EDHREC when you open a commander, not stored here.
      </p>
    </section>
  );
}
