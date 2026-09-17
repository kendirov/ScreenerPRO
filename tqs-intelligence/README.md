# TQS Intelligence & Strategy Machine v0.4

Одна локальная/серверная машина для рынка, аномалий, исторических исследований, стратегий, новостей и брифинга.

## Главная идея

TQS должна работать 24/7 и становиться полезнее по мере накопления данных:

`рынки → состояния → аномалии → эпизоды → история 2021+ → historical replay → event studies → Strategy Machine → research/briefing/knowledge`

**Аномалия** в TQS — прежде всего место/время потенциально повышенного движения. Это ещё не направление BUY/SELL. Historical Replay проверяет, действительно ли после подобных состояний абсолютное движение выше обычного фона. Направление, вход, выход и costs проверяются отдельно Strategy Machine.

Подробный контракт для AI/разработчиков: `AI_OPERATING_CONTEXT.md`.

## Что есть в v0.4

### Live Intelligence
- Bitget, Binance, Bybit, OKX;
- MOEX ISS: акции, FORTS, FX, индексы, облигации;
- optional Twelve Data;
- GDELT + RSS;
- current anomaly/state engine;
- persistent anomaly episodes;
- график и outcomes 5m/15m/1h/4h/24h;
- relationship miner;
- source health + runtime logs.

### Historical Data Lake
Тяжёлая история хранится не в основной DuckDB, а в partitioned Parquet/Zstandard:

`provider / instrument / interval / year / month`.

Windows installer автоматически предпочитает `D:\TQS_DATA`, если диск D: доступен и достаточно свободен. Путь можно изменить через `TQS_DATA_LAKE_ROOT`.

Bulk backfill v0.4:
- Binance spot/USDT futures;
- MOEX ISS shares/FORTS через candles;
- диапазон по умолчанию начинается с 2021 года.

После backfill автоматически ставится Historical Replay.

### Historical Replay
Replay восстанавливает исторические anomaly events на уже загруженных свечах без lookahead, сохраняет Parquet эпизодов и сравнивает последующее движение с фоновой выборкой.

Статус `movement_candidate` означает: на validation/holdout абсолютное движение после anomaly events выше фонового. Это **не** направление сделки.

Если найден movement candidate, TQS создаёт machine-origin запись в Idea Inbox с тем, что проверить дальше.

### Strategy Machine
Versioned `StrategySpec` + persistent research queue.

Встроенные первые варианты:
- MOEX 10m: отскок от круглых/буферных зон;
- Crypto 5m: отскок от круглых/буферных зон.

Round/buffer research:
- уровни и buffer grid;
- shifted placebo controls 0.25S/0.50S/0.75S;
- вход только после first-touch без lookahead;
- exploration/validation/untouched holdout;
- walk-forward blocks;
- costs in bps;
- MFE/MAE;
- robustness matrix.

`candidate` не становится live strategy автоматически. Для live promotion нужны более сильная репликация/data-quality/execution/risk layers.

### Лаборатория идей
В UI можно сохранить сырой текст идеи: research/anomaly/strategy/UI/source/briefing. Сырой текст не теряется. Позже AI/Codex может превратить идею в новые detector/StrategySpec/provider/UI change, сохраняя связь с исходной мыслью.

### MOEX Market Lab
Текущий бесплатный ISS — baseline. Интерфейс/контракты рассчитаны на дальнейшее подключение premium/realtime:
- OI/delta OI;
- физлица long/short;
- юрлица long/short;
- число участников;
- participant divergence/acceleration;
- цена × OI × participant-position divergence;
- futures family/current-next/expiry/roll/basis;
- акция ↔ фьючерс ↔ сектор ↔ индекс ↔ событие.

Free/delayed и paid/realtime данные не должны незаметно смешиваться.

### Briefing mode
Один data core питает и исследовательский терминал, и briefing scene:
- fixed anchors;
- до 3–6 главных историй;
- `WHY SHOWN`;
- связанные новости;
- research updates;
- fullscreen;
- LIVE/FROZEN.

Дальше тот же `BriefingSnapshot` должен питать HTML/PPTX/PDF/video, а не пересобирать факты заново.

### Portable snapshot / Google Drive
Кнопка **«Сохранить TQS»** делает ZIP с:
- current Market Snapshot;
- anomaly episodes;
- findings;
- hypotheses;
- Idea Inbox;
- research jobs;
- StrategySpecs/runs;
- relationships;
- logs;
- Data Lake manifest;
- `AI_READ_ME.json`.

Если `TQS_DRIVE_EXPORT_ROOT` указывает на локальную папку Google Drive Desktop, ZIP автоматически копируется туда. После синхронизации можно попросить ChatGPT проанализировать последний snapshot.

## Режимы нагрузки

### STOP
Фоновый рынок и тяжёлые research jobs стоят. Ручное обновление рынка доступно.

### LIGHT
Для работы за ПК: live market/news/anomalies продолжаются, bulk history/replay/strategies ждут.

### MAX
Для ночи/сервера: ускоренный live loop + persistent backfill/replay/Strategy Machine queue.

UI показывает режим, CPU/RAM, свободный data disk, очередь и текущее действие машины.

## Windows — установка один раз

На ветке v0.4:

1. `install-windows.cmd`
2. `start-windows.cmd`
3. открывается `http://127.0.0.1:8787`

`start-windows` теперь запускает supervisor. Он следит за API и может его перезапускать.

## Обновление одной кнопкой

Кнопка **«Обновить»**:
1. проверяет upstream текущей Git-ветки;
2. не трогает dirty worktree;
3. не прерывает heavy job без force;
4. делает fast-forward pull;
5. переустанавливает зависимости;
6. перезапускает API;
7. проверяет `/api/health`;
8. при провале откатывает предыдущий commit.

Supervisor также проверяет обновления периодически, если `TQS_AUTO_UPDATE=true`.

## Linux VPS

```bash
sudo bash tqs-intelligence/deploy/linux/install-server.sh
```

`docker-compose.server.yml` сохраняет отдельно:
- `./data` → operational DB/control;
- `${TQS_SERVER_DATA_LAKE:-./data-lake}` → Parquet history.

По умолчанию bind только `127.0.0.1:8787`; для удалённого доступа используйте VPN/Tailscale/SSH tunnel/authenticated reverse proxy.

## Главные env

```text
TQS_MODE=light
TQS_DATA_LAKE_ROOT=D:\TQS_DATA
TQS_DRIVE_EXPORT_ROOT=
TQS_AUTO_UPDATE=true
TQS_HEAVY_WORKERS=2
TQS_REFRESH_SECONDS=60
TQS_EPISODE_THRESHOLD=70
```

Premium/future placeholders также описаны в `.env.example`; секреты не коммитить.

## UI v0.4

- Сейчас
- Отбор / In Play
- Аномалии / эпизоды
- Мосбиржа PRO
- Машина стратегий
- Исследования
- Лаборатория идей
- Новости
- Брифинг / эфир
- Данные / Data Lake
- Система / логи

Episode drill-down использует TradingView Lightweight Charts при доступности CDN, с candlestick, zoom/pan/crosshair, trigger price и anomaly score panel. Numeric/event data остаётся доступной даже если renderer не загрузился.

## API highlights

- `GET /api/health`, `/api/overview`, `/api/system`
- `GET/POST /api/control`
- `POST /api/refresh`
- `GET /api/anomalies`, `/api/episodes`, `/api/episodes/{id}`
- `GET /api/moex/lab`, `/api/moex/lab/{canonical_id}`
- `GET/POST /api/ideas`
- `GET /api/jobs`
- `POST /api/backfill`
- `GET/POST /api/strategies`
- `POST /api/strategies/{id}/run`
- `GET /api/strategies/runs`
- `GET /api/data-lake`, `POST /api/data-lake/verify`
- `GET /api/research/findings`, `/api/research/runtime`, `/api/relationships`
- `GET /api/briefing`
- `POST /api/export/snapshot`
- `GET/POST /api/system/update`
- OpenAPI: `/docs`

## Что ещё не надо выдавать за готовое

v0.4 создаёт фундамент full historical research, но ещё не содержит весь будущий universe backfill всех бирж/всех тикеров автоматически, L2/orderflow, premium MOEX credentials, Telegram credentials, options/on-chain или live execution. Эти слои должны добавляться adapters/modules поверх текущего ядра, а не отдельными продуктами.
