# Screener Terminal Audit — текущее ядро и карта внедрения

Технический и продуктовый аудит скринера ScreenerPRO на основе кода и доктрины `docs/INTRADAY_SCREENER_TERMINAL_VISION.md`.

**Дата:** 2026-07-06  
**Статус:** аудит только — UI и логика **не менялись**.

Связанные файлы: `PROJECT_CONTEXT.md`, `docs/MARKET_RADAR_FORMULAS.md`, `shared/src/contracts/market.ts`.

---

## 1. Current State

### Маршруты и страницы

| Маршрут | Компонент | Роль сегодня |
|---------|-----------|--------------|
| `/screener` | `ScreenerHomePage` → `MarketNowPage` | **Пульт «Лаборатория рынка»** — KPI, hard in-play таблица, топ оборота, импульсы, high/low, опасные, фьючерсы в фокусе |
| `/screener/stocks` | `StocksScreenerPage` | **Основной скринер акций** — index strip, leader strip (ликвидность / в игре / волатильность), `StocksRadarTable` |
| `/screener/futures` | `FuturesScreenerPage` | Фьючерсы — KPI, **пресеты** (`ScreenerPresetChips`), `InstrumentQuickInspector`, `ScreenerTable` |

**Важно:** `MarketCommandCenter` и `MarketRadar` **существуют в коде**, но **не подключены** к текущим prod-маршрутам `/screener` и `/screener/stocks`. Они используются в legacy `homepage-screener.tsx` и `/sandbox`.

### Два параллельных стека радара (фрагментация)

| Стек | Файлы | Где в UI |
|------|-------|----------|
| **Market Radar v4** | `market-radar-layers.ts`, `market-radar-selectors.ts`, `market-radar-config.ts`, `MarketRadar` | Legacy homepage, sandbox, частично `MarketNowPage` (`selectHardInPlayInstruments`) |
| **Stocks Radar** | `lib/screener/stocks-radar.ts`, `in-game-logic.ts`, `StocksLeaderStrip` | `/screener/stocks` |

Пороги и reason keys **частично дублируются** (`MARKET_RADAR_CONFIG` vs `RADAR_THRESHOLDS` / `IN_GAME_CONFIG`). Риск расхождения «В игре» на разных экранах.

### Таблицы

| Компонент | Использование | Виртуализация |
|-----------|---------------|---------------|
| `StocksRadarTable` | **Активный** `/screener/stocks` — 7 колонок, сортировка, highlight строки | Нет (`@tanstack/react-virtual` в зависимостях, **не подключён**) |
| `StocksScreenerTable` + `columns.tsx` | Legacy/alternate — расширенные колонки, hover-card, expanded row | Нет |
| `ScreenerTable` | `/screener/futures`, sandbox, legacy homepage | Нет — TanStack Table, `table-fixed`, min-width 840px |

### Источники данных

```
GET /api/screener?assetClass=stock|future|all[&date=YYYY-MM-DD]
  → moex-screener.getScreenerResponse()
  → MOEX ISS (TQBR + FORTS) · cache 20s · stale fallback до 30 мин
  → enrich: screener-math (percentiles, IN_PLAY tags)
  → intraday baseline loader (Vol x / Trades x, top-35)
  → Prisma daily bars (full-day baselines, optional)
  → fallback: demo rows · explicit dev fallback · off mode
```

Клиент: `useScreenerQuery` — refetch 45s (live), Zod `screenerApiResponseSchema`.

### Fallback и статус

- `status.source`: `moex` | `demo` | `fallback` | `off`
- `status.baselineStatus`: `ok` | `skipped` | `error`
- `status.degraded`, `staleCache`, `fallbackReason`, `marketStatus`
- UI: `DataQualityCompact`, `MarketStatusStrip`, `ScreenerDataSourceStrip`

### Что уже работает как «терминал»

- Live MOEX pipeline с честным fallback
- Intraday baseline (Vol x / Trades x) для части universe
- Market Radar формулы задокументированы (`docs/MARKET_RADAR_FORMULAS.md`)
- Короткий словарь сигналов (`trader-signal-labels.ts`)
- Фьючерсы: пресеты + боковой inspector
- `/screener`: компактный market overview (KPI + списки)

### Что ещё placeholder

- `SessionPulseCard` — фаза сессии по времени, бейдж **«Скоро»**, ссылка на `/lab/session-liquidity-map`
- Session Memory — **нет в коде**
- Voice/Notes — **нет в коде**

---

## 2. Existing Metrics

### Поля `MarketSnapshot` (каждая строка API)

| Метрика | Поле | В UI скринера |
|---------|------|---------------|
| Цена | `lastPrice` | Да — таблица, радары, пульт |
| Изменение % | `percentChange` | Да |
| Абс. изменение | `absoluteChange` | Редко (карточка тикера) |
| Объём (шт.) | `volume` | В API, почти не в UI скринера |
| Оборот ₽ | `turnover` | Да — ключевая |
| Сделки | `tradesCount` | Да |
| Open | `open` | В расчётах (structure), не колонка |
| High / Low | `high`, `low` | В расчётах position-in-range, near high/low |
| Prev close | `previousClose` | В расчётах range %, gap |
| Статус торгов | `tradingStatus` | Косвенно |
| Класс активности | `stockActivityClass` | В тегах / статусах |
| ОИ (фьючерсы) | `openInterest` | Колонка futures |
| Экспирация | `expiryDate` | Пресет «Дальние» |

### Поля `ScreenerMetricSet` (metrics)

| Метрика | Поле | В UI |
|---------|------|------|
| Диапазон дня % | `dayRangePct` | Да — «Диапазон» |
| Vol x (same-time) | `volumeRatioNow` | Да — «Оборот x» (columns) / vol в пульте |
| Trades x | `tradesRatioNow` | Да — в columns.tsx; в StocksRadarTable — нет отдельной колонки |
| Oборот vs avg день | `turnoverVsAverage` | Fallback для vol x |
| Range vs avg | `rangeVsAverage` | Tooltip / inspector |
| Trades vs avg | `tradesVsAverage` | Legacy full-day |
| Percentiles | `turnoverPercentile`, `tradesPercentile`, `rangePercentile` | Reason tags, in-play math |
| In-play score | `inPlayScore` | Сортировка, пресеты |
| IN_PLAY flag | `isInPlay`, `inPlayTags` | Бейдж «В игре» (`IN_PLAY` tag) |
| Reason label | `reasonLabel` | Колонка «Причина» (columns.tsx); StocksRadar — `tableReason` |
| Session progress | `sessionProgress` | Relative turnover |
| Baseline meta | `intradayBaselineStatus`, `intradayBaselineKind`, `baselineMode`, … | Tooltips, честные «—» |
| Activity ratio | `activityRatio`, `requiredActivityRatio` | Inspector / signals |
| Gap / rel vol | `gapPct`, `relativeVolatility20d` | **null** в pipeline |

### Производные в domain-слое (не в API, client/server)

| Метрика | Где | UI |
|---------|-----|-----|
| Position in day range | `stock-sparkline`, `market-radar-layers` | StocksRadarTable «Положение» |
| MarketRadar reason keys | `market-radar-layers` | MarketRadar rows, tooltips |
| Stock table status | `stock-screener-display` | Теги: Ликвид, Импульс, Давление… |
| Impulse events | `stocks-screener-signals` | Leader strip «Волатильность» |
| In-game scenario | `in-game-logic` | Leader strip «В игре» |
| Spread | — | **Нет в screener API** (есть в technical characteristics) |

### Benchmarks (`/api/screener` → `benchmarks[]`)

IMOEX / IMOEX2: `lastValue`, `percentChange`, `dayRangePct`, aggregate turnover/trades — `StocksIndexStrip`.

### Status / source / fallback

Полный блок `ScreenerDataStatus` + optional `diagnostics` — отображается в strip/chips, не в каждой строке.

---

## 3. Gaps

Относительно North Star «intraday decision terminal за 10–30 секунд»:

| Gap | Текущее состояние | Влияние |
|-----|-------------------|---------|
| **Почему тикер в игре** | `reasonLabel` / percentiles есть в API; на `/screener/stocks` — `tableReason` в модели, но **узкая таблица без колонки «Причина»**; пульт показывает vol x без reason code | Трейдер видит тикер, но не всегда **числовую причину** на поверхности |
| **Теги ситуации** | Частично: `getStockTableStatus`, impulse events, `MarketRadarReasonKey` — **три разных словаря**, не единый Situation Engine | Нет стабильного набора: импульс / пробой / high / low / объёмная аномалия / раскорреляция |
| **Session Memory** | Отсутствует | Нельзя сравнить «20/40/60 мин назад» |
| **Боковой inspector (акции)** | `StockRowInspector` **написан**, но **не подключён** к `StocksScreenerPage`; на фьючерсах — `InstrumentQuickInspector` работает | Клик по строке только highlight, без панели деталей |
| **Нормализация к своей норме** | Vol x / Trades x для top-35; остальные — rough/previous-day; два in-play пайплайна | Непоследовательные подписи между экранами |
| **Пресеты трейдера (акции)** | `STOCK_SCREENER_PRESETS` + `applyStockPreset` **готовы**, UI **только на futures** | Нет быстрых режимов «скальп / в игре / импульс» на главной таблице акций |
| **Визуальная иерархия сигналов** | Leader strip + highlight; glass/neon в lab-стиле; in-play — emerald/cyan/amber **без единой доктрины cyan-accent** | Сигналы есть, но иерархия «что смотреть первым» слабая |
| **Компактный Market Pulse** | `MarketNowPage` KPI — хорошая база; `SessionPulseCard` — placeholder; нет единого «живой/спит» + фаза сессии на `/screener/stocks` | Пульс размазан между маршрутами |
| **Фрагментация радара** | Два стека + legacy компоненты | Риск регрессий при итерациях |
| **Spread в скринере** | Не в ISS endpoint скринера | Условия сделки неполные на скринере (есть в материалах) |
| **Раскорреляция** | Нет в screener pipeline | Тег из доктрины недоступен |
| **Виртуализация** | Заявлена в PROJECT_CONTEXT, **не реализована** | Риск при росте колонок/строк (сейчас ~250 акций — терпимо) |

---

## 4. Data Feasibility

### A. Можно сделать сейчас на MOEX ISS + текущем API

| Фича | Обоснование |
|------|-------------|
| **Situation Engine v0** — теги и reason codes | Все поля есть: price, OHLC, turnover, trades, dayRangePct, volumeRatioNow, position-in-range, percentiles |
| **Reason codes в таблице** | `reasonLabel`, `getRadarRowAnalysis`, `stocks-screener-signals` — объединить в один слой |
| **Smart Presets (акции)** | `screener-presets.ts` уже реализует фильтры |
| **Instrument Inspector (акции)** | `StockRowInspector` + существующие formatters |
| **Market Pulse v1** | Агрегаты из `rows[]` + `benchmarks[]` + `session-phase.ts` (время MSK) |
| **Унификация «В игре»** | Свести `selectHardInPlayInstruments` и `buildStocksRadarModel` к одному selector |
| **Честный spread-proxy** | Опционально: второй ISS-запрос bid/offer **только для top-N** (как в materials) — без платного API |

### B. Нужна локальная история / ingest (Prisma)

| Фича | Обоснование |
|------|-------------|
| **Надёжный Vol x / Trades x для всего universe** | `intraday-baseline-loader` + 10m свечи MOEX; сейчас top-35 |
| **Session Memory (snapshots)** | Периодический snapshot в SQLite/Postgres или in-memory ring buffer на сервере |
| **Range vs 20d average** | `relativeVolatility20d`, `rangeVsAverage` — частично есть в Prisma baselines |
| **Sparkline «5д» стабильно** | `/api/instruments/[ticker]/history` после ingest |
| **Hysteresis IN_PLAY по сессии** | TODO в `screener-math.ts` — нужен session state store |
| **Исторический режим радара** | `dataMode: historical` — часть слоёв отключена |

### C. Платные данные / новости / стакан / orderflow

| Фича | Обоснование |
|------|-------------|
| **Раскорреляция с сектором/индексом в реальном времени** | Нужны потоковые факторы или тяжёлые corr-расчёты (есть прототип в `/lab/correlation-lab`, дневной) |
| **ГО / margin footprint** | Явно null в technical characteristics |
| **Orderflow / DOM / tape** | Только симулятор `/lab/orderflow-simulator` |
| **Новостной контекст** | Smart-Lab calendar — эксперимент в preparation lab |
| **Voice / Notes pipeline** | Внешний ASR + storage + auth |

---

## 5. Proposed v1 Implementation Plan

Пять итераций **без big-bang**: каждая добавляет value, не ломая маршруты и API-контракт.

### Iteration 1 — Situation Engine v0 (теги + reason codes)

**Цель:** единый server-agnostic модуль, который для каждой `ScreenerRow` возвращает `{ situationTags[], primaryReason, reasonCodes[], numericEvidence[] }`.

**Scope:**
- Объединить логику из `market-radar-layers` (structure flags), `stocks-screener-signals` (impulse), `stock-screener-display` (status)
- Маппинг на словарь доктрины: импульс, пробой, high/low, объёмная аномалия, позднее движение
- Пока **без UI-перестройки** — поле в normalized row + колонка/chip в таблице

**Не делать:** раскорреляцию (нет данных).

---

### Iteration 2 — Smart Presets для таблицы акций

**Цель:** `ScreenerPresetChips` на `/screener/stocks` как на futures.

**Scope:**
- Подключить `STOCK_SCREENER_PRESETS` / `applyStockPreset`
- URL query `?preset=` для shareable state
- Счётчики строк по пресету
- Default view без пресета = текущее поведение

---

### Iteration 3 — Instrument Inspector (акции)

**Цель:** клик по строке → боковая панель (как futures), не только highlight.

**Scope:**
- Подключить `StockRowInspector` или унифицировать с `InstrumentQuickInspector`
- Показать: situation tags, Vol x / Trades x, spread **если добавим** или «н/д», статус данных
- Desktop: фиксированная правая колонка; mobile: drawer

---

### Iteration 4 — Market Pulse / Session Pulse

**Цель:** один компактный блок «состояние рынка» на `/screener` и дубль-ссылка на `/screener/stocks`.

**Scope:**
- Агрегат из rows: total turnover, in-play count, breadth (rising/falling), index change
- Фаза сессии из `session-phase.ts` (открытие / середина / закрытие)
- Заменить/усилить placeholder `SessionPulseCard` **или** вынести pulse в `MarketNowPage` header
- Единый компонент `MarketPulseStrip` — 2–3 числа на поверхности (минимализм цифр)

---

### Iteration 5 — Session Memory / snapshots

**Цель:** «что изменилось за 20/40/60 мин».

**Scope v1 (минимальный):**
- Server: ring buffer snapshots каждые N минут в памяти (dev) или Prisma table `SessionSnapshot` (prod path)
- Client: diff — новые in-play, рост vol x, смена situation tag
- API: `GET /api/screener/session-memory?windows=20,40,60` или расширение status

**Scope v2:** push-уведомления / voice — вне v1.

---

## 6. Files To Touch

### Iteration 1 — Situation Engine v0

| Действие | Файлы |
|----------|-------|
| **Создать** | `frontend/lib/domain/situation-engine.ts` — типы, `evaluateSituation(row, ctx)` |
| **Создать** | `frontend/lib/domain/situation-labels.ts` — RU labels, mapping к `MarketRadarReasonKey` |
| **Изменить** | `frontend/lib/screener/stocks-radar.ts` — добавить situation в `NormalizedStockRow` |
| **Изменить** | `frontend/lib/domain/market-radar-layers.ts` — делегировать tags или re-export |
| **Изменить** | `frontend/components/screener/stocks/stock-tape-row.tsx` — показ primary tag |
| **Изменить** | `frontend/components/screener/stocks/stocks-radar-table.tsx` — колонка «Ситуация» или chip |
| **Тесты** | `frontend/scripts/verify-market-radar-layers.ts` или новый `verify-situation-engine.ts` |
| **Доки** | `docs/MARKET_RADAR_FORMULAS.md` — ссылка на situation codes |

### Iteration 2 — Smart Presets

| Действие | Файлы |
|----------|-------|
| **Изменить** | `frontend/components/screener/stocks-screener-page.tsx` — preset state, chips |
| **Использовать** | `frontend/lib/domain/screener-presets.ts` (уже есть) |
| **Использовать** | `frontend/components/screener/screener-preset-chips.tsx` |
| **Изменить** | `frontend/lib/screener/stocks-radar.ts` — optional preset filter hook |

### Iteration 3 — Instrument Inspector

| Действие | Файлы |
|----------|-------|
| **Изменить** | `frontend/components/screener/stocks-screener-page.tsx` — layout grid + inspector slot |
| **Изменить** | `frontend/components/screener/stocks/stock-row-inspector.tsx` — situation + baseline block |
| **Или унифицировать** | `frontend/components/screener/instrument-quick-inspector.tsx`, `frontend/lib/domain/instrument-inspector-copy.ts` |
| **Создать (опц.)** | `frontend/components/screener/screener-inspector-shell.tsx` — общая оболочка stocks/futures |

### Iteration 4 — Market Pulse

| Действие | Файлы |
|----------|-------|
| **Создать** | `frontend/lib/domain/market-pulse.ts` — агрегаты из `ScreenerRow[]` |
| **Создать** | `frontend/components/screener/market-pulse-strip.tsx` |
| **Изменить** | `frontend/components/screener/market-now/market-now-page.tsx` |
| **Изменить** | `frontend/components/screener/stocks-screener-page.tsx` — compact pulse в header |
| **Изменить** | `frontend/components/screener/dashboard/session-pulse-card.tsx` — убрать «Скоро» или связать с pulse |
| **Использовать** | `frontend/lib/domain/session-phase.ts` |

### Iteration 5 — Session Memory

| Действие | Файлы |
|----------|-------|
| **Создать** | `frontend/lib/server/services/session-snapshot-store.ts` |
| **Создать** | `frontend/app/api/screener/session-memory/route.ts` |
| **Изменить** | `frontend/lib/server/services/moex-screener.ts` — hook после successful fetch |
| **Создать** | `frontend/lib/hooks/use-session-memory.ts` |
| **Создать** | `frontend/components/screener/session-memory-panel.tsx` |
| **Изменить** | `shared/src/contracts/market.ts` — optional `SessionMemorySnapshot` schema |
| **Опц. Prisma** | `frontend/prisma/schema.prisma` — модель `ScreenerSessionSnapshot` |

### Сквозная техдолг-задача (между итерациями 1–2)

| Действие | Файлы |
|----------|-------|
| Свести selectors | `market-radar-selectors.ts` ↔ `stocks-radar.ts` / `in-game-logic.ts` |
| Deprecate legacy | `homepage-screener.tsx`, `MarketCommandCenter` — документировать или перенаправить |

---

## 7. Risk Control

**Нельзя сломать:**

| Область | Контроль |
|---------|----------|
| **Маршруты** | `/screener`, `/screener/stocks`, `/screener/futures` — те же URL; только additive UI |
| **MOEX live/fallback** | Не менять семантику `getScreenerResponse`, `fallbackReason`, `buildUnavailableScreenerResponse` |
| **Build** | `pnpm -C frontend build` после каждой итерации |
| **Таблица** | Не убирать сортировку; осторожно с row count; виртуализацию добавлять отдельным PR |
| **Shared contracts** | Новые поля — optional в Zod; не удалять существующие |
| **Адаптивность** | `StocksRadarTable` min-width 880px; inspector — не ломать mobile (drawer); `hideBelow: md` для Vol x |
| **Производительность** | Situation engine — pure functions, memo в `useMemo`; snapshot store — bounded buffer |
| **Честность данных** | `DataStatusBadge` при fallback; не показывать spread без данных |
| **Формулы** | Пороги — `market-radar-config.ts`; после правок — `verify-market-radar-layers.ts` |

---

## 8. Definition of Done

### Iteration 1 — Situation Engine v0

- [ ] `evaluateSituation()` покрывает ≥5 типов из доктрины (импульс, пробой, high, low, объёмная аномалия)
- [ ] У каждого тега есть `numericEvidence` (например `vol 2.4x`, `range 3.1%`)
- [ ] `/screener/stocks` показывает primary situation на строке (chip или колонка)
- [ ] Unit/script verify проходит локально
- [ ] Build green
- [ ] Нет расхождения HARD in-play между пультом и таблицей (manual check 3 тикера)

### Iteration 2 — Smart Presets

- [ ] Chips видны на `/screener/stocks`, ≥4 пресета с счётчиками
- [ ] `?preset=` сохраняет состояние при refresh
- [ ] Сброс пресета возвращает текущий default view
- [ ] Build green
- [ ] Пресет «В игре» совпадает с leader strip (manual)

### Iteration 3 — Instrument Inspector

- [ ] Клик по строке открывает inspector с situation + Vol x + оборот + сделки + статус
- [ ] Повторный клик / Esc закрывает
- [ ] Futures inspector не регрессирует
- [ ] Build green
- [ ] Mobile: inspector доступен (drawer или bottom sheet)

### Iteration 4 — Market Pulse

- [ ] Единый `MarketPulseStrip` на `/screener` с фазой сессии MSK
- [ ] Compact pulse или ссылка на `/screener/stocks`
- [ ] 2–3 KPI на поверхности (минимализм цифр)
- [ ] При `source=fallback` pulse показывает degraded status
- [ ] Build green

### Iteration 5 — Session Memory

- [ ] Snapshots пишутся в live-режиме (минимум in-memory)
- [ ] UI показывает diff vs 20 мин (хотя бы: новые in-play, top vol x delta)
- [ ] API documented в `docs/SCREENER_API_CONTRACT.md`
- [ ] Build green
- [ ] Нет утечки памяти (bounded store)

---

## Рекомендуемый следующий шаг

**Начать с Iteration 1 (Situation Engine v0)** — максимальный продуктовый эффект при минимальном UI-diff и без новых API endpoints. Параллельно завести задачу на **сведение двух radar-стеков** (техдолг перед Iteration 2).

---

*При изменении архитектуры скринера обновлять этот файл и `AI_SESSION_STATE.md`.*
