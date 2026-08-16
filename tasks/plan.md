# Plan — Trading Workspace / Stocks Radar v2

1. Preserve `main` and continue the existing Draft PR branch in a separate worktree.
2. Turn `/trading/stocks` into one decision path: computed market state → multi-session context → instruments in play → execution support → full chart/table.
3. Reuse the existing MOEX screener and candle contracts; expose missing data as `—` and never replace absent baselines with cross-sectional guesses.
4. Use real three-session lines for scanning and the existing interactive candle chart for detail; never introduce a hidden score.
5. Verify data contracts, TypeScript, targeted lint, production build, missing/stale states, desktop/mobile UI and console.
6. Update Draft PR #10 and publish a protected Vercel Preview only after local verification.

## Boundaries

- Production `main` and `screenerpro.vercel.app` remain unchanged.
- No Futures, Crypto, Strategies, Materials, Inspector or global platform redesign in this slice.
- Existing dirty CRLF-only changes outside Trading Workspace remain untouched and excluded from commits.
- No new dependency unless the existing stack cannot provide the required behavior.
