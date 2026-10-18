"use client";

import Image from "next/image";
import type { CardStat } from "@/lib/edhrec";
import type { DeckEntry } from "@/lib/match";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import { cardImageUrl, setCodeOf, setIconUrl, type PrintingIndex } from "@/lib/printings";
import type { CardIndex } from "@/lib/types";
import { HoverCard } from "./HoverCard";

/** Above this, a card is specific to the commander rather than a general staple. */
export const SIGNATURE_SYNERGY = 0.25;

/** A titled grid of card images: one category of a deck, with its count. */
export function CardGroup({
  title,
  entries,
  printings,
  prices,
  stats,
  basics,
  notes,
  index,
}: {
  title: string;
  entries: DeckEntry[];
  printings: PrintingIndex | null;
  prices: PriceIndex | null;
  stats?: Map<string, CardStat>;
  basics?: { cardIndex: number; needed: number }[];
  /** Card index -> a line shown in place of the owned/missing state. */
  notes?: Map<number, string>;
  index: CardIndex;
}) {
  const count =
    entries.reduce((s, e) => s + e.needed, 0) + (basics ?? []).reduce((s, b) => s + b.needed, 0);

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title} ({count})
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <CardTile
            key={entry.cardIndex}
            entry={entry}
            printings={printings}
            prices={prices}
            stat={stats?.get(entry.card.n)}
            note={notes?.get(entry.cardIndex)}
          />
        ))}
        {(basics ?? []).map((basic) => {
          const card = index.cards[basic.cardIndex];
          if (!card) return null;
          return (
            <BasicTile
              key={basic.cardIndex}
              name={card.n}
              cardIndex={basic.cardIndex}
              needed={basic.needed}
              printings={printings}
            />
          );
        })}
      </div>
    </section>
  );
}

function CardTile({
  entry,
  printings,
  prices,
  stat,
  note,
}: {
  entry: DeckEntry;
  printings: PrintingIndex | null;
  prices: PriceIndex | null;
  stat?: CardStat;
  note?: string;
}) {
  const owned = entry.have >= entry.needed;
  const partial = !owned && entry.have > 0;
  const price = prices ? gbpPrice(prices, entry.cardIndex) : undefined;
  const url = prices ? cardmarketUrl(prices, entry.cardIndex) : undefined;
  const image = printings ? cardImageUrl(printings, entry.cardIndex) : undefined;
  const set = printings ? setCodeOf(printings, entry.cardIndex) : undefined;
  const signature = stat !== undefined && stat.synergy >= SIGNATURE_SYNERGY;

  const usage =
    stat &&
    `In ${Math.round(stat.inclusion * 100)}% of decks for this commander` +
      (signature
        ? `, and ${Math.round(stat.synergy * 100)}% more common here than in decks generally`
        : "");

  const tile = (
    <>
      {/*
        Missing cards are marked with a ring and their caption, never by
        altering the image: Scryfall's terms forbid desaturating, blurring or
        colour-shifting card images, which the previous greyed-out treatment did.
      */}
      <div
        className={`relative aspect-[488/680] w-full overflow-hidden rounded-lg bg-surface-2 ${
          owned ? "" : "ring-2 ring-[#e07a6a]/70"
        }`}
      >
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {image && (
          <Image
            src={image}
            alt={entry.card.n}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        )}
        {!image && (
          <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">
            {entry.card.n}
          </span>
        )}
        {entry.needed > 1 && (
          <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold">
            {entry.needed}×
          </span>
        )}
        {entry.card.gc === 1 && (
          <span className="absolute right-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
            GC
          </span>
        )}
      </div>

      <div className="mt-1.5 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-xs font-medium" title={entry.card.n}>
            {entry.card.n}
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
              // ratio. Icons ship unfilled, hence the invert.
              className="h-3 w-3 shrink-0 opacity-60 invert"
            />
          )}
        </div>

        <p className="truncate text-[11px] text-muted" title={usage}>
          {stat ? (
            <>
              {Math.round(stat.inclusion * 100)}% of decks
              {signature && <span className="text-accent"> · signature</span>}
            </>
          ) : (
            entry.card.r
          )}
        </p>

        <p
          className={`truncate text-[11px] ${owned || partial ? "text-muted" : "text-[#e07a6a]"}`}
          title={note}
        >
          {note ?? (owned
            ? "Owned"
            : partial
              ? `${entry.have} of ${entry.needed} owned`
              : price !== undefined
                ? `${formatGbp(price)} to buy`
                : "Missing")}
        </p>
      </div>
    </>
  );

  const wrapped =
    owned || !url ? (
      <div>{tile}</div>
    ) : (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
        {tile}
      </a>
    );
  return (
    <HoverCard image={image} name={entry.card.n}>
      {wrapped}
    </HoverCard>
  );
}

/**
 * A basic land. Shown with its count because the mana base is part of the
 * decklist, but with no owned or missing state — basics sit outside the
 * percentage, and marking them either way would imply they were scored.
 */
function BasicTile({
  name,
  cardIndex,
  needed,
  printings,
}: {
  name: string;
  cardIndex: number;
  needed: number;
  printings: PrintingIndex | null;
}) {
  const image = printings ? cardImageUrl(printings, cardIndex) : undefined;
  return (
    <div>
      <div className="relative aspect-[488/680] w-full overflow-hidden rounded-lg bg-surface-2">
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {image && (
          <Image
            src={image}
            alt={name}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        )}
        {!image && (
          <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">
            {name}
          </span>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold">
          {needed}×
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        <p className="truncate text-xs font-medium">{name}</p>
        <p className="text-[11px] text-muted">Mana base</p>
      </div>
    </div>
  );
}
