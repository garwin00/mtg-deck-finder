# Deck Finder

Upload a Magic: The Gathering collection export and see which official Commander
preconstructed decks you are closest to already owning — ranked by completion,
with a missing-cards shopping list and an estimated Commander Bracket.

MVP scope: precon matching only. Freeform commander synergy scoring is V2.

## Running it

```bash
npm install
npm run build:data   # only needed if public/data is missing or stale
npm run dev
```

Open http://localhost:3000 and drop a CSV on the page.

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

## Data sources

Card data from [Scryfall](https://scryfall.com), decklists from
[MTGJSON](https://mtgjson.com). Not affiliated with or endorsed by Wizards of
the Coast.
