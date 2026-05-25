# EVENT_REACTION_LAB — Реакция на новости

Маршрут: **`/lab/event-reactions`**

Статус: **черновик · LOCAL · SQLite · EVENT STUDY (2026-05-25)**

---

## Что это

**Event Reaction Lab** — local-first система для изучения реакции рынка MOEX на новости.

Не лента СМИ и не AI-бот. Это **локальная база знаний**: вы вносите новость → система разбирает событие → привязывает тикеры → (позже) считает реакцию по временным окнам → сохраняет выводы для брифинга и будущих агентов.

---

## Какие задачи решает

| Задача | v1 | Этап 2+ |
|--------|----|---------|
| Сохранить новость локально | ✅ ручной ввод | автоимпорт MarketTwits / MOEX |
| Понять тип события | ✅ rule-based stub | AI parser + structured JSON |
| Найти затронутые тикеры | ✅ паттерны в тексте | NER + справочник MOEX |
| Запланированная / внезапная | ✅ эвристики | календарь + surprise score |
| Реакция до/после новости | заготовки `no_data` | минутные свечи MOEX ISS |
| Секундные окна (+5с, +30с) | `planned_tick_data` | QUIK / брокерский tick-stream |
| Похожие исторические кейсы | — | embeddings + reaction DB |
| Связь с брифингом | — | `/lab/preparation` + агенты |

---

## Какие данные собираем

### Источники (`NewsSource`)

Реестр источников: MarketTwits, Smart-Lab, MOEX, ручной ввод и др. Поля: тип, URL, статус, уровень доверия.

### Сырые новости (`RawNewsItem`)

Текст, ссылка, время публикации, hash для дедупликации, статус пайплайна.

### События (`MarketEvent`)

Структурированное событие: тип, важность, surprise, scheduled flag, parsed JSON.

### Связи с инструментами (`EventInstrumentLink`)

Тикер, рынок, тип связи, ожидаемое направление, confidence.

### Реакции (`EventReaction`)

Метрики по каждому окну: Δ%, high/low, оборот vs норма, reaction score.

### Находки (`EventReactionFinding`)

Человекочитаемые выводы: сильная реакция, нет реакции, leak, уже в цене и т.д.

---

## Пайплайн

```
raw news
  → parsed event        (parse-news: rule-based stub / позже AI)
  → linked instruments  (тикеры + macro proxies)
  → market data         (этап 2: intraday candles)
  → reaction windows    (pre/post окна)
  → findings            (интерпретация + severity)
```

### API (local dev)

| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/api/lab/event-reactions/sources` | GET | Список источников |
| `/api/lab/event-reactions/news` | GET | Последние RawNewsItem |
| `/api/lab/event-reactions/manual-news` | POST | Ручной ввод новости |
| `/api/lab/event-reactions/events` | GET | Последние MarketEvent |
| `/api/lab/event-reactions/parse-news` | POST | Rule-based разбор |
| `/api/lab/event-reactions/analyze` | POST | Заготовка окон реакции |
| `/api/lab/event-reactions/findings` | GET | EventReactionFinding |

---

## Окна реакции

Определены в `frontend/lib/event-reactions/reaction-windows.ts`.

### До новости (pre)

| Ключ | Смысл |
|------|-------|
| `pre_15m` | Движение за 15 мин до публикации |
| `pre_5m` | Движение за 5 мин до публикации |

### После новости (post) — честно на 1m свечах

| Ключ | Смысл |
|------|-------|
| `plus_1m` | +1 минута |
| `plus_2m` | +2 минуты |
| `plus_5m` | +5 минут |
| `plus_15m` | +15 минут |
| `plus_30m` | +30 минут |
| `plus_40m` | +40 минут |
| `plus_1d` | +1 торговый день |
| `plus_3d` | +3 торговых дня |

### Planned — нужны тики

| Ключ | Статус |
|------|--------|
| `planned_plus_5s` | `planned_tick_data` |
| `planned_plus_30s` | `planned_tick_data` |

**Почему 5 и 30 секунд только planned:** минутная свеча MOEX ISS не различает реакцию в первые секунды. Без tick-data / QUIK / брокерского потока любые цифры были бы выдумкой — мы их не показываем.

**Что считается честно на минутных свечах:** окна ≥ 1 мин (`plus_1m` … `plus_40m`, `pre_5m`, `pre_15m`) — после подключения intraday ingest. Дневные окна (`plus_1d`, `plus_3d`) — из `DailyBar` после ingest.

---

## Parser v1 vs AI (planned)

**Сейчас:** `event-parser-stub.ts` — rule-based без OpenAI:

- «дивиденд» → `dividend`
- «отчёт» / «МСФО» / «РСБУ» → `earnings`
- «ЦБ» / «ставка» → `rate`
- «санкц» → `sanction`
- «нефть» / «Brent» → `oil`
- «газ» → `gas`
- «рубль» / «доллар» / «юань» → `currency`
- тикеры по паттернам `SBER`, `(GAZP)` и known list

**Позже:** AI parser с structured JSON (OpenAI / local LLM), confidence, multi-ticker NER, sector mapping.

---

## Prisma / SQLite

- Schema: `frontend/prisma/schema.prisma`
- Provider: **SQLite** (`DATABASE_URL=file:./prisma/dev.db`)
- Модели Event Reaction Lab добавлены **без удаления** существующих (`Instrument`, `DailyBar`, …)

### Применение схемы (локально)

```bash
pnpm -C frontend prisma:push
pnpm -C frontend prisma:generate
```

Проект использует `prisma db push`, не migration history. **Не делать** `prisma migrate reset` — уничтожит dev.db.

### Риски

| Риск | Митигация |
|------|-----------|
| SQLite lock при параллельных запросах | локальный dev — OK; prod нужна внешняя БД |
| Vercel + file SQLite | Event Reaction Lab — **local-first**; prod API вернёт empty без DATABASE_URL |
| Дубли parse-news | v1 допускает повторный разбор; этап 2 — unique constraint на event per news |
| Нет intraday bars | analyze честно ставит `dataStatus: no_data` |

---

## Связь с агентами и брифингом

| Компонент | Связь |
|-----------|-------|
| `/lab/preparation` | События из Event Reaction Lab → блок «Ближайшие события» и фокус брифинга |
| Local agents (planned) | `EventReactionFinding` + история реакций → training corpus |
| Скринер | in-play + reaction score → «аномалия после новости» |
| `/materials` | promotion из sidebar «Черновики» после стабилизации |

Документы агентов (если появятся): `docs/LOCAL_AGENTS_ARCHITECTURE.md`, `docs/LOCAL_AGENTS_IMPLEMENTATION_PLAN.md`.

---

## Empty states (честность)

- «Пока нет рыночных данных для расчёта реакции»
- «Добавьте новость и укажите тикеры явно в тексте»
- «Для секундных окон нужен источник тиков»
- Нет фейковых графиков и процентов

---

## Файлы

| Путь | Назначение |
|------|------------|
| `frontend/lib/event-reactions/reaction-types.ts` | TypeScript типы |
| `frontend/lib/event-reactions/reaction-windows.ts` | Окна и offsets |
| `frontend/lib/event-reactions/event-parser-stub.ts` | Rule-based parser |
| `frontend/lib/server/services/event-reactions.ts` | DB + business logic |
| `frontend/components/lab/event-reactions/event-reactions-page.tsx` | UI |
| `frontend/app/(app)/lab/event-reactions/page.tsx` | Route |
| `frontend/app/api/lab/event-reactions/*` | API handlers |

---

## Этап 2 (backlog)

1. Intraday candle ingest (MOEX ISS 1m) для `plus_*` и `pre_*` окон
2. Расчёт `priceChangePct`, `turnoverVsNormal`, `reactionScore`
3. Finding engine: сильная реакция / нет реакции / leak / priced-in
4. AI parser (structured JSON)
5. Исторический поиск похожих событий
6. Tick-data adapter (QUIK / broker) для `planned_plus_5s` / `planned_plus_30s`
7. Интеграция с `/lab/preparation` и local agents
