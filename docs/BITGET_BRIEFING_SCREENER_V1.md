# Bitget Briefing Screener v1

Статус: feature branch `codex/bitget-briefing-screener-v1-2026-08-13`, draft PR.

## Решение

`/screener/bitget` остаётся одним продуктом и одним command center. Существующий Bitget Terminal V3 не дублируется и не заменяется вторым скринером: сверху добавлен Briefing слой, ниже остаются карта, радар, полный universe и inspector.

Цель первого среза — отвечать на три вопроса:

1. Что сейчас заметно?
2. Что из этого можно нормально исполнить именно на Bitget?
3. Какая наблюдаемая ситуация объясняет попадание в briefing?

## Контракт слоя

`frontend/lib/bitget/briefing-engine.ts` — чистая функция без сети и без записи состояния.

- `Attention` — относительная 24h proxy из движения, оборота и диапазона.
- `Execution Quality` — Bitget-only: статус, наличие цены, spread в basis points.
- `Situation` — детерминированное состояние: `PUMP`, `DUMP`, `VOLUME_EXPLOSION`, `VOL_EXPANSION`, `WAKE_UP`, `QUIET`, `WATCH_ONLY`.
- `Disposition` — `IN_PLAY`, `WATCH_ONLY` или `QUIET`.
- `reasons` — короткие факты, а не необъяснимый score.
- максимум `10` кандидатов `IN_PLAY`.

Правило допуска: высокая Attention сама по себе не делает инструмент `IN_PLAY`; при слабом исполнении он остаётся `WATCH_ONLY`.

## Честные ограничения v1

- Исторический baseline 4–8 недель ещё не подключён. В API это явно отражено как `baseline: MISSING`, `quality: BASELINE_MISSING`; 24h proxy не является финальной нормой.
- `Trades x`, acceleration, OI delta, liquidation intensity, depth/refill/pull/stack и session memory не подменяются текущими полями тикера. Они остаются следующими слоями контракта.
- Binance discovery/reference пока не входит в этот live-срез. Текущая выдача — только Bitget execution truth.
- Нет trading POST, ордеров и автоматических действий.
- Ошибка или частичная загрузка Bitget не превращается в demo/fallback; route возвращает 502 либо явно частичный status.

## Источники и identity

Рабочий universe должен сверяться с каноническими Drive-реестрами:

- `00_BITGET_РЕЕСТР_ИНСТРУМЕНТОВ` — продуктовые контуры, источники и рабочий каталог.
- `00_BITGET_MASTER_ALL_INSTRUMENTS` — master identity с отдельными вкладками spot/futures и другими продуктами.
- `2026-08-04 — Bitget — подготовка к брифингу` и `2026-08-06 — Bitget — активные пары и торговый фокус` — авторская логика core / rotational / event-only, не live-цены.
- `2026-08-11 — Крипто и Bitget — подготовка v1` — пустой файл и не является source of truth.

Identity должна разделять базовый актив и конкретный Bitget product: `BASE`, `SYMBOL`, `category`, `marketGroup`, `quoteCoin`, `status`, `isReality`, contract/expiry metadata.

## Провайдеры

Текущий срез использует официальный Bitget UTA v3 REST market layer. Binance должен добавляться через отдельный discovery adapter и не может определять исполнимость на Bitget:

```text
Bitget instruments/tickers/orderbook/trades/OI/funding -> execution truth
Binance public market data                 -> price-discovery/reference
Massive US stocks                          -> будущий provider для stocks
Macro/commodities                          -> отдельный provider, не synthetic Bitget product
```

Нельзя объединять показатели разных провайдеров в один неподписанный ряд. Каждый snapshot обязан иметь `source`, `asOf`, `freshness`, `quality`, `coverage` и fallback policy.

## Следующий срез

1. Добавить server-side 10-minute snapshot store для 20 ликвидных Bitget symbols.
2. Считать same-time `Turnover x` и накопление `Trades x`; до появления baseline показывать `—`.
3. Подключить 1m candles, public trades, OI и funding history для top-50.
4. Добавить Binance reference только для divergence/confirmation.
5. Перенести engine с 24h proxy на baseline percentiles и session memory `now/5m/20m/40m/60m`.
6. Расширить inspector: orderbook depth, trades/sec, volume/sec, acceleration, liquidation and data-quality panel.

Проверка текущего контракта: `pnpm --dir frontend verify:bitget-briefing`.
