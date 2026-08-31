export type Category =
  | "land"
  | "ramp"
  | "creature"
  | "wipe"
  | "counter"
  | "removal"
  | "draw"
  | "planeswalker"
  | "battle"
  | "artifact"
  | "enchantment"
  | "instant"
  | "sorcery"
  | "other";

/** Slim card record as emitted by scripts/build-data.mjs. */
export type CardRecord = {
  /** Full Scryfall name (both faces for DFCs). */
  n: string;
  /** Type line. */
  t: string;
  /** Colour identity as a letter string, e.g. "BU". */
  ci: string;
  r: string;
  cat: Category;
  /** On the official Game Changers list. */
  gc?: 1;
  /** Legal as a commander. */
  cmdr?: 1;
  basic?: 1;
  /** Art crop URL, only present for commander candidates. */
  art?: string;
  /** Credited wherever the art crop is shown, as Scryfall require. */
  artist?: string;
};

export type CardIndex = {
  generatedAt: string;
  cards: CardRecord[];
  /** Normalised name (and each DFC face) -> index into `cards`. */
  aliases: Record<string, number>;
};

export type Precon = {
  id: string;
  name: string;
  code: string;
  release: string;
  /** Indices into CardIndex.cards. */
  commanders: number[];
  /** Basic lands the deck runs, as `[cardIndex, count]`. Not scored. */
  basics: [number, number][];
  /** [cardIndex, count] for every non-basic card. */
  cards: [number, number][];
};

/**
 * Commanders EDHREC ranks: slug, the card index it resolves to, and how many
 * decks exist for it. Decklists are not included — the browser fetches one
 * from EDHREC when the user opens it.
 */
export type CommanderCatalogue = {
  generatedAt: string;
  /** Theme vocabularies, split so tribes and archetypes can be offered apart. */
  tribes: { s: string; l: string }[];
  archetypes: { s: string; l: string }[];
  /** `t` and `a` index into those vocabularies. */
  decks: { s: string; c: number; n: number; t?: number[]; a?: number[] }[];
};

export type PreconIndex = {
  generatedAt: string;
  gameChangerCount: number;
  decks: Precon[];
};

export const CATEGORY_ORDER: Category[] = [
  "creature",
  "ramp",
  "draw",
  "removal",
  "wipe",
  "counter",
  "artifact",
  "enchantment",
  "instant",
  "sorcery",
  "planeswalker",
  "battle",
  "other",
  "land",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  creature: "Creatures",
  ramp: "Ramp & mana",
  draw: "Card draw",
  removal: "Removal",
  wipe: "Board wipes",
  counter: "Counterspells",
  artifact: "Artifacts",
  enchantment: "Enchantments",
  instant: "Instants",
  sorcery: "Sorceries",
  planeswalker: "Planeswalkers",
  battle: "Battles",
  other: "Other",
  land: "Lands",
};
