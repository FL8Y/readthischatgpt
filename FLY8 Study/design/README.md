# Design notes

Tokens live in `src/ui/tokens.ts` (pure, tested in `tests/theme.test.ts`); `src/ui/theme.ts` adds `useTheme()`; components in `src/ui/kit.tsx` + `src/ui/kitParts.tsx`.

- Accent: indigo. Light and dark follow the phone setting. Inter via `@expo-google-fonts/inter`, system font until it loads.
- New screens use `useTheme()`. Old screens still import `c`, a one-time colour snapshot; convert them to `useTheme()` when you touch them.
- Never show state by colour alone: pair it with an icon and a word (see `AnswerTile`, `Chip`).

## Screenshots (web preview, no phone needed)

```
cd "FLY8 Study"
npm install
node scripts/screenshots.mjs          # exports the web build, then writes PNGs to $SHOT_DIR (default /tmp/fly8-shots)
SKIP_EXPORT=1 EXPORT_DIR=/tmp/fly8-web-export node scripts/screenshots.mjs   # reuse an export
```

Needs a Chromium under `/opt/pw-browsers` (or set `CHROMIUM_PATH`). Demo data: `design/demoState.json` (invented). Quiz shots use the web-only `#demo=choice|typing|matching|ordering|cloze` route (`src/ui/DemoHarness.tsx`). Do not commit the PNGs.
