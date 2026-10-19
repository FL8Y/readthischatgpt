# App 4 — Tangerine Prep inspired research

Static reverse-engineering of Tangerine Prep 1.9.0 (`com.tangerineprep.app`), a Philippine nursing licensure (PNLE/NCLEX-style) exam-prep app: how it works, what it implies for the Nursing app master plan, and a tested practice engine.

| Path | What it is |
|---|---|
| `Tangerine_Prep_Research.docx` | Full report (28 pages): architecture, learning features, pricing, privacy findings, feature blueprint, reference code, unknowns, three addenda |
| `research/` | Markdown notes: backend/auth/voice, learning features and logic, native SDKs and security |
| `product/practice-engine/` | TypeScript: partial-credit scoring (mcq/SATA/matrix/cloze), Rasch adaptive selection, readiness, timezone streaks, free-tier energy cap. 10/10 tests pass |
| `data/` | Route strings, API path candidates, decoded manifest (keys redacted) |
| `framework/` | Method notes and report builder |

Evidence is labelled observed (literal in code/strings) or inferred. Server-side algorithms are not visible. The original app files and the personal data embedded in the bundle are not stored here.
