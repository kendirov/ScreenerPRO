# Checkpoint: screener-pre-iteration-2026-03-24

## Milestone Name

`checkpoint-screener-pre-iteration-2026-03-24`

## Current Working Screener State

- Main screener UI is driven by `HomePageScreener` with tabs for `Акции` and `Фьючерсы`.
- Search filter is shared by ticker and short name across both tabs.
- Stock tab has a liquidity toggle (`Ликвидные`/`Все`) and table rendering via `ScreenerTable`.
- Data source status strip is visible with MOEX/Fallback indicator, row counts, fallback reason, and fetch time.

## Benchmark Block Present

- Benchmark block is implemented via `BenchmarkStrip` in the stock tab.
- It shows market code/name, last value, percent change, range, aggregate turnover, and trades.
- Unavailable benchmark state is explicitly handled with a fallback message.

## Academy / Materials State

- `Академия` landing page is active and populated from mock academy entries.
- `Материалы` landing page is active and routes to practical tools from materials navigation.
- Materials landing currently presents compact cards marked as working sections.

## Sidebar / Navigation State

- Sidebar uses persisted expand/collapse state via localStorage (`screenerpro.sidebar.pinned`).
- Visible navigation items are currently `Скринер`, `Академия`, and `Материалы`.
- Future sections remain hidden by config (`Скринер PRO`, `Новости`, `События`, `Наблюдение`, `Настройки`).

## Intent of This Checkpoint

This checkpoint captures the pre-iteration baseline before changing screener logic and visual design, so rollback is quick and low-risk.
