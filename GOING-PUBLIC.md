# Before this goes public

Written 31 Aug 2026, from an audit of what the app actually requests and what
the upstream services actually ask for. Nothing here blocks personal use.

Each item says what the problem is, what the evidence was, and what the fix
would be — so the reasoning survives even if the numbers move.

## 1. Scryfall image handling — we are currently non-compliant

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

**Fix:** signal "missing" without touching the pixels — a red border, a corner
badge, or a scrim drawn *over* the tile rather than a filter applied *to* the
image. Add artist and copyright to any surface showing an art crop; Scryfall
returns `artist` on the card object we already fetch.

## 2. Scryfall requires headers a browser cannot send

> All HTTP requests to api.scryfall.com must include a User-Agent header and an
> Accept header. […] Do not allow HTTP libraries to choose the header for you.

`src/lib/images.ts` calls `api.scryfall.com` from the browser, which cannot set
`User-Agent`. There is no client-side way to comply.

**Fix, and it is the good one:** stop calling the API for images at all. A card
image URL is derivable from its Scryfall id —
`https://cards.scryfall.io/normal/front/<id[0]>/<id[1]>/<id>.jpg` — and
`cards.scryfall.io` is a CDN, not the API, so it carries no header requirement.
Storing ids at build time costs roughly 1MB raw (~0.85MB brotli, hex compresses
poorly) in a file that only loads when a deck opens, and in exchange removes
three API requests per deck page, the two per collection page, the whole
double-faced-name workaround in `images.ts`, and this compliance problem
together. Rate limits stop applying as well.

The alternative — proxying through a Next route handler that sets the headers —
works but reintroduces a server, which the privacy design deliberately avoids.

## 3. EDHREC load, at scale

Measured on a real 5,851-card collection:

| Flow | Requests | Data |
| --- | --- | --- |
| Score every owned commander | 188 | 7.7MB |
| Open one commander | 8 | 0.41MB |

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
- **Prices carry a UK-specific caveat.** "EU sellers add around 20% import VAT"
  is wrong for a visitor outside the UK, and the whole figure is GBP-only.
