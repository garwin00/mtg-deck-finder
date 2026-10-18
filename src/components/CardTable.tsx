"use client";

import Image from "next/image";
import type { CardStat } from "@/lib/edhrec";
import type { DeckEntry } from "@/lib/match";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import { cardImageUrl, manaValueOf, type PrintingIndex } from "@/lib/printings";
import { CATEGORY_LABELS, CATEGORY_ORDER, type CardIndex, type Category } from "@/lib/types";
import { HoverCard } from "./HoverCard";

/** Above this, a card is specific to the commander rather than a general staple. */
const SIGNATURE_SYNERGY = 0.25;

/** Card width in the piles; each card behind the front one shows this much of its top. */
const CARD_WIDTH = 140;
const CARD_HEIGHT = Math.round((CARD_WIDTH * 680) / 488);
const PEEK = 30;

type Basic = { cardIndex: number; needed: number };

/**
 * A deck dealt into piles by role, the way it gets sorted on a table. Owned
 * cards are the real card; missing ones are a proxy slip, so missing art is
 * never altered because it is never shown.
 */
export function CardTable({
  entries,
  basics = [],
  index,
  printings,
  prices,
  stats,
  notes,
  keepOrder = false,
}: {
  entries: DeckEntry[];
  basics?: Basic[];
  index: CardIndex;
  printings: PrintingIndex | null;
  prices: PriceIndex | null;
  stats?: Map<string, CardStat>;
  /** Card index -> why it's here, shown when hovering a card. */
  notes?: Map<number, string>;
  /** Keep the given order within a pile instead of owned first, then by mana value. */
  keepOrder?: boolean;
}) {
  const piles = new Map<Category, DeckEntry[]>();
  for (const entry of entries) {
    const pile = piles.get(entry.category) ?? [];
    pile.push(entry);
    piles.set(entry.category, pile);
  }
  if (basics.length > 0 && !piles.has("land")) piles.set("land", []);

  const mv = (e: DeckEntry) => (printings ? (manaValueOf(printings, e.cardIndex) ?? 0) : 0);
  const owns = (e: DeckEntry) => e.have >= e.needed;

  return (
    // Wraps rather than scrolls, so no pile is ever hidden off the edge.
    <div className="flex flex-wrap gap-x-4 gap-y-10 pb-3 pt-6">
      {CATEGORY_ORDER.filter((c) => piles.has(c)).map((category) => {
        const pile = piles.get(category) ?? [];
        const ordered = keepOrder
          ? pile
          : [...pile].sort(
              (a, b) => Number(owns(b)) - Number(owns(a)) || mv(a) - mv(b) || a.card.n.localeCompare(b.card.n)
            );
        const pileBasics = category === "land" ? basics : [];
        const count =
          pile.reduce((s, e) => s + e.needed, 0) + pileBasics.reduce((s, b) => s + b.needed, 0);
        const owned = pile.filter(owns).reduce((s, e) => s + e.needed, 0);
        return (
          <section key={category} className="shrink-0" style={{ width: CARD_WIDTH }}>
            <h3 className="mb-2.5 flex justify-between text-xs font-bold">
              <span>{CATEGORY_LABELS[category]}</span>
              <span className="font-medium tabular-nums text-muted">
                {pileBasics.length > 0 ? count : `${owned}/${count}`}
              </span>
            </h3>
            <div>
              {ordered.map((entry, i) => (
                <PileCard
                  key={entry.cardIndex}
                  first={i === 0}
                  entry={entry}
                  printings={printings}
                  prices={prices}
                  note={notes?.get(entry.cardIndex) ?? usage(stats?.get(entry.card.n))}
                />
              ))}
              {pileBasics.map((basic, i) => (
                <BasicCard
                  key={basic.cardIndex}
                  first={ordered.length === 0 && i === 0}
                  name={index.cards[basic.cardIndex]?.n ?? ""}
                  cardIndex={basic.cardIndex}
                  needed={basic.needed}
                  printings={printings}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function usage(stat?: CardStat): string | undefined {
  if (!stat) return undefined;
  const base = `In ${Math.round(stat.inclusion * 100)}% of decks for this commander`;
  return stat.synergy >= SIGNATURE_SYNERGY
    ? `${base}, and ${Math.round(stat.synergy * 100)}% more common here than in decks generally`
    : base;
}

/** Stacks each card so only the top of the ones behind it shows; hovering lifts it clear. */
const stackStyle = (first: boolean) => ({
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  marginTop: first ? 0 : PEEK - CARD_HEIGHT,
});

function PileCard({
  entry,
  first,
  printings,
  prices,
  note,
}: {
  entry: DeckEntry;
  first: boolean;
  printings: PrintingIndex | null;
  prices: PriceIndex | null;
  note?: string;
}) {
  const image = printings ? cardImageUrl(printings, entry.cardIndex) : undefined;
  const missing = entry.needed - entry.have;
  const title = note ? `${entry.card.n}\n${note}` : entry.card.n;

  if (missing <= 0) {
    return (
      <HoverCard image={image} name={entry.card.n}>
        <div
          className="relative transition-transform duration-150 hover:z-10 hover:-translate-y-3.5"
          style={stackStyle(first)}
          title={title}
        >
          {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
          {image ? (
            <Image
              src={image}
              alt={entry.card.n}
              fill
              unoptimized
              loading="lazy"
              sizes={`${CARD_WIDTH}px`}
              className="rounded-[6px] object-cover shadow-[0_-2px_6px_rgba(0,0,0,0.16)]"
            />
          ) : (
            <span className="grid h-full place-items-center rounded-[6px] bg-wash p-2 text-center text-xs text-muted">
              {entry.card.n}
            </span>
          )}
          {entry.needed > 1 && <Count>{entry.needed}×</Count>}
          {entry.card.gc === 1 && (
            <span className="absolute right-1.5 top-7 rounded-[2px] bg-ink px-1 text-[10px] font-bold text-sheet">
              GC
            </span>
          )}
        </div>
      </HoverCard>
    );
  }

  const price = prices ? gbpPrice(prices, entry.cardIndex) : undefined;
  const url = prices ? cardmarketUrl(prices, entry.cardIndex) : undefined;
  const mv = printings ? manaValueOf(printings, entry.cardIndex) : undefined;
  const slip = (
    <div className="crop-marks relative flex h-full flex-col bg-sheet px-2 pb-1.5 pt-2 shadow-[0_-2px_6px_rgba(0,0,0,0.1)] outline outline-1 outline-rule">
      <div className="flex justify-between gap-1.5 px-[3px] pt-[3px] text-[11px] font-bold leading-tight">
        <span className="truncate">{entry.card.n.split("//")[0].trim()}</span>
        <span className="shrink-0 tabular-nums text-signal">
          {price === undefined ? "–" : formatGbp(price * missing)}
        </span>
      </div>
      {/* The hatched panel stands in for the art a proxy doesn't have. */}
      <div className="mx-[3px] my-2 grid flex-1 place-items-center bg-[repeating-linear-gradient(135deg,var(--sheet)_0_5px,var(--wash)_5px_6px)] text-[11px] font-bold uppercase tracking-[0.08em] text-quiet">
        {entry.have > 0 ? `${entry.have} of ${entry.needed} owned` : "Proxy"}
      </div>
      <div className="flex justify-between px-[3px] text-[9px] text-quiet">
        <span>{entry.card.gc === 1 ? "Game Changer" : entry.card.r}</span>
        {mv !== undefined && <span>MV {mv}</span>}
      </div>
    </div>
  );

  return (
    <HoverCard image={image} name={entry.card.n}>
      <div
        className="relative transition-transform duration-150 hover:z-10 hover:-translate-y-3.5"
        style={stackStyle(first)}
        title={title}
      >
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full">
            {slip}
          </a>
        ) : (
          slip
        )}
      </div>
    </HoverCard>
  );
}

/**
 * A basic land, with its count. No owned or missing state: basics sit outside
 * every percentage, and marking them either way would imply they were scored.
 */
function BasicCard({
  name,
  cardIndex,
  needed,
  first,
  printings,
}: {
  name: string;
  cardIndex: number;
  needed: number;
  first: boolean;
  printings: PrintingIndex | null;
}) {
  const image = printings ? cardImageUrl(printings, cardIndex) : undefined;
  return (
    <div
      className="relative transition-transform duration-150 hover:z-10 hover:-translate-y-3.5"
      style={stackStyle(first)}
      title={`${needed} ${name}`}
    >
      {image ? (
        <Image
          src={image}
          alt={name}
          fill
          unoptimized
          loading="lazy"
          sizes={`${CARD_WIDTH}px`}
          className="rounded-[6px] object-cover shadow-[0_-2px_6px_rgba(0,0,0,0.16)]"
        />
      ) : (
        <span className="grid h-full place-items-center rounded-[6px] bg-wash text-xs text-muted">{name}</span>
      )}
      <Count>×{needed}</Count>
    </div>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute bottom-2 right-2 rounded-[2px] bg-ink px-1.5 py-0.5 text-xs font-bold tabular-nums text-sheet">
      {children}
    </span>
  );
}
