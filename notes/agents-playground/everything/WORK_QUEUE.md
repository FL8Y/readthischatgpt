# Inventory Work Queue

- [x] Confirm scope is limited to `notes/agents-playground/`.
- [x] Capture source commit and recursive tree inventory.
- [x] Inventory snapshot at commit `71d3bd60e92e2597c3ae992708c2ab0cf61b39f4`: 202 entries under playground, 26 agent directories, 147 files.
- [x] Copy and verify three pilot notes from `agent-01-pages-59-61/notes/`.
- [x] Re-fetch each copied note and verify exact source-body equality after stripping the collection-only metadata prefix.
- [x] Verify each original source blob SHA still matches the captured base.
- [ ] Complete a file-by-file content inventory for every other agent workspace.
- [ ] Choose and apply the final subject taxonomy based on real contents.
- [ ] Compare all candidates for exact duplicates, near-duplicates, overlap, continuation, complementary material, and conflicts.
- [ ] Copy all eligible notes, keeping the first-pass copies byte/text identical to source bodies.
- [ ] Expand/fuse only in separate `curated/` derivatives with source-to-derivative provenance.
- [ ] Re-fetch all collection files, validate links and complete manifest accounting, then prepare PR review summary.

## Controls

- Original paths are read-only inputs. Never cut, delete, rename, or rewrite source notes.
- All new files and directory organization must remain inside `notes/agents-playground/`.
- A derivative is not a source copy and must not replace a copied source note.
- Do not describe the whole project as complete while inventory, copy, or review work remains pending.
