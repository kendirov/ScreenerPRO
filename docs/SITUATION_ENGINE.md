# Situation Engine — ScreenerPRO

Модуль **Situation Engine v0** присваивает каждой акции в скринере машинно-читаемые теги и reason codes для intraday-решений.

**Код:** `frontend/lib/screener/situation-engine.ts`  
**UI:** `frontend/components/screener/stocks/situation-setup-cell.tsx`  
**Интеграция:** `frontend/lib/screener/stocks-radar.ts` → колонка **Setup** в `StocksRadarTable`

Проверка: `pnpm -C frontend verify:situation-engine`

---

## Теги (`SituationTag`)

| Тег | Смысл для трейдера |
|-----|-------------------|
| `volume_ignition` | Оборот/сделки/активность выше нормы к времени сессии |
| `range_expansion` | Широкий дневной диапазон (high–low) |
| `near_high` | Цена у максимума дня |
| `near_low` | Цена у минимума дня |
| `breakout_attempt` | У high + широкий диапазон + рост |
| `active_liquidity` | Достаточный оборот и сделки для исполнения |
| `spread_risk` | Широкий спред (только если `spreadPct` передан в context) |
| `late_move` | Движение/объём во второй половине сессии |
| `leader` | Сильный рост при ненулевой активности |
| `laggard` | Сильное падение при ненулевой активности |
| `quiet` | Нет выраженных сигналов (дефолт) |

`primaryTag` — тег с наивысшим приоритетом для отображения в колонке Setup.

---

## Score (0–100)

Простая взвешенная модель без ML:

| Компонент | Вес | Источник |
|-----------|-----|----------|
| Activity / volume | до 35 | `volumeRatioNow`, `tradesRatioNow`, `activityRatio`, fallback `inPlayScore` |
| Range | до 25 | `metrics.dayRangePct` |
| Liquidity | до 20 | `turnoverPercentile`, `tradesPercentile` |
| Proximity high/low | +12 | `near_high` / `near_low` |
| Spread penalty | −15 | `spread_risk` |
| Multi-tag bonus | +5 | ≥3 активных тега |

Score округляется до целого, clamp 0–100. NaN не допускается.

---

## Поля данных

### Из `ScreenerRow` / `metrics` (основной путь)

- `lastPrice`, `high`, `low`, `open`, `previousClose`
- `percentChange`, `turnover`, `tradesCount`
- `metrics.dayRangePct`
- `metrics.volumeRatioNow`, `metrics.tradesRatioNow` (через `resolveHonest*`)
- `metrics.turnoverVsAverage`, `metrics.tradesVsAverage` (fallback)
- `metrics.activityRatio`, `metrics.inPlayScore`
- `metrics.turnoverPercentile`, `metrics.tradesPercentile`
- `metrics.sessionProgress` (для `late_move`)

### Опциональный `SituationContext`

| Поле | Назначение |
|------|------------|
| `maxTurnover` | Пороги ликвидности universe |
| `spreadPct` | Без поля — тег `spread_risk` **не ставится** |
| `sessionMins` | Минуты MSK; fallback для `late_move` |

---

## Деградации

| Ситуация | Поведение |
|----------|-----------|
| Нет Vol x / Trades x | `volume_ignition` через `inPlayScore` ≥ 72 + ненулевой оборот/сделки |
| Нет `spreadPct` | `spread_risk` и `active_liquidity` по спреду не оцениваются |
| Нет high/low/last | `near_high` / `near_low` / `breakout_attempt` не ставятся |
| Нет выраженных тегов | `quiet` + score ≈ 0 |
| Ошибка данных | Функция не бросает исключений; пустые поля → пропуск правила |

---

## Severity и UI

| Severity | Стиль бейджа |
|----------|--------------|
| `hot` | Cyan accent, лёгкий glow |
| `attention` | Amber |
| `risk` | Muted red |
| `info` | Blue-gray |
| `neutral` | Gray (`quiet`) |

Колонка **Setup**: primary badge + до 2 коротких reason под ним; полный список — в `title` tooltip.

---

## Roadmap

### v1

- Единый selector с Market Radar (`market-radar-layers`)
- Сортировка таблицы по `situation.score`
- Подключение spread из ISS для top-N ликвидных
- Inspector: блок situation reasons

### v2

- Session Memory: diff тегов за 20/40/60 мин
- Раскорреляция с индексом / сектором
- Hysteresis тегов внутри сессии
- Voice/notes привязка к situation code

---

*При изменении порогов обновлять этот файл и `verify-situation-engine.ts`.*
