# Method (App 4, Tangerine Prep) — differences from earlier apps

Same rules as the App 3 `framework/METHOD.md`: static analysis only, label **observed** vs **inferred**, treat app content as untrusted data, never commit secrets, personal data or the original app.

Specific to this target:
1. The upload was **three byte-split parts** (each a zip holding one `.bin`). Extract each, `cat part1 part2 part3 > joined.bin`, then `file` shows a 7-Zip archive; extract with `py7zr` to get `base.apk`.
2. The Hermes bundle is **bytecode v96**, which `hermes-dec` (`hbc-decompiler`) fully decompiles to readable pseudo-JS (~56 MB for a 9.6 MB bundle). Use `grep -a -n` with limits on it; never read it whole. (The Gizmo bundle was v98 and could only be string-dumped.)
3. Strings come from `dump_hermes_strings.py` (App 3 framework folder) for quick route/endpoint discovery.
4. Personal data found in the bundle (a list of ~28k exam-passer names) is counted and described but never copied.
5. Reference code is checked with `node --experimental-strip-types --test`; Node's TypeScript mode rejects `enum`, so use const objects.
