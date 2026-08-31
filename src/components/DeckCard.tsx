"use client";

import Image from "next/image";
import Link from "next/link";
import type { DeckMatch } from "@/lib/match";
import { ColourPips } from "./ColourPips";
import { CompletionRing } from "./CompletionRing";

/**
 * One deck in a results grid, linking through to its own page.
 *
 * Three tiers, in the order they get read: what the deck is, how close the
 * collection is, then where it came from. Completion sits on the art so it
 * doesn't compete with the title, and the provenance line is fenced off below a
 * rule so it reads as a footnote rather than another fact of equal weight.
 */
export function DeckCard({ match, href }: { match: DeckMatch; href: string }) {
  const artFrom = match.commanders.find((c) => c.art);
  const art = artFrom?.art;
  const missingCount = match.missing.reduce((sum, e) => sum + (e.needed - e.have), 0);

  return (
    <Link
      href={href}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition hover:border-accent/60"
    >
      <div className="relative h-32 w-full bg-surface-2">
        {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
        {art && (
          <Image
            src={art}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover opacity-70 transition group-hover:opacity-90"
          />
        )}
        {/* Scryfall require the artist to be credited wherever an art crop is
            shown, unless the full card appears in the same interface. */}
        {artFrom?.artist && (
          <span className="absolute bottom-0 right-0 max-w-full truncate bg-background/70 px-1.5 py-0.5 text-[9px] text-muted">
            {artFrom.artist}
          </span>
        )}
        {match.percent >= 90 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#7bd88f] px-2 py-0.5 text-[11px] font-bold text-[#0d2a15]">
            Basically already built
          </span>
        )}
        <span className="absolute -bottom-4 left-4 rounded-full bg-background/90 p-1 ring-1 ring-border">
          <CompletionRing percent={match.percent} size={44} />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-6">
        <h3 className="truncate font-semibold">{match.deck.name}</h3>
        <p className="truncate text-sm text-muted">
          {match.commanders.map((c) => c.n).join(" & ") || "No listed commander"}
        </p>

        <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
          <span>
            {match.ownedCards} of {match.totalCards} owned
          </span>
          <span className={missingCount === 0 ? "text-[#7bd88f]" : "text-[#e07a6a]"}>
            {missingCount === 0 ? "Complete" : `${missingCount} to buy`}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-2.5 text-xs text-muted">
          <ColourPips colours={match.colours} />
          <span className="shrink-0">Bracket {match.bracket.label}</span>
          <span className="ml-auto truncate">{match.deck.subtitle}</span>
        </div>
      </div>
    </Link>
  );
}
