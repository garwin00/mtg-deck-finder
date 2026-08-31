"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Collection } from "@/lib/collection";
import { fetchCardDetails, setIconUrl, type CardDetail } from "@/lib/images";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import type { CardIndex, CardRecord } from "@/lib/types";
import { ColourPips } from "./ColourPips";

/**
 * A page at a time, because images are fetched from Scryfall 75 names per
 * request — the whole collection at once would be 35 requests before anything
 * appeared, where one page is one request.
 */
const PAGE_SIZE = 60;
const NO_DETAILS = new Map<string, CardDetail>();

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

const RARITIES = ["mythic", "rare", "uncommon", "common"];
type Sort = "name" | "price" | "copies" | "added";

type Row = { cardIndex: number; card: CardRecord; copies: number; addedAt?: number };

export function CollectionGrid({
  index,
  collection,
  prices,
}: {
  index: CardIndex;
  collection: Collection;
  prices: PriceIndex | null;
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
      if (colours.size > 0) {
        // Same exact-identity rule as the commander filter.
        const identity = row.card.ci === "" ? ["C"] : [...row.card.ci];
        if (identity.length !== colours.size) return false;
        if (!identity.every((c) => colours.has(c))) return false;
      }
      return true;
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
  const pageKey = useMemo(() => visible.map((r) => r.cardIndex).join(","), [visible]);

  const [loadedDetails, setLoadedDetails] = useState<{
    key: string;
    details: Map<string, CardDetail>;
  } | null>(null);
  const details = loadedDetails?.key === pageKey ? loadedDetails.details : NO_DETAILS;

  useEffect(() => {
    if (visible.length === 0) return;
    let cancelled = false;
    fetchCardDetails(visible.map((r) => r.card.n))
      .then((loaded) => {
        if (!cancelled) setLoadedDetails({ key: pageKey, details: loaded });
      })
      .catch(() => {
        // Names still render without art.
      });
    return () => {
      cancelled = true;
    };
  }, [visible, pageKey]);

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
        placeholder="Search your collection…"
        aria-label="Search your collection"
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

        <label className="flex items-center gap-2 text-muted">
          Rarity
          <select
            value={rarity}
            onChange={(e) => {
              setRarity(e.target.value);
              setPage(0);
            }}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-accent/60"
          >
            <option value="">Any</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2 text-muted">
          Sort
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

        {(query || rarity || colours.size > 0) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRarity("");
              setColours(new Set());
              setPage(0);
            }}
            className="text-muted underline hover:text-foreground"
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
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {visible.map((row) => (
            <CollectionCard
              key={row.cardIndex}
              row={row}
              detail={details.get(row.card.n)}
              prices={prices}
            />
          ))}
        </div>
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
    </>
  );
}

function CollectionCard({
  row,
  detail,
  prices,
}: {
  row: Row;
  detail?: CardDetail;
  prices: PriceIndex | null;
}) {
  const each = prices ? gbpPrice(prices, row.cardIndex) : undefined;
  const url = prices ? cardmarketUrl(prices, row.cardIndex) : undefined;

  const body = (
    <>
      <div className="relative aspect-[488/680] w-full overflow-hidden rounded-lg bg-surface-2">
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {detail?.image && (
          <Image
            src={detail.image}
            alt={row.card.n}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        )}
        {!detail?.image && (
          <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">
            {row.card.n}
          </span>
        )}
        {row.copies > 1 && (
          <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold">
            {row.copies}×
          </span>
        )}
        {row.card.gc === 1 && (
          <span className="absolute right-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
            GC
          </span>
        )}
      </div>

      <div className="mt-1.5">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-xs font-medium" title={row.card.n}>
            {row.card.n}
          </p>
          {detail?.set && (
            <Image
              src={setIconUrl(detail.set)}
              alt=""
              width={12}
              height={12}
              unoptimized
              title={detail.setName}
              // The icons ship unfilled, so they'd be black on black.
              className="shrink-0 opacity-60 invert"
            />
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <ColourPips colours={row.card.ci} />
          <span className="ml-auto tabular-nums">
            {each === undefined ? "—" : formatGbp(each * row.copies)}
          </span>
        </div>
      </div>
    </>
  );

  if (!url) return <div>{body}</div>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
      {body}
    </a>
  );
}
