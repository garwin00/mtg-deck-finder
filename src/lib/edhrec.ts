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
  /** Credited alongside the art crop, as Scryfall require. */
  artist?: string;
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
      artist: card.artist,
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

type CardLists = {
  container?: {
    json_dict?: {
      cardlists?: {
        cardviews: { name: string; num_decks: number; potential_decks: number; synergy?: number }[];
      }[];
    };
  };
};

type CommanderPage = CardLists & {
  tag_counts?: { slug: string; value: string; count: number }[];
  bracket_counts?: Record<string, number>;
  /** Names of commanders EDHREC considers alike, closest first. */
  similar?: string[];
};

const EDHREC = "https://json.edhrec.com/pages";

/**
 * The deck list and the build tab both read a commander's page, and switching
 * between them shouldn't fetch it twice. A failed fetch is dropped from the
 * cache so a retry can succeed.
 */
const commanderPages = new Map<string, Promise<CommanderPage | null>>();

function fetchCommanderPage(slug: string): Promise<CommanderPage | null> {
  let page = commanderPages.get(slug);
  if (!page) {
    page = fetch(`${EDHREC}/commanders/${slug}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<CommanderPage>) : null))
      .catch(() => null);
    page.then((p) => p ?? commanderPages.delete(slug));
    commanderPages.set(slug, page);
  }
  return page;
}

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

/**
 * How players actually pitch this commander, from the brackets they self-report
 * on EDHREC. Distinct from the per-deck estimate in match.ts, which is a floor
 * derived from Game Changer count and knows nothing about how a deck is played.
 */
export type BracketMix = {
  counts: Record<string, number>;
  total: number;
  /** Mean of the 1-5 scale. */
  mean: number;
  /** The single most reported bracket, which often isn't the rounded mean. */
  mode: number;
};

export type CommanderData = {
  variants: DeckVariant[];
  brackets?: BracketMix;
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
  let brackets: BracketMix | undefined;

  try {
    const page = await fetchCommanderPage(commander.slug);
    if (page) {
      for (const tag of page.tag_counts ?? []) {
        if (tag.count < MIN_THEME_DECKS || variants.length > MAX_THEMES) break;
        variants.push({ theme: tag.slug, label: tag.value, numDecks: tag.count });
      }
      const counts = page.bracket_counts;
      if (counts) {
        const pairs = Object.entries(counts).filter(([, n]) => n > 0);
        const total = pairs.reduce((sum, [, n]) => sum + n, 0);
        if (total > 0) {
          brackets = {
            counts,
            total,
            mean: pairs.reduce((sum, [k, n]) => sum + Number(k) * n, 0) / total,
            mode: Number(pairs.sort((a, b) => b[1] - a[1])[0][0]),
          };
        }
      }
      for (const list of page.container?.json_dict?.cardlists ?? []) {
        for (const card of list.cardviews) {
          if (stats.has(card.name) || !card.potential_decks) continue;
          stats.set(card.name, {
            inclusion: card.num_decks / card.potential_decks,
            synergy: card.synergy ?? 0,
          });
        }
      }
    }
  } catch {
    // No themes is fine — the average deck still stands on its own.
  }
  return { variants, stats, brackets };
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
  const res = await fetch(`${EDHREC}/average-decks/${path}.json`);
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

/**
 * EDHREC's names for each colour identity, keyed the way `CardRecord.ci` spells
 * it (letters sorted alphabetically). Their tag pages are published per identity.
 */
const COLOUR_SLUGS: Record<string, string> = {
  "": "colorless",
  W: "mono-white",
  U: "mono-blue",
  B: "mono-black",
  R: "mono-red",
  G: "mono-green",
  UW: "azorius",
  BU: "dimir",
  BR: "rakdos",
  GR: "gruul",
  GW: "selesnya",
  BW: "orzhov",
  RU: "izzet",
  BG: "golgari",
  RW: "boros",
  GU: "simic",
  GUW: "bant",
  BUW: "esper",
  BRU: "grixis",
  BGR: "jund",
  GRW: "naya",
  BGW: "abzan",
  RUW: "jeskai",
  BGU: "sultai",
  BRW: "mardu",
  GRU: "temur",
  BGRU: "glint-eye",
  BGRW: "dune-brood",
  GRUW: "ink-treader",
  BGUW: "witch-maw",
  BRUW: "yore-tiller",
  BGRUW: "five-color",
};

/** Where a filled card came from, so the deck can say why it's there. */
export type FillReason =
  | { tier: "deck" }
  | { tier: "commander" }
  | { tier: "theme"; label: string }
  | { tier: "similar"; commander: string }
  | { tier: "colours" };

/** Card names from one EDHREC page, highest synergy first. */
export type FillTier = { reason: FillReason; names: string[] };

/** How many of the commander's themes, and of its similar commanders, to draw on. */
const FILL_THEMES = 3;
const FILL_SIMILAR = 3;

function namesBySynergy(page: CardLists | null): string[] {
  const cards = (page?.container?.json_dict?.cardlists ?? []).flatMap((l) => l.cardviews);
  return cards.sort((a, b) => (b.synergy ?? 0) - (a.synergy ?? 0)).map((c) => c.name);
}

/**
 * The fill's sources after the commander's own list, in the order they're
 * drawn on: the commander's most-built themes as EDHREC tag pages for its
 * colour identity, then the lists of the commanders EDHREC calls similar. The
 * tag pages are where cards outside its tribe come from: Tokens or Lifegain
 * cards for a Vampires commander. Up to six requests, so only made on Fill.
 */
export async function fetchFillTiers(
  commander: OwnedCommander,
  catalogue: CommanderCatalogue,
  index: CardIndex,
  /** A theme slug to draw on first, when filling that theme's deck. */
  leadTheme?: string
): Promise<FillTier[]> {
  const page = await fetchCommanderPage(commander.slug);
  if (!page) return [];
  const colours = COLOUR_SLUGS[commander.colours];

  const tags = page.tag_counts ?? [];
  const lead = tags.find((t) => t.slug === leadTheme);
  const chosen = [...(lead ? [lead] : []), ...tags.filter((t) => t !== lead)].slice(0, FILL_THEMES);
  const themes = colours
    ? chosen.map(async (tag): Promise<FillTier> => {
        const res = await fetch(`${EDHREC}/tags/${tag.slug}/${colours}.json`).catch(() => null);
        const tagPage = res?.ok ? ((await res.json()) as CardLists) : null;
        return { reason: { tier: "theme", label: tag.value }, names: namesBySynergy(tagPage) };
      })
    : [];

  // Similar commanders arrive by name; the catalogue holds their exact slugs.
  const slugByCard = new Map(catalogue.decks.map((d) => [d.c, d.s]));
  const similar = (page.similar ?? [])
    .map((name) => {
      const cardIndex = lookupKeys(name)
        .map((k) => index.aliases[k])
        .find((i) => i !== undefined);
      const slug = cardIndex === undefined ? undefined : slugByCard.get(cardIndex);
      return slug ? { name, slug } : undefined;
    })
    .filter((s) => s !== undefined)
    .slice(0, FILL_SIMILAR)
    .map(async ({ name, slug }): Promise<FillTier> => ({
      reason: { tier: "similar", commander: name },
      names: namesBySynergy(await fetchCommanderPage(slug)),
    }));

  return Promise.all([...themes, ...similar]);
}
