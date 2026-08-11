# AI_SESSION_STATE — Лаборатория рынка

---

## Текущая задача

**Bitget Global Screener — Terminal v3 + Market Map** (2026-08-11)

Цель: превратить Bitget-срез в профессиональный briefing terminal внутри ScreenerPRO: один scroll, быстрый отбор, понятные классы рынка, inline-анализ инструмента и отдельная карта механики Bitget.

Ветка: `feature/bitget-global-screener-v1`.

Реализовано:

- `frontend/lib/bitget/types.ts` — контракт public universe;
- `frontend/lib/server/services/bitget-market.ts` — Bitget UTA v3 adapter;
- `frontend/app/api/bitget/screener/route.ts` — bulk market endpoint;
- `frontend/app/api/bitget/weekly/route.ts` — ленивый cached 7d слой по дневным свечам;
- `frontend/components/bitget/tradingview-chart.tsx` — TradingView Advanced Chart embed;
- `frontend/components/bitget/bitget-terminal-v3.tsx` — основной рабочий терминал;
- `frontend/components/bitget/bitget-market-map.tsx` — интерактивная карта рынков;
- `/screener/bitget` — terminal;
- `/screener/bitget/map` — market map;
- Bitget добавлен в основную навигацию.

Terminal v3:

- один вертикальный scroll страницы, без собственного вертикального scroll таблицы;
- блоки `Сильнее всего / Слабее всего / Самый большой оборот / Funding экстремум`;
- фильтры по классам рынка и рыночному состоянию;
- цена, 24ч, реальный 7d по свечам, ход 24ч, оборот, spread, funding, focus;
- null funding при сортировке всегда остаётся ниже реальных значений;
- spread на поверхности в %, точные б.п. в деталях;
- rToken: badge `R` + привычный underlying ticker;
- клик по тикеру копирует код для TradingView;
- клик по строке раскрывает inline workspace с TradingView, параметрами, watchlist и заметкой;
- favorites/notes сохраняются локально в браузере;
- `Открыть TradingView` ведёт в полный внешний workspace;
- `Копировать контекст` создаёт структурированный блок для дальнейшего анализа/брифинга.

Market Map объясняет отдельными секциями Spot, Margin, Futures, rToken, Stock Perps, Stock+, Options, Commodity Perps и TradFi. Отдельные API-контуры не маскируются под live-данные текущего UTA endpoint.

Vercel build isolation:

- карта без terminal v3 — SUCCESS;
- terminal v3 без карты — SUCCESS;
- текущий feature head после очистки промежуточных файлов должен проходить финальный Preview build перед показом владельцу.

Секреты Bitget в код/браузер не передаются. Торговых POST-запросов нет.

---

## Что нельзя сломать

| Маршрут | Статус |
|---------|--------|
| `/screener` | стабилен |
| `/screener/stocks` | стабилен |
| `/screener/futures` | стабилен |
| `/screener/strategies` | Strategy Scanner v0 demo-ready |
| `/screener/bitget` | Bitget Terminal v3 |
| `/screener/bitget/map` | Bitget Market Map |

---

## Следующий лучший срез Bitget

1. Проверить новый Preview визуально вместе с владельцем.
2. Улучшить Market Map после UX-ревью: live counts/top instruments и переходы в фильтр скринера.
3. Создать signed Stock+ adapter: полный equities/ETF universe.
4. Создать options adapter: underlying → expiry → strike → call/put.
5. Добавить historical feature cache для RSI14, ATR, relative activity и multi-timeframe momentum.
6. Связать выбранный инструмент с news/event-reaction pipeline: «что случилось → когда → реакция цены».
7. Добавить облачный user workspace (auth/Supabase) для watchlist, notes, layouts и briefing history.
8. Private Classic v2 account analytics держать отдельной поверхностью от public market adapter.

---

## Dev commands

```bash
pnpm -C frontend dev:live
pnpm -C frontend build
```

**Bitget terminal:** `/screener/bitget`

**Bitget market map:** `/screener/bitget/map`

**Strategy debug:** `/screener/strategies?screenerChartDebug=1`
