# Sector K — Stocks Workspace

Status: approved product slice, 2026-08-14.

## Objective

Turn `/sector-k/stocks` into one continuous market workspace where the trader can see the real MOEX stock universe, locate activity, compare instruments and open a real chart without leaving the page.

## Product decisions

### Keep

- real MOEX ISS data and explicit source state;
- stock-only universe filter;
- direct sorting from numeric column headers;
- price, change, turnover, trades and day range;
- search, column selection, dark/light themes;
- existing historical screener and candle APIs;
- production and all legacy routes unchanged.

### Change now

- rename the primary `Сегодня` destination to `Рынок`;
- group `Акции / Фьючерсы / Крипто` as the screener and visually separate `Инструменты / Материалы`;
- remove the stock page title, MOEX/TQBR preamble, common/preferred filters, right inspector and top counters;
- sort by trade count by default;
- add an actual trading-date selector and historical readback;
- show IMOEX2 and IMOEX as pinned market rows when MOEX returns them;
- show aggregate stock-market turnover and trades only from the API contract;
- add `Скрыть неликвиды`, enabled by default; hide only the bottom liquidity tail by current-session turnover and trades, not by a fixed ruble threshold;
- add a compact, dynamically sized `В игре` area based on reliable same-time turnover baselines; do not cap it to five instruments;
- add a separate current-market impulse area for liquid spikes and dumps; do not call it historical abnormality;
- ticker click copies the symbol; row click selects; the disclosure arrow opens a real inline MOEX candlestick chart;
- remove the table's vertical scroll container; page scroll is the only vertical scroll;
- selected state uses a restrained matte highlight and one semantic accent, not permanent neon.

### Do not repeat

- no marketing copy, generic slogans or explanatory water;
- no fixed `top 5` / `top 20` when the market itself determines the count;
- no common/preferred split in the main workflow;
- no hidden algorithm in place of the full sortable universe;
- no absolute-turnover claim that an instrument is `in play` without comparison to its own same-time baseline;
- no raw exchange codes, universe counts or data-pipeline details above the working table;
- no separate right inspector duplicating the selected row;
- no nested vertical scrolling;
- no fake chart, no decorative line and no TradingView iframe dependency.

## Data rules

- `В игре`: only reliable `same-time` turnover ratio from MOEX intraday history plus current liquidity/range confirmation. Missing baseline means no claim.
- `Импульсы`: current cross-section only; liquid instruments with an extreme signed move and meaningful day range.
- Illiquidity: compute turnover and trades ranks inside the stock-only universe; hide rows that remain in the bottom tail on both measures.
- Historical dates: server may resolve a weekend/holiday to the nearest previous trading day; show the resolved date from status.
- Index rows: price, change and range belong to the index; aggregate turnover and trades belong to the complete filtered stock market and must remain labeled as market totals.

## Chart architecture

- Reusable adapter: `MarketCandleChart` over `lightweight-charts`.
- Data source: existing `/api/screener/stocks/candles` and `useStockExpandedCandles`.
- First consumer: inline stock disclosure row in Sector K.
- Future consumers: strategies, materials and detailed instrument workspaces.
- No new chart dependency in this slice.

## Commands

- `pnpm -C frontend verify:sector-k`
- `pnpm -C frontend verify:stock-universe`
- `pnpm -C frontend exec tsc --noEmit`
- targeted `pnpm -C frontend exec eslint ...`
- `pnpm -C frontend build`

## Boundaries

- Always: preserve unrelated dirty files, verify live and historical data, run desktop/mobile browser QA, publish only a Vercel Preview.
- Ask first: production promotion, schema migration, new external chart provider or new credential.
- Never: change production aliases, stage unrelated files, invent missing index/baseline values.

## Success criteria

- a trader reaches the full stock table immediately, without a page-title block;
- default order is trades descending;
- date selection changes the API request and returns a historical MOEX day;
- IMOEX2/IMOEX rows appear when their real data is available;
- checked liquidity filter removes only the current-session bottom tail and can be disabled;
- ticker copy and inline chart expansion work;
- no right inspector and no vertical table scroll;
- desktop/mobile and dark/light visual QA pass in Preview;
- production remains on its previous deployment.
