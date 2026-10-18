/**
 * Builds the static card + precon index the app ships to the browser.
 *
 * Sources:
 *  - Scryfall bulk `oracle_cards` (one card per oracle id) for card facts.
 *  - MTGJSON `DeckList` + per-deck files for official Commander precon decklists.
 *  - Scryfall search `is:gamechanger` for the official Game Changers list.
 *
 * Output (public/data):
 *  - cards.json    slim records for every card we might need to talk about,
 *                  plus a normalised-name alias map for collection matching.
 *  - precons.json  decklists as indices into cards.json.
 *  - printings.json id, set, mana value and EDHREC rank per card, so the
 *                  browser can build image URLs itself instead of calling
 *                  Scryfall's API — which requires a User-Agent header browser
 *                  JavaScript cannot set.
 *
 * Run: npm run build:data
 */
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "data");
const UA = "mtg-deck-finder/0.1 (personal collection tool)";
const MTGJSON = "https://mtgjson.com/api/v5";

const log = (...a) => console.log("[build-data]", ...a);

/** Normalise a card name for matching across printings, punctuation and accents. */
function normalise(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every key a card should be findable under: full name and each face. */
function aliasKeys(name) {
  const keys = new Set([normalise(name)]);
  if (name.includes("//")) {
    for (const face of name.split("//")) keys.add(normalise(face));
  }
  return [...keys];
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stream the gzipped JSONL bulk file, yielding card objects one at a time. */
async function* streamOracleCards() {
  const bulk = await getJson("https://api.scryfall.com/bulk-data");
  const oracle = bulk.data.find((d) => d.type === "oracle_cards");
  log(`oracle_cards updated ${oracle.updated_at}, ${(oracle.compressed_size / 1e6).toFixed(1)}MB gz`);
  const res = await fetch(oracle.jsonl_download_uri, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`bulk download failed: ${res.status}`);
  const lines = createInterface({
    input: Readable.fromWeb(res.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function fetchGameChangers() {
  const names = new Set();
  let url = "https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards";
  while (url) {
    const page = await getJson(url);
    for (const c of page.data) names.add(c.name);
    url = page.has_more ? page.next_page : null;
    if (url) await sleep(120); // Scryfall asks for ~10 req/s max
  }
  log(`game changers: ${names.size}`);
  return names;
}

async function fetchPrecons() {
  const list = (await getJson(`${MTGJSON}/DeckList.json`)).data
    .filter((d) => d.type === "Commander Deck")
    // Collector's Edition reprints are the same 100 cards in fancier treatments.
    .filter((d) => !/Collector's Edition/i.test(d.name));
  log(`commander precons in DeckList: ${list.length}`);

  const decks = [];
  for (let i = 0; i < list.length; i++) {
    const meta = list[i];
    try {
      const deck = (await getJson(`${MTGJSON}/decks/${meta.fileName}.json`)).data;
      decks.push({
        id: meta.fileName,
        name: deck.name,
        code: deck.code,
        release: deck.releaseDate,
        commanders: (deck.commander ?? []).map((c) => c.name),
        // sideBoard on commander products is normally empty; mainBoard is the 99.
        entries: [...(deck.mainBoard ?? []), ...(deck.commander ?? [])].map((c) => ({
          name: c.name,
          count: c.count ?? 1,
        })),
      });
    } catch (err) {
      console.warn(`[build-data] skipped ${meta.fileName}: ${err.message}`);
    }
    if (i % 25 === 0) log(`  fetched ${i}/${list.length} decks`);
    await sleep(60);
  }
  return decks;
}

async function main() {
  const precons = await fetchPrecons();
  const gameChangers = await fetchGameChangers();

  // Cards that must be kept even though they aren't Commander-legal: precon
  // contents (precons ship cards that were later banned, e.g. Mana Crypt) and
  // the Game Changers list. Everything Commander-legal is kept regardless.
  const wanted = new Set();
  for (const deck of precons) {
    for (const e of deck.entries) for (const k of aliasKeys(e.name)) wanted.add(k);
  }
  for (const name of gameChangers) for (const k of aliasKeys(name)) wanted.add(k);

  /** cards[] records, plus alias -> index. */
  const cards = [];
  const byAlias = new Map();
  /** Parallel to cards[]: the printing to show, and what to show about it. */
  const printings = [];

  const addCard = (c, { withArt = false } = {}) => {
    const record = {
      n: c.name,
      t: c.type_line ?? "",
      ci: (c.color_identity ?? []).join(""),
      r: c.rarity ?? "",
    };
    if (gameChangers.has(c.name)) record.gc = 1;
    if (isCommanderCandidate(c)) record.cmdr = 1;
    if (isBasicLand(c)) record.basic = 1;
    // Kept for precons and the Game Changers list, but a deck built from the
    // collection must never suggest one.
    if (c.legalities?.commander !== "legal") record.ban = 1;
    record.cat = categorise(c);
    if (withArt) {
      const art = c.image_uris?.art_crop ?? c.card_faces?.[0]?.image_uris?.art_crop;
      if (art) record.art = art;
      // Scryfall require the artist to be credited wherever an art crop is
      // shown, unless the full card is shown in the same interface.
      const artist = c.artist ?? c.card_faces?.[0]?.artist;
      if (artist) record.artist = artist;
    }
    const index = cards.push(record) - 1;
    printings.push({ id: c.id, set: c.set ?? "", cmc: c.cmc ?? 0, rank: c.edhrec_rank ?? 0 });
    for (const k of aliasKeys(c.name)) if (!byAlias.has(k)) byAlias.set(k, index);
    return index;
  };

  // Keep the whole Commander-legal card pool, not just what precons use. Any
  // deck source we match against (precons now, EDHREC average decks next) draws
  // from the full pool, and a card missing from the index silently drops out of
  // both sides of a completion percentage rather than failing loudly.
  let seen = 0;
  const pool = [];
  for await (const c of streamOracleCards()) {
    seen++;
    if (!isPlayable(c)) continue;
    const commander = isCommanderCandidate(c);
    const legal = c.legalities?.commander === "legal";
    const needed = legal || commander || aliasKeys(c.name).some((k) => wanted.has(k));
    if (needed) pool.push({ card: c, commander });
  }

  // Reversible Secret Lair printings are real cards but duplicate a name, so let
  // the normal printing claim the alias key first and drop the duplicate.
  const ordered = [
    ...pool.filter((p) => p.card.layout !== "reversible_card"),
    ...pool.filter((p) => p.card.layout === "reversible_card"),
  ];
  let shadowed = 0;
  for (const { card, commander } of ordered) {
    // Drop only a true duplicate — every key already claimed. A card that
    // merely shares one face name with an older card keeps its other keys:
    // "Spellbook Seeker // Careful Study" must not vanish because "Careful
    // Study" has existed since Odyssey. addCard never steals a claimed key.
    if (aliasKeys(card.name).every((k) => byAlias.has(k))) {
      shadowed++;
      continue;
    }
    addCard(card, { withArt: commander });
  }
  log(`scanned ${seen} oracle cards, kept ${cards.length}, dropped ${shadowed} duplicate names`);

  // Resolve precon entries to card indices; drop basics from the matchable list.
  const decks = precons.map((deck) => {
    const cardRefs = [];
    // Which basics, not just how many: a decklist is unbuildable without its
    // mana base, so the split has to survive into the app.
    const basicRefs = new Map();
    const unresolved = [];
    for (const e of deck.entries) {
      // MTGJSON writes meld and some Secret Lair cards as "Name // Name", so
      // try every face key rather than the composite name alone.
      const idx = aliasKeys(e.name)
        .map((k) => byAlias.get(k))
        .find((i) => i !== undefined);
      if (idx === undefined) {
        unresolved.push(e.name);
        continue;
      }
      if (cards[idx].basic) {
        basicRefs.set(idx, (basicRefs.get(idx) ?? 0) + e.count);
        continue;
      }
      cardRefs.push([idx, e.count]);
    }
    if (unresolved.length) {
      console.warn(`[build-data] ${deck.id}: unresolved ${unresolved.join(", ")}`);
    }
    return {
      id: deck.id,
      name: deck.name,
      code: deck.code,
      release: deck.release,
      commanders: deck.commanders
        .map((n) => aliasKeys(n).map((k) => byAlias.get(k)).find((i) => i !== undefined))
        .filter((i) => i !== undefined),
      basics: [...basicRefs],
      cards: cardRefs,
    };
  });

  await mkdir(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  // Sizes go in a manifest because the loading UI needs a real total to measure
  // against: Content-Length is the brotli-compressed size while the stream
  // yields decompressed bytes, so progress against it runs well past 100%.
  const written = {};
  const write = async (name, payload) => {
    const body = JSON.stringify(payload);
    await writeFile(path.join(OUT_DIR, name), body);
    written[name.replace(/\.json$/, "")] = { bytes: Buffer.byteLength(body) };
  };

  await write("cards.json", { generatedAt, cards, aliases: Object.fromEntries(byAlias) });

  // Set codes repeat heavily, so they are interned; ids lose their dashes and
  // are rebuilt on the client. Kept out of cards.json so the upload path does
  // not pay for data only a deck page needs.
  const setCodes = [];
  const setAt = new Map();
  const sets = [];
  for (const p of printings) {
    if (!setAt.has(p.set)) {
      setAt.set(p.set, setCodes.push(p.set) - 1);
    }
    sets.push(setAt.get(p.set));
  }
  await write("printings.json", {
    generatedAt,
    setCodes,
    ids: printings.map((p) => p.id.replace(/-/g, "")),
    sets,
    cmc: printings.map((p) => p.cmc),
    // Scryfall's copy of EDHREC's all-decks popularity rank, 0 when unranked.
    // Orders the last-resort fill, where no commander-specific data reaches.
    rank: printings.map((p) => p.rank),
  });
  await write("precons.json", { generatedAt, gameChangerCount: gameChangers.size, decks });
  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify({ generatedAt, files: written })
  );
  log(`wrote ${cards.length} cards and ${decks.length} decks to public/data`);
}

/**
 * Filters out things that carry a real card's name but aren't that card: art
 * series inserts (type line "Card // Card"), tokens and emblems. Left in, an art card shadows the real one in the alias map — which
 * is how basic lands ended up being counted as deck cards.
 */
const UNPLAYABLE_LAYOUTS = new Set([
  "art_series",
  "token",
  "double_faced_token",
  "emblem",
  "vanguard",
]);

function isPlayable(c) {
  // Note: no filter on `games`. Several paper cards (Goblin Lackey, Coastal
  // Tower) have an MTGO-only chosen printing in the oracle export, so filtering
  // on paper availability silently drops real precon cards.
  return !UNPLAYABLE_LAYOUTS.has(c.layout);
}

/** A card can head a Commander deck. Mirrors the rules, not a hardcoded list. */
function isCommanderCandidate(c) {
  if (c.legalities?.commander !== "legal") return false;
  const type = c.type_line ?? "";
  const text = `${c.oracle_text ?? ""} ${(c.card_faces ?? []).map((f) => f.oracle_text ?? "").join(" ")}`;
  if (/can be your commander/i.test(text)) return true;
  return /Legendary/.test(type) && /Creature/.test(type);
}

/**
 * Functional bucket for the decklist view, computed here so the client never
 * needs oracle text. Deliberately coarse: creatures stay creatures unless
 * they're obviously mana ramp, which is how most decklist writeups read.
 */
function categorise(c) {
  const type = c.type_line ?? "";
  const text = [c.oracle_text ?? "", ...(c.card_faces ?? []).map((f) => f.oracle_text ?? "")]
    .join("\n")
    .toLowerCase();

  if (/\bland\b/i.test(type) && !/creature/i.test(type)) return "land";

  const isCreature = /creature/i.test(type);
  const ramp =
    /add \{/.test(text) ||
    /search your library for (a|up to \w+)[^.]*\blands?\b/.test(text) ||
    /lands? you control (become|becomes)/.test(text);
  if (ramp) return "ramp";
  if (isCreature) return "creature";

  if (/destroy all|exile all|sacrifices? (all|\w+ creatures)|deals \d+ damage to each creature/.test(text))
    return "wipe";
  if (/counter target/.test(text)) return "counter";
  if (/destroy target|exile target|deals \d+ damage to (any target|target)|target (creature|player) sacrifices|gets -\d+\/-\d+/.test(text))
    return "removal";
  if (/draw (a|one|two|three|four|five|\w+) cards?/.test(text)) return "draw";
  if (/planeswalker/i.test(type)) return "planeswalker";
  if (/battle/i.test(type)) return "battle";
  if (/artifact/i.test(type)) return "artifact";
  if (/enchantment/i.test(type)) return "enchantment";
  if (/instant/i.test(type)) return "instant";
  if (/sorcery/i.test(type)) return "sorcery";
  return "other";
}

function isBasicLand(c) {
  return /Basic/.test(c.type_line ?? "") && /Land/.test(c.type_line ?? "");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
