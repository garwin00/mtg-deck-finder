/**
 * SPIKE — not production. Answers three questions about using EDHREC's average
 * decks as the V2 reference-decklist source:
 *
 *   1. Can we derive an average-deck slug from a commander's card name, or do we
 *      need to ship a name -> slug map?
 *   2. Do the card names in an average deck resolve against our existing index?
 *   3. What do completion percentages actually look like for a real collection?
 *
 * Run: node scripts/spike-edhrec.mjs [collection.csv] [--decks N]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const UA = "mtg-deck-finder/0.1 (personal collection tool)";
const SITEMAP = "https://edhrec.com/sitemaps/average-decks.xml";
const JSON_BASE = "https://json.edhrec.com/pages/average-decks";
const DATA = path.join(process.cwd(), "public", "data");

const log = (...a) => console.log("[spike]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Same normalisation the app uses, so alias lookups line up. */
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

/**
 * Guess the EDHREC slug for a commander. Their slugs drop apostrophes entirely
 * rather than turning them into separators, so "Praetors' Voice" is
 * "praetors-voice" and not "praetors--voice".
 */
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchSlugs() {
  const res = await fetch(SITEMAP, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();
  return new Set([...xml.matchAll(/<loc>[^<]*\/average-decks\/([^<]+)<\/loc>/g)].map((m) => m[1]));
}

/** Flatten an average deck's category buckets into [name, count] pairs. */
function entriesOf(payload) {
  const out = [];
  for (const [category, list] of Object.entries(payload.deck?.cards ?? {})) {
    for (const [name, count] of list) out.push({ name, count, category });
  }
  return out;
}

/** Minimal CSV read — enough for a ManaBox export, not a general parser. */
async function readCollection(file, aliases) {
  const text = await readFile(file, "utf8");
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = header.split(",").map((h) => h.trim().toLowerCase());
  const nameCol = cols.indexOf("name");
  const qtyCol = cols.indexOf("quantity");
  const owned = new Map();
  for (const line of lines) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
    const name = cells[nameCol]?.trim();
    if (!name) continue;
    const qty = Number.parseInt(cells[qtyCol] ?? "1", 10) || 1;
    const idx = aliasKeys(name).map((k) => aliases[k]).find((i) => i !== undefined);
    if (idx !== undefined) owned.set(idx, (owned.get(idx) ?? 0) + qty);
  }
  return owned;
}

async function main() {
  const args = process.argv.slice(2);
  const flagAt = args.indexOf("--decks");
  const limit = flagAt === -1 ? 40 : Number(args[flagAt + 1]) || 40;
  const positional = args.filter((a, i) => !a.startsWith("--") && i !== flagAt + 1);
  const csv = positional[0] ?? "collections/sample-manabox.csv";

  const index = JSON.parse(await readFile(path.join(DATA, "cards.json"), "utf8"));
  log(`card index: ${index.cards.length} cards`);

  const owned = await readCollection(csv, index.aliases);
  log(`collection: ${csv} -> ${owned.size} distinct cards matched`);

  const ownedCommanders = [...owned.keys()]
    .map((i) => ({ i, card: index.cards[i] }))
    .filter((c) => c.card?.cmdr);
  log(`legal commanders owned: ${ownedCommanders.length}`);

  // Q1: slug derivation.
  const slugs = await fetchSlugs();
  log(`sitemap: ${slugs.size} average-deck slugs`);
  const resolved = ownedCommanders.map((c) => ({ ...c, slug: slugify(c.card.n.split(" // ")[0]) }));
  const hits = resolved.filter((c) => slugs.has(c.slug));
  const misses = resolved.filter((c) => !slugs.has(c.slug));
  log(`slug guess hit rate: ${hits.length}/${resolved.length} (${((hits.length / resolved.length) * 100).toFixed(1)}%)`);
  if (misses.length) log(`  sample misses: ${misses.slice(0, 12).map((m) => `${m.card.n} -> ${m.slug}`).join(" | ")}`);

  // Q2 + Q3: fetch a sample of decks and score them.
  const sample = hits.slice(0, limit);
  log(`fetching ${sample.length} average decks…`);
  const results = [];
  const unresolvedNames = new Set();
  const allNames = new Set();
  const saturation = [];
  let failed = 0;

  for (const { card, slug } of sample) {
    try {
      const res = await fetch(`${JSON_BASE}/${slug}.json`, { headers: { "User-Agent": UA } });
      if (!res.ok) { failed++; continue; }
      const payload = await res.json();
      const entries = entriesOf(payload);
      let total = 0;
      let have = 0;
      let basics = 0;
      let missingFromIndex = 0;
      let deckCards = 0;
      for (const e of entries) {
        deckCards += e.count;
        allNames.add(e.name);
        const idx = aliasKeys(e.name).map((k) => index.aliases[k]).find((i) => i !== undefined);
        if (idx === undefined) {
          unresolvedNames.add(e.name);
          missingFromIndex += e.count;
          continue;
        }
        if (index.cards[idx].basic) { basics += e.count; continue; }
        total += e.count;
        have += Math.min(owned.get(idx) ?? 0, e.count);
      }
      saturation.push([results.length + 1, allNames.size, unresolvedNames.size]);
      results.push({
        name: card.n,
        slug,
        entries: entries.length,
        deckCards,
        total,
        basics,
        missingFromIndex,
        have,
        percent: total ? (have / total) * 100 : 0,
        brackets: payload.bracket_counts,
      });
    } catch {
      failed++;
    }
    await sleep(150); // be polite
  }

  log(`fetched ${results.length}, failed ${failed}`);
  log(`unresolved card names across all decks: ${unresolvedNames.size}`);
  if (unresolvedNames.size) log(`  ${[...unresolvedNames].slice(0, 15).join(" | ")}`);

  const sizes = results.map((r) => r.total + r.basics);
  if (sizes.length) {
    sizes.sort((a, b) => a - b);
    log(`deck sizes (incl. basics): min ${sizes[0]} median ${sizes[Math.floor(sizes.length / 2)]} max ${sizes.at(-1)}`);
  }

  console.log("\nTop matches by completion:");
  for (const r of results.sort((a, b) => b.percent - a.percent).slice(0, 15)) {
    const b = r.brackets ?? {};
    const modal = Object.entries(b).sort((x, y) => y[1] - x[1])[0];
    console.log(
      `  ${r.percent.toFixed(1).padStart(5)}%  ${String(r.have).padStart(3)}/${String(r.total).padEnd(3)}  ${r.name}` +
        (modal ? `  (most decks bracket ${modal[0]})` : "")
    );
  }

  // How complete is each deck once unknown cards are dropped? Anything well
  // under 100 means the percentages above are scored on a partial decklist.
  const coverage = results.map((r) => ((r.deckCards - r.missingFromIndex) / r.deckCards) * 100);
  const avgCoverage = coverage.reduce((a, b) => a + b, 0) / coverage.length;
  const fullDeck = results.map((r) => r.deckCards);
  console.log("");
  log(`decklist size as published: median ${median(fullDeck)} cards`);
  log(`index coverage of those cards: ${avgCoverage.toFixed(1)}% average (${Math.min(...coverage).toFixed(0)}% worst)`);
  log(`distinct card names seen: ${allNames.size}, of which ${unresolvedNames.size} are absent from cards.json (${((unresolvedNames.size / allNames.size) * 100).toFixed(1)}%)`);

  // Saturation: are new names still arriving, or has the universe converged?
  const marks = [1, 10, 25, 50, 100, 150, 200].filter((m) => m <= saturation.length);
  log(`name saturation (decks -> distinct names / unknown):`);
  for (const m of marks) {
    const [, names, unknown] = saturation[m - 1];
    log(`  ${String(m).padStart(4)} decks -> ${String(names).padStart(5)} names, ${String(unknown).padStart(5)} unknown`);
  }
  const lastTen = saturation.slice(-10);
  if (lastTen.length === 10) {
    const rate = (lastTen.at(-1)[1] - lastTen[0][1]) / 10;
    log(`  new names per deck over the last 10: ${rate.toFixed(1)}`);
  }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

main().catch((e) => { console.error(e); process.exit(1); });
