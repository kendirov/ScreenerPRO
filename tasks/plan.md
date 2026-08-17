# Plan — Trading Workspace / Stocks v5 + Futures v1

1. Preserve `main`, current Draft PR branch and unrelated dirty files.
2. Clarify Stocks three-session charts, reduce support rails to an explicit top six and turn the table close-position mark into an honest OHLC session microvisual.
3. Enrich Futures rows with MOEX `ASSETCODE`, group contracts by underlying and select a lead contract using current turnover with expiry safeguards.
4. Build a Futures briefing surface with family focus, separate liquidity/volatility rankings, family-aware table and selected-contract chart.
5. Add same-time contract-volume comparison only where at least three completed prior sessions exist; keep current ruble turnover separate.
6. Verify contracts, TypeScript, lint, build, desktop/mobile UI, console and network.
7. Update CANON, commit only scoped files, update Draft PR #10 and publish a protected Vercel Preview.

## Boundaries

- Production `main` and `screenerpro.vercel.app` remain unchanged.
- No broker actions, paid keys, FUTOI claims or invented basis.
- No new dependency.
- Existing unrelated dirty files stay untouched and outside the commit.
