# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Связка `/lab/weekly-inflation` ↔ `/lab/preparation`** — общий storage, карточка, порядок эфира, Telegram.

---

## Что сделано (2026-05-25, preparation link)

### Shared storage

- `lib/domain/weekly-inflation-storage.ts`
  - `loadWeeklyInflationPoints()` / `saveWeeklyInflationPoints()` — localStorage + event `weekly-inflation-updated`
  - `getWeeklyInflationDashboard()` / `getLatestInflationBrief()`
  - `WeeklyInflationBrief`: headline, 4w avg, annualized 4w, режим, `airOrderLine`, `telegramLine`

### `/lab/preparation`

- Карточка **«Недельная инфляция»**: последняя неделя · 4w avg · annualized 4w · режим · «Открыть лабораторию»
- Empty: **«данные не загружены»**
- **Порядок эфира**: строка «Инфляция / ставка» после «Контекст»
- **Telegram summary**: строка инфляции, если данные есть
- Hook `useWeeklyInflationBrief()` — sync между вкладками и после сохранения в lab

### Прочее

- `weekly-inflation-page.tsx` — save/load через storage helper
- `buildTelegramSummary()` — опциональный `inflationTelegramLine`

---

## Маршруты — статус

| Маршрут | Статус |
|---------|--------|
| `/lab/weekly-inflation` | 🟢 ввод → localStorage → event |
| `/lab/preparation` | 🟢 видит brief, порядок эфира, Telegram |

---

## Проверка сборки

- `pnpm -C frontend exec next build` — **OK** (2026-05-25)

---

## TODO (осталось)

- Стабильный API Росстат/ЕМИСС
- Promotion в `/materials`

---

## Последний промпт

Связать weekly-inflation с preparation: storage helper, карточка, порядок эфира, Telegram.
