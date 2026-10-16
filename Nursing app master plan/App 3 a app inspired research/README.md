# App 3 — Gizmo (AI flashcards & quizzes) inspired research

Static reverse-engineering of Gizmo 3.2.130 (Android `ai.saveall.app`, React Native / Expo, Hermes bytecode v98), plus a reference implementation of an AI "next quiz" generator.

| Path | What it is |
|---|---|
| `Gizmo_App_Research.docx` | Full report (54 pages, including addenda; verified from the current DOCX in the Library): architecture, API surface, quiz engine, AI features, how to add an AI API for auto-generated quizzes |
| `research/` | Markdown research notes: quiz-engine rules, data model / events / feature flags / languages, native Android side and security posture |
| `data/` | Secret-free extracts: routes, `/api/` paths, quiz-engine systems and components, AI model strings, daily-quiz events, decoded manifest (keys redacted) |
| `framework/` | The repeatable method (`METHOD.md`), Hermes string-table dumper, report builder |
| `product/ai-next-quiz/` | TypeScript reference code: question schema, validated AI generator, buffer/refill/fire/response service (type-checked, not run against a live API) |

Evidence is labelled observed (literal strings/values) or inferred. The original app files are not stored here.
