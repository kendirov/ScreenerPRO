# START_HERE_FOR_AI — TQS / ScreenerPRO

This is the public-safe technical front door for AI agents working in this repository.

> **Important:** `ScreenerPRO` is the historical repository name. The product is part of the broader **Trading QS / TQS** platform. Never choose this repo merely because it is familiar.

## Read first

1. **`AGENTS.md`** — execution and routing rules.
2. **`TQS_PLATFORM.md`** — platform/module boundaries and sources of truth.
3. **`AI_SESSION_STATE.md`** — compact current repository checkpoint.
4. **`PRODUCT_VISION.md`** — product/UX intent when relevant.
5. **`PROJECT_CONTEXT.md`** — deeper legacy technical context only when needed.
6. Module-specific docs for the affected surface.

For Screener/Cockpit UX:
- `docs/INTRADAY_SCREENER_TERMINAL_VISION.md`
- `docs/UI_NUMBERS_MINIMALISM.md`
- `docs/MARKET_RADAR_FORMULAS.md`

For Strategy Lab:
- `docs/STRATEGY_LAB_TARGET.md`
- `docs/ROUND_LEVELS_STRATEGY.md`
- `docs/STRATEGY_SCANNER_ARCHITECTURE.md`

## Roles

- **Owner**: product intent and trader logic.
- **Current ChatGPT/AI agent**: architect + researcher + default executor when connected tools can implement and verify the task.
- **Cursor/Codex/other workers**: optional execution/escalation tools, never mandatory memory or routing layers.

Do not end a normal development task by merely writing a prompt for another worker when the current connected agent can implement and verify it.

## Repository ownership

This repo currently owns:
- TQS Screener/Cockpit code;
- Strategy Lab surfaces implemented here;
- Academy/material surfaces implemented here.

This repo does **not** own generic device/computer automation. Historical TQS Desktop Agent material is reference only; current generic persistent execution is Artem OS in `kendirov/tqs-development-factory`.

## Before changing code

1. Confirm current branch/HEAD.
2. Read `AI_SESSION_STATE.md`.
3. Identify the owning TQS module in `TQS_PLATFORM.md`.
4. Reuse an existing code path before creating a new app/service.
5. Define observable acceptance.
6. If the task depends on live market/runtime state, inspect that state instead of trusting old docs.

## Verification

Never equate "commit/build succeeded" with product PASS.

Minimum code gate:
```
pnpm -C frontend build
```

Also run targeted verification relevant to the affected module, then inspect actual runtime/UI for user-visible changes.

## Important routes to protect

- `/screener`
- `/screener/stocks`
- `/screener/futures`
- `/screener/strategies`
- Academy/material routes currently linked from the product
- MOEX live/fallback behavior
- shared layout/navigation

## Local development

```
pnpm install
pnpm -C frontend dev
```

Full setup and legacy cross-platform helpers remain documented in `PROJECT_CONTEXT.md` and `docs/WORKFLOW.md`. Load them only when the current task needs them.

## Persistence

After a meaningful change:
- commit the technical delta;
- run verification;
- update `AI_SESSION_STATE.md` with only durable current state;
- keep private Drive content/secrets out of this public repository.
