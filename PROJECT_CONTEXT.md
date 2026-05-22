# PROJECT_CONTEXT — ScreenerPRO

Документ для передачи контекста другому AI-ассистенту. Составлен по состоянию репозитория и сессии настройки окружения (май 2026). Не выдумывать то, что помечено «нужно проверить».

---

## 1. Что это за проект и какую задачу решает

**ScreenerPRO** (в коде пакет `super-screener`, бренд в UI — `SCREENERPRO`) — веб-платформа для трейдеров и аналитиков **MOEX** (акции TQBR + фьючерсы FORTS).

Задачи продукта:

- **Скринер** — оперативная лента инструментов с метриками активности (in-play, оборот, диапазон, статус торгов).
- **Материалы** — прикладные «рабочие столы»: технические характеристики, карта акций по секторам/капитализации/индексам, карта фьючерсов по базовым активам.
- **Академия** — редакционный контент (сейчас в основном mock + Motion-сцены).
- Заложен **premium/auth** слой (mock), Supabase и биллинг — **не подключены**.

Ориентация: **интрадей**, сравнение инструментов по ликвидности, спреду, обороту и производным скорингам.

---

## 2. Текущий стек

| Слой | Технология |
|------|------------|
| **Monorepo** | `pnpm` workspace (`pnpm-workspace.yaml`): `frontend`, `shared` |
| **Framework** | Next.js **16.2.1** (App Router, Turbopack в dev) |
| **UI** | React **19.2.4**, TypeScript strict |
| **Routing** | Route groups: `app/(public)`, `app/(app)`; API в `app/api/*` |
| **Styling** | Tailwind CSS **v4** (`app/globals.css`), shadcn-style primitives (`components/ui/*`, `components.json`) |
| **State / data fetching (client)** | **TanStack Query v5** (`@tanstack/react-query`) — `app/providers.tsx`, хуки `lib/hooks/*` |
| **Tables** | **TanStack Table v8** + **TanStack Virtual v3** (скринер) |
| **Charts** | `lightweight-charts` (зависимость есть; placeholder в `components/charts/price-chart-placeholder.tsx`) |
| **Animation** | `motion` (академия) |
| **Validation** | **Zod v4** — контракты в `shared/src/contracts/market.ts`, `lib/materials/contracts.ts` |
| **ORM / DB** | **Prisma 6** + **SQLite** (`frontend/prisma/schema.prisma`, `DATABASE_URL=file:./prisma/dev.db`) |
| **External market data** | **MOEX ISS** REST JSON |
| **Auth (prepared)** | `@supabase/supabase-js` — `lib/supabase/client.ts` (бросает ошибку без env) |
| **Package manager** | `pnpm@10.32.1` (поле `packageManager` в `frontend/package.json`) |

**Deployment:** в репозитории **нет** `vercel.json`, CI workflow или README с инструкцией деплоя. В `.gitignore` есть `.vercel` — признак возможного деплоя на Vercel, но конфигурация в коде **не зафиксирована** (см. §12).

---

## 3. Главные страницы и маршруты

### Публичная группа `app/(public)` — layout без sidebar

| Маршрут | Файл | Назначение |
|---------|------|------------|
| `/` | `app/(public)/page.tsx` | Редирект на `/screener` |
| `/login` | `app/(public)/login/page.tsx` | Страница входа (UI, без реальной auth) |
| `/pricing` | `app/(public)/pricing/page.tsx` | Тарифы + `EntitlementBoundary` (mock flags) |

### Продуктовая группа `app/(app)` — `AppSidebar` + `TopBar`

| Маршрут | Файл | Назначение |
|---------|------|------------|
| `/screener` | `app/(app)/screener/page.tsx` → `ScreenerHomePage` | Обзор: топ in-play, фьючерсы, волатильность |
| `/screener/stocks` | `app/(app)/screener/stocks/page.tsx` | Скринер акций |
| `/screener/futures` | `app/(app)/screener/futures/page.tsx` | Скринер фьючерсов |
| `/stocks/[ticker]` | `app/(app)/stocks/[ticker]/page.tsx` | Карточка акции |
| `/futures/[ticker]` | `app/(app)/futures/[ticker]/page.tsx` | Карточка фьючерса |
| `/academy` | `app/(app)/academy/page.tsx` | Каталог академии (mock) |
| `/academy/[slug]` | `app/(app)/academy/[slug]/page.tsx` | Статья (mock `academyEntries`) |
| `/materials` | `app/(app)/materials/page.tsx` | Лендинг материалов |
| `/materials/screener` | `app/(app)/materials/screener/page.tsx` | Документация логики скринера |
| `/materials/technical-characteristics` | `app/(app)/materials/technical-characteristics/page.tsx` | Тех. характеристики |
| `/materials/stocks` | `app/(app)/materials/stocks/page.tsx` | Карта акций |
| `/materials/futures` | `app/(app)/materials/futures/page.tsx` | Карта фьючерсов |
| `/sandbox` | `app/(app)/sandbox/page.tsx` | Диагностика скринера |
| `/lab/market-map` | `app/(app)/lab/market-map/page.tsx` | **Черновики (LAB):** экспериментальная карта акций MOEX; shell `LabPageShell`, режимы Пузырьки / Координаты / Сигналы; данные из `/api/screener?assetClass=stock` |
| `/lab/currency-correlation` | `app/(app)/lab/currency-correlation/page.tsx` | **Черновики (LAB):** **Валютная связка** — Si / CNY / ED; MOEX ISS: `…/intraday`, `…/history`, `…/weeks` (календарные недели, якорь week-open); графики: Ноги, Расхождение, Z-score, **Недели**, дневные режимы; lifecycle возврат/невозврат + недельный контекст |
| `/lab/orderflow-simulator` | `app/(app)/lab/orderflow-simulator/page.tsx` | **Черновики (LAB):** **Привод-симулятор** — учебный терминал: график + узкий DOM (объём слева, цена справа) + круги сделок у стакана + footprint; виды **Привод / Стакан крупно (дефолт) / Учебный / Мультиокно**; **симуляция, не MOEX** — `docs/ORDERFLOW_SIMULATOR.md` |
| `/app/watchlist` | `app/(app)/app/watchlist/page.tsx` | Watchlist (скрыт в nav) |
| `/app/settings` | `app/(app)/app/settings/page.tsx` | Настройки (скрыт в nav) |

### API Routes

| Endpoint | Метод | Handler / сервис |
|----------|-------|------------------|
| `/api/screener?assetClass=all\|stock\|future` | GET | `moex-screener.getScreenerResponse` |
| `/api/materials/technical-characteristics?assetClass=&liquidity=` | GET | `materials-technical-characteristics.getTechnicalCharacteristics` |
| `/api/instruments/[ticker]` | GET | `screener-query.getInstrumentDetail` (Prisma) |
| `/api/instruments/[ticker]/history` | GET | `screener-query.getInstrumentHistory` (Prisma) |
| `/api/instruments/[ticker]/metrics` | GET | `screener-query.getInstrumentDetail` |
| `/api/admin/ingest/moex` | POST | `moex-ingest` (sync universe, snapshots, bars) |
| `/api/dev/diagnostics` | GET | `moex-screener.getScreenerDiagnostics` |
| `/api/lab/currency-correlation/history?tickers=&days=&interval=` | GET | `moex-futures-history` — дневные бары валютных фьючерсов для LAB-графика |
| `/api/lab/currency-correlation/intraday?interval=&days=` | GET | `currency-correlation-intraday` — интрадей-свечи FORTS (fallback интервала 5→10→60→24) |
| `/api/lab/currency-correlation/weeks?pair=&interval=&weeks=&anchor=` | GET | `currency-correlation-weeks` — недельные ряды спреда (текущая + прошлые недели, max 8) |

Скрытые пункты sidebar (config `visibility: "hidden"`): `/pro`, `/news`, `/events`, `/app/watchlist`, `/app/settings` — см. `lib/constants/navigation.ts`.

**Зона `/lab` (Черновики):** префикс маршрутов для экспериментов — отдельный тихий блок внизу `AppSidebar` (заголовок «Черновики», бейдж `LAB`, `labNavConfig` в `navigation.ts`). Общий UI: `lab-page-shell.tsx` + `lab-ui.tsx` (единые pills источника, loading/error/empty, лимит **60** инструментов на карте). Не влияет на основной `sidebarNav`. `/lab/market-map`: `useScreenerQuery("stock")` → MOEX ISS; **Пузырьки** — `GravityMarketMap` (d3-force); **Координаты** — `AxisMarketMap` (зоны, лидеры); **Сигналы** — placeholder. `/lab/currency-correlation` (**Валютная связка**): порядок UI — контракты → управление → карта расхождений → график (~74vh) → состояние пары → журнал → «Как читать»; якорь спреда (`currency-spread-anchor`, дефолт week-open); домен: `spread-lifecycle`, `spread-lifecycle-weekly`, `spread-trajectory`, `currency-correlation-weeks-compare`, `currency-correlation-divergence-map`. `/lab/orderflow-simulator` (**Привод-симулятор**, полировка DOM 2026-05): дефолт **Стакан крупно** (`domfocus`); **Привод** — график + `DomTapeStack` (круги слева от стакана, без пустой средней колонки) + footprint; шкала баров 20K, строки 16px, лоты 300–25K в формате `20K`; виды `educational | terminal | domfocus | multiwindow`; 7 учебных сценариев стакана; `docs/ORDERFLOW_SIMULATOR.md`. Данные **синтетические**, не MOEX.

---

## 4. Главные компоненты и за что отвечают

### Shell

| Компонент | Файл | Роль |
|-----------|------|------|
| `AppSidebar` | `components/shell/app-sidebar.tsx` | Навигация, expand/collapse, `localStorage` ключ `screenerpro.sidebar.pinned` |
| `TopBar` | `components/shell/top-bar.tsx` | Верхняя панель приложения |

### Черновики (LAB)

| Компонент | Файл | Роль |
|-----------|------|------|
| `LabPageShell` | `components/lab/lab-page-shell.tsx` | Заголовок, описание, pills источника/статуса, слот переключателей режимов |
| `lab-ui` | `components/lab/lab-ui.tsx` | `LabLoadingState`, `LabErrorState`, `LabEmptyState`, `LabSectionHeading`, `buildLabSourcePills` |
| `LabModePlaceholder` | `components/lab/lab-page-shell.tsx` | Placeholder для режимов в разработке |
| `MarketMapPage` | `components/lab/market-map-page.tsx` | `/lab/market-map` — переключатели Пузырьки / Координаты / Сигналы |
| `GravityMarketMap` | `components/lab/market-map/gravity-market-map.tsx` | Органическая карта пузырей (d3-force), режимы размера, инспектор |
| `AxisMarketMap` | `components/lab/market-map/axis-market-map.tsx` | Scatter-карта: настраиваемые X/Y/размер/цвет, пресеты, зоны |
| `MarketMapInspector` | `components/lab/market-map/market-map-inspector.tsx` | Панель по `MarketMapTile` (пузырьки) |
| `MarketLabInspector` | `components/lab/market-map/market-lab-inspector.tsx` | Панель по `MarketLabNode` (координаты) |
| `CurrencyCorrelationPage` | `components/lab/currency-correlation-page.tsx` | `/lab/currency-correlation` — shell, контракты, controls, body, «Как читать» |
| `CurrencyCorrelationLabBody` | `components/lab/currency-correlation/currency-correlation-lab-body.tsx` | Карта расхождений, график, состояние пары, журнал |
| `CurrencyCorrelationLabControls` | `components/lab/currency-correlation/currency-correlation-lab-controls.tsx` | Управление: источник, период, интервал, график, пара, чувствительность, единицы |
| `CurrencyCorrelationDivergenceMap` | `components/lab/currency-correlation/currency-correlation-divergence-map.tsx` | Карта 3 пар + шкала z |
| `CurrencyCorrelationDataStatus` | `components/lab/currency-correlation/currency-correlation-data-status.tsx` | Строка MOEX ISS или диагностика при нехватке точек |
| `CurrencyCorrelationWorkspace` | `components/lab/currency-correlation/currency-correlation-workspace.tsx` | Legacy: дневной workspace (страницей не используется) |
| `CurrencyCorrelationChart` | `components/lab/currency-correlation/currency-correlation-chart.tsx` | lightweight-charts: 3 линии, tooltip, маркеры расхождения |
| `OrderflowSimulatorPage` | `components/lab/orderflow-simulator/orderflow-simulator-page.tsx` | `/lab/orderflow-simulator` — виды Привод / Стакан крупно / Учебный / Мультиокно |
| `LargeDomWorkspace` | `components/lab/orderflow-simulator/large-dom-workspace.tsx` | Режим «Стакан крупно»: DOM + лента + инспектор уровня |
| `DomTapeStack` | `components/lab/orderflow-simulator/dom-tape-stack.tsx` | Привод: круги сделок + компактный `DomLadder` |
| `ScalpTerminalWorkspace` | `components/lab/orderflow-simulator/scalp-terminal-workspace.tsx` | Canvas привода (`combinedBook`) |
| `TapeBubbleLane` | `components/lab/orderflow-simulator/tape-bubble-lane.tsx` | Круги сделок, привязка к цене строки DOM |
| `SimulatedCandleChart` | `components/lab/orderflow-simulator/simulated-candle-chart.tsx` | SVG свечи + объёмы (симуляция), таймфрейм 1м/5м |
| `OrderBookLadder` | `components/lab/orderflow-simulator/order-book-ladder.tsx` | Стакан bid/ask, плотности, айсберг-контур |
| `TapePrintFeed` | `components/lab/orderflow-simulator/tape-print-feed.tsx` | Лента принтов, группировка тиков |
| `ClusterPanel` | `components/lab/orderflow-simulator/cluster-panel.tsx` | Кластера: покупки/продажи/Δ по цене и времени |
| `SimulatorControlPanel` | `components/lab/orderflow-simulator/simulator-control-panel.tsx` | Сценарии, ручное управление, режимы, hotkeys hint |
| `PresentationToolbar` | `components/lab/orderflow-simulator/presentation-toolbar.tsx` | Компактная панель для режима Презентация |
| `AnnotationsPanel` | `components/lab/orderflow-simulator/annotations-panel.tsx` | Ручные аннотации (стрелки, подсветки) |
| `ScenarioJournalPanel` | `components/lab/orderflow-simulator/scenario-journal-panel.tsx` | Журнал «Ход сценария» |
| `TeachingOverlay` | `components/lab/orderflow-simulator/teaching-overlay.tsx` | SVG-аннотации на графике (уровни, стрелки, зоны) |

### Скринер (пульт `/screener`)

| Компонент | Файл | Роль |
|-----------|------|------|
| `MarketCommandCenter` | `components/screener/dashboard/market-command-center.tsx` | Пульт: hero, лента, радары |
| `RealSparkline` / `SignalAura` | `components/screener/mini-sparkline.tsx` | Реальная история («5д») vs декоративный aura от live-метрик |
| `InstrumentCardVisual` | `components/screener/instrument-card-visual.tsx` | Выбор sparkline + подпись «история: нет» |
| `SignalHeroCard` | `components/screener/dashboard/signal-hero-card.tsx` | Главный сигнал (плотная карточка) |
| `SignalRail` | `components/screener/dashboard/signal-rail.tsx` | Компактная лента 3–5 тикеров |

**Зависимости данных (Vercel):** обязательная отрисовка `/screener` и `/lab/market-map` — **MOEX ISS** через `/api/screener` (без SQLite). Sparkline «5д» — опционально `/api/instruments/[ticker]/history` (Prisma/SQLite после ingest); при отсутствии — `SignalAura` + «история: нет». `package.json`: `d3-force`, `@types/d3-force`.

### Скринер (таблицы)

| Компонент | Файл | Роль |
|-----------|------|------|
| `ScreenerHomePage` | `components/screener/screener-home-page.tsx` | Дашборд `/screener` |
| `HomePageScreener` / `HomePageScreenerClient` | `homepage-screener.tsx`, `homepage-screener-client.tsx` | Legacy combined screener (dynamic import, `ssr: false`) |
| `StocksScreenerPage` | `components/screener/stocks-screener-page.tsx` | Таблица акций + benchmark |
| `FuturesScreenerPage` | `components/screener/futures-screener-page.tsx` | Таблица фьючерсов |
| `ScreenerTable` | `components/screener/screener-table.tsx` | Virtualized TanStack Table |
| `stockColumns` / futures columns | `components/screener/columns.tsx`, `futures-*-table.tsx` | Колонки |
| `MarketRadar` | `components/screener/market-radar.tsx` | Визуализация рынка |

### Материалы

| Компонент | Файл | Роль |
|-----------|------|------|
| `MaterialsPageShell` | `components/materials/materials-page-shell.tsx` | Общая обёртка (title, freshness, source badge) |
| `TechnicalCharacteristicsClient` | `technical-characteristics-client.tsx` | UI фильтров + инспектор |
| `TechnicalCharacteristicsTable` | `technical-characteristics-table.tsx` | Таблица, пресеты колонок, сортировка |
| `StocksMaterialsClient` | `stocks-materials-client.tsx` | 4 режима карты акций |
| `StocksSectorsMode` / `Capitalization` / `Indices` | `stocks-*-mode.tsx` | Режимы отображения |
| `FuturesMaterialsClient` | `futures-materials-client.tsx` | Цепочки фьючерсов |
| `ScreenerMaterialsPage` | `screener-materials-page.tsx` | Статическая документация логики activity |

### Прочее

| Компонент | Файл | Роль |
|-----------|------|------|
| `EntitlementBoundary` | `components/premium/entitlement-boundary.tsx` | Premium gate |
| `InstrumentLayout` | `components/instrument/instrument-layout.tsx` | Страница тикера |
| Academy editorial | `components/academy/*` | Статьи, сцены, `range-turnover-editorial` |

---

## 5. Откуда берутся данные

### A. Live MOEX ISS (основной поток UI скринера и technical characteristics)

- HTTP: `lib/server/moex-iss/http.ts` — `fetchIssJson(path)` → `https://iss.moex.com/iss` + retry (жёстко в коде; **не** читает `MOEX_BASE_URL` из `.env`).
- Парсинг: `lib/server/moex-iss/schemas.ts` (`moexIssPayloadSchema`).
- Скринер: `lib/server/services/moex-screener.ts` — `getMoexSnapshot()`, in-memory cache **20 с**, enrich через `enrichMoexStocksWithInPlayMetrics` (`screener-math.ts`), historical baselines из Prisma если есть `DATABASE_URL`.
- Тех. характеристики: `lib/server/services/materials-technical-characteristics.ts` — отдельные ISS-запросы TQBR + FORTS, cache **20 с**.

**Fallback скринера:** при ошибке MOEX → `getDemoSnapshot()` из `lib/mock/screener.ts` (`screenerRows`), `status.source = "demo"`, `fallbackReason` ∈ `moex-unavailable` | `no-usable-rows` | `validation-failed`.

**Fallback technical characteristics:** `app/api/materials/technical-characteristics/route.ts` при exception → HTTP 200 с `rows: []`, `status.source: "demo"` и сообщением об ошибке.

### B. Prisma / SQLite (ingest + instrument API)

- Ingest CLI: `frontend/scripts/ingest-moex.ts` → `syncUniverse`, `ingestSnapshots`, `ingestDailyBars(120)` из `lib/server/services/moex-ingest.ts`.
- MOEX client для ingest: `lib/server/integrations/moex/client.ts` (`moexGetJson`, **использует** `MOEX_BASE_URL`, `MOEX_HTTP_TIMEOUT_MS`).
- DB access: `lib/server/db.ts`, модели в `prisma/schema.prisma` (`Instrument`, `MarketSnapshot`, `DailyBar`, `ScreenerMetric`, …).
- **Instrument pages / history API** читают БД через `lib/server/services/screener-query.ts`, **не** live ISS.

**Важно:** live `/api/screener` и Prisma-поток **могут расходиться** (разные источники и момент обновления). Это архитектурное ограничение, не баг документации.

### C. Статические списки тикеров (local TS, не API)

- Группы акций в материалах: `STOCKS_MODE_GROUPS` в `lib/materials/stocks-map.ts`.
- Сектора (отдельный модуль): `lib/materials/stocks-sectors.ts` (`OFFICIAL_SECTOR_DEFS`).
- Капитализация: `lib/materials/stocks-capitalization.ts`.
- Индексы: `lib/materials/stocks-indices.ts`.
- Фьючерсные семьи: `lib/domain/futures-family.ts`, `lib/materials/futures-map.ts`.

### D. Mock (`lib/mock/screener.ts`)

- `screenerRows` — demo fallback для скринера.
- `instrumentDetails` — fallback карточек тикера, если `getInstrumentDetail` вернул `null`.
- `academyEntries` — академия.
- `premiumFlagsMock` — pricing / entitlement.

### E. Supabase

- Не используется в runtime без env. `createSupabaseBrowserClient()` требует `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 6. Как устроена страница `/materials/technical-characteristics`

### Маршрутизация

```
app/(app)/materials/technical-characteristics/page.tsx
  → TechnicalCharacteristicsClient (client)
    → useTechnicalCharacteristicsQuery(assetClass, liquidity)
    → GET /api/materials/technical-characteristics
    → getTechnicalCharacteristics() в materials-technical-characteristics.ts
```

### Поток данных

1. **Клиент** (`TechnicalCharacteristicsClient`):
   - Режим `TechnicalMode`: `stocks` | `futures` | `compare` → маппится в query `assetClass`: `stock` | `future` | `all`.
   - `liquidity`: `liquid` | `all` → query param `liquidity` (на сервере `liquidOnly`: `liquidity !== "all"`).
   - Refetch: каждые **20 с** (`use-technical-characteristics-query.ts`).

2. **API** (`route.ts`):
   - Query: `assetClass`, `liquidity`.
   - Ответ валидируется клиентом через `technicalCharacteristicsResponseSchema`.

3. **Сервер** (`getTechnicalCharacteristics`):
   - Параллельно два ISS-запроса (акции TQBR, фьючерсы FORTS).
   - `buildStockRows` / `buildFuturesRows` → массив `TechnicalCharacteristicsRow`.
   - Сортировка по обороту (`sortByUtility`).
   - Фильтр `filterRows(assetClass, liquidOnly)`; для акций `liquidOnly` использует `classifyStockLiquidity` (`lib/server/domain/liquidity.ts`).

4. **UI**:
   - Верхние фильтры в `TechnicalCharacteristicsClient`.
   - Таблица `TechnicalCharacteristicsTable` — колонки из `COLUMN_DEFS`, пресеты `TABLE_PRESETS`, конфиг режимов `MODE_CONFIGS`.
   - Правая панель «Инспектор» — детали выбранного тикера.
   - Блоки «Формулы» и «Источник» — статический copy в client.

### Тип строки

`TechnicalCharacteristicsRow` в `lib/materials/contracts.ts` — поля с обёрткой `ValueWithStatus` (`value`, `status`: `available` | `derived` | `unavailable`, `note`).

---

## 7. Фильтры, вкладки, таблицы, расчётные поля

### Technical characteristics — фильтры (client)

| UI | Состояние | Логика |
|----|-----------|--------|
| Вкладки | `mode`: stocks / futures / compare | → API `assetClass` |
| Ликвидные / Все | `liquidity` | → API; серверный `applyLiquidFilter` для акций |
| «Только торгуемые» | `tradableNow` | client: `tradesCount > 0` и `spreadPct < 1.2` |
| Board | `boardFilter` | client filter по `row.board` |
| Поиск | `search` | ticker / instrumentName |
| Compact / Comfortable | `density` | padding строк |
| Heat metric | `heatMode` | подсветка колонки сортировки |

### Technical characteristics — таблица

- **Пресеты колонок** (`TABLE_PRESETS`): `scalp`, `intraday`, `liquidity`, `stocks`, `futures`.
- **Колонки** (`COLUMN_DEFS` в `technical-characteristics-view.ts`): instrument, ticker, assetClass, lotSize, currentPrice, lotPrice, priceStep, stepValue, spreadPct, tradesCount, turnoverRubMln, turnoverPerTradeRubK, largeLotRubMln, intradayUsabilityScore, entryFriction, commissionToRangeScore, daysToExpiry, contractSize, marginFootprintRub, board, scalabilityHint.
- **Client-only метрика:** `getEntryFriction(row)` — не в API payload, считается в view-слое.
- **Summary bar:** count, median spread, total turnover (млн ₽), avg trades — из `TechnicalCharacteristicsTable.onSummaryChange`.

### Серверные расчётные поля (materials-technical-characteristics.ts)

Константы комиссий: `STOCK_COMMISSION_RATE = 0.0004`, `FUTURES_COMMISSION_RATE = 0.0002`.

| Поле | Функция / формула |
|------|-------------------|
| `spreadPct` | `spreadPct(bid, offer, last)` |
| `lotPrice` | last × lotSize |
| `stepValue` | stocks: minstep × lot; futures: STEPPRICE или fallback |
| `turnoverPerTradeRub` | turnover / NUMTRADES |
| `largeLotRub` | 1% от VALTODAY |
| `commissionRub` | lotPrice × rate |
| `pointsToCoverCommission` | commission / stepValue |
| `slippageSensitivity` | proxy от spread и turnover/trade |
| `commissionToRangeScore` | баланс комиссии к day range % |
| `intradayUsabilityScore` | логарифмический скоринг spread + turnover + trades |
| `liquidityQuality` | `liquidityQuality(turnover, trades)` → high/medium/low/unknown |
| `scalabilityHint` | текстовая подсказка (скальп / интрадей / осторожность) |
| `availabilityConfidence` | % заполненных ключевых метрик |
| `daysToExpiry` | от `LASTDELDATE` (futures) |

**Недоступно по дизайну:** `marginFootprintRub` для фьючерсов — всегда `null` с note «Требуется API по ГО».

### Скринер — ключевые метрики

- `ScreenerMetricSet` в `@screenerpro/shared` — inPlayScore, isInPlay, inPlayTags, turnoverVsAverage, percentiles, activityRatio, …
- Обогащение: `lib/server/domain/screener-math.ts`, `computeInPlaySignals`, `classifyStockActivity` (`stock-activity.ts`).
- Ликвидность акций в UI: `classifyStockLiquidity` — пороги `minTurnoverRub: 500M`, `minTradesCount: 10_000`, allowlist тикеров.

### Materials / stocks — режимы

`StocksMode`: `sectors` | `capitalization` | `indices` | `drivers` — группы из `STOCKS_MODE_GROUPS`, метрики группы в `computeGroupView` (`stocks-map.ts`).

---

## 8. Какие проблемы уже решались в этом чате

Сессия была **onboarding / setup**, не feature-разработка:

1. Установлен **Node.js LTS 24.15.0** (winget) — в Cursor был только bundled Node без npm.
2. Установлен **pnpm 10.32.1** глобально.
3. Создан **`frontend/.env`** из `.env.example`.
4. Выполнен **`pnpm install`** (443 пакета, postinstall `prisma generate`).
5. **`pnpm -C frontend prisma:push`** — SQLite `frontend/prisma/dev.db`.
6. **`pnpm -C frontend ingest:moex`** — 747 инструментов, 747 snapshots, 7548 daily bars.
7. **`pnpm -C frontend build`** — успешная production-сборка.
8. Запущен **dev-сервер** на `http://localhost:3000`.

Предупреждение pnpm: **ignored build scripts** (`@prisma/client`, `prisma`, `esbuild`) — см. §9.

---

## 9. Текущие баги / ограничения

| Ограничение | Детали |
|-------------|--------|
| **Два источника данных скринера** | UI: live MOEX (`moex-screener`). Instrument API: Prisma после ingest. Синхронизация не гарантирована. |
| **Два MOEX HTTP-клиента** | `moex-iss/http.ts` (hardcoded URL) vs `integrations/moex/client.ts` (env). Поведение timeout может отличаться (8s vs 10s env). |
| **SQLite на serverless** | Локальный `file:./prisma/dev.db` **не подходит** для Vercel serverless без внешней БД — нужно проверить целевую prod-стратегию. |
| **Supabase / auth** | Env пустые; login не подключён. |
| **Mock-контент** | Академия, часть pricing, fallback скринера, fallback карточек тикера. |
| **ГО фьючерсов** | `marginFootprintRub` не заполняется. |
| **IN_PLAY hysteresis** | TODO в `screener-math.ts:145` — нет sticky enter/exit по сессии. |
| **pnpm approve-builds** | Могут не выполняться postinstall-скрипты зависимостей до `pnpm approve-builds`. |
| **Admin ingest без защиты** | `POST /api/admin/ingest/moex` — нет auth в коде (нужно проверить, закрыт ли на prod). |
| **Git** | На момент onboarding workspace мог быть без git init (user_info: «Is directory a git repo: No»). |
| **Секторы stocks-materials** | `stocks-sectors.ts` содержит `OFFICIAL_SECTOR_DEFS`; `stocks-map.ts` использует упрощённые `STOCKS_MODE_GROUPS` — возможное дублирование/расхождение списков (нужно проверить, какой путь активен в UI: `StocksSectorsMode` vs map groups). |

---

## 10. Что важно не сломать

1. **Контракты `@screenerpro/shared`** — Zod-схемы `ScreenerRow`, `ScreenerApiResponse`, `ScreenerDataStatus`; UI парсит ответы через `screenerApiResponseSchema`.
2. **Fallback-семантика** — при падении MOEX скринер должен отдавать demo rows с понятным `status.fallbackReason`, не пустой 500.
3. **Technical characteristics** — поля `ValueWithStatus`; не подставлять числа вместо `null` (явное правило в UI copy).
4. **`classifyStockLiquidity`** — пороги и allowlist влияют на фильтр «Ликвидные» в тех. характеристиках и скринере.
5. **Sidebar state** — ключ `screenerpro.sidebar.pinned` в `AppSidebar`.
6. **In-play pipeline** — `enrichMoexStocksWithInPlayMetrics` + тег `IN_PLAY` в колонках скринера.
7. **Route groups** — `(app)` layout с sidebar не должен применяться к marketing-only страницам без необходимости.
8. **Checkpoint-документы** — `docs/checkpoints/*`, `docs/recovery-checkpoint.md` описывают стабильные milestone; при откате проверять `/screener`, benchmark, academy, sidebar.

---

## 11. Как локально запустить проект

### Требования

- Node.js LTS (в сессии setup: **24.15.0**)
- **pnpm 10.32.1** (рекомендуется версия из `packageManager`)

### Быстрый путь (Windows)

```cmd
cd C:\Users\Admin\Documents\GitHub\ScreenerPRO
run-dev-full.cmd
```

Скрипт `run-dev-full.ps1`:

1. Копирует `frontend\.env.example` → `frontend\.env` если нет `.env`
2. Освобождает порт 3000
3. `pnpm install`
4. `pnpm -C frontend prisma:generate`
5. `pnpm -C frontend prisma:push`
6. `pnpm -C frontend ingest:moex` (warn + continue при ошибке)
7. `pnpm -C frontend dev`

### Ручной путь

```bash
cd <repo-root>
cp frontend/.env.example frontend/.env   # или создать вручную
pnpm install
pnpm -C frontend prisma:push
pnpm -C frontend ingest:moex             # опционально, для Prisma/instrument API
pnpm -C frontend dev
```

Открыть: http://localhost:3000/screener

### Env (`frontend/.env`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL="file:./prisma/dev.db"
MOEX_BASE_URL="https://iss.moex.com/iss"
MOEX_HTTP_TIMEOUT_MS="10000"
```

### Прочие скрипты (`frontend/package.json`)

| Script | Команда |
|--------|---------|
| build | `prisma generate && next build` |
| ingest | `tsx scripts/ingest-moex.ts` |
| prisma studio | `pnpm -C frontend prisma:studio` |

---

## 12. Как деплоится на Vercel

**В репозитории нет задокументированного pipeline.** Выводы по косвенным признакам:

| Аспект | Статус |
|--------|--------|
| `vercel.json` | **Отсутствует** |
| Root directory | Вероятно **`frontend`** (нужно проверить настройки проекта в Vercel Dashboard) |
| Build command | Ожидаемо `pnpm build` или `cd frontend && pnpm build` |
| Install | `pnpm install` из корня monorepo (workspace) |
| Env | Те же переменные, что `.env.example`; для prod БД — **не SQLite file** (нужно проверить) |
| MOEX | Serverless functions должны иметь исходящий доступ к `iss.moex.com` |
| In-memory cache | `moex-screener` / technical characteristics cache **20 с** — на serverless cold start сбрасывается (это норма) |
| Cron ingest | `POST /api/admin/ingest/moex` — **нужно проверить**, настроен ли Vercel Cron и защита секретом |

Типовой ручной деплой (нужно проверить аккаунт):

```bash
cd frontend
vercel          # или vercel --prod
```

**Риск:** Prisma + SQLite file path не персистентен на Vercel — instrument API и historical baselines могут не работать без Turso/Postgres/etc.

---

## 13. Наиболее важные файлы для понимания логики

### Архитектура и конфиг

- `pnpm-workspace.yaml`
- `frontend/next.config.ts` — `transpilePackages: ["@screenerpro/shared"]`
- `frontend/app/layout.tsx`, `frontend/app/(app)/layout.tsx`
- `frontend/lib/constants/navigation.ts`

### Данные MOEX (live UI)

- `frontend/lib/server/services/moex-screener.ts` — **главный** сервис скринера
- `frontend/lib/server/services/materials-technical-characteristics.ts` — тех. характеристики
- `frontend/lib/server/moex-iss/http.ts`, `schemas.ts`
- `frontend/lib/server/domain/screener-math.ts`, `stock-activity.ts`, `liquidity.ts`, `in-play-signals.ts`

### Данные Prisma (ingest + instruments)

- `frontend/prisma/schema.prisma`
- `frontend/lib/server/services/moex-ingest.ts`
- `frontend/lib/server/integrations/moex/client.ts`, `endpoints.ts`, `mappers.ts`
- `frontend/lib/server/services/screener-query.ts`
- `frontend/scripts/ingest-moex.ts`

### API

- `frontend/app/api/screener/route.ts`
- `frontend/app/api/materials/technical-characteristics/route.ts`

### Client data layer

- `frontend/lib/hooks/use-screener-query.ts`
- `frontend/lib/hooks/use-technical-characteristics-query.ts`
- `shared/src/contracts/market.ts`

### UI entry points

- `frontend/components/screener/stocks-screener-page.tsx`
- `frontend/components/materials/technical-characteristics-client.tsx`
- `frontend/lib/materials/technical-characteristics-view.ts`
- `frontend/lib/materials/stocks-map.ts`, `futures-map.ts`

### Mock / fallback

- `frontend/lib/mock/screener.ts`

### Документация milestone

- `docs/checkpoints/checkpoint-screener-pre-iteration-2026-03-24.md`
- `docs/checkpoints/checkpoint-academy-sidebar-stable.md`
- `docs/recovery-checkpoint.md`

---

## 14. Какие следующие задачи планируются

По **checkpoint / README / TODO в коде** (не внешний roadmap):

| Источник | Задача |
|----------|--------|
| `frontend/README.md` | Подключить реальные MOEX query вместо mock; Supabase auth + RLS; billing |
| `checkpoint-academy-sidebar-stable.md` | QA sidebar на `/screener` и `/academy`; UI regression |
| `checkpoint-screener-pre-iteration-2026-03-24.md` | Baseline перед итерацией screener UX/logic |
| `screener-math.ts:145` | Session-level hysteresis IN_PLAY (enter ≥78 / exit <74) |
| `navigation.ts` | Раскрыть скрытые разделы: Скринер PRO, Новости, События, Наблюдение, Настройки |
| Technical characteristics | API гарантийного обеспечения (ГО) для `marginFootprintRub` |
| Product | Заменить mock academy / instrument details на CMS или API |
| Infra | Prod DB вместо SQLite; защита `POST /api/admin/ingest/moex`; Vercel env + cron |
| `recovery-checkpoint.md` | Git tag `checkpoint-academy-sidebar-stable` — **нужно проверить**, создан ли tag в текущем clone |

Конкретный приоритет product backlog **в репозитории не зафиксирован** — уточнять у владельца продукта.

---

## Быстрая шпаргалка зависимостей (frontend)

```
next, react, react-dom
@prisma/client, prisma
@tanstack/react-query, @tanstack/react-table, @tanstack/react-virtual
@radix-ui/react-tabs, @radix-ui/react-slot, @radix-ui/react-tooltip
@supabase/supabase-js
lightweight-charts, motion, lucide-react
zod, class-variance-authority, clsx, tailwind-merge
@screenerpro/shared (workspace)
```

---

## Последнее состояние проекта

*Обновлено: май 2026 — onboarding + AI-handoff документация.*

| Область | Статус |
|---------|--------|
| Локальный запуск | Настроен: Node LTS, pnpm, `frontend/.env`, `pnpm install`, Prisma SQLite, MOEX ingest |
| Dev-сервер | `pnpm -C frontend dev` → http://localhost:3000 |
| Production build | `pnpm -C frontend build` — проходил успешно после setup |
| Live данные | Скринер и «Тех. характеристики» — MOEX ISS; при сбое — demo/mock fallback |
| База Prisma | `frontend/prisma/dev.db` после `prisma:push` + `ingest:moex` (~747 инструментов) |
| Auth / Supabase | Не подключены (пустые env) |
| Vercel / prod | Конфиг в репо не зафиксирован — см. §12 |

**Документы для работы с AI (корень и `docs/`):**

- `PRODUCT_VISION.md` — продукт, UX, роль ChatGPT vs Cursor (для не-программиста).
- `AI_SESSION_STATE.md` — след последней итерации; обновляет Cursor после задач.
- `docs/CURSOR_WORKFLOW.md` — правила исполнения и отчётности для Cursor.

---

*Файл сгенерирован для AI-handoff. При изменении архитектуры данных обновлять §5, §9 и §12 в первую очередь.*
