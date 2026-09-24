# Spec — Trading Workspace / Stocks Radar v1

## Objective

Build the first finished decision surface of Trading Workspace for an active Russian-speaking MOEX trader. Within 10–20 seconds `/trading/stocks` must answer what the market is doing, which stocks deserve attention, why they were selected and which real data supports that conclusion.

## Product Contract

- Decision path: `Market Strip → В игре → evidence → market table`.
- `В игре` is a compact trading workspace, not a card gallery.
- Every selection reason is a visible numeric fact. Ranking may order candidates internally, but the UI never presents an unexplained universal score.
- Missing or unreliable metrics render as `—` and never become synthetic live data.
- Visual language: neutral matte black/graphite, warm near-white type, restrained semantic green/red/amber/violet, no permanent cyan tint, glow or cyberpunk decoration.

## Data Truth

| Metric | Source | Unit / timeframe | Calculation | Freshness / fallback | Baseline |
| --- | --- | --- | --- | --- | --- |
| IMOEX value/change/range | MOEX ISS benchmark | points, %, current session | API fields | source timestamp; `—` when absent | no |
| Breadth | MOEX ISS TQBR stock universe | count, current snapshot | positive vs negative session change | source timestamp; `—` if universe absent | no |
| Market turnover/trades | MOEX ISS TQBR stock universe | RUB / count, cumulative session | sum over validated stock rows | source timestamp; `—` if absent | no |
| Turnover balance | MOEX ISS TQBR stock universe | %, current snapshot | `(up turnover - down turnover) / (up turnover + down turnover)` | `—` if denominator is zero | no |
| Stock relative move | stock + IMOEX snapshot | percentage points | stock change minus benchmark change | `—` if either side absent | no |
| Range position | stock snapshot | % of current day range | `(last-low)/(high-low)` | `—` for incomplete/zero range | no |
| Turnover x / Trades x | MOEX same-time intraday baseline | multiplier | current cumulative value divided by average cumulative value at the same MSK time | only reliable `intraday-ok`; otherwise `—` | required |
| Mini chart | MOEX ISS candles | 10-minute intraday candles | real close/turnover series | loading/no-data state; no synthetic sparkline | no |
| Cross-sectional reason | validated stock universe | percentile label | descending rank within current universe | used only as explicit rank fact, never called historical abnormality | no |

## Existing Stack

- Next.js 16 App Router, React 19, TypeScript.
- TanStack Query for market/candle fetching.
- Existing MOEX ISS screener, baseline and candle services.
- Existing SVG radar sparkline; no new chart dependency for the compact focus view.

## Commands

- Install: `pnpm install --frozen-lockfile`
- Dev: `pnpm -C frontend dev:live`
- Contract: `pnpm -C frontend verify:sector-k`
- Universe: `pnpm -C frontend verify:stock-universe`
- Type: `pnpm -C frontend exec tsc --noEmit`
- Targeted lint: `pnpm -C frontend exec eslint components/trading app/'(trading)' lib/trading scripts/verify-trading-workspace-stocks.ts`
- Build: `pnpm -C frontend build`

## Testing Strategy

- Deterministic script verifies turnover balance, relative move, range position and reason ordering/fallbacks.
- Existing stock universe and Sector K contract scripts protect source semantics.
- Browser QA covers 1440px desktop and 390px mobile, dark/light, loading/no-data/degraded source UI and zero console errors.
- Preview must be READY and remain protected; Production is not touched.

## Success Criteria

1. Market Strip is compact and shows IMOEX, breadth, turnover, trades, range position, exact turnover balance, source and freshness.
2. `В игре` is visually dominant and contains ticker, price, move, turnover, trades, range, range position, relative move, honest activity ratios and 1–3 numeric reasons.
3. Each focus row contains a real compact MOEX intraday chart or an explicit no-data/loading state.
4. No missing baseline is rendered as a ratio; no AI score or fake market data is shown.
5. Desktop/mobile layouts, build, targeted lint/type checks and relevant data scripts pass.
6. Draft PR #10 receives a new protected Preview; Production remains on `main@1cc078b`.

## Open Product Decisions

- Final public project/domain: target `tradingworkspaces.vercel.app`; create only after the Preview is approved as the product baseline.
- The next slice after approval is the instrument Inspector, not automatic expansion into other asset classes.
