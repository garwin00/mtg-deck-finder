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
};

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
  index: CardIndex
): Promise<DeckSource> {
  const res = await fetch(`https://json.edhrec.com/pages/average-decks/${commander.slug}.json`);
  if (!res.ok) throw new Error(`EDHREC returned ${res.status} for ${commander.name}`);
  const payload = (await res.json()) as AverageDeck;

  const resolve = (name: string) =>
    lookupKeys(name)
      .map((k) => index.aliases[k])
      .find((i) => i !== undefined);

  const cards: [number, number][] = [];
  let basics = 0;
  for (const list of Object.values(payload.deck?.cards ?? {})) {
    for (const [name, count] of list) {
      const cardIndex = resolve(name);
      if (cardIndex === undefined) continue;
      if (index.cards[cardIndex].basic) {
        basics += count;
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
    id: commander.slug,
    name: commander.name,
    subtitle: `Average deck · ${commander.numDecks.toLocaleString()} on EDHREC`,
    kind: "commander",
    commanders: commanders.length > 0 ? commanders : [commander.cardIndex],
    basics,
    cards,
  };
}
