# Логика скрининга рынка (Market Screening)

Источник данных: **MOEX ISS** (`/api/screener`). При сбое — stale cache → demo (с явной маркировкой `DEMO ·`).

## Диагностика «0 бумаг»

1. `GET /api/screener?assetClass=stock` — смотреть `diagnostics`:
   - `rowsRaw` / `rowsBeforeFilter` — сколько строк до UI-фильтров
   - `rowsAfterFilter` — после assetClass slice
   - `moexOk`, `fallbackUsed`, `errors`, `fetchMs`
2. `GET /api/screener/health` — `moexFetchStatus`
3. UI полоска: **MOEX ISS · live** / **DEMO · резерв** / **ошибка данных** / **кэш**
4. Фильтр «Скрыть неликвиды» — если `apiRowCount > 0` и таблица пуста, empty-state: «Фильтр скрыл все строки»

## sessionProgress

Функция: `deriveStockActivityMetrics` / `getMoscowTradingSessionProgress`.

- Сессия MOEX: ~10:00–18:45 MSK
- До открытия: `0`, после закрытия: `1`, внутри: `elapsed / fullSession`
- Если время неизвестно: fallback `0.5`

## Нормализация оборота и сделок

```
expectedTurnoverNow = avgDailyTurnover20d × sessionProgressFactor
turnoverRatioNow    = currentTurnover / expectedTurnoverNow

expectedTradesNow   = avgDailyTrades20d × sessionProgressFactor
tradesRatioNow      = currentTrades / expectedTradesNow
```

**Vol x / Trades x** в UI — intraday same-time baseline (`volumeRatioNow`, `tradesRatioNow`), не полный день / 20d.

Если 20d baseline нет (production/Vercel без SQLite):
- `baselineStatus: skipped`
- cross-section percentiles: `turnoverPercentile`, `tradesPercentile`, `rangePercentile`
- `intradayBaselineKind`: rough / previous-day / none

## inPlayScore (сервер)

Слой: `enrichMoexStocksWithInPlayMetrics` + `computeInPlaySignals`.

Компоненты:
- **ликвидность** — перцентили оборота/сделок, spread proxy
- **активность** — `turnoverRatioNow`, `tradesRatioNow` (clamped)
- **движение** — `dayRangePct`, `|changePct|`, market-adjusted move
- **локация** — близость к high/low дня
- **штрафы** — тонкая лента, широкий spread, stale

Жёсткий **IN_PLAY** tag — отдельные пороги в `in-play-signals.ts` (см. `docs/MARKET_RADAR_FORMULAS.md`).

## Классификация на клиенте (`classifyStockTradingState`)

| Состояние | Смысл |
|-----------|--------|
| **in_play** | `isStockInPlay` — деньги + сделки + движение + нормальный spread |
| **momentum** | импульс по %/range с подтверждением |
| **near_high / near_low** | цена у экстремума дня + не мусорная ликвидность |
| **liquid** | оборот и сделки без обязательного движения |
| **active** | высокий score / vol x / trades x |
| **dangerous** | движение есть, условия торговли плохие |
| **dead** | нет оборота и сделок |

**Волатильные ≠ Опасные**: волатильная бумага может быть ликвидной; опасная — большой ход при плохом spread/ленте.

## Пресеты акций (`/screener/stocks?preset=`)

В игре · Для скальпа · Топ оборота · Импульс · У high · У low · Объём выше нормы · Волатильные · Опасные

Сортировка: `screener-presets.ts` — score / turnover / trades / range / change.

## Теги строк (`buildTradingTags`)

Приоритет: risk → in-play → volume → location → liquidity. Максимум 4–5 в строке.

## Live / fallback / demo

| Режим | `status.source` | UI |
|-------|-----------------|-----|
| MOEX OK | `moex` | LIVE · MOEX ISS |
| Stale cache | `moex` + `staleCache` | кэш MOEX |
| Demo | `demo` + `isDemo` | DEMO · резерв |
| Пустой 503 | `moex` + `fallbackReason` | ошибка данных |

## Фьючерсы

Отдельные пресеты и группы: валюта / индекс / сырьё / металлы / в игре / топ оборота / импульс / осторожно.

Контракт: `expiryDate`, `openInterest`; статус main/near/far — по обороту и сроку, без выдуманных полей.
