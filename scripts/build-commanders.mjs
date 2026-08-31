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

const log = (...a) => console.log("[build-commanders]", ...a);
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

  const unresolved = [];
  const decks = [];
  for (const entry of ranked) {
    const cardIndex = resolve(entry.name);
    if (cardIndex === undefined) {
      unresolved.push(entry.name);
      continue;
    }
    decks.push({ s: entry.slug, c: cardIndex, n: entry.numDecks });
  }

  await mkdir(OUT_DIR, { recursive: true });
  const body = JSON.stringify({ generatedAt: new Date().toISOString(), decks });
  await writeFile(path.join(OUT_DIR, "commanders.json"), body);
  log(`wrote ${decks.length} commanders (${(Buffer.byteLength(body) / 1e3).toFixed(0)}KB)`);
  if (unresolved.length) {
    log(`unresolved commander names: ${unresolved.length} (${unresolved.slice(0, 6).join(", ")})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
