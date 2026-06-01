# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Spread Lab — percentile zones на spread-графике (7С)** — завершён (2026-05-31).

---

## Что сделано

### Percentile analytics (`spread-percentile-analytics.ts`)

Метрики по `spreadPoints` за выбранную глубину истории:

- currentSpread, maxSpread, minSpread, maxAbsSpread
- percentileCurrent, percentileAbs, p70, p90, p97
- currentZone: `noise | watch | extreme | strong`
- lastExtremeAt, collapseFromExtreme, retestCount

**Зоны** (по |spread|):

| Зона | Перцентиль (≥40 точек) | Fixed fallback |
|------|------------------------|----------------|
| noise | < p70 | < 100 п. |
| watch | p70–p90 | 100–300 п. |
| extreme | p90–p97 | 300–700 п. |
| strong | ≥ p97 | ≥ 700 п. |

Минимум для надёжных перцентилей: **40 точек** (`SPREAD_PERCENTILE_MIN_POINTS`).

### UI

- **График**: мягкие горизонтальные полосы зон (BaselineSeries, ±симметрично)
- **Side panel**: NOW, MAX 7С, MIN 7С, P90, P97, зона, percentile abs
- **Метки**: MAX/MIN/NOW + локальные экстремумы (▲/▼)
- **Signal strip**: spread, перцентиль, зона, схлопывание, последний экстремум, retest

### Интерпретация

- «Spread в зоне p90 — рабочее расхождение»
- «Spread выше p97 — экстремальная зона»
- «После экстремума идёт схлопывание на X п.»
- «Повторный тест экстремума»
- При <40 точек: честный fallback на fixed 100/300/700/900

---

## Файлы

`spread-percentile-analytics.ts`, `spread-points.ts`, `spread-lab-chart-model.ts`, `spread-lab-chart.tsx`, `quad-hedge-spread-strip.tsx`, `point-thresholds.ts`, `types.ts`, `index.ts`, `docs/QUADROHEDGE_LAB.md`

---

## Build

`pnpm -C frontend exec next build` — **OK** (2026-05-31)

---

## Следующий шаг

Hover event tape → маркеры; local collector для глубокой истории.
