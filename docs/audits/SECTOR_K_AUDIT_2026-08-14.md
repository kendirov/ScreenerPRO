# Sector K / ScreenerOS — audit before implementation

Date: 2026-08-14

Scope: Google Drive canon, `kendirov/ScreenerPRO`, `kendirov/presentation-os`, GitHub branches/PRs, Vercel production and previews.

Rule: this report classifies evidence observed before the Sector K implementation. It does not turn documentation claims into runtime facts.

## Executive decision

Build Sector K as a namespaced, reviewable slice in `kendirov/ScreenerPRO` from the current production commit `1cc078b`, without changing existing `/screener`, `/screener/stocks`, `/screener/futures`, market formulas or production aliases.

Why:

- `main` is the only branch tied to the current `screenerpro.vercel.app` production deployment;
- eight open Draft PRs contain useful but mutually independent donor work;
- merging those branches first would make the new product diff unreviewable;
- the current main branch already contains the live MOEX adapter, stock table, futures family model, materials and strategy labs required as a safe data/runtime base;
- Presentation OS already owns private Studio/Player patterns and must remain a separate runtime.

## Verified deployment boundary

| Surface | Evidence | Classification | Decision |
| --- | --- | --- | --- |
| Vercel `screenerpro` production | deployment `dpl_FaAJGnxBZMVHCr1GABdjqgEUwhKQ`, alias `screenerpro.vercel.app`, `main@1cc078b`, `READY` | WORKING / KEEP | Do not promote, alias or modify production in this iteration. |
| Current production routes | authenticated Vercel fetch returned HTTP 200 for `/screener`, `/screener/stocks`, `/screener/futures` | WORKING / KEEP | Preserve route files and shell. |
| Current production stock API | HTTP 200 from `/api/screener?assetClass=stock`; live MOEX rows, source timestamps and null baselines observed | WORKING / KEEP, DEGRADED BASELINE | Reuse contract. Never replace missing Vol x / Trades x with a proxy. |
| PR #8 Bitget Preview | `READY`, branch `codex/bitget-briefing-screener-v1-2026-08-13`, commit `13d329b`, protected Preview | EXPERIMENT / DONOR | Keep separate. Crypto remains the next slice. |
| Preview access | normal Preview/API request can redirect to Vercel SSO | WORKING PROTECTION / QA GATE | Verify with authenticated Vercel/browser tooling; do not disable protection. |

## GitHub topology

`kendirov/ScreenerPRO` is public, default branch `main`, owner has admin/push access. Current open Draft PRs:

| PR | Head → base | Classification | Reusable value | Risk |
| --- | --- | --- | --- | --- |
| #1 | `feature/ai-data-terminal-v1` → `main` | EXPERIMENT | AI export surface | Separate product slice. |
| #2 | `feature/design-foundation-navigation-shell` → `main` | PARTIAL DONOR | semantic tokens/navigation | Older shell direction; not current Visual DNA. |
| #3 | `feature/stocks-command-center-lab` → `main` | EXPERIMENT | live-only command-center pattern | Adds lab on top of PR #2. |
| #4 | `codex/trading-os-shell-v1` → `feature/stocks-command-center-lab` | PARTIAL DONOR | runtime boundary ADR, mobile nav, Studio bridge | Three-branch dependency; not a clean base. |
| #5 | `feature/bitget-screener-mvp` → `main` | OBSOLETE DONOR | early Bitget adapter | Superseded by PR #6/#8. |
| #6 | `feature/bitget-global-screener-v1` → `main` | EXPERIMENT | Bitget UTA v3 market layer | 32 commits; separate crypto product slice. |
| #7 | `codex/screeneros-source-of-truth-audit-2026-08-13` → `main` | DOCUMENTATION / KEEP AS REFERENCE | source-of-truth and security P0 | Must not be treated as runtime QA. |
| #8 | `codex/bitget-briefing-screener-v1-2026-08-13` → `feature/bitget-global-screener-v1` | EXPERIMENT / DONOR | Attention / Execution Quality / Situation | Correctly isolated from `main`; browser QA still required. |

## Product and route matrix

Classification is based on code inspection, production HTTP checks, build output (62 static/dynamic routes), and source contracts.

| Area | Routes / evidence | Classification | Sector K action |
| --- | --- | --- | --- |
| Today / market cockpit | `/screener`; current `MarketPriorityPage`, live stock/futures queries | WORKING BUT REDESIGN | New asymmetric cockpit under `/sector-k`; reuse live contracts only. |
| Stocks screener | `/screener/stocks`; virtualized/table components, presets, inspector, candles | WORKING BUT REDESIGN | New table-first Sector K surface; keep legacy route untouched. |
| Futures screener | `/screener/futures`; `buildFuturesFamilies`, family/contract modes, OI/expiry | WORKING BUT REDESIGN | Reuse family model; present family → contracts honestly. Basis stays `—` when absent. |
| MOEX screener API | `/api/screener`, TQBR/FORTS ISS endpoints, Zod contract | WORKING / KEEP | Read-only reuse. No new trading actions. |
| Same-time baseline | partial/no-history states observed in production API | PARTIAL | Show `—`, session count and warning; never infer reliable Vol x. |
| Instrument detail/candles | `/stocks/[ticker]`, `/futures/[ticker]`, candles/history APIs | WORKING / KEEP | Link from inspector where useful. |
| Materials | `/materials/*`; mixed real tools and authored/static content | PARTIAL | Add one isolated web-native material with live MOEX identity + user-controlled friction assumptions. |
| Academy | `/academy/*`; repository docs identify mock/editorial content | EXPERIMENT | Do not use as source of live market truth. |
| Strategy labs | `/screener/strategies`, correlation, event, CBR and spread labs | WORKING / EXPERIMENT MIX | Keep separate; Sector K exposes a bounded index and links to verified legacy workspaces. |
| Orderflow simulator | `/lab/orderflow-simulator`; simulated UI | EXPERIMENT | Do not present as a real terminal or live market. |
| Login/pricing/watchlist | UI/mock flags; auth/subscriptions not connected | PARTIAL / NOT PRODUCTION AUTH | Do not reuse as Studio protection. |
| Supabase | client scaffolding present; no production auth/CMS confirmed | UNKNOWN / NEEDS VERIFICATION | No database migration in this slice. |
| Bitget | separate PR #6/#8 routes and APIs | EXPERIMENT / NEXT SLICE | Keep out of Sector K v1 branch. Show explicit “data not connected” state. |

## Presentation OS boundary

`kendirov/presentation-os` is a private, separate repository. Main currently provides:

- public library and Player;
- owner-gated Studio;
- content-as-code seed;
- `draft → review → published → archive`;
- immutable release model;
- scene-based interactive player;
- Supabase target architecture.

Its repository contains `.openai/hosting.json`; therefore it is not a Vercel-safe-deploy target under the current deployment procedure. This Sector K change will not copy the Studio runtime, merge repositories, share cookies or read Presentation OS tables directly. It will reuse only the documented content schema concepts and keep a future versioned API/release-manifest boundary.

## Drive canon and duplicates

Confirmed canonical chain:

`Трейдинг → Платформа → ScreenerOS → 05_Work Prompts → 01_MASTER_PROMPT_Work_New_Screener`

Canonical documents read:

- `00_НАВИГАЦИЯ_Трейдинг.txt`;
- `00_НАВИГАЦИЯ_Платформа`;
- `00_НАВИГАЦИЯ_ScreenerOS`;
- `01_МАСТЕР_ЗАДАЧА_ScreenerOS`;
- `02_PRODUCT_BLUEPRINT_Screener_2026-08-14`;
- `01_VISUAL_DNA_Screener`;
- `01_STUDIO_DRAFT_PUBLISH_WORKFLOW`;
- `AI_SESSION_STATE_ScreenerOS`.

Search also returned explicit backup copies of Trading/Platform navigation in the archive/system parent. They are backups, not alternate canons. No Drive object is moved, renamed or deleted in this iteration.

## Data truth rules for implementation

1. `source`, `generatedAt`, degraded state and baseline reliability stay visible.
2. “В игре” is used only when the existing contract says `metrics.isInPlay=true`.
3. A high score without reliable baseline is “Фокус”, not proven relative activity.
4. Futures family metrics come from real FORTS rows; missing basis remains `null/—`.
5. Friction calculator values are user assumptions. Live MOEX contributes only instrument identity, price, lot, turnover and trades.
6. Crypto is not shown as live in this branch.

## Repository anomalies observed before edits

- A fresh clone reports three files as modified only because the committed files contain malformed CR/CRLF sequences while `.gitattributes` requires LF. They are outside Sector K scope and will not be staged.
- Baseline production build passed: Next 16.2.1, TypeScript and generation of 62 routes.
- Dependency install initially could not write Prisma's user cache; Prisma generation passed after redirecting its cache to an isolated temporary directory.

## Definition of Done for this slice

- isolated `codex/sector-k-preview-v1-2026-08-14` branch from `main@1cc078b`;
- new namespaced routes only; no legacy route changes;
- neutral matte dark + porcelain light tokens;
- live Today, Stocks and Futures surfaces with truthful missing-data behavior;
- Studio content model and Preview-only content-as-code library;
- one interactive “Отбор инструментов” material;
- typecheck, targeted lint, production build, API smoke and browser QA at desktop/mobile in both themes;
- explicit Draft PR and Vercel Preview; production aliases untouched.
