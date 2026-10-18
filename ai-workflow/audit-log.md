# Audit Log

Deliberate deviations from established patterns, with rationale, so future
reviews don't flag them as mistakes.

| Date | Change | Deviation | Rationale |
| --- | --- | --- | --- |
| 2026-08-31 | Collection persistence | Reversed the documented "nothing is persisted" rule and the "never stored" claim in the UI | Asked for explicitly. Collections now save to localStorage so a refresh or deep link keeps working. "Never uploaded" — the half that matters, since no server sees the data — still holds, and a Forget control plus a saved-on date were added so it can be erased and can't go quietly stale. Names are stored rather than card indices, because indices are renumbered by every data rebuild. |
| 2026-08-31 | Mana curve | Kept the app's green/red for owned/missing despite `dataviz` validator FAIL on the dark-mode lightness band | They are the existing semantic colours on every card tile and row; recolouring the chart alone would break that consistency for a worse outcome. The checks that matter passed — CVD separation ΔE 10.8 (deutan, floor 8) and contrast — and the pair is status, not categorical, which is outside the band check's stated scope. Secondary encoding added as required: fixed stack order, legend and direct counts, so nothing reads by colour alone. |
| 2026-10-18 | Visual design | Replaced the dark Geist theme with a light "print sheet" (paper, ink, signal red, Funnel Display) and supersedes the 2026-08-31 mana curve entry: owned is now ink and missing a red outline, not green and red | Chosen with Garry over four rounds of exploration; warm natural palettes and serif display type were rejected. Red is reserved for missing or cost so it stays a signal. The curve keeps a non-colour encoding (fill versus outline). |
| 2026-10-18 | Missing cards | Deck pages show missing cards as proxy slips (name, price, role, mana value) instead of the card image with a red ring; commander art is no longer shown at 70% opacity | Scryfall's terms forbid altering card images; a proxy never shows the art, so there is nothing to alter. Proxies are also what players put in a deck while waiting for a card. |
| 2026-10-18 | Colour identity | Mana symbols come from Scryfall's SVG CDN (`svgs.scryfall.io/card-symbols`) instead of lettered circles | Same CDN as the set icons already used; not the API, so no User-Agent requirement. |
| 2026-10-18 | Build tab fill | Last-resort tier ranks by EDHREC's all-decks rank, which means a new per-card field in `printings.json` | Once EDHREC's commander, theme and similar-commander lists run out, nothing commander-specific is left, and an unordered pick from ~1,000 owned cards would be arbitrary. Scryfall already ships `edhrec_rank` in the bulk file the build streams, so it costs no request and no hand-kept list. It sits in `printings.json`, not `cards.json`, so the upload path doesn't pay for it. |
| 2026-10-18 | Card index | Added `ban` to `CardRecord` | The index deliberately keeps a few non-legal cards for precons and the Game Changers list; a deck built from the collection must not suggest them. Taken from Scryfall's legality, not a hand list. |
| 2026-08-31 | Project setup | `CLAUDE.md` written standalone rather than from the instil-concepts workspace template | Personal side project — deliberately isolated from company templates, Mission Control and SharePoint. |

## Background Audit - 2026-08-31 11:08

| Changed | Findings |
|---------|----------|
| **CLAUDE.md** (modified) | ✓ Comprehensive working agreement added: covers stack (Next.js 16, React 19, TypeScript strict, Tailwind v4), architecture, key files, domain decisions, conventions, banned practices. ✓ Correctly references AGENTS.md for Next-specific guidance. ✓ UK spelling enforced. ✓ Clear separation of concerns (build-time pipeline, client-only runtime). ✓ Strong anti-pattern guardrails. |
| **ai-workflow/audit-log.md** (untracked) | Deliberate-deviations log documenting the choice to write CLAUDE.md standalone (not from instil-concepts). Aligns with your "Deliberate decisions" policy. Untracked — verify if you want to commit or add `ai-workflow/` to .gitignore. |

No code changes, no build/lint/type issues indicated. Ready to stage and commit when ready.

## Background Audit - 2026-08-31 11:10

## Audit — CLAUDE.md + ai-workflow/

**Files changed:** CLAUDE.md (modified, +118 lines), ai-workflow/ (untracked directory with audit-log.md)

**P1 findings:** None.

**Build/lint/type:** ✓ All clean.

**Documentation quality:**
- ✓ Comprehensive working agreement with clear separation of concerns (build-time pipeline, client-only runtime)
- ✓ Domain decisions explicitly guarded ("don't quietly reverse these")
- ✓ Conventions documented (UK spelling, earned comments, Tailwind-only, `type` vs `interface`)
- ✓ Strong anti-patterns and banned practices listed (no `any`, no hardcoded Magic lists, client-side collection data)
- ✓ References AGENTS.md for Next.js 16 specifics
- ✓ Correctly states current branch as feat/mvp-precon-matcher and enforces atomic commits

**Process note:** ai-workflow/audit-log.md documents the deliberate choice to write CLAUDE.md standalone (not from instil-concepts), aligning with your "Deliberate decisions" policy. Recommend adding `ai-workflow/` to `.gitignore` unless you intend to version audit logs with the project.

Ready to stage and commit.

## Background Audit - 2026-08-31 11:13

## Audit: CLAUDE.md + ai-workflow/

| Changed | Findings |
|---------|----------|
| **CLAUDE.md** (+118 lines) | ✓ Comprehensive working agreement. Stack clearly stated (Next.js 16, React 19, TypeScript strict, Tailwind v4, PapaParse). Architecture diagram sharp – clean build/runtime split, client-only runtime enforced. Key files table precise. Domain decisions explicitly guarded (basics excluded, name-based matching, etc.). Conventions concrete (UK spelling, earned comments, Tailwind-only, `type` over `interface`). Banned list strong and specific. References AGENTS.md for Next-specific guidance. |
| **ai-workflow/audit-log.md** | Untracked directory. Audit-log documents deliberate choice to write CLAUDE.md standalone (not from instil-concepts), aligns with your "Deliberate decisions" policy. Decision log is good; consider adding `ai-workflow/` to `.gitignore` if keeping audit logs ephemeral. |

**Build/lint/type:** ✓ All clean – next build, eslint, tsc pass.

**What's good:** Documentation is tight, load-bearing, and governance-forward. Architecture separation (build-time derivation vs client-only runtime) is clear and defensible. Anti-patterns and domain guardrails are firm.
