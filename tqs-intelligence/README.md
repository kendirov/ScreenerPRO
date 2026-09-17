# TQS Intelligence Engine v0.3

Автономное локальное/серверное ядро TraderQuest: непрерывно собирает несколько рынков, сохраняет историю, выделяет аномалии, превращает их в устойчивые эпизоды, подгружает свечной контекст, отслеживает исход и периодически пересчитывает предварительную статистику повторяющихся паттернов.

## Главный цикл

`рынки → normalize → snapshots → anomaly → episode → candle backfill → outcome → similar cases → autonomous research → briefing/API`

Горячий контур работает обычным кодом без LLM. Модель в будущем получает только shortlisted cases и компактный MarketSnapshot.

## Источники

Без ключей: Bitget UTA v3, Binance, Bybit V5, OKX V5, MOEX ISS, GDELT. MOEX включает акции, FORTS, валютный рынок, индексы и облигации. Опционально: Twelve Data и произвольные RSS/Atom.

Для эпизодов крипты сервис автоматически запрашивает свечи Bitget/Binance/Bybit/OKX. Для MOEX использует ISS candles, когда известен board. Локальные snapshots продолжают график после события.

## Что такое эпизод аномалии

Строка anomaly не пишется как новый независимый объект каждую минуту. Когда score превышает `TQS_EPISODE_THRESHOLD`, создаётся episode. Пока событие живо, обновляются last/peak score, цена, причины, signals и hits. После grace period без сильного сигнала эпизод закрывается, но остаётся в DuckDB.

Для эпизода доступны: график до/во время/после, 5m/15m/1h/4h/24h returns, MFE/MAE, похожие прошлые случаи, pattern key и причины.

## Autonomous Research Loop

Каждые `TQS_RESEARCH_EVERY_REFRESHES` циклов сервис пересматривает закрытые эпизоды. Похожие случаи группируются по типу рынка, направлению и machine-readable signals. Рассчитываются direction-normalized median continuation и win-rate для 1h/4h. Небольшая выборка остаётся `watch`; только после sample gate более устойчивый результат получает `candidate`. Это исследовательский кандидат, не торговый сигнал.

## Windows

Первый раз:

1. `install-windows.cmd`
2. `start-windows.cmd`
3. открыть `http://127.0.0.1:8787`

После обновления ветки достаточно остановить окно, сделать Pull origin и снова запустить `install-windows.cmd`, затем `start-windows.cmd`. DuckDB в `data/` сохраняется.

## Linux VPS: запустить один раз и оставить работать

Требуются Git + Docker Compose plugin. В клонированном репозитории на нужной ветке:

```bash
sudo bash tqs-intelligence/deploy/linux/install-server.sh
```

Скрипт:
- создаёт `.env` из шаблона, если его нет;
- строит и запускает контейнер;
- включает `restart: unless-stopped`;
- включает systemd timer автообновления каждые 30 минут;
- updater обновляет текущую Git-ветку только fast-forward;
- после rebuild ждёт Docker healthcheck;
- при неуспехе откатывает Git на предыдущий commit и возвращает предыдущую рабочую версию.

Проверка:

```bash
bash tqs-intelligence/deploy/linux/status-server.sh
```

По умолчанию сервер слушает только `127.0.0.1:8787`. Для доступа извне лучше SSH tunnel или reverse proxy с авторизацией. `TQS_SERVER_BIND=0.0.0.0` открывает порт наружу и должен использоваться осознанно.

## Основные настройки `.env`

- `TQS_REFRESH_SECONDS=60`
- `TQS_EPISODE_THRESHOLD=70`
- `TQS_EPISODE_CLOSE_GRACE_SECONDS=180`
- `TQS_HISTORY_BACKFILL_MAX=8`
- `TQS_HISTORY_REFRESH_EVERY=5`
- `TQS_RESEARCH_EVERY_REFRESHES=15`
- `TQS_TWELVE_DATA_API_KEY=`
- `TQS_TWELVE_DATA_SYMBOLS=AAPL,MSFT,NVDA,SPY,QQQ`
- `TQS_RSS_URLS=`

## UI

- Сейчас
- Мосбиржа
- История аномалий
- Аномалии
- Новости
- Исследования
- Возможности
- Источники
- Логи

Во вкладке «История аномалий» можно искать `SMLT`, `SBER`, `BTC` и т.д., открывать активные/закрытые случаи, менять окно графика ±6ч/±24ч/±3д и переходить между похожими случаями.

## API v0.3

- `GET /api/health`
- `GET /api/overview`
- `POST /api/refresh`
- `GET /api/anomalies`
- `GET /api/episodes`
- `GET /api/episodes/{id}`
- `GET /api/research/findings`
- `GET /api/relationships`
- `GET /api/quotes`
- `GET /api/moex`
- `GET /api/news`
- `GET /api/logs`
- `GET/POST /api/hypotheses`
- `GET /api/capabilities`
- `GET /api/system`
- OpenAPI: `/docs`

## Следующие тяжёлые слои

v0.3 сохраняет минутные snapshots в DuckDB. Для многолетней истории и L2 следующий scale-up слой: partitioned Parquet + DuckDB/Polars research views, затем ClickHouse при реальной необходимости. Дальше: WebSocket sequence/gap recovery, historical universe replay, conditional relationship mining, event-study/OOS/walk-forward/bootstrap, macro/exchange/token events, BriefingSnapshot и дешёвый LLM-router только поверх shortlist.
