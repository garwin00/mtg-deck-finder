# Deck Finder

Upload a Magic: The Gathering collection export and see which official Commander
preconstructed decks you are closest to already owning — ranked by completion,
with a missing-cards shopping list and an estimated Commander Bracket.

Two ways in: official precons scored automatically, and any commander in your
collection opened up into its buildable decks — the EDHREC average plus its top
themes — each ranked by how close you already are.

## Running it

```bash
npm install
npm run build:data       # only needed if public/data is missing or stale
npm run build:commanders # commander catalogue (slugs + deck counts)
npm run dev
```

Open http://localhost:3000 and drop a CSV on the page.

Personal exports belong in `collections/`, which is gitignored. To generate a
synthetic one for testing:

```bash
node scripts/make-sample-collection.mjs collections/sample-manabox.csv
```

## How it works

Everything after the initial data load happens in the browser — the collection
file is never uploaded or persisted.

- `scripts/build-data.mjs` builds the static index in `public/data`:
  - **Cards** from Scryfall's `oracle_cards` bulk export. Only cards we might
    need are kept (anything in a precon, plus every legal commander), each as a
    slim record: name, type line, colour identity, rarity, functional category,
    Game Changer flag, commander flag.
  - **Precons** from MTGJSON's `DeckList` plus per-deck files, filtered to
    `Commander Deck` products. Collector's Edition variants are dropped as
    duplicates.
  - **Game Changers** from Scryfall's `is:gamechanger` search, so the list stays
    correct when WotC revises it rather than being hardcoded here.
- `scripts/build-prices.mjs` builds `public/data/prices.json` — the cheapest
  buyable EUR printing of each card with its Cardmarket product id, plus the
  day's ECB EUR→GBP rate.
- `scripts/build-commanders.mjs` builds `public/data/commanders.json` — the
  commanders EDHREC ranks, with their exact average-deck slug and deck count.
  It fetches 32 colour-bucket listings and no decklists at all.
- `src/lib/collection.ts` stream-parses the CSV in a worker (PapaParse) and
  aggregates every printing and finish of a card into one owned quantity.
- `src/lib/match.ts` scores each precon and estimates a bracket floor.

`.github/workflows/refresh-data.yml` rebuilds the index weekly.

## Decisions worth knowing

- **Basic lands are excluded from both sides of every percentage.** Most
  collections hold basics in bulk, so counting them would inflate completion;
  they are also left off the shopping list.
- **Cards are matched by name, not printing.** A collection's Showcase foil
  counts the same as the precon's printing.
- **Double-faced cards** are indexed under the full name and each face, so
  `Henrika Domnathi` and `Henrika Domnathi // Henrika, Infernal Seer` both hit.
- **Secret Lair reversible printings are dropped** where a normal printing of the
  same name exists. Scryfall lists them with the type line `Card // Card`, and
  left in they shadow real cards — including the basic lands.
- **Categories (ramp / draw / removal / …) are computed at build time** from
  oracle text so the browser never has to download it. They are deliberately
  coarse: a creature stays a creature unless it is obviously mana ramp.
- **Bracket estimates count Game Changers only.** WotC also weighs two-card
  combos, mass land denial, tutors and extra turns; those are V2.
- **Prices are indicative, not a quote.** They are the cheapest buyable printing
  on Cardmarket from a single snapshot, converted at the ECB reference rate.
  They ignore condition, seller and shipping, and EU sellers add around 20%
  import VAT on delivery to the UK. Gold-bordered World Championship reprints
  are excluded even though Scryfall marks them legal — they are usually the
  cheapest listing and no playgroup accepts them.
- **EDHREC decklists are fetched by the browser, one at a time, when you open a
  commander.** Nothing of theirs is crawled in bulk or served from here. A
  precon-only tool mostly rediscovers precons you already bought — a real
  collection scores a median 20% with nothing in the 50–89% band — so the
  commander list is where the useful answers are.

## Data sources

Card data from [Scryfall](https://scryfall.com), precon decklists from
[MTGJSON](https://mtgjson.com), commander average decks from
[EDHREC](https://edhrec.com). Not affiliated with or endorsed by Wizards of the
Coast.
