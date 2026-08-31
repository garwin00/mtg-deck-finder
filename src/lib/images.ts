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
const NAMED = "https://api.scryfall.com/cards/named";
const CHUNK = 75;
/** Cap the one-at-a-time fallback so a bad deck can't spray requests. */
const MAX_EXACT = 12;

type ScryfallCard = {
  name: string;
  set?: string;
  set_name?: string;
  mana_cost?: string;
  cmc?: number;
  rarity?: string;
  image_uris?: { normal?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
};

export type CardDetail = {
  image?: string;
  set?: string;
  setName?: string;
  manaCost?: string;
  /** Mana value, for the curve. */
  cmc?: number;
  rarity?: string;
};

/** Front face of a multi-part name: "A // B" -> "A". */
function frontFace(name: string): string {
  const [front] = name.split("//");
  return front.trim() || name;
}

async function lookup(identifiers: string[]): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  for (let i = 0; i < identifiers.length; i += CHUNK) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifiers: identifiers.slice(i, i + CHUNK).map((name) => ({ name })),
      }),
    });
    if (!res.ok) continue;
    const payload = (await res.json()) as { data?: ScryfallCard[] };
    cards.push(...(payload.data ?? []));
  }
  return cards;
}

function detailOf(card: ScryfallCard): CardDetail {
  return {
    // Transform and modal cards carry no top-level image; the front face is
    // the one to show.
    image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
    set: card.set,
    setName: card.set_name,
    manaCost: card.mana_cost,
    cmc: card.cmc,
    rarity: card.rarity,
  };
}

/**
 * Card name -> printing detail. Names Scryfall can't place are simply absent.
 *
 * Two passes, because the endpoint rejects a full double-faced name — asking
 * for "Bloodline Keeper // Lord of Lineage" puts it in not_found — while the
 * front face alone resolves and comes back under the full name.
 *
 * Asking by front face for everything is not safe: a front face can be another
 * card's whole name, and "Careful Study" in the same request as "Spellbook
 * Seeker // Careful Study" collapses onto the double-faced card. So exact names
 * go first and only what genuinely failed is retried by front face, with the
 * returned name checked against what was wanted.
 */
export async function fetchCardDetails(names: string[]): Promise<Map<string, CardDetail>> {
  const details = new Map<string, CardDetail>();
  const wanted = [...new Set(names)];

  for (const card of await lookup(wanted)) {
    details.set(card.name, detailOf(card));
  }

  const retry = wanted.filter((name) => !details.has(name) && name.includes("//"));
  if (retry.length > 0) {
    const expected = new Map(retry.map((name) => [frontFace(name), name]));
    for (const card of await lookup([...expected.keys()])) {
      if (expected.get(frontFace(card.name)) !== card.name) continue;
      details.set(card.name, detailOf(card));
    }
  }

  // Ten cards in the index share their whole name with one face of a
  // double-faced card — Lightning Bolt, Demonic Tutor, Swords to Plowshares
  // and other staples. In a batch the identifier matches the double-faced card
  // instead, leaving the real one with nothing. /cards/named?exact= is not
  // ambiguous, so pick those off individually.
  const stragglers = wanted.filter((name) => !details.has(name)).slice(0, MAX_EXACT);
  for (const name of stragglers) {
    try {
      const res = await fetch(`${NAMED}?exact=${encodeURIComponent(name)}`);
      if (!res.ok) continue;
      const card = (await res.json()) as ScryfallCard;
      if (card.name === name) details.set(card.name, detailOf(card));
    } catch {
      // A card without art still renders as its name.
    }
  }
  return details;
}

/** Scryfall's set icons are unfilled, so they need inverting on a dark ground. */
export function setIconUrl(set: string): string {
  return `https://svgs.scryfall.io/sets/${set}.svg`;
}
