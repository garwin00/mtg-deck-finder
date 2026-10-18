"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Collection } from "@/lib/collection";
import { cardImageUrl, setCodeOf, setIconUrl, type PrintingIndex } from "@/lib/printings";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import type { CardIndex, CardRecord } from "@/lib/types";
import { ColourFilter, ColourPips, matchesColours } from "./ColourPips";
import { HoverCard } from "./HoverCard";
import { buttonGhost, input, segment, segmented, select } from "./ui";

/** A page at a time: 2,555 cards is a lot of image elements to mount at once. */
const PAGE_SIZE = 60;

const RARITIES = ["mythic", "rare", "uncommon", "common"];
type Sort = "name" | "price" | "copies" | "added";

type Row = { cardIndex: number; card: CardRecord; copies: number; addedAt?: number };

export function CollectionGrid({
  index,
  collection,
  prices,
  printings,
}: {
  index: CardIndex;
  collection: Collection;
  prices: PriceIndex | null;
  printings: PrintingIndex | null;
}) {
  const [query, setQuery] = useState("");
  const [colours, setColours] = useState<Set<string>>(new Set());
  const [rarity, setRarity] = useState("");
  const [sort, setSort] = useState<Sort>("price");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const [cardIndex, copies] of collection.owned) {
      const card = index.cards[cardIndex];
      if (card) out.push({ cardIndex, card, copies, addedAt: collection.addedAt.get(cardIndex) });
    }
    return out;
  }, [index, collection]);

  const hasDates = useMemo(() => rows.some((r) => r.addedAt), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kept = rows.filter((row) => {
      if (q && !row.card.n.toLowerCase().includes(q)) return false;
      if (rarity && row.card.r !== rarity) return false;
      return matchesColours(row.card.ci, colours);
    });

    const priceOf = (row: Row) => (prices ? (gbpPrice(prices, row.cardIndex) ?? -1) : 0);
    const sorted = [...kept];
    if (sort === "name") sorted.sort((a, b) => a.card.n.localeCompare(b.card.n));
    else if (sort === "copies") {
      sorted.sort((a, b) => b.copies - a.copies || a.card.n.localeCompare(b.card.n));
    } else if (sort === "added") {
      sorted.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0) || a.card.n.localeCompare(b.card.n));
    } else sorted.sort((a, b) => priceOf(b) - priceOf(a) || a.card.n.localeCompare(b.card.n));
    return sorted;
  }, [rows, query, rarity, colours, sort, prices]);

  const pages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const current = Math.min(page, pages - 1);
  // Memoised so the image effect can depend on it honestly: recomputing the
  // slice every render would refetch the page's art on every keystroke.
  const visible = useMemo(
    () => filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE),
    [filtered, current]
  );


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
          placeholder="Search your cards"
          aria-label="Search your collection"
          className={`w-full sm:w-64 ${input}`}
        />

        <ColourFilter selected={colours} onToggle={toggleColour} />

        <label className="flex items-center gap-2 text-muted">
          Rarity
          <select
            value={rarity}
            onChange={(e) => {
              setRarity(e.target.value);
              setPage(0);
            }}
            className={select}
          >
            <option value="">Any</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <div className={segmented} role="group" aria-label="Sort">
          {(
            [
              ["price", "Value"],
              ["copies", "Copies"],
              ["name", "A–Z"],
              ...(hasDates ? ([["added", "Newest"]] as const) : []),
            ] as [Sort, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSort(key);
                setPage(0);
              }}
              aria-pressed={sort === key}
              className={segment(sort === key)}
            >
              {label}
            </button>
          ))}
        </div>

        {(query || rarity || colours.size > 0) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRarity("");
              setColours(new Set());
              setPage(0);
            }}
            className="text-muted underline hover:text-ink"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-muted">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} cards
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing in your collection matches those filters.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((row) => (
            <CollectionCard
              key={row.cardIndex}
              row={row}
              printings={printings}
              prices={prices}
            />
          ))}
        </div>
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
    </>
  );
}

function CollectionCard({
  row,
  printings,
  prices,
}: {
  row: Row;
  printings: PrintingIndex | null;
  prices: PriceIndex | null;
}) {
  const each = prices ? gbpPrice(prices, row.cardIndex) : undefined;
  const url = prices ? cardmarketUrl(prices, row.cardIndex) : undefined;
  const image = printings ? cardImageUrl(printings, row.cardIndex) : undefined;
  const set = printings ? setCodeOf(printings, row.cardIndex) : undefined;

  const body = (
    <>
      <div className="relative aspect-[488/680] w-full overflow-hidden rounded-[6px] bg-wash shadow-[0_2px_6px_rgba(0,0,0,0.14)]">
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {image && (
          <Image
            src={image}
            alt={row.card.n}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        )}
        {!image && (
          <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">
            {row.card.n}
          </span>
        )}
        {row.copies > 1 && (
          <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-ink px-1.5 py-0.5 text-[11px] font-bold text-sheet">
            {row.copies}×
          </span>
        )}
        {row.card.gc === 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-[2px] bg-ink px-1 text-[10px] font-bold text-sheet">
            GC
          </span>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold" title={row.card.n}>
            {row.card.n}
          </p>
          {set && (
            <Image
              src={setIconUrl(set)}
              alt=""
              width={12}
              height={12}
              unoptimized
              title={set.toUpperCase()}
              // Both dimensions are set because Tailwind's preflight applies
              // height:auto to images, which Next flags as a broken aspect
              // ratio.
              className="h-3 w-3 shrink-0 opacity-60"
            />
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <ColourPips colours={row.card.ci} size={13} />
          <span className="ml-auto tabular-nums">
            {each === undefined ? "–" : formatGbp(each * row.copies)}
          </span>
        </div>
      </div>
    </>
  );

  const wrapped = url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {body}
    </a>
  ) : (
    <div>{body}</div>
  );
  return (
    <HoverCard image={image} name={row.card.n}>
      {wrapped}
    </HoverCard>
  );
}
