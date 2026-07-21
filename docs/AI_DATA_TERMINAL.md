# AI Data Terminal v1

## Цель

`/screener/ai-data` готовит компактный пакет MOEX для внешней модели. Это не встроенный чат и не торговый совет: пользователь копирует данные в ChatGPT для брифинга и ручного анализа.

## Поток

`MOEX ISS → getScreenerResponse(stock) → typed AI adapter → Market Priority + Situation Engine → serializer (AI Text / JSONL / JSON / CSV) → Clipboard/download`.

`POST /api/ai-data/export` валидирует Zod-параметры, ограничивает выбранные тикеры до 30 и не экспортирует demo. Используется один общий live-снимок `/api/screener` через серверный сервис; в нём нет fan-out по всем акциям.

## Поля и честность v1

Есть live: цена, день, оборот, Vol x, Trades x, диапазон, позиция в диапазоне, baseline, Market Priority, Situation и data quality. Спред отсутствует в публичном контракте — `null`.

Исторические 5/15/30/60m returns, дельты оборота/сделок, relative strength, trend/chop и глубокие свечи в v1 возвращаются как `null`: проект не имеет durable 5m snapshots. Нули не подставляются.

## Форматы

- **AI Text**: TASK, MARKET_CONTEXT, SCHEMA, STOCKS, DEEP_SHORTLIST, DATA_QUALITY.
- **JSONL/JSON/CSV**: тот же нормализованный набор, для дальнейшей обработки.

## Нагрузка и кэш

Live export делает один вызов общего MOEX snapshot и наследует его серверный TTL 20 секунд. Нет открытых admin/destructive endpoint и нет бесконтрольных candle-запросов.

## V2

После подключения Postgres/Supabase и Vercel Cron: общий snapshot каждые 5 минут, hourly aggregates прошлых сессий, 20D profile и deep 5m OHLCV только для shortlist (cap + concurrency + persistent cache). До этого UI не должен обещать исторические данные.
