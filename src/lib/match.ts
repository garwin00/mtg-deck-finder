import type { CardIndex, CardRecord, Category, Precon, PreconIndex } from "./types";
import type { Collection } from "./collection";

/**
 * A deck to score a collection against, whatever produced it. Precons and
 * EDHREC average decks differ only in where they came from and what they are
 * called, so they share one matcher.
 */
export type DeckSource = {
  id: string;
  name: string;
  /** Provenance line, e.g. "C21 · 2021" or "43,948 decks on EDHREC". */
  subtitle: string;
  kind: "precon" | "commander";
  commanders: number[];
  /** The mana base, shown but never scored. */
  basics: [number, number][];
  cards: [number, number][];
};

export function preconSource(deck: Precon): DeckSource {
  return {
    id: deck.id,
    name: deck.name,
    subtitle: `${deck.code} · ${deck.release}`,
    kind: "precon",
    commanders: deck.commanders,
    basics: deck.basics,
    cards: deck.cards,
  };
}


export type DeckEntry = {
  card: CardRecord;
  cardIndex: number;
  /** Copies the printed deck runs. */
  needed: number;
  /** Copies the collection can cover. */
  have: number;
  category: Category;
};

export type Bracket = {
  floor: 1 | 2 | 3 | 4;
  label: string;
  gameChangers: string[];
};

export type DeckMatch = {
  deck: DeckSource;
  entries: DeckEntry[];
  commanders: CardRecord[];
  /** Colour identity across the deck's commanders, e.g. "BU". */
  colours: string;
  ownedCards: number;
  totalCards: number;
  percent: number;
  missing: DeckEntry[];
  bracket: Bracket;
};

/** Score every official precon against the collection. */
export function matchPrecons(
  precons: PreconIndex,
  index: CardIndex,
  collection: Collection
): DeckMatch[] {
  return matchDecks(precons.decks.map(preconSource), index, collection);
}

/**
 * Score decks against the collection. Basic lands are excluded from both sides
 * at build time, so a collection's bulk basics can't inflate a match.
 */
export function matchDecks(
  decks: DeckSource[],
  index: CardIndex,
  collection: Collection,
  /** "given" keeps the caller's order — used to browse decks by popularity. */
  sort: "percent" | "given" = "percent"
): DeckMatch[] {
  const matches = decks.map((deck) => {
    const entries: DeckEntry[] = deck.cards.map(([cardIndex, needed]) => {
      const card = index.cards[cardIndex];
      const have = Math.min(collection.owned.get(cardIndex) ?? 0, needed);
      return { card, cardIndex, needed, have, category: card.cat };
    });

    const totalCards = entries.reduce((sum, e) => sum + e.needed, 0);
    const ownedCards = entries.reduce((sum, e) => sum + e.have, 0);
    const commanders = deck.commanders.map((i) => index.cards[i]).filter(Boolean);

    return {
      deck,
      entries,
      commanders,
      colours: colourIdentity(commanders),
      ownedCards,
      totalCards,
      percent: totalCards === 0 ? 0 : (ownedCards / totalCards) * 100,
      missing: entries.filter((e) => e.have < e.needed),
      bracket: estimateBracket(entries),
    };
  });

  if (sort === "given") return matches;
  return matches.sort((a, b) => b.percent - a.percent || a.deck.name.localeCompare(b.deck.name));
}

function colourIdentity(cards: CardRecord[]): string {
  const order = ["W", "U", "B", "R", "G"];
  const set = new Set(cards.flatMap((c) => c.ci.split("")));
  return order.filter((c) => set.has(c)).join("");
}

/**
 * Estimated Commander Bracket from Game Changer density only. WotC's bracket
 * system is a self-reported beta and also weighs two-card combos, mass land
 * denial and tutors — this is a floor, not a verdict.
 */
export function estimateBracket(entries: DeckEntry[]): Bracket {
  const gameChangers = entries.filter((e) => e.card.gc).map((e) => e.card.n);
  const count = gameChangers.length;
  if (count === 0) return { floor: 1, label: "1–2", gameChangers };
  if (count <= 3) return { floor: 3, label: "3", gameChangers };
  return { floor: 4, label: "4", gameChangers };
}

/** Legal commanders the collection contains, most colourful first. */
export function ownedCommanders(index: CardIndex, collection: Collection): CardRecord[] {
  const cards: CardRecord[] = [];
  for (const cardIndex of collection.owned.keys()) {
    const card = index.cards[cardIndex];
    if (card?.cmdr) cards.push(card);
  }
  return cards.sort((a, b) => a.n.localeCompare(b.n));
}

/**
 * A missing-cards list a retailer will accept: one line of `<count> <name>`,
 * which is what Cardmarket's wants list, TCGplayer's mass entry and Moxfield all
 * read. Double-faced cards use the front face, since retailers catalogue them
 * that way rather than under the composite name.
 */
export function missingAsText(match: DeckMatch): string {
  return match.missing
    .map((e) => `${e.needed - e.have} ${e.card.n.split("//")[0].trim()}`)
    .join("\n");
}

export function missingAsCsv(match: DeckMatch): string {
  const rows = [
    ["Quantity", "Name", "Category", "Rarity", "Game Changer"],
    ...match.missing.map((e) => [
      String(e.needed - e.have),
      e.card.n,
      e.category,
      e.card.r,
      e.card.gc ? "yes" : "",
    ]),
  ];
  return rows
    .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\n");
}
