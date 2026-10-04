# Trading Workspace / Stocks Radar v2

## Product decision path

1. **Market:** computed state from IMOEX, breadth and turnover balance; last session is explicit when the market is closed.
2. **Context:** IMOEX intraday path against two previous sessions; market turnover against seven previous sessions.
3. **Focus:** up to five explainable `В игре` candidates with real three-session charts and numeric reasons.
4. **Execution support:** compact `Ликвидность` and de-emphasized `Прострелы` rails.
5. **Work:** clicking any radar row selects the instrument, opens its real candle chart and connects the top to the table.

## Truth rules

- No hardcoded inclusions, including OZON. A ticker appears only if it passes the current formula.
- Amber means anomaly/attention, never price direction. Direction is green/red.
- Turnover history is absolute. During an open session it is not presented as a same-time norm.
- `В игре` needs participation plus at least two confirmations from range, move, turnover and trades.
- `Ликвидность` is execution availability, not a signal.
- `Прострелы` are range from 2% or move from 1.5% plus a high volatility rank.
- “Hard illiquid” is the bottom 42% simultaneously by turnover and trades in the current cross-section, so the filter adapts to session time.

## Visual rules

- Hierarchy beats equal-weight cards: `В игре` owns the main surface; support radars stay narrow.
- Strong accents are reserved for direction, current session and actionable selection.
- The compact chart overlays normalized intraday paths; the detailed chart remains an interactive candlestick chart.
- Russian product labels only. Missing trustworthy baselines remain `—`.

## Out of scope

- Futures, Crypto, Strategies, Materials.
- Inspector or new universal score.
- Production release.
