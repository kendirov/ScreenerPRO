# TQS MOEX REFERENCE VERTICAL — TRADER-FIRST CANON

Status: ACTIVE PRIORITY — 2026-09-18

## 1. Why MOEX is the reference vertical

The current TQS engine can collect and compute substantially more than the owner-facing product explains. That is a product failure: a trader must not need to decode `jobs / metric points / RUN / failed / Parquet` to understand what the machine knows.

Until this contract is satisfied, MOEX is the primary reference vertical. Crypto remains supported, but product decisions are first proven on a market Artem understands deeply.

North Star for one instrument:

`SBER / BR / Si → price timeline + volume/turnover + OI/FUTOI + linked stock/future/index + public participant evidence + news/events + anomalies/episodes + comparable historical cases + research/strategy results + explicit coverage/gaps`.

## 2. Product navigation

Owner-facing navigation should converge to:
1. **Пульт** — what market + machine are doing now, all progress in Russian.
2. **Мосбиржа** — Russian market cockpit and coverage.
3. **Инструмент** — one symbol, all time-aligned layers.
4. **Участники** — public/aggregate participant evidence with evidence level.
5. **Исследования** — questions, runs, results, rejected hypotheses.
6. **Данные и покрытие** — what exists, coverage %, gaps, provider/quality.
7. **Система** — version/runtime/diagnostics; technical layer only.

Technical English may exist in logs/schema IDs, not as the primary trader language.

## 3. MOEX data layers

### A. MOEX ISS — base market universe
All currently available MOEX instruments remain searchable. Reference vertical prioritizes:
- shares;
- FORTS futures;
- indices;
- FX;
- linked bonds only when relevant.

For shares/futures persist and expose:
- last/bid/ask/spread;
- volume/turnover/trades;
- trading/session state;
- candles/history;
- current OI where source exposes it;
- linked family/economic instrument.

### B. MOEX AlgoPack / FUTOI — aggregate participant layer
FUTOI is aggregate exchange participant evidence, **not individual accounts**.
Target fields:
- physical-person long / short;
- legal-entity long / short;
- number of long/short participants when available;
- net positions and deltas;
- divergence/acceleration/extremes;
- source time, delay/licence/entitlement.

Never merge delayed/free and licensed/realtime data silently. Realtime/licensed use remains a separate adapter/entitlement state.

### C. LCHI 2026 public participants — individual public evidence
Create a dedicated read-only source class, separate from MOEX aggregate FUTOI.

Public profile pages can expose, depending on participant:
- participant ID/nickname/league/rank;
- start/current amount and return;
- current public positions by market;
- signed quantity (including visible shorts);
- average price / displayed P&L;
- number of deals/orders;
- downloadable/public trade history when available.

Target automatic flow:
`public rating discovery → participant catalog → rate-limited profile snapshots → position diffs/trade-history ingestion → instrument timeline markers → participant/cohort research`.

Store source URL, fetch timestamp, public/contest status, parser version and raw-to-canonical mapping.

This is public-observation research, not inference of motive/stop/intelligence. Respect access terms, robots/site limits and redistribution/licensing boundaries. Do not create a public mirror of participant data without permission.

### D. T-Bank Pulse — weaker public account evidence
Pulse is a distinct evidence type:
- public profile;
- approximate portfolio-size bucket;
- composition where public;
- last-month trades / trade prices when public;
- posts/comments as event/context.

The public Pulse surface hides operation quantity for other users. Therefore TQS must **not invent exact notional** for Pulse trades. Pulse markers are `observed buy/sell at price/time; size unknown` unless a lawful source explicitly provides more.

### E. News / corporate events
Russian-market event layer should add:
- MOEX exchange notices;
- issuer disclosures/corporate actions;
- regulator/CBR events;
- macro calendar;
- selected public news/RSS;
- selected public Telegram sources only when explicitly connected/allowed.

Event timing and market reaction are stored separately; timing coincidence is not causality.

## 4. Instrument Workspace acceptance

Opening SBER/BR/Si must eventually show one synchronized research workspace:

1. Candles + volume/turnover.
2. OI and OI change/acceleration where applicable.
3. FUTOI physical/legal long/short and participant counts for futures.
4. Linked underlying/future/index/sector context.
5. LCHI position/trade markers:
   - account nickname/id;
   - buy/sell or position change;
   - quantity/notional only when actually public;
   - source/evidence badge.
6. Pulse markers with explicit `size unknown` when quantity is hidden.
7. News/event markers.
8. Anomaly/episode markers.
9. Comparable historical episodes and forward outcomes 5m/15m/1h/4h/day.
10. Research/Strategy results with sample/control/OOS status.
11. Data coverage drawer: each layer = available / partial / missing / licensed / stale.

Every plotted marker must be clickable and show its provenance.

## 5. MOEX cockpit

The dedicated MOEX view must answer in <20 seconds:

### Market now
- shares/futures/indices/FX observed now;
- sources freshness;
- active anomalies and episodes;
- important linked divergences.

### Data build progress
For each dataset:
- target universe;
- completed instruments;
- queued/running/failed;
- history from/to;
- rows/points stored;
- last success;
- next automatic action.

Required rows at minimum:
- MOEX live universe;
- share candle history;
- futures candle history;
- FUTOI;
- LCHI catalog/profiles/trades;
- Pulse public profiles/trades;
- news/events.

### Research now
Show literal Russian:
`что проверяет → на каких данных → прогресс → sample → result/status → what next`.

## 6. Research program

The machine should continuously create reproducible studies, not generic “AI insights”.

Core MOEX cells:
- turnover/volume anomaly × future return;
- price impulse × OI change;
- compression × OI accumulation;
- price × physical/legal net divergence;
- FUTOI extreme/acceleration × forward return;
- stock × linked future divergence;
- stock × sector/IMOEX relative strength;
- LCHI cohort position change × future return/volatility;
- top LCHI participant entry/exit × market regime;
- Pulse public trade/post timing × market reaction (size unknown);
- opening/gap/auction behavior;
- roll/expiry behavior;
- news event × price/volume/OI/participant reaction;
- round/buffer levels;
- liquidity/spread shock.

All results require sample counts, counterexamples, regime splits, chronological OOS/holdout, realistic costs where trading interpretation is attempted, and durable negative-result memory.

## 7. Coverage policy

“Все инструменты” means:
- complete live/searchable MOEX universe where source permits;
- full-history target for all relevant shares and FORTS instruments in gradual Tier C backfill;
- deeper/higher-frequency Tier A for liquid/In-Play/watchlist/research instruments;
- no fake 100% coverage if a provider does not expose history.

The UI must distinguish:
- universe coverage;
- historical candle coverage;
- derivative metric coverage;
- participant/account coverage;
- event/news coverage.

## 8. Evidence levels

Use visible badges:
- **БИРЖА** — MOEX primary exchange data.
- **АГРЕГАТ** — FUTOI aggregate physical/legal participants.
- **ПУБЛИЧНЫЙ СЧЁТ** — LCHI public individual participant.
- **ПУБЛИЧНЫЙ ПРОФИЛЬ** — Pulse public profile; hidden quantity stays unknown.
- **НОВОСТЬ/СОБЫТИЕ** — event source.
- **РАСЧЁТ TQS** — deterministic derived feature.
- **ГИПОТЕЗА** — not validated.
- **ИССЛЕДОВАНИЕ** — statistical result with sample/method.
- **СТРАТЕГИЯ** — only after explicit validation gates.

## 9. Owner language contract

Primary UI must be Russian:
- Research queue → Очередь исследований
- Findings → Выводы исследований
- Failed → Ошибки
- Market cycles → Циклы обновления рынка
- Metric points → Точки метрик OI/FUTOI/ставок
- Data Lake → Хранилище истории (technical path secondary)
- READY/RUN/WAIT → Готов / Работает / Ожидает
- provider snapshot → снимок источника

Technical IDs remain available in drill-down/diagnostics.

## 10. Definition of done

MOEX reference vertical is not done when endpoints/files exist. It is done when Artem can:
1. open **Мосбиржа** and see coverage/work/progress;
2. search SBER/BR/Si;
3. click one instrument;
4. visually inspect all available time-aligned layers;
5. click public participant/event markers and see evidence;
6. see exactly which layers are missing and why;
7. see what TQS is currently downloading/researching next;
8. copy one diagnostic/AI package without terminal work.

This reference vertical becomes the template for crypto and future markets.
