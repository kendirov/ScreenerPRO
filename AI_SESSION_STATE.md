# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Market Radar dev debug** — завершён (2026-06-06).

---

## sessionContext

Файл: `frontend/lib/domain/market-radar-session.ts`

- `turnoverRef` = median(top-3 оборот)
- `tradesRef` = median(top-5 сделок)
- `sessionIntensity` = 0.6×turnoverIntensity + 0.4×tradesIntensity (same-time baseline по рынку)
- Режимы: **quiet** / **soft** / **normal** / **hot** → `minTurnover` / `minTrades`
- На строку: `leaderPresenceScore`, `relativeTurnover`, `relativeTrades`

Snapshot: `buildRadarBoard(universe, candidates)` — один `rankCtx` на все колонки.

---

## Правила отбора (v4)

### В игре (`isInGame`)

- `inGameScore ≥ 0.75` (45% leader + 35% movement + 20% baseline)
- `leaderPresenceScore ≥ 0.60`
- `movementScore ≥ 0.55`
- `turnover ≥ session.minTurnover`, `trades ≥ session.minTrades`
- **0 строк — норма**, не добиваем

### Актив (`isActive`)

- не in-game, не тонкая (< 10M ₽ или < 300 сделок)
- `activityScore ≥ 0.58`
- `movementScore ≥ 0.30`, `leaderPresence ≥ 0.25`
- `turnover ≥ minTurnover×0.5`, `trades ≥ minTrades×0.5`
- Список: in-game → active, max **8**

### Волатильность (`isVolatile`)

- gate: range ≥ 1.5% / |Δ| ≥ 1.2% / near high-low / пробой
- top **6** по `volatilityScore`
- тонкие: тег **тонко**, не в активность только из-за диапазона

### Ликвидность

- top **5** по rank-based `liquidityScore`

---

## UI радара (компактно, ~260px)

| Блок | Строка |
|------|--------|
| **ЛИКВИДНОСТЬ** | тикер · % · оборот · сделки · `деньги` |
| **АКТИВНОСТЬ** | тикер · [бейдж `в игре`] · % · оборот x/оборот · сделки x/сделки · reason |
| **ВОЛАТИЛЬНОСТЬ** | тикер · % · оборот · диапазон · reason |

**Reason активность:** `лидер + диапазон` · `объём + сделки` · `сделки + ход` · `актив` · `нет базы`

**Reason волатильность:** `диапазон` · `у high` · `у low` · `пробой high/low` · `тонко`

Без ratio → обычные числа, без фейкового x. Пустой блок → `—`.

Запрещено в UI: VOL, TRD, LIQ, GAME, ОБ·X, ДИАП.

Файлы: `radar-ui-labels.ts`, `market-radar-selectors.ts` (`resolveRadarActivityTag`, `resolveRadarVolatilityTag`), `radar-mini-row.tsx`, `market-radar.tsx`.

---

## Dev-диагностика Market Radar

**Только development** — не видна обычному пользователю, production API → 404.

| Способ | Как |
|--------|-----|
| console.table | `/screener/stocks?debugRadar=1` — DevTools, группа `[Market Radar] debug` |
| JSON | `/sandbox` — блок «Market Radar debug» |
| API | `GET /api/dev/market-radar-debug` (dev only) |

Файл: `frontend/lib/domain/market-radar-debug.ts` — top-30 по обороту, все scores + `isInGame` / `isActive` / `isVolatile` + `listed*` (фактически в списках UI) + `radarTag` / `radarReason`.

Сравнение SMLT vs SBER: смотреть `leaderPresenceScore`, `movementScore`, `inGameScore`, gates `session.minTurnover/minTrades`.

---

## Build / verify

```bash
pnpm -C frontend exec next build
pnpm -C frontend verify:market-radar
pnpm -C frontend verify:market-radar-session
```

---

## Browser checklist (`/screener/stocks`)

1. **ЛИКВИДНОСТЬ** — Сбер с тегом `деньги`; flat день не обязан быть в активности.
2. **АКТИВНОСТЬ** — in-game: бейдж + reason; SMLT/ASTR при лидерстве: `лидер + диапазон` или x-слоты; без базы: `—` + `нет базы`.
3. **ВОЛАТИЛЬНОСТЬ** — тонкие с большим %: `тонко`, не в активности.
4. In-game **0** — без текста «в игре» в пустой колонке.
5. Радар ~260px sticky, таблица сразу под ним.
