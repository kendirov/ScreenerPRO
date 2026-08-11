# AI_SESSION_STATE — Лаборатория рынка

---

## Текущая задача

**Bitget Global Screener + Interactive Market Map** (2026-08-11)

Цель: собрать внутри ScreenerPRO единый Bitget Trading OS: карта продукта объясняет механику, скринер сокращает universe до рабочих инструментов, затем подключаются Stock+, options, TradFi и private account analytics.

Реализовано в ветке `feature/bitget-global-screener-v1`:

- `/screener/bitget` — Terminal v3;
- `/screener/bitget/map` — интерактивная карта рынков;
- public UTA v3 adapter;
- cached 7d enrichment;
- TradingView inline workspace;
- docs/BITGET_GLOBAL_SCREENER.md.

### Карта рынков — текущая логика

Presentation Blueprint: **объект → устройство → механика → источник движения → риск → действие**.

Три мира:

1. Крипто: Spot → Margin / Futures.
2. Акции / ETF: U.S. underlying → Stock+ / rToken / Stock Perp / Options.
3. Глобальные рынки: external commodity/FX/index market → Commodity Perps / TradFi-CFD.

UX:

- центральный смысл — сначала определить механику сделки;
- линии всегда заканчиваются в реальном узле;
- hover подсвечивает маршрут;
- click фиксирует продукт;
- понятные русские названия идут раньше API-терминов;
- зелёный status = данные уже есть в скринере;
- amber status = продукт есть у Bitget, но наш adapter ещё следующий;
- у фондовой ветви отдельный rail «один underlying — четыре торговые оболочки»;
- live-группы показывают count и крупнейших представителей по turnover;
- отсутствующие adapters не маскируются нулями.

### Terminal v3

- весь подключённый public universe;
- crypto spot/futures, margin, rToken, stock perps, commodity perps;
- единый page scroll;
- briefing strip;
- 24h + cached 7d;
- turnover, spread, funding;
- ticker copy;
- inline TradingView chart;
- favorite + notes;
- local persistence.

### Следующие adapters

1. Stock+ securities/quotes.
2. U.S. options: underlyings → expiries → option chains.
3. TradFi / CFD.
4. Historical feature cache: RSI/ATR/relative volume/momentum.
5. Private Classic v2 account analytics.
6. Cloud user workspace.

Секреты Bitget не попадают в браузер или GitHub. Торговых POST-запросов нет.

---

## Что нельзя сломать

| Маршрут | Статус |
|---------|--------|
| `/screener` | стабилен |
| `/screener/stocks` | стабилен |
| `/screener/futures` | стабилен |
| `/screener/strategies` | Strategy Scanner v0 demo-ready |
| `/screener/bitget` | Bitget Terminal v3 |
| `/screener/bitget/map` | Interactive Bitget Market Map |

---

## Dev commands

```bash
pnpm -C frontend dev:live
pnpm -C frontend build
```

**Bitget terminal:** `/screener/bitget`

**Bitget map:** `/screener/bitget/map`
