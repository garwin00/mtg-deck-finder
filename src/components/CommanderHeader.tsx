"use client";

import Image from "next/image";
import Link from "next/link";
import type { BracketMix, OwnedCommander } from "@/lib/edhrec";
import { cardImageUrl, type PrintingIndex } from "@/lib/printings";
import { ColourPips } from "./ColourPips";
import { CommanderTabs } from "./CommanderTabs";
import { HoverCard } from "./HoverCard";
import { backLink, lede, pageTitle } from "./ui";

/** The top of both commander tabs: the card, the name, how it's built, and the tabs. */
export function CommanderHeader({
  commander,
  printings,
  brackets,
  active,
}: {
  commander: OwnedCommander;
  printings: PrintingIndex | null;
  brackets?: BracketMix;
  active: "decks" | "build";
}) {
  // EDHREC publish no prose about a commander, so this is assembled from what
  // they do publish: the themes people build, and the brackets they report.
  const themes = [...commander.tribes, ...commander.archetypes];
  const playstyle = themes.length
    ? `Usually built as ${themes.slice(0, 3).join(", ")}${themes.length > 3 ? ` and ${themes.length - 3} other themes` : ""}.`
    : null;
  const image = printings ? cardImageUrl(printings, commander.cardIndex) : undefined;
  const name = commander.name.split("//")[0].trim();

  return (
    <>
      <Link href="/" className={backLink}>
        ← Your commanders
      </Link>

      <header className="mt-4 grid gap-7 md:grid-cols-[140px_1fr] md:items-end">
        <div className="hidden md:block">
          {image && (
            <HoverCard image={image} name={commander.name}>
              <Image
                src={image}
                alt={commander.name}
                width={140}
                height={195}
                unoptimized
                className="h-[195px] w-[140px] rounded-[6px] shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
              />
            </HoverCard>
          )}
        </div>
        <div className="min-w-0">
          <ColourPips colours={commander.colours} />
          <h1 className={`mt-2 ${pageTitle}`}>{name}</h1>
          {playstyle && <p className={lede}>{playstyle}</p>}
          {brackets && (
            <p
              className="mt-1 text-sm text-muted"
              title={[1, 2, 3, 4, 5]
                .map((b) => `Bracket ${b}: ${Math.round(((brackets.counts[b] ?? 0) / brackets.total) * 100)}%`)
                .join(" · ")}
            >
              Most decks are bracket <span className="font-semibold text-ink">{brackets.mode}</span>,
              average {brackets.mean.toFixed(1)} across {brackets.total.toLocaleString()} decks on
              EDHREC.
            </p>
          )}
        </div>
      </header>

      <CommanderTabs slug={commander.slug} active={active} />
    </>
  );
}
