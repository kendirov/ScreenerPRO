# TQS Intelligence Engine v0.2

Локальное ядро TraderQuest для непрерывного сбора рынков, унификации инструментов, поиска аномалий, новостей, связей и очереди исследовательских гипотез. Основной поток работает обычным кодом без постоянных расходов на LLM.

## Уже работает

- Bitget UTA v3: spot + USDT futures, без API-ключа.
- Binance: spot + USDT-M futures, без API-ключа.
- Bybit V5: spot + linear futures, без API-ключа.
- OKX V5: spot + swaps + expiry futures, без API-ключа.
- MOEX ISS: акции + FORTS + валютный рынок + индексы + облигации, без API-ключа.
- Twelve Data: опциональный адаптер для глобальных акций/ETF при наличии ключа.
- GDELT + произвольные RSS/Atom: новостной поток и первичная привязка к инструментам/темам.
- Унифицированная Quote schema и canonical_id `provider:market:symbol`.
- Cross-sectional anomaly engine: движение, оборот, OI, funding, spread.
- Relationship Miner: корреляции и one-bucket lead/lag по накопленным snapshots с минимальным sample gate.
- DuckDB: snapshots, anomalies, news, hypotheses и runtime logs.
- Русский терминал: Сейчас / Мосбиржа / Аномалии / Новости / Исследования / Возможности / Источники / Логи.
- Первый снимок собирается в фоне: UI открывается сразу, а медленный источник не блокирует интерфейс.
- Частичный отказ сегмента одного провайдера помечается `DEGRADED`, а не обрушает весь источник.

## Windows — первый запуск

1. Открыть папку `tqs-intelligence`.
2. Двойной клик `install-windows.cmd`.
3. После завершения — двойной клик `start-windows.cmd`.
4. Откроется `http://127.0.0.1:8787`.

PowerShell-вариант:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-windows.ps1
.\start-windows.ps1
```

## Как обновить уже установленную версию

1. Остановить окно TQS Intelligence (`Ctrl+C` или закрыть консоль).
2. В GitHub Desktop на ветке `codex/tqs-intelligence-engine-v0-1-2026-09-17` нажать `Fetch origin`, затем `Pull origin`.
3. Снова запустить `install-windows.cmd` — это обновит Python package и зависимости, существующий `.env` и `data/tqs-intelligence.duckdb` сохранятся.
4. Запустить `start-windows.cmd`.
5. Проверить вкладки `Источники` и `Логи`.

## Мосбиржа

Вкладка `Мосбиржа` показывает только фактически полученные данные MOEX ISS и отдельно считает:

- акции (`stock / shares`);
- срочный рынок FORTS (`future / forts`);
- валютный рынок (`fx / selt`);
- индексы (`index`);
- облигации (`bond / bonds`).

Можно искать по тикеру или названию и фильтровать класс инструмента. Для FORTS сохраняется доступный `OPENPOSITION`, для всех сегментов — торговый статус и provenance.

## Возможности и источники

Во вкладке `Возможности` видно, какие рынки и поля даёт каждый адаптер и нужен ли ключ. Во вкладке `Источники` видны `OK / DEGRADED / ERROR`, число инструментов, latency, время последнего успеха и текст ошибки.

### Мировые акции / ETF

В `.env`:

```text
TQS_TWELVE_DATA_API_KEY=ваш_ключ
TQS_TWELVE_DATA_SYMBOLS=AAPL,MSFT,NVDA,SPY,QQQ
```

После изменения перезапустить `start-windows.cmd`.

### Дополнительные новости

В `.env` можно добавить RSS/Atom через запятую:

```text
TQS_RSS_URLS=https://example.com/feed.xml,https://example.org/rss
```

GDELT работает и без этого.

## Логи

Вкладка `Логи` показывает:

- старт/остановку сервиса;
- каждый цикл сбора;
- длительность цикла;
- количество инструментов/аномалий/новостей;
- деградацию или ошибку конкретного источника;
- восстановление источника;
- размеры накопленного DuckDB-хранилища.

Логи также доступны через `GET /api/logs`.

## API

- `GET /api/health`
- `GET /api/system`
- `GET /api/capabilities`
- `POST /api/refresh`
- `GET /api/overview`
- `GET /api/moex`
- `GET /api/anomalies?min_score=50&asset_class=crypto`
- `GET /api/quotes?provider=moex&asset_class=future&q=Si`
- `GET /api/news?symbol=BTC`
- `GET /api/relationships?min_samples=20`
- `GET /api/logs?limit=200`
- `POST /api/hypotheses`
- `GET /api/hypotheses`
- OpenAPI: `/docs`

## Архитектурный принцип

Raw market stream не отправляется в LLM. Постоянный код собирает, нормализует, хранит, фильтрует и ищет аномалии. Будущий AI-router получает только shortlisted MarketSnapshot/Anomaly/Research packets.

## Следующие слои

1. Historical candles/trades + partitioned Parquet lake.
2. Persistent WebSocket для Tier-A crypto, sequence integrity и gap recovery.
3. Historical baselines по самому инструменту, режиму и времени суток.
4. Conditional relationships, correlation breaks и sequence mining.
5. Research Engine: event study, OOS, walk-forward, bootstrap, multiple-testing control, fee/slippage stress.
6. Exchange announcements, macro calendar, token unlocks, listings/delistings, filings.
7. BriefingSnapshot для веба, эфира, Telegram, курса и презентаций.
8. Optional LLM router только для лучших отобранных событий и итоговых research summaries.

## Проверка

После установки:

```powershell
.\verify.ps1
```

Затем запустить приложение и открыть `Источники` / `Логи`: это финальная live-проверка сетевой доступности именно с вашего Windows/VPN.
