# AI_SESSION_STATE — TQS / ScreenerPRO

## Canonical status

- Default branch: `main`
- Current observed HEAD before this front-door repair: `6a7d89d41e31a8a2f3e6798cfd1e24c26e10e30f`
- Latest user-facing repository change: **TQS Academy v1**
- This file is a compact recovery checkpoint, not a chronological log.

## Current product surfaces in this repo

- **Screener/Cockpit**: stocks/futures selection, Market Radar/In Play and related decision UI.
- **Strategy Lab**: round-level and related strategy/research surfaces remain implemented; July scanner work is historical state, not the global current task.
- **Academy**: dashboard, learning path and live lessons were added in the latest main commit.
- **Materials**: interactive educational surfaces remain part of this codebase.

## Architecture boundary

TQS is broader than this repository. See `TQS_PLATFORM.md`.

Generic desktop/device automation is no longer owned here. The historical `TQS Desktop Agent` implementation/docs are reference only; current generic execution belongs to Artem OS / `kendirov/tqs-development-factory`.

## Current repair / priority

AI front door is being normalized so new ChatGPT/AI sessions:
- enter through `AGENTS.md -> START_HERE_FOR_AI.md -> TQS_PLATFORM.md -> AI_SESSION_STATE.md`;
- use Chat-first execution when available;
- do not assume Cursor is mandatory;
- do not use ScreenerPRO as the default repo for unrelated projects.

## Stable verification

Use targeted module verification first, then:

```
pnpm -C frontend build
```

For user-visible changes, build success alone is not PASS: inspect the actual relevant runtime/browser state.

## Next task rule

There is intentionally no permanent "next feature" in this file. The next task comes from the owner's current goal + private TQS canon + current Git/runtime state. Update this file only when durable technical current state materially changes.
