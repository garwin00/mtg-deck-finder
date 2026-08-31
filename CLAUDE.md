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
npm run build:data   # rebuild public/data from Scryfall + MTGJSON (network, ~1–2 min)
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

Anything derived from oracle text (category, commander legality, Game Changer,
basic-land flag) is computed **here**, so the browser never downloads oracle text.

**Runtime — client only.** `src/app/page.tsx` fetches both JSON files, parses the
CSV in a PapaParse worker, matches, and renders. There are no API routes, no
server components doing data work, no database. The collection file never leaves
the browser — that promise is made in the UI, so keep it true.

### Key files

| File | Role |
| --- | --- |
| `scripts/build-data.mjs` | The entire data pipeline. Most data bugs live here. |
| `src/lib/types.ts` | `CardRecord`, `Precon`, category enum + labels/order. |
| `src/lib/normalise.ts` | Name normalisation. **Must stay identical to the copy in `build-data.mjs`** — the alias map is built with it. |
| `src/lib/collection.ts` | CSV header sniffing, stream parse, quantity aggregation. |
| `src/lib/match.ts` | Completion scoring, bracket estimate, export formats. |
| `src/components/` | Presentational only — no data fetching, no parsing. |
| `src/app/page.tsx` | All state lives here and is passed down. |

## Domain decisions (don't quietly reverse these)

- **Basic lands are excluded from both sides of every percentage** and from the
  shopping list. Collections hold basics in bulk; counting them inflates matches.
- **Cards match by name, not printing.** Any printing or finish counts.
- **DFCs are indexed under the full name and each face.** Collection lookup also
  tolerates `/`, `|` and dashes as face separators.
- **Reversible Secret Lair printings are dropped** when a normal printing shares
  the name — left in, they shadow real cards including basic lands.
- **Bracket = Game Changer count only** (0 → 1–2, 1–3 → 3, 4+ → 4). It is a
  floor, presented with a disclaimer. Combos, land denial, tutors and extra
  turns are V2.
- **Magic rules are never hardcoded.** Commander legality comes from
  `legalities.commander` + type line + "can be your commander"; the Game
  Changers list comes from Scryfall. If a change would mean a hand-maintained
  card list, flag it first.
- MVP is **precon matching only**. EDHREC / freeform commander synergy is V2 and
  must sit behind an adapter if it ever lands.

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
