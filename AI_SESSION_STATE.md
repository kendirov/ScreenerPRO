# AI_SESSION_STATE — Лаборатория рынка

---

## 2026-08-02 — Trading OS shell v1

- Ветка: `codex/trading-os-shell-v1`.
- Baseline: `670eebf` (`origin/feature/stocks-command-center-lab`).
- Контрольная точка до изменений: `checkpoint/trading-os-shell-v1-before-2026-08-02`.
- Worktree: `/Users/kendirov/Documents/Презентации и интерактив/worktrees/ScreenerPRO-trading-os-shell-v1`.

### Что реализовано

- Единый русскоязычный shell из семи разделов: `Сегодня`, `Рынок`, `Лаборатория`, `Новости`, `Студия`, `Знания`, `Управление`.
- Desktop sidebar развёрнут по умолчанию; mobile navigation оставляет три главных действия и меню `Ещё`.
- В верхнюю панель добавлен контекст рынка: `Пульт`, `Акции`, `Фьючерсы`, `Стратегии`.
- Создан `/studio`: безопасный bridge в отдельный Presentation OS через `NEXT_PUBLIC_PRESENTATION_OS_URL`; без настройки показывается честное состояние `не подключено`.
- Неготовые контуры маркированы `черновик`, `мост`, `в разработке`; фальшивые auth, публикации и live-data не добавлялись.
- Существующие URL, Market Radar, Strategy Lab, MOEX ISS и fallback-контракты не менялись.

### Архитектурное решение

- ScreenerPRO — Trading OS shell и рыночный runtime.
- presentation-os — отдельное контентное ядро Studio/Player.
- Интеграция: deep link сейчас, затем versioned release manifest и единая identity boundary.
- Запрещены для текущего этапа: merge репозиториев, iframe, общая cookie-сессия, прямой доступ одного приложения к таблицам другого.
- Основание: `docs/architecture/ADR-001-platform-boundaries.md`.

### Проверки

- Targeted ESLint изменённых TS/TSX: пройден.
- TypeScript `tsc --noEmit`: пройден.
- `verify:navigation-design`: пройден; 7 разделов, 3 mobile primary actions.
- `verify:market-radar`, `verify:situation-engine`, `verify:stocks-command-center`: пройдены.
- Production build: пройден; 65 страниц, включая `/studio`.
- Полный repo lint: не пройден из-за зафиксированного baseline-долга — 73 ошибки и 144 предупреждения; изменённые файлы чистые.
- Browser QA: desktop — 10 ключевых маршрутов без error boundary, console чистая; mobile `390×844` — bottom navigation и меню `Ещё` проверены, console чистая.

### Следующий вертикальный срез

`Relative Activity v1` для 20 ликвидных акций TQBR:

- относительный оборот к тому же времени 10-минутного слота;
- относительное число сделок после накопления достоверного baseline;
- импульс 5/15 минут и положение в диапазоне дня;
- максимум пять бумаг `В игре`;
- объяснимая причина отбора, `observedAt`, источник и число baseline-сессий;
- при недостатке истории — `—`, без выдуманного коэффициента.

Спецификация: `docs/roadmap/TRADING_OS_VERTICAL_SLICES.md`.

---

## 2026-07-21 — Stocks Command Center Lab

- Ветка: `feature/stocks-command-center-lab` от `08ebab0` (Design Foundation + Navigation Shell).
- Новый изолированный маршрут: `/lab/stocks-command-center`; production-скринеры не менялись.
- Один существующий live snapshot, без candle batch-запросов.
- Доступны: цена, изменение дня, high/low, оборот, сделки, IMOEX, baseline где он есть. Нет стакана, ленты, агрессора и universe-wide 5/15/60m истории.
- Проверки: `verify:stocks-command-center`, targeted lint, TypeScript, production build.

---

## Текущая задача

**Strategy Scanner v0 — round-levels small universe** (2026-07-08)

- Цель: первый batch scan `round-levels` по small universe 5–10 тикеров
- `frontend/lib/strategies/strategy-runner-types.ts` ✅
- `frontend/lib/strategies/round-levels-strategy-runner.ts` ✅
- `frontend/scripts/scan-round-levels-strategy.ts` ✅
- JSON snapshot: `frontend/public/strategy-runs/round-levels-stocks-5m-10d.json` ✅
- verify script: `frontend/scripts/verify-strategy-scan-result.ts` ✅
- docs updated: `docs/STRATEGY_SCANNER_ARCHITECTURE.md`, `AI_SESSION_STATE.md` ✅

**Фокус:** `/screener/strategies` only

**Изменённые файлы:**
- `frontend/lib/screener/strategies/strategy-candle-range.ts` (new)
- `frontend/lib/server/services/strategy-candles.ts` (new)
- `frontend/lib/hooks/use-strategy-candles.ts`
- `frontend/lib/screener/strategies/strategy-candles.ts`
- `frontend/app/api/screener/stocks/candles/route.ts`
- `frontend/components/screener/strategies/strategy-lab-page.tsx`
- `frontend/components/strategies/strategy-candlestick-chart.tsx`
- `frontend/scripts/verify-strategy-candle-range.ts` (new)
- `frontend/package.json`
- `docs/STRATEGY_LAB_TARGET.md`
- `docs/ROUND_LEVELS_STRATEGY.md`
- `docs/STRATEGY_SCANNER_ARCHITECTURE.md`
- `frontend/lib/strategies/strategy-runner-types.ts`
- `frontend/lib/strategies/round-levels-strategy-runner.ts`
- `frontend/scripts/scan-round-levels-strategy.ts`
- `frontend/scripts/verify-strategy-scan-result.ts`
- `AI_SESSION_STATE.md`

---

## Фокус продукта

| Маршрут | Роль | Статус |
|---------|------|--------|
| `/screener/strategies` | **Strategy Lab** | v0 demo-ready |
| `/screener/stocks` | Главный рабочий скринер | стабилен |
| `/screener/futures` | Фьючерсы | не трогать |

Документация: `docs/STRATEGY_LAB_TARGET.md`, `docs/ROUND_LEVELS_STRATEGY.md`, `docs/ZIGZAG_LITE_STRATEGY_LAYER.md`, `docs/STRATEGY_SCANNER_ARCHITECTURE.md`

---

## Dev commands

```bash
pnpm -C frontend dev:live
pnpm -C frontend verify:round-levels
pnpm -C frontend verify:round-buffer-direction
pnpm -C frontend verify:zigzag-lite
pnpm -C frontend strategy:scan:round-levels:v0
pnpm -C frontend verify:strategy-scan-result
pnpm -C frontend build
```

**Debug URL:** `/screener/strategies?screenerChartDebug=1`
# 2026-07-21 — Design Foundation + Navigation Shell

- Добавлены semantic design tokens с совместимыми `lab-*` aliases, desktop shell и mobile bottom navigation.
- Создан `/relationships` как честный каталог market/event labs; данные и формулы скринеров не менялись.
- AI Data link controlled by `NEXT_PUBLIC_AI_DATA_AVAILABLE=true`, потому что маршрут пока живёт в отдельной ветке.
