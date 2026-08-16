# Plan — Trading Workspace / Stocks Radar v1

1. Preserve `main` and continue the existing Draft PR branch in a separate worktree.
2. Turn the current `/trading/stocks` header into one decision path: market state → instruments in play → evidence → full table.
3. Reuse the existing MOEX screener and candle contracts; expose missing data as `—` and never replace absent baselines with cross-sectional guesses.
4. Add compact real intraday charts and explicit numeric reasons to the focus rows without introducing a hidden score.
5. Verify data contracts, TypeScript, targeted lint, production build, missing/stale states, desktop/mobile UI and console.
6. Update Draft PR #10 and publish a protected Vercel Preview only after local verification.

## Boundaries

- Production `main` and `screenerpro.vercel.app` remain unchanged.
- No Futures, Crypto, Strategies, Materials, full Inspector or global platform redesign in this slice.
- Existing dirty CRLF-only changes outside Trading Workspace remain untouched and excluded from commits.
- No new dependency unless the existing stack cannot provide the required behavior.
