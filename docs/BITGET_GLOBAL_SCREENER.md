# Bitget Global Screener — Terminal v3

## Задача

Вертикальный срез ScreenerPRO для Bitget: не просто список котировок, а рабочий терминал для брифинга и отбора инструментов из полного публичного UTA universe.

Маршруты:

- `/screener/bitget` — рабочий скринер;
- `/screener/bitget/map` — интерактивная русская карта рынков и механики продуктов.

`attentionScore` остаётся техническим приоритетом внимания, а не прогнозом или торговым сигналом.

## Источник данных

Публичный Bitget UTA v3:

- `GET /api/v3/market/instruments` для `SPOT`, `MARGIN`, `USDT-FUTURES`, `USDC-FUTURES`, `COIN-FUTURES`;
- `GET /api/v3/market/tickers` для spot и futures-категорий;
- margin использует соответствующий spot ticker при совпадении символа;
- `GET /api/v3/market/candles` — ленивый недельный слой только для текущего видимого списка.

Серверный адаптер: `frontend/lib/server/services/bitget-market.ts`.

Недельный endpoint: `frontend/app/api/bitget/weekly/route.ts`.

Клиент не получает API Secret или Passphrase. В этом срезе нет торговых POST-запросов.

## Классификация universe

- `CRYPTO_SPOT` — обычный spot;
- `RTOKEN_SPOT` — `isReality=yes`;
- `MARGIN` — Bitget category `MARGIN`;
- `STOCK_PERPS` — futures с `symbolType=stock`;
- `COMMODITY_PERPS` — futures с `symbolType=metal|commodity`;
- `CRYPTO_FUTURES` — остальные futures.

Stock+ equities/ETFs, Stock+ options и TradFi/CFD не маскируются под публичный UTA universe. Для них предусмотрены отдельные адаптеры.

## Terminal v3

Основной экран строится как одна прокручиваемая страница. У таблицы нет собственного вертикального scroll-container.

На первом уровне:

- четыре быстрых блока: сильнее всего, слабее всего, максимальный оборот, funding-экстремум;
- фильтр по классу рынка;
- быстрые фильтры `Все / В фокусе / Рост / Падение / Широкий ход / Funding`;
- поиск;
- таблица: инструмент, рынок, цена, 24ч, 7 дней, ход 24ч, оборот 24ч, спред, funding, focus.

Правила отображения:

- rToken не показывается как непонятный `RSPY`: визуально это badge `R` + `SPY`, при этом исходный Bitget symbol хранится ниже;
- спред на поверхности показан в процентах; точные базисные пункты доступны в tooltip/раскрытии;
- пустой funding остаётся `—` и всегда сортируется после реальных значений;
- недельное изменение не выдумывается: оно считается по дневным свечам через серверный cache;
- оборот показывает валюту котирования; для USD/USDT/USDC используется `$`-представление.

## Интерактив строки

Клик по самому тикеру копирует код для TradingView.

Клик по остальной области строки раскрывает рабочее пространство непосредственно под строкой:

- TradingView Advanced Chart;
- цена, 24ч, 7д, ход, оборот, spread, funding;
- bid/ask, high/low, OI, mark/index, leverage;
- избранное;
- заметка для брифинга;
- копирование структурированного контекста инструмента;
- ссылка `Открыть TradingView` для полноценного внешнего workspace.

Избранное и заметки v3 сохраняются в localStorage текущего браузера. Это честный локальный persistence; облачная синхронизация будет отдельным слоем после подключения auth/Supabase.

## TradingView

Быстрый график использует официальный Advanced Chart embed widget. Он нужен для анализа внутри ScreenerPRO.

Полноценное сохранение пользовательских layout/drawings не выдаётся за функцию бесплатного embed widget. Для этого либо используется собственный Advanced Charts storage adapter, либо пользователь открывает инструмент в своём TradingView workspace.

## Карта рынков Bitget

`/screener/bitget/map` объясняет продуктовую структуру не языком API, а языком трейдера:

- Крипто · Спот;
- Маржинальный спот;
- Крипто · Фьючерсы;
- Акции · rToken;
- Акции · Перпетуалы;
- Stock+ · Акции и ETF;
- Опционы США;
- Товары · Перпетуалы;
- Forex / индексы / CFD.

Для каждой секции фиксируются: что торгуется, механика, главный риск и зачем это трейдеру. Отдельные API-контуры помечаются честно и не получают fake live-данные.

## Attention Score

Score не прогнозирует направление. Он объединяет наблюдаемые признаки текущей активности:

- абсолютное 24ч движение;
- ширину 24ч диапазона;
- percentile оборота внутри текущего universe;
- качество spread;
- экстремальный funding как небольшой дополнительный фактор.

В дальнейшей итерации технический `Фокус` должен постепенно уступить более объяснимой модели `Relative Activity / Situation`, когда появится достаточная историческая база.

## Следующие слои

1. Signed Stock+ adapter: полный equities/ETF universe и stock market data.
2. Options adapter: underlying → expiry → strike → call/put.
3. Исторический feature cache: RSI14, ATR, relative volume, multi-timeframe momentum, session memory.
4. News/reaction layer: выбранный инструмент → события → реакция цены → объяснение для брифинга.
5. Облачный workspace пользователя: watchlist, заметки, сохранённые экраны и briefing history.
6. Private account analytics отдельной поверхностью; не смешивать личные сделки с public market adapter.

## Проверка

- старые `/screener`, `/screener/stocks`, `/screener/futures`, `/screener/strategies` не изменены по бизнес-логике;
- Vercel Preview собирается из feature branch;
- отдельные debug-isolation builds подтвердили, что и карта, и terminal v3 компилируются независимо;
- никаких fake/mock рыночных чисел;
- секреты Bitget не попадают в клиент или GitHub.
