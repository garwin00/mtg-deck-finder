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

type Sort = "popularity" | "name" | "added";

const COLOURS = [
  { key: "W", label: "White" },
  { key: "U", label: "Blue" },
  { key: "B", label: "Black" },
  { key: "R", label: "Red" },
  { key: "G", label: "Green" },
  { key: "C", label: "Colourless" },
];

const PIP_STYLES: Record<string, string> = {
  W: "bg-[#f8f2df] text-[#3b3428]",
  U: "bg-[#9cd3f2] text-[#0e3348]",
  B: "bg-[#4b4453] text-[#e6dff0]",
  R: "bg-[#e78a72] text-[#4a1710]",
  G: "bg-[#8fc79a] text-[#12351c]",
  C: "bg-surface-2 text-muted",
};

/**
 * The commanders the collection can field. Opening one fetches its decks from
 * EDHREC and scores them — decklists are never held locally, so this is the
 * only route to them.
 */
export function CommanderList({ commanders, opening, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [colours, setColours] = useState<Set<string>>(new Set());
  const [type, setType] = useState("");
  const [sort, setSort] = useState<Sort>("popularity");

  const hasDates = useMemo(() => commanders.some((c) => c.addedAt), [commanders]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const commander of commanders) {
      for (const t of commander.types) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [commanders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = commanders.filter((commander) => {
      if (q && !commander.name.toLowerCase().includes(q)) return false;
      if (type && !commander.types.includes(type)) return false;
      if (colours.size > 0) {
        // Within the selection: a commander fits if every colour it needs is
        // picked. Colourless is its own pip so it isn't swept in by every
        // selection, being technically a subset of all of them.
        if (commander.colours === "") {
          if (!colours.has("C")) return false;
        } else if (![...commander.colours].every((c) => colours.has(c))) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "added") {
      sorted.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0) || a.name.localeCompare(b.name));
    }
    // "popularity" is the order the catalogue already arrives in.
    return sorted;
  }, [commanders, query, type, colours, sort]);

  const filtering = query !== "" || type !== "" || colours.size > 0;

  const toggleColour = (key: string) =>
    setColours((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <div className="flex items-center gap-1.5">
          {COLOURS.map(({ key, label }) => {
            const on = colours.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleColour(key)}
                aria-pressed={on}
                aria-label={label}
                title={label}
                className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold transition ${
                  PIP_STYLES[key]
                } ${on ? "ring-2 ring-accent" : "opacity-45 hover:opacity-80"}`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {types.length > 0 && (
          <label className="flex items-center gap-2 text-muted">
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-accent/60"
            >
              <option value="">Any</option>
              {types.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2 text-muted">
          Sort
          {(
            [
              ["popularity", "Popularity"],
              ["name", "A–Z"],
              ...(hasDates ? ([["added", "Newest"]] as const) : []),
            ] as [Sort, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`rounded-md border px-2.5 py-1 ${
                sort === key
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtering && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setType("");
              setColours(new Set());
            }}
            className="text-muted underline hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No commander matches those filters.</p>
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
