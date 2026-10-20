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
2. Sector K does not expose `isInPlay`, score or percentile labels as market facts while same-time baselines are missing.
3. Every stock count and ranking uses the verified stock-only TQBR universe.
4. Futures family metrics come from real FORTS rows; inferred signal copy is hidden and missing basis remains `null/—`.
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

## Iteration 02 — pre-change product critique

Compared surfaces: current `/sector-k`, `/sector-k/stocks`, `/sector-k/futures`; legacy `/screener`, `/screener/stocks`, `/screener/futures`; dark and light themes; live MOEX response at 18:51 MSK.

### Live universe audit

The API returned 505 TQBR rows. The repository's existing `stock-universe-filter` classified them as:

| Category | Rows |
| --- | ---: |
| Common shares | 214 |
| Preferred shares | 48 |
| ETF | 113 |
| Funds | 66 |
| Bond-like instruments | 63 |
| Unknown | 1 |
| Stock-only total | 262 |

The required liquid and preferred symbols (`SBER`, `SBERP`, `TRNFP`, `VTBR`, `IRAO`, `SIBN`, `X5`) remain inside the 262-row stock universe.

### Strongest current problems

1. **Wrong stock universe.** Sector K reports all 505 TQBR rows as stocks and silently mixes 243 ETF/fund/bond/unknown rows with 262 shares.
2. **Market hidden by the default algorithm.** `/sector-k/stocks` opens on 248 “active” rows instead of the complete stock universe. The first decision is made by the score before the user sees the market.
3. **Sorting is in the wrong control.** A separate dropdown hides ordinary table behavior, supports no price/trades sort and uses absolute change only. Numeric headers are not interactive.
4. **Today is a symmetric KPI dashboard.** “Акции в игре”, “Активные акции” and baseline coverage dominate the first screen but do not answer where turnover, trades, movement and range are concentrated.
5. **Today has one opaque stock ranking.** The same seven score-ranked rows stand in for liquidity, trades, movement and range; these are different trader questions and need separate rankings.
6. **Dead-end blocks.** The Today mini-list opens only the generic stock page; no block carries its relevant sort/filter. Stock table rows do not expose the existing detail/candles route.
7. **Core columns are displaced by model state.** “Статус” and “Baseline” occupy permanent table width while price, change, turnover, trades and day range are the actual comparison core.
8. **Inspector over-exposes internals.** `inPlayScore`, `activityRatio` and baseline implementation details appear before price structure and direct detail navigation.
9. **Useful legacy mechanics were lost.** Legacy already has direct header sorting, full-universe browsing, market breadth, IMOEX context, leader rails, detail pages and candles. Its visual density and contrast are weak, but the mechanics are valuable donors.
10. **Themes are visually coherent but the hierarchy is oversized.** Dark and light both work, yet the large page title and equal panels consume vertical space that should show more market rows above the fold.

### Iteration 02 decision

- Keep the Sector K shell, themes, MOEX source state and futures-family model.
- Replace score-first Today with an asymmetric market cockpit: market breadth/context, top turnover table, trade-count leaders, movers, ranges and futures families.
- Apply the existing verified stock-only classifier before every Sector K stock ranking and count.
- Make the full 262-row stock universe the default.
- Move sorting to numeric column headers with explicit ascending/descending state; remove the sort dropdown.
- Keep presets as optional views, never as the only access to the market.
- Use URL query state for Today → Stocks drill-down.
- Keep model/baseline data secondary and truthful; never let it displace the market-comparison fields.

## Iteration 02 — implemented result

### Market workspace

- **Today:** asymmetric cockpit with session/IMOEX/breadth, total stock turnover and trades, turnover leaders, movers, range leaders, trade-count leaders and futures families.
- **Stocks:** 262 shares by default; common/preferred composition filters; ticker/name search; direct numeric header sorting; selectable columns; reset; sticky instrument column; selected row and instrument drill-down.
- **Futures:** compact family/contract workspace; direct numeric header sorting; active and next-series drill-down; basis remains unavailable until spot and a common timestamp exist. The unverified inferred “signal” column is not rendered.
- **Crypto:** one explicit unavailable-source state instead of three empty cards.
- **Tools:** five existing analysis routes in a dense working list; no empty “public strategies” placeholder.
- **Materials:** one real registry row; draft placeholders removed.
- **Intraday selection:** stock-only market context, top-turnover instrument selector, live MOEX price/turnover/trades/lot, friction calculator and concrete include/exclude checks.
- **Studio:** Russian scene labels and product-facing version data; schema internals removed from the main hierarchy.

### Local verification

- stock universe audit: 505 raw TQBR rows → 262 shares, 243 excluded;
- contract and stock-universe verification scripts passed;
- TypeScript and targeted ESLint passed;
- production build passed with 70 routes;
- desktop QA: all seven public Sector K routes plus Studio, dark/light themes;
- mobile QA: stock table, horizontal comparison, mobile navigation and controls;
- functional QA: stock search, header sort, column visibility/reset, futures sort and material calculator;
- browser console: no warnings or errors in the verified run.
