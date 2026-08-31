"use client";

import Image from "next/image";
import type { DeckMatch } from "@/lib/match";
import { ColourPips } from "./ColourPips";
import { CompletionRing } from "./CompletionRing";

/** One precon match in the ranked results grid. */
export function DeckCard({ match, onOpen }: { match: DeckMatch; onOpen: () => void }) {
  const art = match.commanders.find((c) => c.art)?.art;
  const missingCount = match.missing.reduce((sum, e) => sum + (e.needed - e.have), 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition hover:border-accent/60"
    >
      <div className="relative h-28 w-full bg-surface-2">
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
        {match.percent >= 90 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#7bd88f] px-2 py-0.5 text-[11px] font-bold text-[#0d2a15]">
            Basically already built
          </span>
        )}
      </div>

      <div className="flex items-start gap-4 p-4">
        <CompletionRing percent={match.percent} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{match.deck.name}</h3>
          <p className="truncate text-sm text-muted">
            {match.commanders.map((c) => c.n).join(" & ") || "No listed commander"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <ColourPips colours={match.colours} />
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              Bracket {match.bracket.label}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {match.ownedCards}/{match.totalCards} owned · {missingCount} to buy
          </p>
          <p className="truncate text-xs text-muted">{match.deck.subtitle}</p>
        </div>
      </div>
    </button>
  );
}
