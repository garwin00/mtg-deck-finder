/**
 * Synthesises a ManaBox-shaped collection export for testing: most of one
 * precon, half of another, a quarter of a third, plus a few thousand random
 * cards as bulk noise.
 *
 * Run: node scripts/make-sample-collection.mjs collections/sample-manabox.csv
 */
import { readFileSync, writeFileSync } from "node:fs";
const cards = JSON.parse(readFileSync("public/data/cards.json", "utf8")).cards;
const decks = JSON.parse(readFileSync("public/data/precons.json", "utf8")).decks;

const pick = (n) => decks[Math.floor(decks.length / 2) + n];
const rows = [];
const push = (name, qty) =>
  rows.push([name, "znr", "Zendikar Rising", "1", "normal", "rare", String(qty), "", ""]);

const seen = new Map();
const add = (name, qty) => seen.set(name, (seen.get(name) ?? 0) + qty);

// Near-complete deck, half a deck, and a quarter of a third.
[[0, 0.97], [1, 0.55], [2, 0.25]].forEach(([offset, share]) => {
  const deck = pick(offset);
  deck.cards.forEach(([i, count], idx) => {
    if (idx / deck.cards.length < share) add(cards[i].n, count);
  });
});

// Bulk noise: random cards from the index, some as duplicate printings.
for (let i = 0; i < 3000; i++) {
  const card = cards[Math.floor(Math.random() * cards.length)];
  add(card.n, 1);
}
add("Island", 40);
add("Swamp", 38);

for (const [name, qty] of seen) push(name, qty);

const header = [
  "Name","Set code","Set name","Collector number","Foil","Rarity","Quantity","Scryfall ID","Purchase price",
];
const csv = [header, ...rows]
  .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
  .join("\n");
writeFileSync(process.argv[2], csv);
console.log(`${rows.length} rows; decks used: ${[0,1,2].map(o=>pick(o).name).join(", ")}`);
