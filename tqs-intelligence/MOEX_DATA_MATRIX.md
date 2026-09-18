# TQS MOEX DATA MATRIX

Status: active design contract for MOEX Market Lab.

## Product principle

MOEX is not a flat table of thousands of instruments. The product must maintain the full searchable universe, but the main trader view promotes only instruments/families/sectors/events that are unusual, liquid and relevant now.

Every promoted item must answer `ПОЧЕМУ ПОКАЗАНО` with concrete evidence.

## Canonical linked object

A Russian-market instrument should be connected to related objects where possible:

`stock <-> stock future(s) <-> sector index <-> IMOEX/RTS <-> FX/commodity context <-> news/events <-> anomaly episodes <-> research/strategy results`.

For futures also maintain family relationships:

`underlying/reference <-> current contract <-> next contract <-> perpetual where applicable <-> expiry/roll metadata`.

## Basic live/free MOEX layer

### Common
- last price / bid / ask;
- source timestamp / fetched timestamp;
- session/trading status;
- board/market/engine;
- change from previous close where semantically valid;
- intraday high/low;
- volume;
- turnover/value;
- number of trades when exposed by the source;
- spread in bps;
- day range and position in range;
- source quality: LIVE / DELAYED / CLOSED / STALE / ERROR / UNKNOWN.

### Stocks
- turnover and relative turnover;
- volume and relative volume;
- number of trades and relative trades;
- 1m/5m/10m/15m/1h/day returns where source coverage allows;
- ATR / realized volatility;
- range expansion/compression;
- gap/open behavior;
- VWAP distance;
- acceleration/deceleration;
- relative strength vs IMOEX and sector;
- linked futures state;
- news/corporate-event flag;
- active anomaly episode;
- historical anomaly analogues;
- technicality/repeatability profile from validated research.

### Futures
- current price / settlement/reference where available;
- turnover / volume / trades;
- OI;
- delta OI and OI acceleration from successive observations;
- current/next family mapping;
- DTE / expiry timestamp;
- roll share / roll acceleration;
- basis vs compatible underlying/reference;
- spread/liquidity;
- intraday volatility/range;
- underlying divergence;
- clearing/session state;
- active anomaly/research flags.

### FX
- CNY/RUB and other live pairs;
- linked Si/CNY/other futures families;
- spot/futures divergence and basis where timestamps are compatible;
- intraday/rolling volatility;
- turnover/trade activity;
- cross-currency context.

### Indices
- core anchors: IMOEX/IMOEX2, RTSI, sector indices, RGBI and relevant rate/repo indices;
- own-volatility normalized move;
- sector breadth/context;
- linked futures;
- avoid treating methodological index recalculations as ordinary tradable price anomalies.

### Bonds
- keep complete searchable universe but do not pollute the primary equity/futures screen;
- separate OFZ/corporate/high-yield views;
- price/yield/duration/coupon/maturity fields when stable source data is available;
- turnover/liquidity and abnormal moves;
- issuer linkage to stocks/news where applicable.

## Premium/realtime MOEX participant layer

When licensed credentials become available, adapters must add fields without redesigning the rest of TQS:

- total OI;
- individual long;
- individual short;
- legal-entity long;
- legal-entity short;
- number of individual/legal participants when available;
- intraday position deltas;
- 5m or best-licensed update cadence;
- provider timestamp and entitlement metadata.

Derived features:

- individual net = individual_long - individual_short;
- legal net = legal_long - legal_short;
- individual/legal divergence;
- position acceleration;
- crowding/extreme percentiles;
- price x OI divergence;
- price x individual-net divergence;
- price x legal-net divergence;
- OI x participant divergence;
- participant change before/after anomaly;
- participant reaction to news/event/expiry/roll.

Premium data must never silently replace free/delayed data. Store provider, entitlement, timestamp, delay/quality and mapping explicitly.

## Selection / ranking

The main MOEX screen should not default-sort the entire 5k+ universe by turnover. Maintain several explainable lanes:

1. `АКЦИИ В ИГРЕ`
2. `ФЬЮЧЕРСЫ В ИГРЕ`
3. `СЕКТОРА В ИГРЕ`
4. `OI / PARTICIPANTS`
5. `ROLL / EXPIRY`
6. `НОВОСТНАЯ РЕАКЦИЯ`
7. `ТЕХНИЧНЫЕ / RESEARCH CONFIRMED`
8. `НОВЫЕ / НЕОБЫЧНЫЕ`

Conceptual priority:

`priority = abnormality * liquidity/relevance * freshness * evidence_quality`

Do not expose only a magic score. Show 2-4 reasons, for example:

- `оборот 4.1x нормы к этому времени`;
- `движение 3.2 sigma`;
- `OI +18% за 40 минут при цене +0.4%`;
- `физлица резко нарастили short, юрлица long`;
- `акция +5.0%, связанный future +6.6%, сектор +0.4%`;
- `новость 12:31, аномальный volume начался 12:34`;
- `похожих случаев 43, median abs move next 1h = 2.1%`.

## Instrument drill-down

Opening an instrument should show one integrated research page:

- modern candlestick chart;
- volume/turnover;
- OI;
- participant lines when licensed;
- anomaly windows and trigger markers;
- news/event markers;
- round/buffer zones and other strategy overlays;
- linked stock/future/index/sector context;
- historical comparable episodes;
- forward outcomes 5m/15m/1h/4h/day;
- existing Strategy Machine results;
- buttons: `Добавить идею`, `Проверить гипотезу`, `Скачать историю`, `Запустить стратегию`, `Зафиксировать кейс`.

## Automatic studies

The machine should continuously accumulate reusable research cells such as:

- high turnover + low price movement;
- high OI delta + compression;
- price impulse without OI confirmation;
- participant divergence;
- stock vs future divergence;
- stock vs sector/index relative strength;
- roll/expiry anomalies;
- abnormal opening/gap/auction behavior;
- news reaction speed and persistence;
- round/buffer-zone interactions;
- volatility compression -> expansion;
- repeated intraday levels/zones;
- liquidity/spread shocks.

Any promising relationship remains a hypothesis until control/OOS/walk-forward/cost checks pass.

## UI rule

The full universe remains accessible through search/filter/export, but the primary screen must be sparse and decision-oriented. A quiet market is allowed to look quiet.


## Public participant sources — evidence separation (2026-09-18)

### LCHI 2026 / Финуслуги
Treat public LCHI participant pages as **individual public account evidence**, separate from exchange aggregate FUTOI. Public pages may expose signed positions, quantity, average price/P&L and trade/order counts; public trade downloads may provide deeper history. The intended TQS adapter is automatic discovery + rate-limited snapshots/diffs, not a manual address form.

### T-Bank Pulse
Treat Pulse as **public profile/trade evidence with hidden size**. Public profile composition and last-month trade history can be useful for timing/context, but operation quantity is hidden to other users. Do not estimate exact notional from Pulse unless another lawful source supports it.

### Evidence UI
Every participant row/marker must carry `source_type`, source/profile URL or stable source ID, observed timestamp, parser/version and quality/visibility. FUTOI aggregate, LCHI account and Pulse profile must never be presented as one homogeneous “smart money” dataset.
