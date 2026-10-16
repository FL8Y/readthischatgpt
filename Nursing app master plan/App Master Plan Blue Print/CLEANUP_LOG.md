# Blueprint Cleanup Log

**Project:** Nursing Study App planning workspace  
**Scope:** This cleanup is limited to the blueprint documentation. Raw research folders, APK-derived files, reports, reference code, root Claude/Ruflo configuration and the unrelated FLY8 prompt are out of scope and must remain untouched.  
**Purpose:** Record exactly what was consolidated, where its information now lives, and which legacy paths were removed. Git history retains the prior file versions.

## Why the cleanup was needed

The blueprint had multiple overlapping documents that repeated requirements, UX/learning rules, architecture alternatives, data entities, service contracts and acceptance tests. This increased the chance that agents would edit the wrong copy or leave cross-document contradictions.

## Consolidation mapping

| Former source path | Destination | What was retained and consolidated |
|---|---|---|
| `Nursing app master plan/App Master Plan Blue Print/REQUIREMENTS_TRACEABILITY.md` | `PRODUCT_REQUIREMENTS_AND_UX.md` | All R-001 through R-032 requirements, proposed modules/data concepts, dependencies/statuses, acceptance evidence, cross-cutting invariants, unresolved requirement policies. |
| `Nursing app master plan/App Master Plan Blue Print/UX_AND_LEARNING_SPEC.md` | `PRODUCT_REQUIREMENTS_AND_UX.md` | Navigation, key learner journeys, screen-state/accessibility requirements, diagnostic and mastery logic, remediation, spaced-repetition UX, rewards, nursing safeguards and UX acceptance tests. Duplicate statements were combined while preserving unique criteria. |
| `Nursing app master plan/App Master Plan Blue Print/ARCHITECTURE_OPTIONS.md` | `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md` | Framework/persistence/provider/SRS options, AI generation validation, answer-key boundary, topic graph, import/media pipeline, offline/sync and testing trade-offs. |
| `Nursing app master plan/App Master Plan Blue Print/DATA_MODEL_AND_CONTRACTS.md` | `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md` | Canonical entities/relationships, event ledger, mastery model, service boundaries, illustrative request/response contracts, idempotency/transactions/migrations, security and contract tests. Duplicate details were merged into shared sections. |

## Other cleanup actions

- Shortened `CLAUDE_MASTER_PROMPT.md` by moving detailed product and technical requirements to the two canonical specs and making the orchestrator link to them, rather than restating the same content.
- Updated current document cross-references and agent ownership rules to point to the consolidated specifications and avoid multiple agents writing the same file.
- The repository audit and both README indexes are refreshed to point to the consolidated documents and the post-cleanup tree.

## Deletion/move record

**Status: IN PROGRESS at log creation.** The four former source documents above are retained until the consolidated documents and their GitHub read-backs are checked. After deletion, this section must record the exact deletion commit SHAs and final tree counts.

No research assets, binaries, reports, code samples, app source code, or global repository/Claude configuration have been intentionally deleted or moved. No application has been built.

## Verification record

- Consolidated product spec: `PRODUCT_REQUIREMENTS_AND_UX.md` — created in commit `7844840ef2521bad4175ba233c8b9d7bde9adb9e`; subsequently fetched from GitHub and checked for the requirements matrix, strict diagnostic gate, accessibility and nursing safeguards.
- Consolidated technical spec: `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md` — created in commit `fedf1e773ee029ffb5705524fdfe6ec0b61c1b8`; subsequently fetched from GitHub and checked for framework comparison, data model, AnkiDroid/SRS, answer-key separation, security and offline requirements.
- Orchestrator prompt shortened in commit `2055c443cfb5e42cc41757c80bbd7ec4e0f5e31f`.
- Current cross-reference updates include commits `c72bfa679749ed29612f024408d94068720e8d38`, `c61ac987476ebdc1e057641b98881250a626d257`, `d2c497d44aaa34ec72a93ea6ec1aa9281799ff70` and `b924594704a93210d1e3db59f405bbc68de9c88e`.
- This is an activity log, not a claim that the application or its reference integrations were runtime-tested.
