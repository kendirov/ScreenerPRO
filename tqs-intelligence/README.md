# TQS Intelligence & Strategy Machine v0.11

Одна локальная/серверная машина для рынка, аномалий, исторических исследований, стратегий, публичных счетов/позиций, новостей и брифинга.

## Главная идея

TQS должна работать 24/7 и становиться полезнее по мере накопления данных:

`рынки + позиции + новости + идеи → состояния → аномалии → эпизоды → история 2021+ → historical replay → Strategy Machine → research/briefing/knowledge`

**Аномалия** в TQS — прежде всего место/время потенциально повышенного движения. Это ещё не направление BUY/SELL. Historical Replay проверяет, действительно ли после подобных состояний абсолютное движение выше обычного фона. Направление, вход, выход и costs проверяются отдельно Strategy Machine.

Подробные контракты для AI/разработчиков: `AI_OPERATING_CONTEXT.md`, `AGENTS.md`, `POSITION_ACCOUNT_INTELLIGENCE.md`, `STRATEGY_MACHINE_V2.md`, `DASHBOARD_NEXT_STAGE.md`.

## Что есть в v0.5

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

### Account / Position Intelligence
Первый исполняемый адаптер — публичные Hyperliquid-адреса:
- открытые позиции;
- fills/history;
- long/short bias;
- концентрация по инструментам;
- taker share;
- признаки серийного добора;
- realized PnL samples;
- сохранение данных в локальный SQLite;
- фоновая синхронизация в LIGHT/MAX;
- русская вкладка `Счета / позиции`;
- включение account profiles/positions/fills в `Сохранить TQS`.

Профиль описательный: он не доказывает скрытый мотив, уровень стопа или «умность» счёта. Следующий слой синхронизирует fills с MarketContext/аномалиями и проверяет гипотезы статистически.

MOEX физлица/юрлица рассматриваются отдельно как агрегированный participant layer, а не как индивидуальные счета.

### Historical Data Lake
Тяжёлая история хранится в partitioned Parquet/Zstandard:

`provider / instrument / interval / year / month`.

Windows installer предпочитает `D:\TQS_DATA`, если большой D: доступен. Путь можно изменить через `TQS_DATA_LAKE_ROOT`.

Bulk backfill:
- Binance spot/USDT futures;
- MOEX ISS shares/FORTS через candles;
- диапазон по умолчанию начинается с 2021 года.

После backfill автоматически ставится Historical Replay.

### Historical Replay
Replay восстанавливает исторические anomaly events без lookahead, сохраняет эпизоды и сравнивает последующее движение с фоновой выборкой.

`movement_candidate` означает повышенное движение на validation/holdout относительно background. Это **не** направление сделки.

### Strategy Machine v2
Versioned `StrategySpec` + persistent research queue.

Встроенные семейства:
- MOEX/crypto: отскок от круглых/буферных зон;
- `Покупать каждое падение — сетка %/bps`;
- `Покупать падение — тейки/стопы в пунктах`.

Buy-the-dip grid автоматически перебирает:
- величину падения;
- тейки;
- стопы;
- максимальное удержание;
- costs;
- background controls.

Параметры выбираются только на exploration. Далее идут chronological validation, untouched holdout и walk-forward.

Кроме итогового PnL сохраняются MFE/MAE, лучшие/худшие сделки и диагностические разрезы: pre-trend, pre-volatility, exit reason. Если диагностика нашла интересный фильтр, это новая гипотеза и новый OOS-прогон, а не право переписать старый holdout.

### Лаборатория идей
В UI можно сохранить сырой текст идеи: research/anomaly/strategy/UI/source/briefing. Сырой текст не теряется. AI/Codex должен превращать идею в новый detector/StrategySpec/provider/UI change внутри той же TQS машины.

### MOEX Market Lab
Текущий бесплатный ISS — baseline. Контракты рассчитаны на premium/realtime:
- OI/delta OI;
- физлица long/short;
- юрлица long/short;
- число участников;
- participant divergence/acceleration;
- цена × OI × participant divergence;
- futures family/current-next/expiry/roll/basis;
- акция ↔ фьючерс ↔ сектор ↔ индекс ↔ событие.

### Control Center
- **STOP** — background loops paused, data preserved;
- **LIGHT** — live market/news/anomaly/account collection, heavy research paused;
- **MAX** — heavy historical/research/strategy jobs execute.

UI показывает CPU/RAM, очередь, current action и место на Data Root.

### Remote Node / домашний Mac

Офисный Windows-компьютер можно один раз превратить в always-on TQS Node кнопкой **Настроить сервер** в Launcher.

После настройки:
- Windows Task Scheduler запускает TQS при старте Windows;
- Supervisor работает без открытого Launcher;
- сервер остаётся на `127.0.0.1:8787`;
- Tailscale Serve даёт приватный HTTPS-адрес только внутри tailnet;
- Mac/телефон открывают тот же Cockpit по закладке;
- безопасные Git-обновления проверяются каждые 5 минут и проходят через healthcheck/rollback;
- Launcher показывает REMOTE ONLINE и умеет скопировать адрес для Mac.

Один раз на Mac нужно установить Tailscale и войти в тот же аккаунт/tailnet. Публичный port-forward и Tailscale Funnel для TQS не нужны.

Подробный контракт: `REMOTE_NODE.md`.


### Сохранить TQS
Portable ZIP содержит:
- Market Snapshot;
- anomaly episodes;
- findings/hypotheses;
- ideas/jobs;
- StrategySpecs/runs;
- relationships/logs;
- Data Lake manifest;
- tracked accounts/profiles/open positions/recent fills;
- AI_READ_ME.

Если `TQS_DRIVE_EXPORT_ROOT` указывает на Google Drive Desktop, ZIP копируется туда автоматически.

### Обновить
Windows работает через supervisor:
- fetch upstream;
- dirty-worktree guard;
- heavy-job guard;
- fast-forward pull;
- reinstall dependencies;
- restart + healthcheck;
- rollback при неудаче.

Целевой workflow: `идея → verified commit → нажать Обновить → функция появилась в том же TQS`.

## Ограничения v0.5

- account adapter сейчас Hyperliquid public addresses; другие DEX/venues добавляются отдельными adapters;
- fills ещё не полностью enriched историческим MarketContext — это следующий account-research слой;
- MOEX premium participant feed не включён без подписки/credentials;
- Telegram ingestion зарезервирован, но не подключён;
- live order execution отсутствует;
- Strategy Machine candidate не равен live strategy.

## Запуск Windows

Первичная установка:

`install-windows.cmd`

Запуск:

`start-windows.cmd`

Не запускай второй экземпляр TQS одновременно: DuckDB — single-writer operational DB. После первого запуска дальнейшие обновления делаются кнопкой `Обновить`.
