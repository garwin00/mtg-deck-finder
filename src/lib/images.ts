/**
 * Card printings, fetched from Scryfall on demand.
 *
 * Their /cards/collection endpoint takes up to 75 identifiers per POST, matches
 * on name, and is CORS-open — so a 100-card deck costs two requests and the
 * card index carries no image URLs at all.
 *
 * Scryfall picks the printing for a name query, so the set reported here is the
 * one the image shows rather than the copy the user owns. Cards are matched by
 * name and not by printing, so there is no single right answer; keeping the set
 * and the art from the same printing at least keeps the tile self-consistent.
 */
const ENDPOINT = "https://api.scryfall.com/cards/collection";
const CHUNK = 75;

type ScryfallCard = {
  name: string;
  set?: string;
  set_name?: string;
  mana_cost?: string;
  rarity?: string;
  image_uris?: { normal?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
};

export type CardDetail = {
  image?: string;
  set?: string;
  setName?: string;
  manaCost?: string;
  rarity?: string;
};

/** Card name -> printing detail. Names Scryfall can't place are simply absent. */
export async function fetchCardDetails(names: string[]): Promise<Map<string, CardDetail>> {
  const details = new Map<string, CardDetail>();
  const unique = [...new Set(names)];

  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    });
    if (!res.ok) continue;
    const payload = (await res.json()) as { data?: ScryfallCard[] };
    for (const card of payload.data ?? []) {
      details.set(card.name, {
        image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
        set: card.set,
        setName: card.set_name,
        manaCost: card.mana_cost,
        rarity: card.rarity,
      });
    }
  }
  return details;
}

/** Scryfall's set icons are unfilled, so they need inverting on a dark ground. */
export function setIconUrl(set: string): string {
  return `https://svgs.scryfall.io/sets/${set}.svg`;
}
