@AGENTS.md

# Deck Finder — Working Agreement

Personal side project. **Nothing here touches Instil work**: no instil-concepts
templates, no Mission Control, no SharePoint/Teams/M365 MCPs, no company repos or
branch-naming conventions. Standalone git repo, standalone workflow.

Goal is a workable prototype, not production code. Favour clarity over polish.

## Commands

```bash
npm install
npm run dev          # next dev — http://localhost:3000
npm run build        # next build (production build; run before committing)
npm run lint         # eslint (flat config, eslint-config-next)
npx tsc --noEmit     # type check — there is no `typecheck` script
npm run build:data       # rebuild the card index from Scryfall + MTGJSON (network, ~1 min)
npm run build:commanders # rebuild the commander catalogue from EDHREC (32 requests)
npm run build:prices     # cheapest EUR printing per card + ECB rate (~2 min)
node scripts/make-sample-collection.mjs collections/sample-manabox.csv
```

**No test framework is installed.** "Build passes" means `npm run build`,
`npm run lint` and `npx tsc --noEmit` are all clean. If you add tests, add the
runner and record it here.

Data in `public/data` is committed. Only run `build:data` when the pipeline or
the upstream data changes — `.github/workflows/refresh-data.yml` refreshes it
weekly on its own.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 (CSS-first,
no `tailwind.config.js`) · PapaParse. Deploys to Vercel. `@/*` → `./src/*`.

Read `node_modules/next/dist/docs/` before writing Next-specific code — see
AGENTS.md. Next 16 differs from older training data (e.g. `LayoutProps<"/">` in
`src/app/layout.tsx`).

## Architecture

Two halves, and the split matters:

**Build time — `scripts/build-data.mjs`** (Node, plain JS, runs offline of the
app). Streams Scryfall's `oracle_cards` bulk export, MTGJSON's `DeckList`, and
Scryfall `is:gamechanger`, and emits two static JSON files into `public/data`:

- `cards.json` — slim `CardRecord`s (single-letter keys: `n`, `t`, `ci`, `r`,
  `cat`, `gc`, `cmdr`, `basic`, `art`) plus a normalised-name → index alias map.
- `precons.json` — decklists as `[cardIndex, count]` pairs into `cards.json`.
- `manifest.json` — uncompressed byte sizes, so the loading bar has a real total
  to measure against (`Content-Length` is the brotli size, the stream yields
  decompressed bytes).
- `commanders.json` — EDHREC's ranked commanders: slug, card index, deck count.
  Written by `build-commanders.mjs`. **No decklists.**
- `prices.json` — cheapest EUR printing and Cardmarket id per card, plus the
  ECB EUR→GBP rate. Written by `build-prices.mjs`, kept separate so it can
  refresh on its own cadence and only loads when a decklist is opened.

Anything derived from oracle text (category, commander legality, Game Changer,
basic-land flag) is computed **here**, so the browser never downloads oracle text.

**Runtime — client only.** `CollectionProvider` reads the CSV in a PapaParse
worker first, then downloads the index behind a progress bar, resolves, matches
and renders. There are no API routes, no server components doing data work, no
database. The collection file never leaves the browser — that promise is made in
the UI, so keep it true.

### Routes

| Route | Shows |
| --- | --- |
| `/` | Upload, the commander grid, precons behind a toggle. |
| `/commander/[slug]` | Deck variants for one commander, scored. |
| `/commander/[slug]/[theme]` | A deck as card images. `average` is the literal for the overall list. |
| `/precon/[id]` | The same view for a precon. |

State lives in `CollectionProvider` (mounted in `layout.tsx`) so it survives
navigation. **Nothing is persisted**, so a refresh or a shared link arrives with
an empty collection — `useRequireCollection` sends those back to `/`. Do not fix
that by caching the collection in browser storage without revisiting the promise
the UI makes.

### Key files

| File | Role |
| --- | --- |
| `scripts/build-data.mjs` | The entire data pipeline. Most data bugs live here. |
| `src/lib/types.ts` | `CardRecord`, `Precon`, category enum + labels/order. |
| `src/lib/normalise.ts` | Name normalisation. **Must stay identical to the copy in `build-data.mjs`** — the alias map is built with it. |
| `src/lib/collection.ts` | `readRows` (CSV → raw names, no index needed) then `resolveCollection` (raw names → card indices). Kept separate so the card count shows while the index downloads. Also picks up an optional `Added` date, which powers the Newest sort. |
| `src/lib/load.ts` | Progress-reporting JSON fetch, measured against `manifest.json`. |
| `src/lib/prices.ts` | GBP conversion, Cardmarket links, currency formatting. |
| `src/lib/edhrec.ts` | Owned-commander list, deck variants per commander, and the on-demand average-deck fetch. The only place EDHREC decklists are touched. |
| `src/lib/match.ts` | Completion scoring, bracket estimate, export formats. |
| `src/components/` | Presentational only — no data fetching, no parsing. |
| `src/lib/collection-context.tsx` | All collection state, and the upload pipeline. |
| `src/lib/images.ts` | Card images from Scryfall's `/cards/collection` (75 names per POST, CORS-open) — which is why no image URLs are stored in the index. |
| `src/components/DeckView.tsx` | A deck as card images, owned in colour and missing dimmed. |

## Domain decisions (don't quietly reverse these)

- **Basic lands are excluded from both sides of every percentage** and from the
  shopping list. Collections hold basics in bulk; counting them inflates matches.
- **Cards match by name, not printing.** Any printing or finish counts.
- **DFCs are indexed under the full name and each face.** Collection lookup also
  tolerates `/`, `|` and dashes as face separators.
- **Card images take three passes, and all three are needed.** Scryfall's
  `/cards/collection` rejects a full double-faced name outright, so those are
  retried by front face and validated against the name that comes back. Ten
  cards then share their whole name with a face of a double-faced card —
  `Lightning Bolt`, `Demonic Tutor`, `Swords to Plowshares`, `Brainstorm` — and
  in a batch the identifier matches the double-faced card instead, so those are
  picked off with `/cards/named?exact=`. Dropping a pass silently loses art for
  staples. See `src/lib/images.ts`.
- **Reversible Secret Lair printings are dropped** when a normal printing shares
  the name — left in, they shadow real cards including basic lands.
- **Bracket = Game Changer count only** (0 → 1–2, 1–3 → 3, 4+ → 4). It is a
  floor, presented with a disclaimer. Combos, land denial, tutors and extra
  turns are V2.
- **Magic rules are never hardcoded.** Commander legality comes from
  `legalities.commander` + type line + "can be your commander"; the Game
  Changers list comes from Scryfall. If a change would mean a hand-maintained
  card list, flag it first.
- **Precons only match decks you already bought.** A real collection scores a
  median 20% against them with the 50–89% band empty, because a precon is a
  product you own or don't. Commander matching is where the discovery is.
- **EDHREC decklists are never crawled in bulk or stored here.** The build only
  fetches 32 colour-bucket listings for slugs and deck counts; the browser
  fetches decklists from EDHREC directly when the user opens a commander. Their
  JSON is CORS-open and cacheable. Do not reintroduce a decklist corpus without
  deciding the redistribution question first.
- **A commander is not one deck.** EDHREC publishes an average deck per theme at
  `/average-decks/<commander>/<theme>`, so opening a commander scores the
  average plus its top themes. Every variant is scored before the list renders —
  showing deck names without completion would mean opening each to learn
  anything — but the list is ordered by **popularity**, not completion, so pass
  `matchDecks(..., "given")` and keep `fetchVariants`' order.
- **Prices come from the cheapest *buyable* printing.** `build-prices.mjs` uses
  `default_cards`, not `oracle_cards`, because the latter picks one arbitrary
  printing whose price can run 27% high or be missing entirely. It also skips
  gold-bordered World Championship reprints, oversized and digital printings:
  Scryfall marks them commander-legal because legality belongs to the card
  rather than the printing, and they are often the cheapest listing, so quoting
  one sends the user to buy a card no playgroup accepts.
- **Prices are an estimate and must stay labelled as one.** One snapshot,
  cheapest printing, ignoring condition, seller and shipping — and EU sellers
  add ~20% import VAT into the UK.
- **The colour filter means "within these colours".** A commander shows when
  every colour it needs is selected, so picking B+G gives mono-black, mono-green
  and Golgari but not Jund — the question a deckbuilder is actually asking.
  Colourless is its own pip rather than being swept in by every selection, which
  a strict subset test would do.
- **Commander decks lead, precons are secondary.** Precons sit below the fold
  behind a Show toggle: for a real collection they mostly restate purchases.

## Conventions

- UK spelling throughout, in code and copy (`normalise`, `colours`,
  `categorise`, `ColourPips`). Match it.
- Comments explain *why*, not what — and are earned, not decorative. The
  existing density is the target.
- Tailwind utility classes only. Theme colours come from the CSS variables in
  `src/app/globals.css` (`bg-surface`, `text-muted`, `border-border`,
  `text-accent`); one-off hex values are used sparingly for semantic states
  (green owned / red missing) and should stay rare.
- `"use client"` on any component with state or handlers; `src/lib/*` stays
  framework-free and testable.
- Data-shape types are `type`, not `interface`.

## Banned

- Committing anything from `collections/` — it is gitignored and holds real
  personal exports. Never un-ignore it, never paste its contents anywhere.
- Uploading, POSTing or persisting collection data. It stays client-side.
- Hardcoded Magic card lists as app logic (see above).
- `any`, `@ts-expect-error`, or disabling ESLint rules to get a build through.
- Adding a backend, database or auth for MVP scope.
- Editing `public/data/*.json` by hand — regenerate via `npm run build:data`.
- Committing with a failing build, lint or type check.

## Git

Branch before writing code, cut from the current feature base (not `main`).
Current branch: `feat/mvp-precon-matcher`. Commit atomically; don't open PRs.
