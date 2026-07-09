# Strategy Lab — целевая архитектура

**ScreenerPRO · `/screener/strategies` («Стратегии»)**  
**Дата:** 2026-07-07  
**Статус:** Strategy Lab v0 **demo-ready** (2026-07-08): chart-first layout, русский UI, directional buffers, ZigZag-lite toggle, debug только при `?screenerChartDebug=1`.

**Chart base (2026-07-08):** lifecycle stable, overlays enabled, drag/zoom/fit/reset, no React update loops in normal mode.

Связанные документы:

| Документ | Роль |
|----------|------|
| `PRODUCT_VISION.md` | Скринер — ядро; Strategy Lab — отдельная зона визуализации идей |
| `PROJECT_CONTEXT.md` | Маршруты, shell, MOEX ISS, charts |
| `docs/STOCK_SCREENER_PAGE_TARGET.md` | Границы `/screener/stocks` — **не трогать** |
| `docs/INTRADAY_SCREENER_TERMINAL_VISION.md` | North Star intraday terminal |
| `docs/UI_NUMBERS_MINIMALISM.md` | Минимализм цифр в UI |
| `docs/SESSION_BOX_OVERLAY.md` | Session box overlay для intraday context |
| `docs/STRATEGY_SCANNER_ARCHITECTURE.md` | Batch scanner / ratings architecture |

---

## Аудит навигации и routing (2026-07-07)

### Левое меню (sidebar)

| Слой | Файл | Роль |
|------|------|------|
| Конфиг пунктов | `frontend/lib/constants/navigation.ts` | `sidebarMainNavGroups`, `sidebarDraftsNav`, `hiddenDevNavConfig` |
| Рендер sidebar | `frontend/components/shell/app-sidebar.tsx` | Основное меню + блок «Черновики» (по флагу `isDraftNavVisible`) |
| Видимость черновиков | `frontend/lib/constants/nav-visibility.ts` | `isDraftNavVisible`, `isDevLabLinkVisible` |

**Основное меню (`sidebarMainNavGroups`, группа «Рынок»):**

| Пункт | href | icon |
|-------|------|------|
| Рынок | `/screener` | `ChartColumn` |
| Акции | `/screener/stocks` | `CandlestickChart` |
| Фьючерсы | `/screener/futures` | `ChartCandlestick` |
| **Стратегии** | `/screener/strategies` | `Layers` |

**Черновики (`sidebarDraftsNav`):** `/lab/*`, `/materials/technical-characteristics` и др. — отдельный shelf внизу sidebar, не в основной группе «Рынок».

### Маршруты screener

| Маршрут | Route-файл | Главный компонент | Продуктовая роль |
|---------|------------|-------------------|------------------|
| `/screener` | `frontend/app/(app)/screener/page.tsx` | `ScreenerHomePage` → `MarketPriorityPage` | Market Lab / пульт приоритизации. **Не основной скринер.** |
| `/screener/stocks` | `frontend/app/(app)/screener/stocks/page.tsx` | `StocksScreenerPage` | **Главный рабочий скринер акций.** |
| `/screener/futures` | `frontend/app/(app)/screener/futures/page.tsx` | `FuturesScreenerPage` | Скринер фьючерсов. **Не трогать.** |
| `/screener/strategies` | `frontend/app/(app)/screener/strategies/page.tsx` | `StrategyLabPage` | **Strategy Lab** — визуализация торговых идей (shell v1) |

### Draft / lab routes (существующие)

| Зона | Префикс | Примеры | Shell |
|------|---------|---------|-------|
| Lab-черновики | `/lab/*` | `/lab/market-map`, `/lab/currency-correlation`, `/lab/orderflow-simulator` | `LabPageShell` |
| Каталог lab | `/lab` | `frontend/app/(app)/lab/page.tsx` | inline |
| Песочница | `/sandbox` | raw-данные скринера | без lab shell |
| Материалы | `/materials/*` | витрина, тех. характеристики | `materials-page-shell` |

**Важно:** Strategy Lab — **не** `/lab/*`. Это отдельный screener-route `/screener/strategies`, в основном меню рядом с Рынок / Акции / Фьючерсы.

### Layout components

| Компонент | Файл | Где используется |
|-----------|------|------------------|
| `AppGroupLayout` | `frontend/app/(app)/layout.tsx` | Все `(app)`-страницы: `AppSidebar` + `TopBar` + `<main>` |
| `AppSidebar` | `frontend/components/shell/app-sidebar.tsx` | Левое меню |
| `TopBar` | `frontend/components/shell/top-bar.tsx` | Верхняя панель |
| `ScreenerPageHeader` / `ScreenerPanel` | `frontend/components/screener/screener-page-chrome.tsx` | Скринерные страницы (glass chrome) |
| `LabPageShell` | `frontend/components/lab/lab-page-shell.tsx` | `/lab/*` — **не использовать** для Strategy Lab |
| `lightweight-charts` | `stock-expanded-chart.tsx`, lab charts | Свечи MOEX — переиспользовать паттерн |

### Данные для v0 (реализовано, Iteration 2–3)

| Слой | Путь | Назначение |
|------|------|------------|
| API | `GET /api/screener/stocks/candles?view=chart&secid=&interval=&board=&period=&from=&till=&limit=` | MOEX ISS intraday свечи с диапазоном |
| Server fetch | `frontend/lib/server/services/strategy-candles.ts` | пагинация ISS `start`, merge, cap 5000 |
| Range | `frontend/lib/screener/strategies/strategy-candle-range.ts` | периоды today/3d/10d/20d, from/till МСК |
| Client hook | `frontend/lib/hooks/use-strategy-candles.ts` | fetch + normalize + diagnostics |
| Normalize | `frontend/lib/strategies/strategy-candles-normalizer.ts` | UNIX seconds, OHLC validation |
| Bridge | `frontend/lib/screener/strategies/strategy-candles.ts` | expanded series → normalizer |
| Chart | `frontend/components/strategies/strategy-candlestick-chart.tsx` | `lightweight-charts` v5, `overlaysEnabled` |

**Источник:** MOEX ISS через `buildStrategyChartSeries` (board TQBR по умолчанию). Кэш сервера ~20 с.

**Периоды (2026-07-08):**
- toolbar: **Сегодня · 3д · 10д · 20д** рядом с таймфреймом;
- default: **3д** (для 5м и остальных ТФ v0);
- compact UI: `Свечей: N · период 3д`;
- hard cap: **5000** свечей (хвост диапазона);
- пагинация: ISS `start` по 500 строк, dedupe по timestamp, sort asc.

**Ограничения v0:**
- только акции TQBR (`board` параметризован, default TQBR);
- интервалы 5 / 10 / 30m;
- произвольный from/to через API, в UI — пресеты периодов (custom range — позже).

---

## 1. Product role

**Strategy Lab** — черновая лаборатория визуализации торговых стратегий.

Здесь мы проектируем и тестируем идеи, которые потом могут быть перенесены в главную страницу «Рынок» или скринер «Акции». Это **не** production-скринер и **не** полноценный бэктестер.

Связанная batch-зона:

- **Strategy Scanner** — server/script-side batch scan по universe
- **Strategy Ratings** — read-only рейтинг лучших инструментов по стратегии
- подробная архитектура: `docs/STRATEGY_SCANNER_ARCHITECTURE.md`

| Раздел | Роль |
|--------|------|
| `/screener` | Market Lab — приоритизация, In Play, пульс |
| `/screener/stocks` | Рабочий скринер акций |
| `/screener/futures` | Скринер фьючерсов |
| **`/screener/strategies`** | **Strategy Lab — визуализация и объяснение торговых идей** |

---

## 2. Route

```
/screener/strategies
```

Опциональные query-параметры (v0+):

| Param | Default | Пример |
|-------|---------|--------|
| `secid` | `GAZP` | `?secid=SBER` |
| `board` | `TQBR` | `?board=TQBR` |
| `interval` | `5` | `?interval=5` (минуты) |
| `strategy` | `round-levels` | `?strategy=round-levels` |

---

## 3. Navigation

Добавить пункт **«Стратегии»** в левое меню **ниже «Фьючерсы»** в группе «Рынок».

**Файл:** `frontend/lib/constants/navigation.ts` → `sidebarMainNavGroups[0].items`:

```ts
// после Фьючерсы
{ href: "/screener/strategies", label: "Стратегии", icon: Layers, visibility: "visible" },
```

**Не** добавлять в `sidebarDraftsNav` — Strategy Lab входит в публичное ядро «Лаборатория рынка», но как отдельная экспериментальная зона (без бейджа ЧЕРН.).

**Sidebar render:** `app-sidebar.tsx` подхватит пункт автоматически из `sidebarMainNavGroups`.

---

## 4. v0 Strategy — Round Levels (круглые числа)

**ID:** `round-levels`  
**Название в UI:** «Круглые числа»  
**Subtitle:** «Линии уровней + буфер реакции вокруг цены»

Буферные зоны, касания и реакции — **слои отображения** внутри этой стратегии, не отдельные strategy tabs.

### Strategy tabs (2026-07-07)

| Tab | ID | Статус |
|-----|-----|--------|
| **Круглые числа** | `round-levels` | active — levels + buffer layers |
| ZigZag | `zigzag` | soon |
| Volume Reaction | `volume-reaction` | soon |

**Убрано:** отдельная вкладка «Буферная зона» — буфер теперь toggle `strategyLayers.buffers`.

### Слои (`strategyLayers`) — toolbar v0

| Слой | Ключ | Default | Назначение |
|------|------|---------|------------|
| Линии уровней | `levels` | on | price lines на chart |
| Буферные зоны | `buffers` | on | directional SVG bands |
| Сессии | `sessions` | on | session boxes + high/low context |
| Реакции | `reactions` | off | B/X markers (selected level) |
| Полу-уровни | `halfLevels` | off | фильтр сетки 0.5 |
| Экстремумы | `extrema` | off | ZigZag-lite markers + direction для буфера |

Major/psychological уровни всегда в фильтре отображения (без отдельного toggle).

Дополнительно в toolbar: **Тикер**, **Загрузить**, **5м / 10м / 30м**, **Буфер авто** (+ ручной размер при выкл.), **Session preset**.

### Normal mode vs debug

| Режим | URL | Что видно |
|-------|-----|-----------|
| **Normal** | `/screener/strategies` | Header, toolbar, chart, правая панель |
| **Debug** | `?screenerChartDebug=1` | + runtime panel, parity panel, debug strip, synthetic source |

Без `screenerChartDebug=1` — никаких debug panels, synthetic switch, runtime strip.

### Аналитический layout (2026-07-08)

**Desktop (full-width chart-first):**
- одна колонка на всю ширину content area (`strategy-lab-page`, `max-width: none`);
- **график** — главное рабочее поле;
- compact strip выбранного уровня (подход / зоны / буфер) над графиком;
- **под графиком** — аналитический блок техничности (та же ширина, что chart):
  - summary инструмента;
  - плотная таблица уровней;
  - лента касаний выбранного уровня.

Правая боковая панель **убрана** — выбор уровня и статистика в нижней аналитике.

**Режим «Фокус-график»** (toolbar toggle):
- скрывает нижнюю аналитику;
- увеличивает высоту графика до `clamp(760px, 82vh, 920px)`;
- кнопка «Показать аналитику» под графиком возвращает нижний блок;
- состояние в `localStorage`: `screenerpro.strategyLab.chartFocusMode`.

Нижний блок — русский, плотный, terminal-like, без giant KPI cards.

### Header

`Круглые числа · GAZP · 5м · TQBR` (русские единицы ТФ)

### Функциональность v0

1. **Выбор инструмента** — SECID picker (дефолт GAZP, board TQBR).
2. **Выбор таймфрейма** — 5m / 10m / 30m (через существующий candles API).
3. **TradingView-style candlestick chart** — `lightweight-charts`, широкий центральный блок.
4. **Автоматические круглые уровни** — горизонтальные линии на round prices (100, 105, 110… или по шагу, зависящему от цены).
5. **Session Box Overlay** — тонкие прямоугольники сессий с `high/low` и label диапазона.
6. **Верхняя и нижняя буферная зона** вокруг каждого уровня — полупрозрачные bands (настраиваемый % или тики).
7. **Подсветка касаний** — маркеры/подсветка свечей, когда high/low входит в buffer zone.
8. **Блок техничности** — под графиком: summary инструмента, таблица уровней, лента touch events для selected level.

### Модули (план)

| Модуль | Путь (план) |
|--------|-------------|
| Round level engine | `frontend/lib/screener/strategies/round-level-engine.ts` |
| Buffer zone overlay | `frontend/lib/screener/strategies/buffer-zone.ts` |
| Touch / reaction stats | `frontend/lib/screener/strategies/round-level-reactions.ts` |
| Chart + overlays | `frontend/components/screener/strategies/strategy-chart.tsx` |
| Page shell | `frontend/components/screener/strategies/strategy-lab-page.tsx` |

---

## 5. Default test case

| Поле | Значение |
|------|----------|
| SECID | `GAZP` |
| board | `TQBR` |
| timeframe | `5m` |
| strategy | `round-levels` |

URL по умолчанию:

```
/screener/strategies?secid=GAZP&board=TQBR&interval=5&strategy=round-levels
```

---

## 6. Future strategies

Очередь после v0 (только ID и краткое описание — без реализации):

| ID | Название | Статус | Суть |
|----|----------|--------|------|
| `round-levels` | Круглые числа | **active** | Уровни + буфер + касания + реакции (слоями) |
| `zigzag` | ZigZag swing structure | soon | Структура свингов, HH/HL/LH/LL |
| `volume-reaction` | Volume reaction | soon | Реакция на всплески объёма у уровня |
| `opening-range` | Opening range | backlog | Диапазон открытия сессии, breakout/breakdown |
| `false-breakout` | False breakout | backlog | Ложный пробой с возвратом |
| `round-level-reclaim` | Round level reclaim | backlog | Возврат цены за круглый уровень после пробоя |
| `sr-cluster` | Support/resistance cluster | backlog | Кластер близких уровней |

Переключатель стратегий — compact tabs над графиком. Слои Round Levels — toggles в правой панели.

---

## 7. UI principles

- **Wide chart first** — график занимает ≥70% ширины viewport на desktop.
- **Minimal dark terminal style** — тёмный фон, тонкие линии, без «dashboard KPI cards».
- **No decorative KPI cards** — только 2–3 числа в stats panel (`docs/UI_NUMBERS_MINIMALISM.md`).
- **Readable annotations** — уровни и зоны не перегружают график; при zoom — адаптивная плотность линий.
- **Shell:** `ScreenerPageHeader` + layout из `(app)/layout.tsx`; **не** `LabPageShell` (это screener-зона, не `/lab`).
- **Data status обязателен** — MOEX live / fallback / mock с явным chip.

### Chart-first layout (2026-07-08)

| Параметр | Default | Фокус-график |
|----------|---------|--------------|
| **Ширина** | 100% content area, `min-width: 980px` @ ≥1280px | то же |
| **Высота desktop** | `clamp(650px, 74vh, 820px)` | `clamp(760px, 82vh, 920px)` |
| **Mobile** | `420px` | `420px` |
| **Tablet** | `540px` | `580px` |

- **Desktop:** single-column full width; toolbar + chart + analytics aligned
- **Нижняя аналитика:** скрывается в режиме «Фокус-график»
- Chart resize через `ResizeObserver`; `chart.applyOptions({ width, height })` без `fitContent` на каждый resize
- Zoom/scroll не ломаются: drag, wheel, toolbar `Вписать / Сброс / + / −`
- Session boxes рисуются через SVG overlay с `timeToCoordinate` / `priceToCoordinate`
- CSS: `.strategy-lab-page`, `.strategy-lab-workspace`, `.strategy-lab-chart-column` в `globals.css`
- Header: `Круглые числа · GAZP · 5m · TQBR`
- Toolbar: SECID, Загрузить, TF, период, buffer, session preset, toggles, **Фокус-график**

### Wireframe (desktop)

```

## Manual checklist

- `/screener/strategies` opens
- `GAZP 5m` chart visible
- levels `93 / 93.5 / 94 / 94.5 / 95` visible
- selected level changes
- buffer around selected level visible
- reaction markers optional
- no build errors
┌─────────────────────────────────────────────────────────────┬──────────────┐
│ Стратегии · Круглые числа / Буферная зона    GAZP · 5m     │ Params       │
├─────────────────────────────────────────────────────────────┤ buffer %     │
│                                                             │ round step   │
│                    CANDLESTICK CHART                        │              │
│              ─── round levels + buffer bands                │ Stats        │
│              ● touch markers                                │ touches: N   │
│                                                             │ bounce: …    │
└─────────────────────────────────────────────────────────────┴──────────────┘
```

---

## 8. What not to do

- **Не модифицировать** `/screener/stocks` — таблица, Command Bar, In Play, Setup column.
- **Не модифицировать** `/screener/futures`.
- **Не переносить** Market Command Deck / `MarketPriorityPage` на другие маршруты.
- **Не строить** полноценный бэктестер (нет equity curve, нет комиссий/slippage в v0).
- **Не подделывать** реальные торговые результаты — только визуальная эвристика «реакция у уровня».
- **Не дублировать** `/lab/orderflow-simulator` (симуляция без MOEX).
- **Не добавлять** Strategy Lab в `sidebarDraftsNav` — только main nav.

---

## 9. Implementation plan

### Iteration 1 — route + nav + static page skeleton ✅ (2026-07-07)

| Задача | Файлы | Статус |
|--------|-------|--------|
| Nav item «Стратегии» | `frontend/lib/constants/navigation.ts` | ✅ |
| Route | `frontend/app/(app)/screener/strategies/page.tsx` | ✅ |
| Static page | `frontend/components/screener/strategies/strategy-lab-page.tsx` | ✅ |

**Критерий готовности:** `/screener/strategies` открывается, пункт в sidebar активен, skeleton без графика.

**Следующий шаг:** Iteration 2 — candle chart (GAZP 5m).

### Iteration 2 — chart component with GAZP candles ✅ (2026-07-07, chart base fix)

| Задача | Файлы | Статус |
|--------|-------|--------|
| Candle normalizer | `frontend/lib/strategies/strategy-candles-normalizer.ts` | ✅ |
| Verify | `frontend/scripts/verify-strategy-candles.ts` | ✅ |
| Candle range | `strategy-candle-range.ts`, `strategy-candles.ts` (server) | ✅ |
| Verify range | `frontend/scripts/verify-strategy-candle-range.ts` | ✅ |
| Chart lifecycle + layout | `strategy-candlestick-chart.tsx`, `strategy-lab-page.tsx` | ✅ |
| Overlays | price lines / SVG / markers | ⏸ временно off |

**Критерий:** свечи GAZP 5m видны на широком chart, resize, loading/empty/error, right stats panel.

**Следующий шаг:** `overlaysEnabled={true}` — levels, затем buffers, затем markers.

### Iteration 3 — round level engine ✅ (2026-07-07)

| Задача | Файлы | Статус |
|--------|-------|--------|
| Engine | `frontend/lib/strategies/round-levels-engine.ts` | ✅ |
| Verify | `frontend/scripts/verify-round-levels-engine.ts` | ✅ |
| Docs | `docs/ROUND_LEVELS_STRATEGY.md` | ✅ |

**Следующий шаг:** Iteration 4 — buffer zones overlay на chart.

### Iteration 4 — buffer zones overlay

| Задача | Файлы |
|--------|-------|
| Buffer math | `buffer-zone.ts` |
| Chart bands | price lines / custom series в lightweight-charts |
| Params UI | buffer % в правой панели |

**Критерий:** верхняя/нижняя зона вокруг каждого уровня, настраиваемый buffer.

### Iteration 5 — touches / reactions analytics

| Задача | Файлы |
|--------|-------|
| Touch detection | `round-level-reactions.ts` |
| Markers on chart | подсветка касаний |
| Stats panel | touches, bounce / break / neutral counts |

**Критерий:** маркеры на графике + 2–3 числа в правой панели, без fake PnL.

---

## Следующие файлы для изменения (чеклист)

1. `frontend/lib/constants/navigation.ts` — пункт «Стратегии»
2. `frontend/app/(app)/screener/strategies/page.tsx` — route
3. `frontend/components/screener/strategies/strategy-lab-page.tsx` — page
4. `frontend/components/screener/strategies/strategy-chart.tsx` — chart (iter 2)
5. `frontend/lib/screener/strategies/round-level-engine.ts` — engine (iter 3)
6. `PROJECT_CONTEXT.md` — добавить маршрут после iter 1
7. `AI_SESSION_STATE.md` — обновлять после каждой итерации
