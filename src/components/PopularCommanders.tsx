"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/collection";
import Image from "next/image";
import { artCropUrl, cardImageUrl, type PrintingIndex } from "@/lib/printings";
import { formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import type { CardIndex, CommanderCatalogue } from "@/lib/types";
import { ColourFilter, ColourPips, matchesColours } from "./ColourPips";
import { HoverCard } from "./HoverCard";
import { Meter } from "./Meter";
import { buttonGhost, input, segment, segmented } from "./ui";

const PAGE_SIZE = 50;

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
      return matchesColours(row.colours, colours);
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search commanders"
          aria-label="Search commanders"
          className={`w-full sm:w-64 ${input}`}
        />

        <ColourFilter selected={colours} onToggle={toggleColour} />

        <div className={segmented} role="group" aria-label="Show">
          <button
            type="button"
            onClick={() => {
              setOwnedOnly(false);
              setPage(0);
            }}
            aria-pressed={!ownedOnly}
            className={segment(!ownedOnly)}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setOwnedOnly(true);
              setPage(0);
            }}
            aria-pressed={ownedOnly}
            className={segment(ownedOnly)}
          >
            Only ones I own
          </button>
        </div>

        <span className="ml-auto text-xs tabular-nums text-muted">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
      </div>

      <div className="mt-6 bg-sheet outline outline-1 outline-rule">
        <div className="hidden grid-cols-[3rem_5rem_minmax(0,1fr)_5rem_6rem_10rem_4rem] items-center gap-4 border-b border-ink px-4 py-2.5 text-xs font-bold text-muted md:grid">
          <span className="text-right">#</span>
          <span />
          <span>Commander</span>
          <span>Colours</span>
          <span className="text-right">Decks</span>
          <span>You</span>
          <span />
        </div>
        <ul className="divide-y divide-rule">
          {visible.map((row) => {
            const price = prices ? gbpPrice(prices, row.cardIndex) : undefined;
            const percent = completion.get(row.slug);
            const image = printings ? cardImageUrl(printings, row.cardIndex) : undefined;
            const art = printings ? artCropUrl(printings, row.cardIndex) : undefined;
            return (
              <li key={row.slug}>
                <HoverCard
                  image={image}
                  name={row.name}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-2 text-sm md:grid-cols-[3rem_5rem_minmax(0,1fr)_5rem_6rem_10rem_4rem]"
                >
                  <span className="text-right font-semibold tabular-nums text-muted">{row.rank}</span>

                  {/* Art is never dimmed for unowned rows; only the text is muted. */}
                  <span className="relative hidden aspect-[626/457] w-20 bg-wash md:block">
                    {art && (
                      <Image src={art} alt="" fill unoptimized sizes="80px" className="object-cover" />
                    )}
                  </span>

                  <div className="min-w-0">
                    {row.owned ? (
                      <Link
                        href={`/commander/${row.slug}`}
                        className="block truncate font-semibold hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="block truncate text-muted">{row.name}</span>
                    )}
                    <p className="truncate text-xs text-quiet">
                      {row.themes.slice(0, 3).join(" · ")}
                      {price !== undefined && (
                        <>
                          {row.themes.length > 0 && " · "}
                          {formatGbp(price)}
                        </>
                      )}
                    </p>
                  </div>

                  <span className="hidden md:block">
                    <ColourPips colours={row.colours} />
                  </span>

                  <span className="hidden text-right tabular-nums text-muted md:block">
                    {row.decks.toLocaleString()}
                  </span>

                  <span className="flex items-center gap-2.5 text-xs font-bold tabular-nums">
                    {row.owned ? (
                      percent !== undefined ? (
                        <>
                          <Meter percent={percent} className="hidden w-20 md:block" />
                          {Math.round(percent)}%
                        </>
                      ) : (
                        "Owned"
                      )
                    ) : (
                      <span className="font-medium text-quiet">Not owned</span>
                    )}
                  </span>

                  <a
                    href={`https://edhrec.com/commanders/${row.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden text-right text-xs text-muted underline hover:text-ink md:block"
                  >
                    EDHREC
                  </a>
                </HoverCard>
              </li>
            );
          })}
        </ul>
      </div>

      {visible.length === 0 && (
        <p className="mt-4 text-sm text-muted">No commander matches those filters.</p>
      )}

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className={buttonGhost}
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
            className={buttonGhost}
          >
            Next →
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-quiet">
        Ranking and deck counts from EDHREC. Decklists live there, and each row links across.
      </p>
    </>
  );
}
