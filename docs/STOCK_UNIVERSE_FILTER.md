# Stock Universe Filter — `/screener/stocks`

**ScreenerPRO · stock-only universe**  
**Дата:** 2026-07-06  
**Код:** `frontend/lib/screener/stock-universe-filter.ts`

---

## Проблема

Эндпоинт MOEX ISS для TQBR возвращает **все** инструменты режима TQBR, не только акции:

| Категория | MOEX `SECTYPE` | Пример | Кол-во (2026-07-06) |
|-----------|----------------|--------|---------------------|
| Обычные акции | `1` | SBER, VTBR | ~214 |
| Привилегированные | `2` | SBERP, TRNFP | ~48 |
| ETF | `J` | AKAI, LQDT | ~109 |
| ПИФ / БПИФ | `9`, `A` | RU000…, XQUANT | ~62 |
| Облигации / паи | `B` | RU000A0JPZL7 | ~62 |
| GDR | `D` | OKEY-гдр | 1 |

`/api/screener?assetClass=stock` помечает **все** строки TQBR как `assetClass: "stock"`. Без фильтра в UI попадают ETF, фонды, RU000… и прочее.

---

## Что считаем акциями (INCLUDE)

- Обычные акции (`SECTYPE=1` или ticker-like + торговые данные)
- Привилегированные акции (`SECTYPE=2` или суффиксы `P`, `PR`, `RP`, `RX`, `DR`, `SP`)
- Board TQBR / equity share boards (`TQBR`, `EQBR`, `SMAL`)
- Ticker-like SECID: `SBER`, `TRNFP`, `SBERP` — **не** исключаем preferred только из-за `P` в конце

### Проверочные тикеры (must pass)

| Ticker | Категория |
|--------|-----------|
| SBER | stock |
| VTBR, IRAO, SIBN | stock |
| SBERP, TRNFP | preferred_stock |
| X5 | stock (реальная акция, не путать с фондами `X*`) |

---

## Что исключаем (EXCLUDE)

| Категория | Сигналы |
|-----------|---------|
| ETF | `SECTYPE=J`, `ETF` в названии |
| Фонды / БПИФ / ПИФ | `SECTYPE=9/A`, слова фонд/ПИФ/БПИФ/ЗПИФ |
| Облигации | `SECTYPE=B`, RU000…, SU… (ОФЗ), bond-like name |
| GDR | `SECTYPE=D`, `-гдр` / GDR в названии |
| Currency / futures / index | board CETS, FORTS, INDEX |
| Без данных | нет цены и нулевой оборот/сделки |
| RU000A101NK4 | exclude, если нет явных share-метаданных |

---

## Почему preferred shares остаются

MOEX кодирует привилегированные акции как `SECTYPE=2` или ticker с суффиксом `P`/`PR`/…  
Фильтр **не** использует правило «SECID заканчивается на P → exclude».  
`TRNFP`, `SBERP`, `SNGSP` — валидные preferred.

---

## Поля данных

### Сейчас в `ScreenerRow` (после нормализации API)

| Поле | Источник MOEX | Использование |
|------|---------------|---------------|
| `ticker` | SECID | форма тикера, dedup |
| `shortName` | SHORTNAME | ETF/фонд/облигация по имени |
| `assetClass` | hardcoded `"stock"` | отсекает futures |
| `moexSecType` | SECTYPE *(new, optional)* | главный типовой сигнал |
| `lastPrice`, `turnover`, `tradesCount` | marketdata | trading data gate |
| `lotSize` | LOTSIZE | справочно |

### Доступно в raw MOEX ISS (TQBR securities)

`SECID`, `SHORTNAME`, `BOARDID`, `LOTSIZE`, `STATUS`, `SECTYPE`, `GROUP` (пусто), `TYPE` (часто null)

Не прокидывается в `ScreenerRow` сегодня: `boardid` (всегда TQBR на этом endpoint), `engine`, `market`, `instrid`, `primary_boardid`, `is_traded`.

---

## Где применяется фильтр

**Единая точка:** `buildStockScreenerUniverse(apiRows)` в `stocks-screener-page.tsx` — один проход после `useScreenerQuery("stock")`.

```typescript
const screenerUniverse = buildStockScreenerUniverse(apiRows);
const stockRows = screenerUniverse.stockRows;
```

| Компонент / слой | Источник данных | Статус |
|------------------|-----------------|--------|
| **Таблица** `StocksRadarTable` | `stockRows` → `buildStocksRadarModel(..., { universePreFiltered: true })` | ✓ |
| **Command Bar** In Play / Liquidity / Volatility | `stockRows` → `computeMarketPriority` | ✓ |
| **Quick filters** | buckets из `marketPriority` на `stockRows` | ✓ |
| **Колонка Setup** | `situation-engine` внутри `buildStocksRadarModel` на `stockRows` | ✓ |
| **Index strip / breadth** | `radarModel.marketSummary` на `stockRows` | ✓ |
| **API** `moex-screener.ts` | enrich `moexSecType`; exclude на API — не делаем (фильтр на странице) | partial |

Повторный вызов `filterValidStockUniverse` в `buildStocksRadarModel` **отключён** (`universePreFiltered: true`).

### Diagnostics (dev / `?debugPriority=1`)

Тонкая строка над Command Bar:

```
stock universe: raw 496 → stocks 262 → excluded 234
```

- **dev** (`NODE_ENV !== "production"`) — всегда
- **production** — только с `?debugPriority=1` на `/screener/stocks`

Без query param в production строка скрыта. Fallback на raw rows **не** используется.

---

## Dev / QA

```bash
pnpm -C frontend verify:stock-universe   # unit cases
pnpm -C frontend audit:stock-universe    # live API audit JSON
```

Dev panel (`ScreenerDevDebugPanel` на `/screener/stocks`): `api rawRows` vs `stockOnlyUniverse`, excluded ETF/fund counts. Без `console.log` в production.

---

## Known limitations

1. **Fallback/demo rows** — без `moexSecType` классификация по имени + форме SECID.
2. **Исторические снимки** — если history API не отдаёт SECTYPE, фильтр деградирует на heuristics.
3. **X5** — единственный «настоящий» тикер на `X*` в TQBR; нельзя blind-exclude все `X*`.
4. **Другие boards** (SMAL, TQTF) — не в текущем ISS endpoint; отдельный проход при расширении universe.

---

## Цепочка данных (аудит)

```
/screener/stocks/page.tsx
  → StocksScreenerPage
  → useScreenerQuery("stock")
  → GET /api/screener?assetClass=stock
  → buildStockScreenerUniverse(apiRows) → stockRows (single filter)
  → buildStocksRadarModel(stockRows) → таблица + situation
  → computeMarketPriority(stockRows) → command bar
```

---

*При изменении правил обновлять этот файл, `verify-stock-universe-filter.ts` и `AI_SESSION_STATE.md`.*
