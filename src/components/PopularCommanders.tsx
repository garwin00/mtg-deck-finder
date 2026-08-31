"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/collection";
import { cardImageUrl, type PrintingIndex } from "@/lib/printings";
import { formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import type { CardIndex, CommanderCatalogue } from "@/lib/types";
import { ColourPips } from "./ColourPips";
import { HoverCard } from "./HoverCard";

const PAGE_SIZE = 50;

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

type Row = {
  rank: number;
  slug: string;
  cardIndex: number;
  name: string;
  colours: string;
  decks: number;
  themes: string[];
  owned: boolean;
};

/**
 * EDHREC's ranking, with ownership and completion laid over it — which is the
 * only reason to browse it here rather than on EDHREC. Every row links out to
 * them for the decklists themselves.
 */
export function PopularCommanders({
  catalogue,
  index,
  collection,
  prices,
  printings,
  completion,
}: {
  catalogue: CommanderCatalogue;
  index: CardIndex;
  collection: Collection;
  prices: PriceIndex | null;
  printings: PrintingIndex | null;
  completion: Map<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [colours, setColours] = useState<Set<string>>(new Set());
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [page, setPage] = useState(0);

  const rows = useMemo<Row[]>(
    () =>
      catalogue.decks.flatMap((entry, i) => {
        const card = index.cards[entry.c];
        if (!card) return [];
        return [
          {
            rank: i + 1,
            slug: entry.s,
            cardIndex: entry.c,
            name: card.n,
            colours: card.ci,
            decks: entry.n,
            themes: [
              ...(entry.t ?? []).map((t) => catalogue.tribes[t]?.l),
              ...(entry.a ?? []).map((a) => catalogue.archetypes[a]?.l),
            ].filter((l): l is string => Boolean(l)),
            owned: collection.owned.has(entry.c),
          },
        ];
      }),
    [catalogue, index, collection]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (ownedOnly && !row.owned) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      if (colours.size > 0) {
        const identity = row.colours === "" ? ["C"] : [...row.colours];
        if (identity.length !== colours.size) return false;
        if (!identity.every((c) => colours.has(c))) return false;
      }
      return true;
    });
  }, [rows, query, colours, ownedOnly]);

  const pages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const toggleColour = (key: string) => {
    setPage(0);
    setColours((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder="Search commanders…"
        aria-label="Search commanders"
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent/60"
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

        <button
          type="button"
          onClick={() => {
            setOwnedOnly((v) => !v);
            setPage(0);
          }}
          aria-pressed={ownedOnly}
          className={`rounded-md border px-2.5 py-1 ${
            ownedOnly
              ? "border-accent text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          Only ones I own
        </button>

        <span className="ml-auto text-xs text-muted">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {visible.map((row) => {
          const price = prices ? gbpPrice(prices, row.cardIndex) : undefined;
          const percent = completion.get(row.slug);
          const image = printings ? cardImageUrl(printings, row.cardIndex) : undefined;
          return (
            <li key={row.slug}>
              <HoverCard
                image={image}
                name={row.name}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                  {row.rank}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {row.owned ? (
                      <Link
                        href={`/commander/${row.slug}`}
                        className="truncate font-medium hover:text-accent hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="truncate text-muted">{row.name}</span>
                    )}
                    <ColourPips colours={row.colours} />
                    {row.owned && (
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-[#7bd88f]">
                        owned
                      </span>
                    )}
                  </div>
                  {row.themes.length > 0 && (
                    <p className="truncate text-[11px] text-muted">
                      {row.themes.slice(0, 4).join(" · ")}
                    </p>
                  )}
                </div>

                {percent !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {Math.round(percent)}%
                  </span>
                )}
                {price !== undefined && (
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted">
                    {formatGbp(price)}
                  </span>
                )}
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                  {row.decks.toLocaleString()}
                </span>
                <a
                  href={`https://edhrec.com/commanders/${row.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-muted underline hover:text-foreground"
                >
                  EDHREC
                </a>
              </HoverCard>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="mt-4 text-sm text-muted">No commander matches those filters.</p>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="rounded-md border border-border px-3 py-1 text-muted hover:text-foreground disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-muted">
            Page {current + 1} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
            className="rounded-md border border-border px-3 py-1 text-muted hover:text-foreground disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Ranking and deck counts from EDHREC. Decklists live there — each row links across.
      </p>
    </>
  );
}
