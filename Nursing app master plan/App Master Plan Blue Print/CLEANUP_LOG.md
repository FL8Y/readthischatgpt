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

**Status: COMPLETE.** The four consolidated duplicate documents were deleted after the canonical replacements were fetched and reviewed:

| Deleted legacy file | Last content blob SHA before deletion | Deletion commit SHA |
|---|---|---|
| `ARCHITECTURE_OPTIONS.md` | `56f153cbf85342e6eea50aab8ceb6026ed3c73cb` | `3f89b057c308e4d724c804cda25d2f3732e405c9` |
| `DATA_MODEL_AND_CONTRACTS.md` | `4f51f00453b25e8db4590ccbe34565f84361101e` | `81432ac4c8f4c0d05dabe7106d20886e36a14dad` |
| `REQUIREMENTS_TRACEABILITY.md` | `7afc3db6c055f36f041445b9b7fbc4e995482251` | `4cff3e5019b4c4931d19beffe92cdf5ad554fd8c` |
| `UX_AND_LEARNING_SPEC.md` | `99a17890949d6dfff3501421a462790ba3ed6d05` | `4ae5560d42c7ec802594d456793f3bf5269ea1e1` |

The final verified post-deletion recursive tree snapshot at `fc52eb44d20278d7503ed5533bb2b89ffa0ecefc` contained **739 entries: 598 blobs/files and 141 trees/directories**, with `truncated=false`. The project subtree contains 407 entries; the blueprint now contains 11 Markdown files plus its directory entry (12 tree entries) and 137,578 listed file bytes. Subsequent changes in this correction cycle modify existing Markdown content only; re-scan after any future create/delete/move.

No research assets, binaries, reports, reference code, application source code, or global repository/Claude configuration were deleted or moved. No application has been built.

## Verification record

- Consolidated product spec: `PRODUCT_REQUIREMENTS_AND_UX.md` — created in commit `7844840ef2521bad4175ba233c8b9d7bde9adb9e`; final current blob SHA after council alignment is `420f89dec36720639c147849d2cf69abc9089137`. The verified content includes the full R-001–R-032 matrix, strict diagnostic gate (including the missing/invalid-key state), UX/accessibility and nursing safeguards.
- Consolidated technical spec: `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md` — created in commit `fedf1e773ee029ffb5705524fdfe6ec0b61c1b8`; final current blob SHA after council alignment is `2f49cea766a5534e64447c25e03f057f4835d046`. The verified content includes framework comparison, data model/contracts, AnkiDroid/SRS, answer-key separation, security/offline requirements, strict diagnostic service gating and a clearly marked proposed baseline.
- Orchestrator prompt shortened in commit `2055c443cfb5e42cc41757c80bbd7ec4e0f5e31f`.
- Current cross-reference updates include commits `c72bfa679749ed29612f024408d94068720e8d38`, `c61ac987476ebdc1e057641b98881250a626d257`, `d2c497d44aaa34ec72a93ea6ec1aa9281799ff70` and `b924594704a93210d1e3db59f405bbc68de9c88e`.
- Subsequent planning-review commits strengthened the two consolidated specs. Those additions were retained and verified by read-back; they did not restore the deleted duplicate files.
- This is an activity log, not a claim that the application or its reference integrations were runtime-tested.
