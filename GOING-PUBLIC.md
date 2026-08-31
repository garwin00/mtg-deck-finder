# Before this goes public

Written 31 Aug 2026, from an audit of what the app actually requests and what
the upstream services actually ask for. Nothing here blocks personal use.

Each item says what the problem is, what the evidence was, and what the fix
would be — so the reasoning survives even if the numbers move.

## 1. Scryfall image handling — RESOLVED 31 Aug 2026

Their [API docs](https://scryfall.com/docs/api) state, verbatim:

> Do not blur, sharpen, desaturate, or color-shift card images.

`DeckView`'s card tile applies `opacity-45 grayscale` to missing cards
(`src/components/DeckView.tsx`). Greying out what you don't own is the app's
central visual idea, and it is the one thing on their list we are doing.

They also require, for `art_crop` specifically:

> When using the art_crop, list the artist name and copyright elsewhere in the
> same interface presenting the art crop, or use the full card image elsewhere
> in the same interface.

The commander grid and deck cards use `art_crop` and show no artist or
copyright. The deck page satisfies this incidentally, since it shows full card
images; `/` and `/collection` do not.

> Repeated mishandling or misrepresentation of data or images in your project
> may result in Scryfall restricting or blocking your API access.

**Done.** Missing cards carry a red ring and a red caption; no filter is applied
to any card image. The artist is credited on every art crop, overlaid bottom
right, and the home page footer carries the copyright line. `CardRecord.artist`
is populated for commanders, which is the only place art crops are used.

## 2. Scryfall API headers — RESOLVED 31 Aug 2026

> All HTTP requests to api.scryfall.com must include a User-Agent header and an
> Accept header. […] Do not allow HTTP libraries to choose the header for you.

`src/lib/images.ts` calls `api.scryfall.com` from the browser, which cannot set
`User-Agent`. There is no client-side way to comply.

**Done**, the good way: the API is no longer called from the browser at all. A card
image URL is derivable from its Scryfall id —
`https://cards.scryfall.io/normal/front/<id[0]>/<id[1]>/<id>.jpg` — and
`cards.scryfall.io` is a CDN, not the API, so it carries no header requirement.
`build-data.mjs` emits `printings.json` (1.29MB raw, 0.59MB brotli) with the id,
set and mana value of each card, loaded only when cards are shown. That removed
three API requests per deck page, two per collection page, the whole
double-faced-name workaround and its ten name collisions, and this compliance
problem together. Rate limits no longer apply.

Measured after the change: opening a commander and its deck makes **zero**
`api.scryfall.com` requests, and all 82 image URLs for a deck are built locally.

The alternative — proxying through a Next route handler that sets the headers —
would have worked but reintroduces a server, which the privacy design avoids.

## 3. EDHREC load, at scale

Measured on a real 5,851-card collection:

| Flow | Requests | Data |
| --- | --- | --- |
| Score every owned commander | 188 | 7.7MB |
| Open one commander and a deck | 2 | 0.41MB |

Scores are cached against a collection fingerprint, so it is once per collection
rather than once per session. Fine for one person. With a public audience it is
188 requests to a free hobby site with no official API for every collection
uploaded.

EDHREC publishes no API terms and no rate limit to comply with, which is a
reason for more caution, not less.

**Options, in the order worth trying:** ask them — a tool that sends people to
their pages is not obviously unwelcome; or move scoring server-side behind a
shared cache, so a popular commander is fetched once for everyone rather than
once per user; or build the decklist corpus at build time, which raises the
redistribution question in §4.

## 4. Redistributing EDHREC's average decks

Deliberately not done. `build-commanders.mjs` fetches only colour buckets and
theme pages — slugs, deck counts and rankings — and the browser fetches
decklists from EDHREC directly, so none of their aggregated data is served from
our domain.

Serving a corpus is a materially different act from linking to one. Decklists
are close to facts, but an *average* deck is their computed product. If §3 pushes
towards a corpus, settle this first, ideally with them.

## 5. Wizards of the Coast Fan Content Policy

A public Magic tool has to comply: no monetising their IP, and the required fan
content disclaimer. Check the current policy text at publication time rather
than trusting this note.

## 6. Attribution

Scryfall, MTGJSON and EDHREC should all be credited in the interface, not only
in this repo. Scryfall additionally forbids implying their endorsement, and
forbids paywalling their data.

## 7. Product gaps that only matter in public

- **Shared links don't work.** A deck URL opened by someone else hits the upload
  screen, because the collection is on the sender's device. Fixing it means
  accounts and a backend.
- **No retry or backoff.** A failed EDHREC or Scryfall call drops that deck
  silently. One flaky moment on a shared link looks like a broken app.
- **No tests.** The matching logic and the name-resolution edge cases —
  double-faced cards, the ten name collisions, banned cards — are exactly what
  a public tool cannot afford to regress, and there is no runner installed.
- **Bulk buying assumes Cardmarket.** The button copies a wants list and opens
  their site, which is right for a UK or EU buyer and wrong elsewhere.
  TCGplayer's `massentry?productline=Magic&c=…` deep link is the US equivalent
  and works; a public release would want to offer both.
- **Prices carry a UK-specific caveat.** "EU sellers add around 20% import VAT"
  is wrong for a visitor outside the UK, and the whole figure is GBP-only.
