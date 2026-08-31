# Audit Log

Deliberate deviations from established patterns, with rationale, so future
reviews don't flag them as mistakes.

| Date | Change | Deviation | Rationale |
| --- | --- | --- | --- |
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
