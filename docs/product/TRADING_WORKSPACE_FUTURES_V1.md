# Spec — Trading Workspace / Futures v1

## Objective

Build a professional MOEX futures decision surface for a Russian-speaking trader. Within 10–20 seconds `/trading/futures` must answer:

1. Which underlying families concentrate turnover and trades now?
2. Which exact contract leads each family, and which other series or perpetual variants exist?
3. Where is the strongest price movement and intraday range?
4. Is the displayed contract volume confirmed by a same-time historical baseline, or is that comparison unavailable?

Stocks remains the design donor, but Futures is not a flat copy of the stock table.

## Tech stack and commands

- Next.js 16, React 19, TypeScript, existing MOEX ISS services and `lightweight-charts`.
- Dev: `pnpm --dir frontend dev:live`
- Contract checks: `pnpm --dir frontend verify:trading-workspace-stocks` and the new Futures verifier.
- Typecheck: `pnpm --dir frontend exec tsc --noEmit`
- Lint: targeted `pnpm --dir frontend exec eslint <changed files>`
- Build: `pnpm --dir frontend build`

## Project structure

- `frontend/components/trading/` — Trading Workspace screens and microvisuals.
- `frontend/lib/domain/` — pure Futures grouping and ranking rules.
- `frontend/lib/server/services/` — MOEX ISS reads and same-time activity context.
- `frontend/app/api/trading/` — read-only product endpoints.
- `frontend/scripts/` — deterministic contract verification.

## Code style

```ts
const activity = ratio == null ? "unavailable" : ratio >= 1.5 ? "strong" : "normal";
```

Prefer explicit source states and small pure selectors. Never convert missing history into a guessed number.

## Testing strategy

- Domain verifier covers family grouping, active-contract choice and rank ordering.
- TypeScript and targeted ESLint cover implementation boundaries.
- Production build verifies server/client integration.
- Real-browser desktop/mobile QA verifies navigation, filters, family expansion, charts, console and request status.

## Boundaries

- Always: exact SECID, expiry, current turnover/trades/OI/range from MOEX ISS; label unavailable baselines honestly.
- Ask first: new paid data source, broker connection, Production deployment.
- Never: orders, broker keys, fake basis, fake volume growth, or mixing a continuous visual symbol with an exact MOEX contract.

## Success criteria

- Families use `ASSETCODE` plus explicit aliases; quarterly, mini and perpetual variants are visible inside one underlying family where the relationship is known.
- The family leader is selected by current turnover with expiry-aware safeguards, not by ticker order.
- The first screen separates Activity, Execution and Situation: family focus, liquidity leaders and volatility leaders.
- Same-time contract-volume ratio appears only for contracts with enough completed prior sessions. Ruble turnover remains a separate current snapshot because FORTS candle `value` can be zero.
- The table exposes family, lead contract, variants, price change, turnover, trades, range, OI and expiry/roll context.
- Stocks support rails show an explicit top six of the full formula result, liquidity is sorted by turnover, and all three-session charts have a legend.
- Production is unchanged; a verified Vercel Preview is delivered.

## Open questions deferred

- Exact spot-synchronized basis and annualized carry remain unavailable until spot and futures share one timestamp.
- FUTOI/HI2/order-book layers remain separate future enrichments; absence does not block v1.
