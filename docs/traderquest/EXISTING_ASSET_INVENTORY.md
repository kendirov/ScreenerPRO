# Existing asset inventory — salvage boundary

Источник: branch `codex/bitget-private-readonly-v1-2026-08-18` at `ebceeb8…`, GitHub tree/readback, Drive canon and Vercel metadata. Статус означает действие для TraderQuest, а не качество production.

| Asset | Status | Branch/source | Routes/files | Reality / dependencies | Не потерять / debt / action |
|---|---|---|---|---|---|
| Bitget public UTA v3 market adapter | KEEP | `feature/bitget-global-screener-v1`; present in base as `frontend/lib/server/services/bitget-market.ts` | `/api/bitget/screener`, `/screener/bitget` | Live server fetch; official Bitget REST; no browser secrets | Category identity, null handling, source fields. 24h-only scoring and no historical baseline; later extract behind `ExchangeAdapter`. |
| Bitget terminal v3 | KEEP | `feature/bitget-global-screener-v1`; `frontend/components/bitget/bitget-terminal-v3.tsx`, `bitget-global-screener.tsx` | `/screener/bitget` | Existing Next.js/React workspace surface; depends on adapter and local favorites/notes | Do not build a second terminal. Keep single scroll/briefing/radar/inspector; future migration only by approved contract. |
| Bitget market map | KEEP | `feature/bitget-global-screener-v1`; `frontend/components/bitget/bitget-market-map.tsx` | `/screener/bitget/map` | Existing interactive map; depends on public market data | Preserve product-mechanics map and honest pending states. No Crypto redesign in TQ-001. |
| Bitget briefing engine | KEEP | `codex/bitget-briefing-screener-v1-2026-08-13`; `frontend/lib/bitget/briefing-engine.ts`, `briefing-types.ts` | `/api/bitget/briefing`, briefing layer in terminal | Deterministic pure function over current adapter rows; 24h proxy, `baseline: MISSING` | Preserve explicit WATCH_ONLY/IN_PLAY and reasons. Refactor only after baseline/data contract exists. |
| Private read-only UTA bridge | KEEP | `codex/bitget-private-readonly-v1-2026-08-18`; `frontend/lib/server/services/bitget-private.ts` | `/api/bitget/private/account`, `/api/bitget/private/balance` | Server-only HMAC-SHA256/Base64 GETs; env names only; production returns 403; no order POST | Preserve no-order boundary and secret isolation. Debt: no user auth/security layer; preview-only, not execution. |
| Private account API routes | KEEP | same as above | listed routes | Preview-only read snapshot of account/assets/funding/open orders/positions | Do not expose or copy secret values. Later place behind approved account boundary and auth. |
| Crypto public scanners | KEEP | `codex/bitget-private-readonly-v1-2026-08-18`; `scripts/crypto-market-scan-v*.mjs`, `scripts/crypto-rebound-scan-v*.mjs` | GitHub Actions outputs in `data/crypto-*-latest.json` | Public Bitget/OKX data; generated snapshots; no order execution | Preserve methodology/limitations and provenance. Not a substitute for tq-market ingestion. |
| Cross-exchange scanner | REFACTOR | same branch; `scripts/crypto-cross-exchange-scan.mjs` | CI-oriented scanner | Binance/Bybit/OKX/Bitget public endpoints; failures are tolerated; provider semantics differ | Do not use as canonical execution truth. Later split provider adapters and signed snapshots; validate geo/API limits. |
| GitHub crypto workflow | KEEP | same branch; `.github/workflows/crypto-cross-exchange-scan.yml` | Push/workflow dispatch on Bitget branch | Runs scans and writes generated JSON back to branch | Preserve audit trail; debt is branch mutation and snapshot-vs-truth ambiguity. |
| TradingView inline workspace | KEEP | Bitget global screener branch; `frontend/components/bitget/tradingview-chart.tsx` | inline in `/screener/bitget` | Visual/reference chart only; not data truth | Preserve as inspector aid; never treat continuous/visual data as execution evidence. |
| Stocks Trading Workspace | KEEP | `codex/trading-stocks-v2-2026-08-15` head `6031c8…`; current shared shell | `/screener/stocks`, stocks materials/routes | Existing MOEX product surface; separate domain | Do not fork a competing frontend; retain shell and canonical visual/data standards. |
| Futures Trading Workspace | KEEP | current repository shared shell | `/screener/futures`, `/futures/[ticker]` | Existing product/research surface | No crypto assumptions or shared metric invention. |
| Strategy Lab / research code | KEEP | current repository; `frontend/app/(app)/lab/*`, strategy routes | Strategy and lab surfaces | Research/prototype surfaces; not TraderQuest execution | Preserve deterministic research semantics; StrategySpec remains future approved representation. |
| Existing event-reactions lab | UNKNOWN | current repository; `frontend/app/(app)/lab/event-reactions`, APIs | event reaction routes | Research/prototype; not evidence that EventContext exists | Do not claim causality. Evaluate separately against future EventContext contract. |
| AI_SESSION_STATE | KEEP | `AI_SESSION_STATE.md` on base | documentation | Historical state says private bridge and global screener boundaries | Use as history, never above Drive canon or current code/Vercel evidence. |

## Explicit duplicate-build prohibitions

Do not add another Bitget REST adapter, another `/screener/bitget` page, another market map, another private HMAC signer, another account route, or a new score that silently replaces `baseline: MISSING`. Existing assets may later be wrapped/extracted behind TraderQuest boundaries; TQ-001 does not rewrite them.

## Security observation

Observed only environment variable names: `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and Vercel/GitHub secret names. No secret values were copied into this inventory. No suspected committed secret observed in the inspected tree.
