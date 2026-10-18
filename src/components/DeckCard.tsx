"use client";

import Link from "next/link";
import type { DeckMatch } from "@/lib/match";
import { ColourPips } from "./ColourPips";
import { Meter } from "./Meter";
import { sheetLink } from "./ui";

/**
 * One deck in a results grid, linking through to its own page.
 *
 * Read in order: what the deck is and how close you are, then what's left to
 * buy, then where it came from as a footnote.
 */
export function DeckCard({ match, href }: { match: DeckMatch; href: string }) {
  const missingCount = match.missing.reduce((sum, e) => sum + (e.needed - e.have), 0);

  return (
    <Link href={href} className={`flex flex-col p-4 ${sheetLink}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-base font-bold tracking-[-0.01em]">{match.deck.name}</h3>
        <span className="shrink-0 text-[22px] font-bold tabular-nums tracking-[-0.02em]">
          {Math.round(match.percent)}%
        </span>
      </div>
      <p className="truncate text-xs text-muted">
        {match.commanders.map((c) => c.n).join(" & ") || "No listed commander"}
      </p>

      <Meter percent={match.percent} className="mt-4" />

      <div className="mt-2.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">
          {match.ownedCards} of {match.totalCards} owned
        </span>
        <span className={missingCount === 0 ? "font-semibold" : "font-semibold text-signal"}>
          {missingCount === 0 ? "Complete" : `${missingCount} to buy`}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-rule pt-2.5 text-xs text-muted">
        <ColourPips colours={match.colours} size={14} />
        <span className="shrink-0 rounded-[2px] border border-ink px-1.5 text-[11px] font-bold text-ink">
          Bracket {match.bracket.label}
        </span>
        <span className="ml-auto truncate">{match.deck.subtitle}</span>
      </div>
    </Link>
  );
}
