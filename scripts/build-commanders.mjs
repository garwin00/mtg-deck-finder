/**
 * Builds the commander catalogue: which commanders EDHREC ranks, their exact
 * average-deck slug, and how many decks exist for each.
 *
 * Deliberately does NOT fetch decklists. The browser pulls one average deck
 * straight from EDHREC when the user opens a commander (their JSON is
 * CORS-open), so nothing of theirs is copied onto our domain and there is no
 * bulk crawl — 32 requests here, then one per deck the user actually opens.
 *
 * Taking the slug from this listing rather than deriving it from the card name
 * also fixes the names that don't slugify cleanly (M.O.D.O.K., double-faced
 * commanders).
 *
 * Also inverts EDHREC's theme pages into commander -> themes, for the archetype
 * and tribe filters. Each theme page lists its top commanders, so this is 435
 * requests rather than one per commander, and the result is "EDHREC's leading
 * commanders for this theme" rather than an exhaustive tagging.
 *
 * Reads public/data/cards.json for the alias map, so run `npm run build:data`
 * first.
 *
 * Run: npm run build:commanders
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "data");
const UA = "mtg-deck-finder/0.1 (personal collection tool)";
const EDHREC = "https://json.edhrec.com/pages";

/** EDHREC groups commanders into these colour-identity buckets, 100 in each. */
const BUCKETS = [
  "mono-white", "mono-blue", "mono-black", "mono-red", "mono-green", "colorless",
  "azorius", "dimir", "rakdos", "gruul", "selesnya", "orzhov", "izzet", "golgari", "boros", "simic",
  "bant", "esper", "grixis", "jund", "naya", "abzan", "jeskai", "sultai", "mardu", "temur",
  "glint-eye", "dune-brood", "ink-treader", "witch-maw", "yore-tiller", "five-color",
];

const TAG_SITEMAP = "https://edhrec.com/sitemaps/tags.xml";
const CREATURE_TYPES = "https://api.scryfall.com/catalog/creature-types";

const log = (...a) => console.log("[build-commanders]", ...a);

/** Run tasks with a bounded number in flight. */
async function pool(items, size, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        await worker(items[i]);
      }
    })
  );
}

/**
 * EDHREC's theme slugs. The sitemap also carries colour-filtered variants
 * (activated-abilities/azorius); only the bare themes are wanted.
 */
async function fetchThemeSlugs() {
  const res = await fetch(TAG_SITEMAP, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`tag sitemap ${res.status}`);
  const xml = await res.text();
  const slugs = new Set();
  for (const m of xml.matchAll(/<loc>[^<]*\/tags\/([a-z0-9-]+)<\/loc>/g)) slugs.add(m[1]);
  return [...slugs];
}

/**
 * Themes split into tribes and archetypes by checking the slug against
 * Scryfall's creature-type catalogue, since EDHREC doesn't distinguish them.
 * Their slugs are plural: zombies -> zombie, elves -> elf, allies -> ally.
 */
async function fetchCreatureTypes() {
  const res = await fetch(CREATURE_TYPES, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`creature types ${res.status}`);
  const { data } = await res.json();
  return new Set(data.map((t) => t.toLowerCase()));
}

function isTribe(slug, creatureTypes) {
  const words = slug.replace(/-/g, " ");
  return [
    words,
    words.replace(/ies$/, "y"),
    words.replace(/ves$/, "f"),
    words.replace(/es$/, ""),
    words.replace(/s$/, ""),
  ].some((candidate) => creatureTypes.has(candidate));
}

/** commander slug -> theme slugs, plus each theme's display label. */
async function fetchThemes() {
  const slugs = await fetchThemeSlugs();
  const creatureTypes = await fetchCreatureTypes();
  log(`${slugs.length} themes to invert`);

  const labels = new Map();
  const byCommander = new Map();
  let done = 0;
  let failed = 0;

  await pool(slugs, 6, async (slug) => {
    try {
      const page = await getJson(`${EDHREC}/tags/${slug}.json`);
      // header is the display name, e.g. "+1/+1 Counters" for
      // plus-1-plus-1-counters, which no slug transform would recover.
      labels.set(slug, page.header || slug);
      for (const list of page.container?.json_dict?.cardlists ?? []) {
        if (!/Commanders/i.test(list.header)) continue;
        for (const cv of list.cardviews) {
          if (!byCommander.has(cv.sanitized)) byCommander.set(cv.sanitized, new Set());
          byCommander.get(cv.sanitized).add(slug);
        }
      }
    } catch {
      failed++;
    }
    if (++done % 100 === 0) log(`  ${done}/${slugs.length} themes`);
  });

  log(`inverted ${done - failed} themes, ${failed} failed, ${byCommander.size} commanders tagged`);
  return { labels, byCommander, creatureTypes };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalise(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliasKeys(name) {
  const keys = new Set([normalise(name)]);
  if (name.includes("//")) for (const face of name.split("//")) keys.add(normalise(face));
  return [...keys];
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

/**
 * Every commander EDHREC ranks, with its exact slug and deck count. Taking the
 * slug from here rather than deriving it from the card name also sidesteps the
 * names that don't slugify cleanly (M.O.D.O.K., double-faced commanders).
 */
async function fetchPopularity() {
  const found = new Map();
  for (const bucket of BUCKETS) {
    try {
      const page = await getJson(`${EDHREC}/commanders/${bucket}.json`);
      for (const list of page.container?.json_dict?.cardlists ?? []) {
        for (const cv of list.cardviews) {
          if (!found.has(cv.sanitized)) {
            found.set(cv.sanitized, { slug: cv.sanitized, name: cv.name, numDecks: cv.num_decks ?? 0 });
          }
        }
      }
    } catch (err) {
      console.warn(`[build-commanders] bucket ${bucket} failed: ${err.message}`);
    }
    await sleep(150);
  }
  return [...found.values()].sort((a, b) => b.numDecks - a.numDecks);
}

async function main() {
  const index = JSON.parse(await readFile(path.join(OUT_DIR, "cards.json"), "utf8"));
  const resolve = (name) => aliasKeys(name).map((k) => index.aliases[k]).find((i) => i !== undefined);
  log(`card index: ${index.cards.length} cards`);

  const ranked = await fetchPopularity();
  log(`EDHREC ranks ${ranked.length} commanders`);

  const { labels, byCommander, creatureTypes } = await fetchThemes();

  // Only themes something in the catalogue actually uses are worth shipping.
  const used = new Set();
  for (const entry of ranked) for (const t of byCommander.get(entry.slug) ?? []) used.add(t);

  const tribes = [];
  const archetypes = [];
  for (const slug of [...used].sort()) {
    const target = isTribe(slug, creatureTypes) ? tribes : archetypes;
    target.push({ s: slug, l: labels.get(slug) ?? slug });
  }
  const tribeAt = new Map(tribes.map((t, i) => [t.s, i]));
  const archetypeAt = new Map(archetypes.map((a, i) => [a.s, i]));
  log(`${tribes.length} tribes, ${archetypes.length} archetypes`);

  const unresolved = [];
  const decks = [];
  for (const entry of ranked) {
    const cardIndex = resolve(entry.name);
    if (cardIndex === undefined) {
      unresolved.push(entry.name);
      continue;
    }
    const themes = [...(byCommander.get(entry.slug) ?? [])];
    const deck = { s: entry.slug, c: cardIndex, n: entry.numDecks };
    const t = themes.filter((x) => tribeAt.has(x)).map((x) => tribeAt.get(x));
    const a = themes.filter((x) => archetypeAt.has(x)).map((x) => archetypeAt.get(x));
    if (t.length) deck.t = t;
    if (a.length) deck.a = a;
    decks.push(deck);
  }
  const tagged = decks.filter((d) => d.t || d.a).length;
  log(`${tagged}/${decks.length} commanders have at least one theme`);

  await mkdir(OUT_DIR, { recursive: true });
  const body = JSON.stringify({
    generatedAt: new Date().toISOString(),
    tribes,
    archetypes,
    decks,
  });
  await writeFile(path.join(OUT_DIR, "commanders.json"), body);
  log(`wrote ${decks.length} commanders (${(Buffer.byteLength(body) / 1e3).toFixed(0)}KB)`);
  if (unresolved.length) {
    log(`unresolved commander names: ${unresolved.length} (${unresolved.slice(0, 6).join(", ")})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
