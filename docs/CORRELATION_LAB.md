# Матрица связей — correlation lab (черновик)

Маршрут: `/lab/correlation-lab`

---

## Цель

Трейдерская лаборатория для быстрого ответа:

- кто связан с **индексом**;
- кто связан с **рублём**;
- кто связан с **нефтью** и **золотом**;
- кто реагирует на **Америку** (через MOEX);
- кто **оторвался** от обычной связи;
- где есть **тема для брифинга**.

Это не «таблица corr на 500 строк», а **6 факторных карточек** + inspector по выбранному фактору.

---

## Почему по доходностям, а не по ценам

Корреляция **уровней цен** на акциях и индексах часто завышена из‑за общего тренда.

v1 считает **дневные доходности** (log-free: `close[t]/close[t-1] - 1`), затем Pearson:

- corr20 — последние **20** общих дней доходностей;
- corr60 — последние **60** (или весь доступный ряд, если <60);
- **beta** — `cov(r_stock, r_factor) / var(r_factor)` на том же окне;
- **breakScore** — `|corr20 − corr60|` + бонус при смене знака.

---

## Факторы и прокси (MOEX ISS)

| Фактор | Прокси v1 | Смысл |
|--------|-----------|--------|
| Индекс | IMOEX2 / IMOEX history, fallback IMOEX futures | Сильнее/слабее рынка |
| Рубль | активный контракт **Si** | Экспорт/импорт, банки |
| Нефть | фронт **Brent** (BR*) | Нефтегаз, индекс, рубль |
| Золото | фронт **Gold** (GD*) | Золотодобытчики |
| Америка | S&P/Nasdaq futures на MOEX, если есть в ленте | Risk-on/off |
| Сектор | equal-weight корзина сектора (ручные группы TQBR) | Лидер/аутсайдер в секторе |

Если истории нет — карточка показывает **«нужна история свечей»**, без нулей.

---

## Источники

| Источник | Статус v1 |
|----------|-----------|
| MOEX ISS candles / history | **основной** — акции + фьючерсы + индекс |
| MOEX ISS correlations API | **planned** — в публичном ISS отдельного endpoint не найдено; считаем локально |
| CBR / MOEX currency stats | **planned** — справочно для рублёвого контекста |
| Внешние US spot (S&P, Nasdaq) | **planned/manual** — не фейкаем |

---

## Ограничения черновика

- UI v1: ~**42** ликвидные акции (`/api/lab/correlation-lab/overview`).
- API v1: топ **60** акций, period **5 / 20 / 60** д, interval **10 / 60 / 24** (для 20/60д — только дневные).
- Кэш: свечи и overview **120 с** (in-memory, dev/session).
- Перекат фьючерсов меняет прокси.
- **beta / breakScore** — учебные метрики, не сигналы.
- Нет полной матрицы N×N, нет rolling heatmap в UI.

---

## API v1 (`/api/lab/correlation/*`)

| Endpoint | Описание |
|----------|----------|
| `GET /api/lab/correlation/overview` | Summary по факторам index, ruble, oil, gold, us, sector |
| `GET /api/lab/correlation/factor/[factorId]` | Сигналы по одному фактору + topPositive / topNegative / brokenLinks / weakLinks |
| `GET /api/lab/correlation/pair?stock=GAZP&factor=ruble` | Normalized series, rolling corr, stats для графика пары |

Query: `period=5|20|60`, `interval=10|60|24` (при period ≥ 20 interval принудительно 24).

`dataStatus`: `live` | `partial` | `no-history` | `no-proxy` — без подстановки фейковых данных.

---

## Файлы

- UI: `frontend/components/lab/correlation-lab/*`
- Domain: `frontend/lib/domain/correlation-lab.ts`, `correlation-lab-math.ts`, `correlation-api.ts`
- API (legacy UI): `/api/lab/correlation-lab/overview`, `/api/lab/correlation-lab/sources`
- API (v1): `/api/lab/correlation/overview`, `/api/lab/correlation/factor/[factorId]`, `/api/lab/correlation/pair`
- Service: `correlation-lab.ts`, `correlation-api.ts`
- MOEX candles: `frontend/lib/moex/moex-candles.ts`

---

## Следующие шаги (не v1)

- Drill-down: scatter доходностей stock vs factor (real candles only).
- Highlight строки скринера по выбранному фактору.
- Сверка с официальным MOEX correlations API, если появится.
- CBR / external US как optional reference layer.
