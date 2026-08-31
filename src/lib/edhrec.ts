import { lookupKeys } from "./normalise";
import type { CardIndex, CommanderCatalogue } from "./types";
import type { Collection } from "./collection";
import type { DeckSource } from "./match";

/** A commander the collection owns that EDHREC has an average deck for. */
export type OwnedCommander = {
  slug: string;
  cardIndex: number;
  name: string;
  numDecks: number;
  colours: string;
  /** Creature types off the type line, for the typal filter. */
  types: string[];
  /** How EDHREC's players actually build it. Empty for untagged commanders. */
  tribes: string[];
  archetypes: string[];
  /** When it entered the collection, if the export said. */
  addedAt?: number;
  /** Art crop, present for all but a couple of dozen commanders. */
  art?: string;
};

/**
 * Creature subtypes from a type line: "Legendary Creature — Cat Warlock" gives
 * ["Cat", "Warlock"]. Only creature faces count, so a Vehicle or a Planeswalker
 * commander contributes nothing.
 */
export function creatureTypes(typeLine: string): string[] {
  const types = new Set<string>();
  for (const face of typeLine.split("//")) {
    if (!/\bCreature\b/.test(face)) continue;
    const [, subtypes] = face.split("—");
    for (const word of (subtypes ?? "").trim().split(/\s+/)) {
      if (word) types.add(word);
    }
  }
  return [...types];
}

/**
 * Commanders the collection can actually field, most-built first. The
 * catalogue is already sorted by deck count, so the filter preserves it.
 */
export function ownedFromCatalogue(
  catalogue: CommanderCatalogue,
  index: CardIndex,
  collection: Collection
): OwnedCommander[] {
  const owned: OwnedCommander[] = [];
  for (const entry of catalogue.decks) {
    if (!collection.owned.has(entry.c)) continue;
    const card = index.cards[entry.c];
    if (!card) continue;
    owned.push({
      slug: entry.s,
      cardIndex: entry.c,
      name: card.n,
      numDecks: entry.n,
      colours: card.ci,
      types: creatureTypes(card.t),
      tribes: (entry.t ?? []).map((i) => catalogue.tribes[i]?.l).filter((l) => l !== undefined),
      archetypes: (entry.a ?? [])
        .map((i) => catalogue.archetypes[i]?.l)
        .filter((l) => l !== undefined),
      addedAt: collection.addedAt.get(entry.c),
      art: card.art,
    });
  }
  return owned;
}

type AverageDeck = {
  deck?: {
    commander?: string[];
    cards?: Record<string, [string, number][]>;
  };
};

type CommanderPage = {
  tag_counts?: { slug: string; value: string; count: number }[];
  container?: {
    json_dict?: {
      cardlists?: {
        cardviews: { name: string; num_decks: number; potential_decks: number; synergy: number }[];
      }[];
    };
  };
};

/** How a card is actually used, which the card face can't tell you. */
export type CardStat = {
  /** Share of this commander's decks running it, 0-1. */
  inclusion: number;
  /**
   * How much more often it appears here than in decks that could play it.
   * High values mark cards specific to this commander rather than staples.
   */
  synergy: number;
};

export type CommanderData = {
  variants: DeckVariant[];
  /** Card name -> usage. Absent for cards EDHREC's lists don't reach. */
  stats: Map<string, CardStat>;
};

/** One buildable deck for a commander: the consensus list, or a themed one. */
export type DeckVariant = {
  /** Undefined for the plain average deck. */
  theme?: string;
  label: string;
  numDecks: number;
};

/** Themes with fewer decks than this are noise rather than a real archetype. */
const MIN_THEME_DECKS = 25;
const MAX_THEMES = 6;

/**
 * One fetch of a commander's page gives both the decks worth offering — the
 * overall average plus its most built themes, published at
 * /average-decks/<commander>/<theme> — and how often each card is played.
 */
export async function fetchCommanderData(commander: OwnedCommander): Promise<CommanderData> {
  const variants: DeckVariant[] = [{ label: "Average deck", numDecks: commander.numDecks }];
  const stats = new Map<string, CardStat>();

  try {
    const res = await fetch(`https://json.edhrec.com/pages/commanders/${commander.slug}.json`);
    if (res.ok) {
      const page = (await res.json()) as CommanderPage;
      for (const tag of page.tag_counts ?? []) {
        if (tag.count < MIN_THEME_DECKS || variants.length > MAX_THEMES) break;
        variants.push({ theme: tag.slug, label: tag.value, numDecks: tag.count });
      }
      for (const list of page.container?.json_dict?.cardlists ?? []) {
        for (const card of list.cardviews) {
          if (stats.has(card.name) || !card.potential_decks) continue;
          stats.set(card.name, {
            inclusion: card.num_decks / card.potential_decks,
            synergy: card.synergy,
          });
        }
      }
    }
  } catch {
    // No themes is fine — the average deck still stands on its own.
  }
  return { variants, stats };
}

/**
 * Fetch one commander's average deck straight from EDHREC and resolve it
 * against our card index.
 *
 * Their JSON is CORS-open and cacheable, so this runs in the browser and only
 * for decks the user actually opens — no bulk crawl, and none of their data is
 * copied onto our domain.
 */
export async function fetchAverageDeck(
  commander: OwnedCommander,
  variant: DeckVariant,
  index: CardIndex
): Promise<DeckSource> {
  const path = variant.theme ? `${commander.slug}/${variant.theme}` : commander.slug;
  const res = await fetch(`https://json.edhrec.com/pages/average-decks/${path}.json`);
  if (!res.ok) throw new Error(`EDHREC returned ${res.status} for ${commander.name}`);
  const payload = (await res.json()) as AverageDeck;

  const resolve = (name: string) =>
    lookupKeys(name)
      .map((k) => index.aliases[k])
      .find((i) => i !== undefined);

  const cards: [number, number][] = [];
  const basics = new Map<number, number>();
  for (const list of Object.values(payload.deck?.cards ?? {})) {
    for (const [name, count] of list) {
      const cardIndex = resolve(name);
      if (cardIndex === undefined) continue;
      if (index.cards[cardIndex].basic) {
        // Kept per type: the mana base is part of the decklist even though it
        // is never scored.
        basics.set(cardIndex, (basics.get(cardIndex) ?? 0) + count);
        continue;
      }
      cards.push([cardIndex, count]);
    }
  }
  if (cards.length === 0) throw new Error(`No decklist for ${commander.name}`);

  const commanders = (payload.deck?.commander ?? [commander.name])
    .map(resolve)
    .filter((i): i is number => i !== undefined);

  return {
    id: `${commander.slug}:${variant.theme ?? "average"}`,
    // The card shows name over commander, the way a precon card does, so the
    // deck's name is the theme rather than a repeat of the commander.
    name: variant.label,
    subtitle: `${variant.numDecks.toLocaleString()} decks`,
    kind: "commander",
    commanders: commanders.length > 0 ? commanders : [commander.cardIndex],
    basics: [...basics],
    cards,
  };
}
