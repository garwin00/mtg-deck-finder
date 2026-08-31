"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CardStat } from "@/lib/edhrec";
import type { CardIndex } from "@/lib/types";
import type { DeckEntry, DeckMatch } from "@/lib/match";
import { missingAsCsv, missingAsText } from "@/lib/match";
import { cardmarketUrl, formatGbp, gbpPrice, type PriceIndex } from "@/lib/prices";
import { fetchCardDetails, setIconUrl, type CardDetail } from "@/lib/images";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/types";
import { ColourPips } from "./ColourPips";
import { ManaCurve } from "./ManaCurve";
import { CompletionRing } from "./CompletionRing";

const NO_DETAILS = new Map<string, CardDetail>();

/** Above this, a card is specific to the commander rather than a general staple. */
const SIGNATURE_SYNERGY = 0.25;

type Props = {
  match: DeckMatch;
  index: CardIndex;
  prices: PriceIndex | null;
  /** Per-card usage from EDHREC. Absent for precons. */
  stats?: Map<string, CardStat>;
  backHref: string;
  backLabel: string;
};

/** A whole deck as card images, owned in colour and missing dimmed. */
export function DeckView({ match, index, prices, stats, backHref, backLabel }: Props) {
  const [loadedDetails, setLoadedDetails] = useState<{
    key: string;
    details: Map<string, CardDetail>;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Keyed by deck so switching decks shows no images rather than the previous
  // deck's, without clearing state synchronously inside the effect.
  const details = loadedDetails?.key === match.deck.id ? loadedDetails.details : NO_DETAILS;

  useEffect(() => {
    let cancelled = false;
    fetchCardDetails([
      ...match.entries.map((e) => e.card.n),
      ...match.deck.basics.map(([i]) => index.cards[i]?.n).filter((n) => n !== undefined),
    ])
      .then((loaded) => {
        if (!cancelled) setLoadedDetails({ key: match.deck.id, details: loaded });
      })
      .catch(() => {
        // Without images the deck still reads as a list of names.
      });
    return () => {
      cancelled = true;
    };
  }, [match, index]);

  // The commander leads, the way a decklist writeup does.
  const { commanderEntries, grouped } = useMemo(() => {
    const isCommander = new Set(match.deck.commanders);
    const buckets = new Map<Category, DeckEntry[]>();
    const commanders: DeckEntry[] = [];
    for (const entry of match.entries) {
      if (isCommander.has(entry.cardIndex)) {
        commanders.push(entry);
        continue;
      }
      const list = buckets.get(entry.category) ?? [];
      list.push(entry);
      buckets.set(entry.category, list);
    }
    return {
      commanderEntries: commanders,
      grouped: CATEGORY_ORDER.filter((c) => buckets.has(c) || c === "land").map((category) => ({
        category,
        entries: (buckets.get(category) ?? []).sort((a, b) => a.card.n.localeCompare(b.card.n)),
      })),
    };
  }, [match]);

  const estimate = useMemo(() => {
    if (!prices) return undefined;
    let total = 0;
    let unpriced = 0;
    for (const entry of match.missing) {
      const each = gbpPrice(prices, entry.cardIndex);
      if (each === undefined) unpriced++;
      else total += each * (entry.needed - entry.have);
    }
    return { total, unpriced };
  }, [match, prices]);

  // Basics are part of the decklist and part of the mana base, but never
  // scored — a collection holds them in bulk, so counting them would add the
  // same offset to every deck and tell the user nothing.
  const basicEntries = useMemo(
    () =>
      match.deck.basics
        .map(([cardIndex, needed]) => ({ cardIndex, needed }))
        .sort((a, b) => b.needed - a.needed),
    [match]
  );

  const manaBase = useMemo(() => {
    const basic = basicEntries.reduce((sum, b) => sum + b.needed, 0);
    const nonbasic = match.entries
      .filter((e) => e.category === "land")
      .reduce((sum, e) => sum + e.needed, 0);
    return { basic, nonbasic, total: basic + nonbasic };
  }, [basicEntries, match]);

  const missingCount = match.missing.reduce((s, e) => s + (e.needed - e.have), 0);

  const copyMissing = async () => {
    await navigator.clipboard.writeText(missingAsText(match));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    const blob = new Blob([missingAsCsv(match)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${match.deck.id.replace(/[^a-z0-9]+/gi, "-")}-missing.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Link href={backHref} className="text-sm text-muted underline hover:text-foreground">
        ← {backLabel}
      </Link>

      <header className="mt-3 flex flex-wrap items-start gap-4">
        <CompletionRing percent={match.percent} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{match.deck.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {match.deck.subtitle} ·{" "}
            {match.commanders.map((c) => c.n).join(" & ") || "No listed commander"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <ColourPips colours={match.colours} />
            <span>
              {match.ownedCards}/{match.totalCards} owned
            </span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5">
              Bracket {match.bracket.label}
            </span>
            {manaBase.total > 0 && (
              <span>
                {manaBase.total} lands · {manaBase.nonbasic} nonbasic, {manaBase.basic} basic
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-8">
          {commanderEntries.length > 0 && (
            <CardGroup
              title="Commander"
              entries={commanderEntries}
              details={details}
              prices={prices}
              stats={stats}
              index={index}
            />
          )}
          {grouped
            .filter(({ category, entries }) => entries.length > 0 || category === "land")
            .map(({ category, entries }) => (
            <CardGroup
              key={category}
              title={CATEGORY_LABELS[category]}
              entries={entries}
              details={details}
              prices={prices}
              stats={stats}
              // Basics belong with the lands, and are shown with their counts
              // so the mana base is legible.
              basics={category === "land" ? basicEntries : undefined}
              index={index}
            />
            ))}
        </div>

        <aside className="w-full shrink-0 lg:w-80">
          <div className="space-y-6 lg:sticky lg:top-6">
            <ManaCurve entries={match.entries} details={details} />

            <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Missing ({missingCount})
              </h2>
              {estimate && missingCount > 0 && (
                <span className="text-sm text-muted">~{formatGbp(estimate.total)}</span>
              )}
            </div>

            {missingCount === 0 ? (
              <p className="mt-3 text-sm text-muted">
                You own every non-basic card in this deck.
              </p>
            ) : (
              <>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={copyMissing}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent/60"
                  >
                    {copied ? "Copied" : "Copy list"}
                  </button>
                  <button
                    type="button"
                    onClick={downloadCsv}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:border-accent/60"
                  >
                    Download CSV
                  </button>
                </div>

                <ul className="mt-3 max-h-[32rem] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface">
                  {[...match.missing]
                    .sort((a, b) => {
                      const pa = prices ? (gbpPrice(prices, a.cardIndex) ?? -1) : 0;
                      const pb = prices ? (gbpPrice(prices, b.cardIndex) ?? -1) : 0;
                      return pb - pa || a.card.n.localeCompare(b.card.n);
                    })
                    .map((entry) => {
                      const each = prices ? gbpPrice(prices, entry.cardIndex) : undefined;
                      const url = prices ? cardmarketUrl(prices, entry.cardIndex) : undefined;
                      const copies = entry.needed - entry.have;
                      return (
                        <li key={entry.cardIndex} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="w-6 shrink-0 text-xs text-muted">{copies}×</span>
                          <span className="min-w-0 flex-1 truncate">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-accent hover:underline"
                              >
                                {entry.card.n}
                              </a>
                            ) : (
                              entry.card.n
                            )}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">
                            {each === undefined ? "—" : formatGbp(each * copies)}
                          </span>
                        </li>
                      );
                    })}
                </ul>

                {prices && (
                  <p className="mt-2 text-xs text-muted">
                    Cheapest printing on Cardmarket, converted at the ECB rate
                    {prices.rateDate ? ` of ${prices.rateDate}` : ""}. Excludes shipping, and EU
                    sellers add around 20% import VAT on delivery to the UK.
                    {estimate && estimate.unpriced > 0 &&
                      ` ${estimate.unpriced} card${estimate.unpriced === 1 ? " has" : "s have"} no listed price.`}
                  </p>
                )}
              </>
            )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function CardGroup({
  title,
  entries,
  details,
  prices,
  stats,
  basics,
  index,
}: {
  title: string;
  entries: DeckEntry[];
  details: Map<string, CardDetail>;
  prices: PriceIndex | null;
  stats?: Map<string, CardStat>;
  basics?: { cardIndex: number; needed: number }[];
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
            detail={details.get(entry.card.n)}
            prices={prices}
            stat={stats?.get(entry.card.n)}
          />
        ))}
        {(basics ?? []).map((basic) => {
          const card = index.cards[basic.cardIndex];
          if (!card) return null;
          return (
            <BasicTile
              key={basic.cardIndex}
              name={card.n}
              needed={basic.needed}
              detail={details.get(card.n)}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * A basic land. Shown with its count because the mana base is part of the
 * decklist, but with no owned or missing state — basics sit outside the
 * percentage, and colouring them either way would imply they were scored.
 */
function BasicTile({
  name,
  needed,
  detail,
}: {
  name: string;
  needed: number;
  detail?: CardDetail;
}) {
  return (
    <div>
      <div className="relative aspect-[488/680] w-full overflow-hidden rounded-lg bg-surface-2">
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {detail?.image && (
          <Image
            src={detail.image}
            alt={name}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        )}
        {!detail?.image && (
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

function CardTile({
  entry,
  detail,
  prices,
  stat,
}: {
  entry: DeckEntry;
  detail?: CardDetail;
  prices: PriceIndex | null;
  stat?: CardStat;
}) {
  const owned = entry.have >= entry.needed;
  const partial = !owned && entry.have > 0;
  const price = prices ? gbpPrice(prices, entry.cardIndex) : undefined;
  const url = prices ? cardmarketUrl(prices, entry.cardIndex) : undefined;
  const signature = stat !== undefined && stat.synergy >= SIGNATURE_SYNERGY;

  const usage =
    stat &&
    `In ${Math.round(stat.inclusion * 100)}% of decks for this commander` +
      (signature
        ? `, and ${Math.round(stat.synergy * 100)}% more common here than in decks generally`
        : "");

  const tile = (
    <>
      <div
        className={`relative aspect-[488/680] w-full overflow-hidden rounded-lg bg-surface-2 ${
          owned ? "" : "opacity-45 grayscale"
        }`}
      >
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {detail?.image && (
          <Image
            src={detail.image}
            alt={entry.card.n}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        )}
        {!detail?.image && (
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

        <p className="truncate text-[11px] text-muted" title={usage}>
          {stat ? (
            <>
              {Math.round(stat.inclusion * 100)}% of decks
              {signature && <span className="text-accent"> · signature</span>}
            </>
          ) : (
            (detail?.rarity ?? entry.card.r)
          )}
        </p>

        <p
          className={`truncate text-[11px] ${
            owned ? "text-muted" : partial ? "text-muted" : "text-[#e07a6a]"
          }`}
        >
          {owned
            ? "Owned"
            : partial
              ? `${entry.have} of ${entry.needed} owned`
              : price !== undefined
                ? `${formatGbp(price)} to buy`
                : "Missing"}
        </p>
      </div>
    </>
  );

  if (owned || !url) return <div>{tile}</div>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
      {tile}
    </a>
  );
}
