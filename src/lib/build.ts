import { lookupKeys } from "./normalise";
import type { CardStat, FillReason, FillTier } from "./edhrec";
import type { Collection } from "./collection";
import { estimateBracket, type Bracket, type DeckEntry, type DeckSource } from "./match";
import type { CardIndex, CardRecord } from "./types";

/** A commander deck is 100 cards, the commander being one of them. */
export const DECK_SIZE = 99;

/** An owned card EDHREC lists for the commander. */
export type Recommendation = {
  cardIndex: number;
  card: CardRecord;
  stat: CardStat;
};

export type BuildPick = DeckEntry & { reason: FillReason };

export type BuiltDeck = {
  picks: BuildPick[];
  /** `[cardIndex, count]`, split the way the average deck splits them. */
  basics: [number, number][];
  /** Below DECK_SIZE only when the collection runs out of cards in these colours. */
  total: number;
  /** Our Game Changer estimate, the same floor the deck pages show. */
  bracket: Bracket;
};

function resolve(index: CardIndex, name: string): number | undefined {
  return lookupKeys(name)
    .map((k) => index.aliases[k])
    .find((i) => i !== undefined);
}

/** Owned, playable alongside this commander, and not a basic (those are counted separately). */
function eligible(
  index: CardIndex,
  collection: Collection,
  commanderIndex: number,
  cardIndex: number | undefined
): cardIndex is number {
  if (cardIndex === undefined || cardIndex === commanderIndex) return false;
  const card = index.cards[cardIndex];
  const commander = index.cards[commanderIndex];
  if (!card || !commander || card.basic || card.ban) return false;
  if (!collection.owned.has(cardIndex)) return false;
  return [...card.ci].every((c) => commander.ci.includes(c));
}

/** Every owned card on the commander's EDHREC page, highest synergy first. */
export function recommend(
  stats: Map<string, CardStat>,
  index: CardIndex,
  collection: Collection,
  commanderIndex: number
): Recommendation[] {
  const seen = new Set<number>();
  const picks: Recommendation[] = [];
  for (const [name, stat] of stats) {
    const cardIndex = resolve(index, name);
    if (!eligible(index, collection, commanderIndex, cardIndex) || seen.has(cardIndex)) continue;
    seen.add(cardIndex);
    picks.push({ cardIndex, card: index.cards[cardIndex], stat });
  }
  return picks.sort((a, b) => b.stat.synergy - a.stat.synergy);
}

/**
 * Fill to DECK_SIZE by working down the tiers: the commander's own list, its
 * themes, similar commanders, then anything else owned in its colours by
 * EDHREC's overall rank. The land count and the basics' split come from the
 * average deck, so a mono-black list gets Swamps and the land count players
 * actually run, rather than a number picked here.
 */
export function buildDeck({
  commanderIndex,
  recommendations,
  tiers,
  average,
  index,
  collection,
  rank,
}: {
  commanderIndex: number;
  recommendations: Recommendation[];
  tiers: FillTier[];
  average: DeckSource;
  index: CardIndex;
  collection: Collection;
  rank: number[];
}): BuiltDeck {
  // One ordered stream of candidates; the first reason a card meets is the one it keeps.
  const stream: { cardIndex: number; reason: FillReason }[] = [];
  const queued = new Set<number>();
  const push = (cardIndex: number | undefined, reason: FillReason) => {
    if (!eligible(index, collection, commanderIndex, cardIndex) || queued.has(cardIndex)) return;
    queued.add(cardIndex);
    stream.push({ cardIndex, reason });
  };
  for (const r of recommendations) push(r.cardIndex, { tier: "commander" });
  for (const tier of tiers) for (const name of tier.names) push(resolve(index, name), tier.reason);
  // Unranked cards (0) go last; they are mostly too new or too obscure to have one.
  const rest = [...collection.owned.keys()].sort(
    (a, b) => (rank[a] || Infinity) - (rank[b] || Infinity)
  );
  for (const cardIndex of rest) push(cardIndex, { tier: "colours" });

  const isLand = (i: number) => index.cards[i].cat === "land";
  const averageBasics = average.basics.reduce((s, [, n]) => s + n, 0);
  const averageNonbasics = average.cards.filter(([i]) => isLand(i)).reduce((s, [, n]) => s + n, 0);

  // Lands first, so the basics can be sized before the spells take the rest.
  // Nonbasics are capped at the average deck's count: a large collection owns
  // enough taplands to fill every land slot, and would crowd out the basics.
  const picks: BuildPick[] = [];
  const take = (wanted: (i: number) => boolean, limit: number) => {
    for (const { cardIndex, reason } of stream) {
      if (limit <= 0) break;
      if (!wanted(cardIndex)) continue;
      const card = index.cards[cardIndex];
      picks.push({ card, cardIndex, needed: 1, have: 1, category: card.cat, reason });
      limit--;
    }
  };
  take(isLand, averageNonbasics);
  const basics = splitBasics(average.basics, averageBasics + averageNonbasics - picks.length);
  const basicCount = basics.reduce((s, [, n]) => s + n, 0);
  take((i) => !isLand(i), DECK_SIZE - picks.length - basicCount);

  // The commander counts: a Game Changer in the command zone still raises the bracket.
  const commander = index.cards[commanderIndex];
  const bracket = estimateBracket([
    { card: commander, cardIndex: commanderIndex, needed: 1, have: 1, category: commander.cat },
    ...picks,
  ]);

  return { picks, basics, total: picks.length + basicCount, bracket };
}

/**
 * Scale the average deck's basics to `slots`, by largest remainder so the
 * counts sum exactly. An average deck with no basics gives none, and those
 * slots go to spells instead.
 */
function splitBasics(average: [number, number][], slots: number): [number, number][] {
  const total = average.reduce((s, [, n]) => s + n, 0);
  if (total === 0 || slots <= 0) return [];
  const shares = average.map(([cardIndex, n]) => {
    const exact = (n / total) * slots;
    return { cardIndex, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = slots - shares.reduce((s, b) => s + b.count, 0);
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (left-- <= 0) break;
    share.count++;
  }
  return shares.filter((b) => b.count > 0).map((b) => [b.cardIndex, b.count]);
}

export function reasonLabel(reason: FillReason): string {
  switch (reason.tier) {
    case "commander":
      return "Played with this commander";
    case "theme":
      return `${reason.label} theme`;
    case "similar":
      return `Played with ${reason.commander}`;
    case "colours":
      return "In your colours";
  }
}

const frontFace = (card: CardRecord) => card.n.split("//")[0].trim();

/**
 * One `<count> <name>` line per card, commander first: what Moxfield, Archidekt
 * and most deck builders import. Front-face names, as the shopping lists use.
 */
export function deckAsText(commander: CardRecord, deck: BuiltDeck, index: CardIndex): string {
  return [
    `1 ${frontFace(commander)}`,
    ...deck.picks.map((p) => `1 ${frontFace(p.card)}`),
    ...deck.basics.map(([i, n]) => `${n} ${index.cards[i].n}`),
  ].join("\n");
}

export function deckAsCsv(commander: CardRecord, deck: BuiltDeck, index: CardIndex): string {
  const rows = [
    ["Quantity", "Name", "Category", "Why"],
    ["1", commander.n, "commander", "Commander"],
    ...deck.picks.map((p) => ["1", p.card.n, p.category, reasonLabel(p.reason)]),
    ...deck.basics.map(([i, n]) => [String(n), index.cards[i].n, "land", "Mana base"]),
  ];
  return rows
    .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\n");
}
