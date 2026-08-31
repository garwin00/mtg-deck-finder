/**
 * The printing to show for each card, indexed the same way as cards.json.
 *
 * This exists so the browser never calls api.scryfall.com. Scryfall require a
 * User-Agent header on every API request and browser JavaScript cannot set one,
 * so any client-side call to them is non-compliant by construction. Image URLs
 * are derivable from a card's id, and cards.scryfall.io is a CDN rather than
 * the API, so it carries no such requirement.
 */
export type PrintingIndex = {
  generatedAt: string;
  /** Interned set codes; `sets` indexes into this. */
  setCodes: string[];
  /** Scryfall ids with the dashes stripped, parallel to cards.json. */
  ids: string[];
  sets: number[];
  cmc: number[];
};

function withDashes(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Scryfall's image path buckets on the first two characters of the id. `front`
 * is the face to show: double-faced cards have no single-image form.
 */
export function cardImageUrl(
  printings: PrintingIndex,
  cardIndex: number,
  size: "small" | "normal" = "normal"
): string | undefined {
  const hex = printings.ids[cardIndex];
  if (!hex) return undefined;
  const id = withDashes(hex);
  return `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;
}

export function setCodeOf(printings: PrintingIndex, cardIndex: number): string | undefined {
  return printings.setCodes[printings.sets[cardIndex]] || undefined;
}

export function manaValueOf(printings: PrintingIndex, cardIndex: number): number | undefined {
  const cmc = printings.cmc[cardIndex];
  return cmc === undefined ? undefined : cmc;
}

/** Scryfall's set icons are unfilled, so they need inverting on a dark ground. */
export function setIconUrl(set: string): string {
  return `https://svgs.scryfall.io/sets/${set}.svg`;
}
