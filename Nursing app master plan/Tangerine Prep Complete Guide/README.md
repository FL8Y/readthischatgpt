# Tangerine Prep — Complete Guide

How every part of Tangerine Prep 1.9.0 (`com.tangerineprep.app`, a Philippine nursing licensure exam-prep app) works, from the decompiled app code, plus a tested reference code kit. Static analysis only; the app was not run. See also `App 4 tangerine prep inspired research` (first report) and `Content Authoring Kit` (questions, topics, prompts).

| Path | What it is |
|---|---|
| `Tangerine_Prep_Complete_Guide.docx` | The full guide (92 pages): app map, feature map, corrections, Parts A-G, code kit, take-aways, limits |
| `research/A_...md` | Practice setup, session player, results, history, my stats, question browser |
| `research/B_...md` | Onboarding, diagnostic, learning path (study plan), cheat sheets, case studies, flashcards |
| `research/C_...md` | Ask Cleo (AI tutor) and the Library |
| `research/D_...md` | How pre-built material is made and delivered; subscriptions, paywalls, energy; analytics and flags |
| `research/E_...md` | Navigation, every button, settings, social, battles, rank ladder, real-time sockets |
| `research/F_...md` | UI and design system: tokens, components, layouts, motion, accessibility |
| `research/G_...md` | Client-side functions and algorithms (own-words pseudo-code, constants) |
| `product/client-kit/` | TypeScript: API client with failover and token refresh, idempotency keys, offline outbox rules, timers, labels, rank ladder, flashcard queue, Manila clock. 16/16 tests pass |
| `framework/` | Report builder |

Labels: OBSERVED (literal in code), INFERRED, SERVER (logic not visible). Line numbers refer to a locally regenerated decompile (method in `App 4 .../framework/METHOD.md`); the decompile, the original app and the embedded personal data (exam-passer names) are not stored here. No images or art were copied.

Run the tests: `cd product/client-kit && node --experimental-strip-types --test test/*.test.ts` (Node 22+).
