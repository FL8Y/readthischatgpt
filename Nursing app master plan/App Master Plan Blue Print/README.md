# App Master Plan Blueprint

> **Purpose:** One source of truth for planning the nursing app, comparing inspired apps, and deciding what belongs in the original app.

## How the research folders relate

- **App 1 research** — reference material for the first app concept.
- **App 2 research** — likely overlaps with App 1; compare the actual files and merge only confirmed duplicates or complementary material.
- **App 3 research** — keep separate for now because it appears to represent a different app/reference.
- **This blueprint** — the central planning document that links the research together and turns findings into implementation decisions.

## Recommended structure

```text
Nursing app master plan/
├── README.md
├── App 1 inspired research/              # canonical App 1 + merged App 2 material, if confirmed
├── App 2 inspired research/              # retain until its contents are reconciled
├── App 3 A App-Inspired Research/         # separate reference app
└── App Master Plan Blue Print/
    └── README.md                         # this document
```

> Folder names above reflect the intended organization, not a verified inventory of every current path.

## Cleanup rules

1. **Do not delete by filename alone.** Compare file hashes/content and inspect context first.
2. **Exact duplicates:** retain one canonical copy and record the original path in a cleanup log.
3. **Near-duplicates:** merge useful differences into the canonical file; preserve important details and provenance.
4. **App 1 vs App 2:** treat them as a *possible same-app pair*, not confirmed duplicates, until their manifests and content have been compared.
5. **App 3:** keep separate unless evidence shows it is the same reference app.
6. **Large binaries, APK/ZIP files, native libraries, fonts, images, and other assets:** never discard based only on matching names. Compare size/hash and keep a manifest.
7. **Incomplete ZIP uploads:** mark missing or blocked files as pending; never describe the archive as fully transferred until verified.
8. **Keep an audit trail:** log each move, merge, deletion, skipped duplicate, and unresolved item in `CLEANUP_LOG.md`.

## App decision matrix

| Area | App 1 / App 2 | App 3 | Decision |
|---|---|---|---|
| Relationship | Suspected overlap | Suspected distinct app | Verify against files before merging |
| Canonical research | App 1 is the provisional home | Keep its own folder | Avoid destructive moves until comparison |
| Shared ideas | Link or summarize here | Link or summarize here | Reuse concepts, not copied piles of files |
| Implementation | Extract requirements into the plan | Extract unique requirements separately | Build one original nursing app, not a blind clone |

## Master plan workflow

1. Inventory every path under the parent folder.
2. Generate a manifest containing path, extension, size, and SHA-256 where possible.
3. Detect exact duplicates by hash.
4. Review near-duplicates and conflicting versions manually.
5. Create a mapping from each old path to its canonical destination.
6. Merge text/document content carefully; preserve original assets unless verified duplicates.
7. Update links and folder READMEs.
8. Record every change in `CLEANUP_LOG.md`.
9. Re-scan the final tree and verify that no unique files were lost.

## Status

- [x] Create a central blueprint folder.
- [ ] Inventory and compare App 1 and App 2.
- [ ] Verify whether App 3 is a distinct app.
- [ ] Merge confirmed duplicates and update links.
- [ ] Verify the ZIP transfer and record blocked/missing files.
- [ ] Complete final tree and link validation.

**Important:** This blueprint is the organizing layer. Research folders should hold source material; this folder should hold decisions, requirements, architecture, priorities, and links—not another copy of all source files.
