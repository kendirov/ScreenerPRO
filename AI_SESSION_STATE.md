# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Матрица связей** — график пары «акция vs фактор» + блок разрыва связи (2026-05-25).

---

## Что сделано (pair chart)

### Компоненты

- `correlation-pair-chart.tsx` — линии акции/фактора (base 100), rolling corr, зоны разрыва, tooltip
- `correlation-pair-stats-panel.tsx` — inspector: режим связи, corr/beta/breakScore, объяснение
- `correlation-pair-break.ts` — детекция зон: разрыв / акция сильнее / не отреагировала; режимы: держится / слабеет / сломалась / нет

### UX

- На графике минимум цифр — точные значения в tooltip при hover
- Зоны разрыва: amber (разрыв), rose (акция сильнее), muted (не отреагировала)
- Подпись «не торговая рекомендация»
- Inspector справа от графика в `CorrelationPairInspector`
- Empty: «История недостаточна»

### Проверка

- `pnpm -C frontend exec next build` — **OK**
- Тест в UI: `/lab/correlation-lab/ruble` → GAZP; `/gold` → PLZL; `/oil` → LKOH

---

## Маршруты (без изменений)

| URL | Назначение |
|-----|------------|
| `/lab/correlation-lab` | Главная, 6 факторов |
| `/lab/correlation-lab/[factorId]` | Деталь фактора + pair inspector |
| `/api/lab/correlation/pair` | Данные для графика |

---

## Файлы

- `frontend/components/lab/correlation-lab/correlation-pair-chart.tsx`
- `frontend/components/lab/correlation-lab/correlation-pair-stats-panel.tsx`
- `frontend/lib/domain/correlation-pair-break.ts`
- `frontend/components/lab/correlation-lab/factor-detail/correlation-pair-inspector.tsx`

---

## TODO (следующий шаг)

1. URL sync period/interval на detail page
2. Highlight строк скринера по фактору
3. Period switcher на главной
4. CBR / external US reference layer

---

## Последний промпт

График пары акция vs фактор, break zones, inspector режим связи, build, AI_SESSION_STATE.
