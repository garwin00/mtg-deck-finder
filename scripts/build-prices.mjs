/**
 * Builds the price index: the cheapest EUR printing of every card, plus the
 * Cardmarket product it belongs to.
 *
 * Uses the `default_cards` bulk file rather than `oracle_cards` because the
 * latter picks one arbitrary printing per card, and its price is the wrong
 * number — Ashnod's Altar quotes 27% over the cheapest printing, and Watery
 * Grave's chosen printing has no EUR price at all.
 *
 * Kept out of cards.json so it can refresh on its own cadence (Scryfall
 * reprices daily) and so the client only pays for it when a decklist is opened.
 *
 * Run: npm run build:prices
 */
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "data");
const UA = "mtg-deck-finder/0.1 (personal collection tool)";
const ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const log = (...a) => console.log("[build-prices]", ...a);

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

/** The ECB publishes daily reference rates as free XML, no key required. */
async function fetchGbpPerEur() {
  const res = await fetch(ECB, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`ECB returned ${res.status}`);
  const xml = await res.text();
  const rate = xml.match(/currency=['"]GBP['"]\s+rate=['"]([\d.]+)['"]/);
  const date = xml.match(/time=['"]([\d-]+)['"]/);
  if (!rate) throw new Error("no GBP rate in the ECB feed");
  return { gbpPerEur: Number(rate[1]), rateDate: date?.[1] ?? null };
}

async function* streamDefaultCards() {
  const bulk = await (await fetch("https://api.scryfall.com/bulk-data", {
    headers: { "User-Agent": UA },
  })).json();
  const file = bulk.data.find((d) => d.type === "default_cards");
  log(`default_cards updated ${file.updated_at}, ${(file.compressed_size / 1e6).toFixed(0)}MB gz`);
  const res = await fetch(file.jsonl_download_uri, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`bulk download failed: ${res.status}`);
  const lines = createInterface({
    input: Readable.fromWeb(res.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

/**
 * A printing someone could actually buy and play with. Scryfall marks the
 * gold-bordered World Championship reprints as commander-legal because
 * legality is a property of the card, not the printing — but they are
 * collectibles no playgroup accepts, and they are often the cheapest listing.
 * Quoting one would send the user to buy a card they cannot use.
 */
function isBuyable(card) {
  if (card.digital) return false;
  if (card.oversized) return false;
  if (!(card.games ?? []).includes("paper")) return false;
  if (card.border_color === "gold" || card.border_color === "silver") return false;
  if (card.set_type === "memorabilia" || card.set_type === "funny") return false;
  return card.legalities?.commander === "legal";
}

async function main() {
  const index = JSON.parse(await readFile(path.join(OUT_DIR, "cards.json"), "utf8"));
  const aliases = index.aliases;
  log(`card index: ${index.cards.length} cards`);

  const { gbpPerEur, rateDate } = await fetchGbpPerEur();
  log(`ECB rate ${rateDate}: 1 EUR = ${gbpPerEur} GBP`);

  // Cheapest EUR printing per card in our index, and the Cardmarket product
  // that printing belongs to, so the link matches the price quoted.
  const cents = new Array(index.cards.length).fill(0);
  const product = new Array(index.cards.length).fill(0);

  let seen = 0;
  let priced = 0;
  let skipped = 0;
  for await (const card of streamDefaultCards()) {
    seen++;
    if (!isBuyable(card)) {
      skipped++;
      continue;
    }
    const eur = Number.parseFloat(card.prices?.eur ?? "");
    if (!Number.isFinite(eur) || eur <= 0) continue;

    const cardIndex = aliasKeys(card.name)
      .map((k) => aliases[k])
      .find((i) => i !== undefined);
    if (cardIndex === undefined) continue;

    const value = Math.round(eur * 100);
    if (cents[cardIndex] !== 0 && cents[cardIndex] <= value) continue;
    cents[cardIndex] = value;
    const id = card.purchase_uris?.cardmarket?.match(/idProduct=(\d+)/);
    product[cardIndex] = id ? Number(id[1]) : 0;
    priced++;
  }

  const covered = cents.filter((c) => c > 0).length;
  log(`scanned ${seen} printings, skipped ${skipped} unbuyable, ${priced} price improvements`);
  log(`${covered}/${index.cards.length} cards priced`);

  const body = JSON.stringify({
    generatedAt: new Date().toISOString(),
    gbpPerEur,
    rateDate,
    cents,
    product,
  });
  await writeFile(path.join(OUT_DIR, "prices.json"), body);
  log(`wrote prices.json (${(Buffer.byteLength(body) / 1e6).toFixed(2)}MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
