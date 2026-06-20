# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Ставка ЦБ / event replay** — lab-страница отполирована под терминал трейдера (2026-06-18).

---

## CBR Rate Reaction Lab

**Маршрут:** `/lab/cbr-rate-reaction`  
**API:** `GET /api/cbr-rate-reaction/candles` (MOEX ISS + fallback mock)

### Что видит пользователь (15-секундное чтение)

| Зона | Содержание |
|------|------------|
| **Селектор заседаний** | вкладки 2026–2023, карточки с датой / ставкой / бейдж «нужно проверить» |
| **Sticky replay header** | `REPLAY · дата` · до / ожид. / факт · surprise · маркеры 13:30 (+15:00) · provenance |
| **Графики** (выше матрицы) | 6 слотов, синхронный crosshair, маркеры 13:30 всегда, 15:00 только при `pressConferenceTime` |
| **4 строки summary** | Факт · Реакция · Подтверждение · Следующий раз |
| **Матрица реакции** | Si / CNY / MX / SBER / active — 5м / 30м / 15:00+ / день / объём / паттерн |
| **Accordion (свернуто)** | Текст ЦБ → перевод · Инструменты в игре · Методика и источники |

**Upcoming (2026-06-19):** placeholder вместо графиков, summary с текстом «заседание не состоялось».  
**History:** графики + матрица; demo-режим явно помечен (`demo · не торговые данные`, бейдж DEMO на каждом чарте).

### Что упростили (финальная полировка)

- Убраны дубли: факт/ожидание не повторяются в accordion «Официальный релиз»
- Убран `CbrExpectationVsFactPanel` с главного экрана — ожидание в header + строка «Следующий раз»
- Селектор перенесён наверх — дата управляет всей страницей (`key={event.id}` на графиках)
- Header: терминальный `REPLAY · дата` вместо новостного заголовка
- Demo: штриховка панели графиков + баннер + бейдж DEMO на каждом слоте
- Матрица под графиками с подписью «матрица реакции»

### Источник дат и ставок ЦБ

**Канонический каталог:** `frontend/data/cbr-rate-events.json` (по годам 2026–2023)  
**Загрузчик:** `frontend/lib/cbr/cbr-rate-events-db.ts` → `CbrRateEvent`  
**Legacy-адаптер UI:** `frontend/lib/cbr/cbr-domain-adapter.ts` → domain `CbrRateEvent`

`sourceStatus` в JSON:
- `verified` — 2026 факты (апр–фев)
- `needs_verification` — 2025/2024/2023 (ручной перенос)
- `upcoming` — 2026-06-19

`_meta.todos` в JSON:
1. импорт официальной истории ставок ЦБ
2. ручная верификация дат заседаний
3. ожидания рынка из брокерских обзоров
4. автоподбор ближайших фьючерсов по дате заседания

### Данные mock / manual (честно)

| Слой | Статус |
|------|--------|
| Ставки 2025/2024/2023 | `needs_verification` — сверить с cbr.ru |
| `expectedRate` | всегда `null` без источника |
| Инструменты replay | `dataStatus: demo` в `cbr-instruments.ts` |
| Свечи | MOEX ISS если есть, иначе `cbr-rate-mock-candles.ts` |
| Игроки «в игре» | mock snapshot в `cbr-rate-event-players.ts` |
| Statement / tone | manual в domain, не парсер ЦБ |

### Компоненты (актуальные)

`frontend/components/lab/cbr-rate-reaction/`:
- `cbr-rate-reaction-page.tsx` — shell
- `cbr-rate-event-selector.tsx` — выбор заседания
- `cbr-rate-replay-header.tsx` — sticky replay bar
- `cbr-synchronized-chart-grid.tsx` + `cbr-reaction-intraday-chart.tsx`
- `cbr-rate-reaction-summary.tsx` — 4 строки трейдерского чтения
- `cbr-compact-reaction-matrix.tsx`
- `cbr-replay-accordion.tsx`, `cbr-statement-translation-panel.tsx`
- `cbr-rate-event-players-compact.tsx`, `cbr-data-integrity-strip.tsx`
- `cbr-rate-upcoming-placeholder.tsx`

`frontend/lib/cbr/`:
- `cbr-rate-events.ts`, `cbr-rate-events-db.ts`, `cbr-data-integrity.ts`
- `cbr-rate-event-selector.ts`, `cbr-instruments.ts`, `index.ts`

### Что проверить вручную

1. `/lab/cbr-rate-reaction` — выбор 24 апр 2026: дата в header, графики выше матрицы, 4 строки summary
2. Маркер 13:30 на всех графиках; 15:00 — только на заседаниях с `pressConferenceTime`
3. Demo-режим: баннер + DEMO на чартах, не выглядит как live MOEX
4. 2025/2024 карточки — бейдж «нужно проверить»
5. 2026-06-19 upcoming — без графиков, summary «не состоялось»
6. Переключение года/даты — вся страница (header, графики, матрица) синхронна
7. Accordion — только детали, не дублирует главный экран

### Следующий этап подключения

1. **Импорт cbr.ru** → заполнить JSON, снять `needs_verification`
2. **MOEX candles** — стабильный live на исторических датах
3. **Rolling futures resolver** — Si/CNY/MX по дате заседания
4. **Broker consensus** → `expectedRate` + surprise
5. **Парсер пресс-релиза** → statement / tone автоматически

### Навигация

- Sidebar **«Черновики»** → **«Ставка ЦБ»**
- `/materials` → карточка «Ставка ЦБ»

---

## Market Radar

См. `docs/MARKET_RADAR_FORMULAS.md`, `market-radar-session.ts`, dev debug: `/screener/stocks?debugRadar=1`, `/sandbox`.

---

## Build / verify (2026-06-18)

```bash
pnpm -C frontend build                    # ✓ exit 0
pnpm -C frontend eslint "components/lab/cbr-rate-reaction/**" "lib/cbr/**" "lib/domain/cbr-rate*.ts"
# 2 react-hooks/set-state-in-effect warnings в chart-grid — build не блокирует
```

**Browser:** `/lab/cbr-rate-reaction`
