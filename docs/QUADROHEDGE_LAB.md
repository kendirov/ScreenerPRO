# QUADROHEDGE_LAB — Spread Lab (SI / EU / CN)

Статус: **percentile zones · 7С history · 2026-05-31**  
Маршрут: **`/lab/currency-correlation`**

---

## Defaults (Spread Lab)

| Параметр | Значение |
|----------|----------|
| pair | **SI–EU** |
| unit | **points** |
| timeframe UI | **5m** |
| historyDepth | **7С** (7 торговых сессий) |
| window | **pick** — фильтр по depth, не «Сегодня/Вчера» |

---

## History depth controls

| Кнопка | Смысл | MOEX fetch (cal.d) | Фильтр |
|--------|-------|-------------------|--------|
| **1С** | последняя торговая сессия | 5 | last 1 session |
| **3С** | 3 торговые сессии | 10 | last 3 sessions |
| **7С** | 7 торговых сессий | 14 | last 7 sessions |
| **MAX** | максимум ISS | chunk + pagination | все загруженные |

**Торговая сессия** = уникальная дата (Europe/Moscow) из свечей MOEX, без сб/вс.

Fallback: запрос шире (14 cal.d), затем `applySpreadLabHistoryDepth()` берёт последние N сессий из реальных timestamps.

---

## Загрузка MOEX ISS

### Контракты

**SiM6**, **EuM6**, **CRM6** (SI / EU / CN).

### Интервал

FORTS **не отдаёт native 5m** → запрос **1m** + bucket **5m** на клиенте.

### Pipeline

1. `historyDepth` → `calendarDays` + `historyMode` (`sessions` или `max`).
2. **sessions**: weekly chunks + pagination `start` (500/запрос).
3. **MAX**: до 18 недель, до 80k 1m/нога.
4. Client: bucket 5m → pair align → filter N sessions → spreadPoints.

### Лимиты MOEX

- 500 свечей / HTTP-запрос (`start` pagination).
- Без pagination — только первые 500 строк.

Empty state (7С недоступна):

> История 7С недоступна через текущий MOEX ISS запрос. Получено N свечей. Для стабильной истории нужен local collector.

### API

`GET /api/lab/quad-hedge/intraday?historyDepth=7S&interval=5&windowScope=pick`

### Диагностика

- `historyDepth`, requested range
- trading sessions found
- candles per leg, aligned, missing
- first / last candle, missing legs

### Метрики spread (полная выбранная история)

- currentSpread, maxSpread, minSpread, maxAbsSpread
- percentileCurrent, percentileAbs, p70, p90, p97
- currentZone: `noise | watch | extreme | strong`
- lastExtremeAt, collapseFromExtreme, retestCount
- maxSpreadToday / minSpreadToday, trend, signalState

---

## Percentile zones (spread chart)

Аналитика: `analyzeSpreadPercentiles()` в `spread-percentile-analytics.ts`, интеграция в `enrichSpreadPointsMetric()`.

### Пороги зон

При **≥ 40 точек** (≈3+ торг. дня на 5m) — зоны по перцентилям **|spread|**:

| Зона | Диапазон |
|------|----------|
| **noise** | < p70 |
| **watch** | p70 – p90 |
| **extreme** | p90 – p97 |
| **strong** | ≥ p97 |

При **< 40 точек** — fixed fallback (без притворства, что перцентили надёжны):

| Зона | Диапазон |
|------|----------|
| noise | < 100 п. |
| watch | 100 – 300 п. |
| extreme | 300 – 700 п. |
| strong | ≥ 700 п. |

Линии p97 / 900 п. на графике — дополнительный ориентир «сильного» экстремума.

### UI

- **График**: горизонтальные полосы watch / extreme / strong (BaselineSeries, симметрично ±)
- **Side panel**: NOW, MAX 7С, MIN 7С, P90, P97, зона, percentile abs
- **Метки**: MAX/MIN/NOW + локальные экстремумы
- **Signal strip**: spread · перцентиль · зона · схлопывание · последний экстремум · retest

### Интерпретация (без торговых приказов)

- «Spread в зоне p90 — рабочее расхождение»
- «Spread выше p97 — экстремальная зона»
- «После экстремума идёт схлопывание на X п.»
- «Повторный тест экстремума»

---

## Chart stack (legs + spread)

| Панель | ~% | Содержимое |
|--------|-----|------------|
| **Верх** | 32% | `legA_delta_points`, `legB_delta_points`, zero line |
| **Низ** | 68% | spreadPoints, histogram, percentile zones, MAX/MIN/NOW, local extrema |

**Формулы** (anchor = первая общая точка пары):

```
A_delta = A_close − A_start
B_delta = B_close − B_start
spread  = A_delta − B_delta
```

- Цвета: leg A **cyan**, leg B **amber**, spread по зонам
- Sync: общая time axis, zoom/pan с нижнего графика, crosshair по времени
- Toggle «Движение: показать/скрыть» (default: показать)

Код UI: `spread-lab-chart.tsx` · модель: `buildSpreadLabChartModel()` → `zoneBands`, `legsMovement` · analytics: `spread-percentile-analytics.ts`

---

## Future: local collector

Непрерывный сбор 1m/5m → локальное хранилище для стабильной глубокой истории без лимитов ISS.

Код: `spread-lab-config.ts` → `moex-futures-candles.ts` → `spread-lab-history.ts` → `pair-spread.ts` → `spread-lab-chart-model.ts`.
