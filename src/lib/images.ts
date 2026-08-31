/**
 * Card images, fetched from Scryfall on demand.
 *
 * Their /cards/collection endpoint takes up to 75 identifiers per POST, matches
 * on name, and is CORS-open — so a 100-card deck costs two requests and the
 * card index carries no image URLs at all.
 */
const ENDPOINT = "https://api.scryfall.com/cards/collection";
const CHUNK = 75;

type ScryfallCard = {
  name: string;
  image_uris?: { normal?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
};

/** Card name -> image URL. Names Scryfall can't place are simply absent. */
export async function fetchCardImages(names: string[]): Promise<Map<string, string>> {
  const images = new Map<string, string>();
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
      const url = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
      if (url) images.set(card.name, url);
    }
  }
  return images;
}
