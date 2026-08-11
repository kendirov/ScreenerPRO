# Bitget Global Screener v1

## Задача

Новый вертикальный срез ScreenerPRO для Bitget: один рабочий экран должен быстро показать, какие инструменты из полного доступного публичного universe сейчас требуют внимания.

Маршрут: `/screener/bitget`.

Это не торговый бот и не генератор рекомендаций. `attentionScore` — прозрачный приоритет внимания, который помогает сократить universe до инструментов для ручного анализа.

## Источник данных

Публичный Bitget UTA v3:

- `GET /api/v3/market/instruments` для `SPOT`, `MARGIN`, `USDT-FUTURES`, `USDC-FUTURES`, `COIN-FUTURES`;
- `GET /api/v3/market/tickers` для spot и futures-категорий;
- margin использует соответствующий spot ticker, если символ совпадает.

Серверный адаптер: `frontend/lib/server/services/bitget-market.ts`.

Клиент никогда не получает API Secret или Passphrase.

## Классификация universe

- `CRYPTO_SPOT` — обычный spot;
- `RTOKEN_SPOT` — `isReality=yes`;
- `MARGIN` — Bitget category `MARGIN`;
- `STOCK_PERPS` — futures с `symbolType=stock`;
- `COMMODITY_PERPS` — futures с `symbolType=metal|commodity`;
- `CRYPTO_FUTURES` — остальные futures.

Stock+ US equities/ETFs и Stock+ options живут в отдельном подписанном API и намеренно не подмешиваются как будто они входят в публичный UTA instruments endpoint. Для них нужен отдельный adapter v2.

## Метрики первого экрана

На поверхности таблицы:

- тикер;
- рынок;
- цена;
- изменение 24ч;
- диапазон 24ч;
- оборот 24ч;
- спред;
- funding для futures;
- 1–3 причины внимания;
- `attentionScore`.

В inspector дополнительно:

- high/low;
- положение цены внутри 24ч диапазона;
- bid/ask;
- volume;
- OI;
- mark/index;
- max leverage;
- min order amount.

## Attention Score v1

Score не прогнозирует направление. Он объединяет только наблюдаемые признаки текущей активности:

- абсолютное 24ч движение;
- ширину 24ч диапазона;
- percentile оборота внутри текущего universe;
- качество спреда;
- экстремальный funding как небольшой дополнительный фактор.

`В игре` требует и достаточный score, и минимум один признак участия/движения. Причины score всегда показываются текстовыми chips, чтобы не было скрытой магии.

## Briefing view

Экран умеет собрать компактную «карту открытия терминала»:

- что открыть первым;
- сильнее рынка;
- слабее рынка;
- funding / futures.

Брифинг строится только из фактических текущих полей API и явно не является рекомендацией.

## Что сознательно не сделано в v1

- RSI/ATR по 2 000+ инструментам на каждый рендер;
- Stock+ 10k equities/ETFs;
- option chains;
- private account history;
- отправка ордеров;
- новостной score.

Следующий слой должен добавить исторический feature cache: свечи загружаются фоново, расчёты RSI/ATR/relative activity выполняются один раз и переиспользуются UI. Stock+ и options добавляются отдельными signed adapters с честным статусом прав/market-data entitlement.

## Критерий готовности v1

1. Старые `/screener`, `/screener/stocks`, `/screener/futures` не меняются.
2. `/screener/bitget` открывается как самостоятельный decision terminal.
3. При доступном `api.bitget.com` загружается весь публичный UTA universe bulk-запросами.
4. При частичной ошибке UI показывает `PARTIAL` и предупреждения.
5. Никаких fake/mock рыночных чисел.
6. Секреты Bitget не попадают в браузер или репозиторий.
