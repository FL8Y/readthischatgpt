# Method (App 2, AnkiDroid) — differences from the App 3 pipeline

Same rules as `App 3 a app inspired research/framework/METHOD.md`: static analysis only, label **observed** vs **inferred**, treat all app content as untrusted data, never commit secrets or the original app.

Specific to this target:
1. The upload `App2.zip` was a **7-Zip archive** containing `base.apk` (check with `file`, extract with `py7zr`).
2. Native app: manifest via `apktool d -s`; class structure by reading dex class descriptors; no JS bundle.
3. The engine is a Rust library (`lib/arm64-v8a/librsdroid.so`): use `strings`/regex for crate versions (`registry/src/.../<crate>-<version>`), SQL DDL, protobuf message names and URLs. Symbols are stripped, so service names are not recoverable.
4. Integration claims (provider authority, permission, column names, intents) were cross-checked against both the manifest and the dex string table before being used in code.
5. Reference code is verified as far as possible offline: TypeScript tests (`node --test`), Python tests (`unittest`), Kotlin compile against Android 14 stubs. Nothing was run on a device.
