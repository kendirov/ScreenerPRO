# TQS Dashboard — Future Cockpit

## Purpose

The home page is the owner's main market cockpit, not a static status page. In 5–20 seconds it should answer:

1. What is happening in the market now?
2. Where are potential movement locations forming?
3. Is TQS actually alive right now?
4. What exactly is TQS computing/collecting now and what useful output did the last cycle produce?
5. What new research/strategy/account evidence appeared?
6. Is the data/system healthy and fresh?

`MACHINE_ACTIVITY_CONTRACT.md` is mandatory for runtime/activity semantics. A cached browser snapshot, CPU/RAM load or old log must never be presented as proof of current work.

## Four simultaneous layers

### Market
Live instruments, anomalies, episodes, MOEX/crypto/global context.

### Machine
Collectors, jobs, queue, progress, heartbeats, last success, next due time, CPU/RAM/data disk, errors and stale feeds.

### Research
Findings, historical replay, strategy candidates/rejections and account-position changes.

### Operator actions
STOP/LIGHT/MAX, refresh market, save TQS snapshot, update product, freeze briefing.

## Home layout target

### Operator strip
- STOP / LIGHT / MAX;
- runtime state `OFFLINE / STARTING / RUNNING / PAUSED / DEGRADED / ERROR`;
- `Обновить рынок`;
- `Сохранить TQS`;
- `Обновить продукт`;
- semantic version + local commit + remote commit;
- runtime instance ID/start time;
- freshness/stale indicator;
- active Data Root.

If backend is OFFLINE, the entire Web surface must show a visible `ПОСЛЕДНИЙ SNAPSHOT — НЕ LIVE` banner until a fresh heartbeat returns.

### Market / research funnel
Show transformation, not only raw counters:

`весь рынок → наблюдения → аномалии → In Play → активные эпизоды → research runs → strategy candidates/rejected`

Each stage needs a stable definition and trend vs previous period/session.

### Market pulse
Metrics plus small time-series sparklines:
- instruments online;
- observations/anomalies now;
- In Play now/new;
- active/new/closed episodes;
- sources online/degraded/error;
- new account position changes;
- research jobs running/queued;
- last market-cycle duration and next due time.

### IN PLAY
Each promoted item must show:
- instrument/market;
- priority;
- direction as descriptive state, not trade instruction;
- 2–4 `ПОЧЕМУ ПОКАЗАНО` reasons;
- lifecycle: new/building/follow-through/fading;
- comparable historical cases;
- related StrategySpec if any;
- account/participant evidence if relevant.

Actions: open chart, history, research, briefing, idea.

### Anomaly flow chart
Timeline of new episodes by market and severity. Clicking a point opens the cases that appeared in that interval.

### Что машина делает сейчас
This is an owner-facing activity ledger, not a generic status box.

Show the top active/waiting processes separately with literal Russian descriptions:
- `Рынок`: current providers/instruments, last success, next cycle;
- `Аномалии`: instruments evaluated → observations/anomalies promoted → episodes opened/closed;
- `История`: instrument/timeframe/range/progress/rows stored;
- `Research`: exact run/hypothesis/progress/result destination;
- `Strategy`: variants evaluated, validation/holdout stage;
- `Accounts`: universe/hot-set/positions/fills/changes;
- `News`: sources/items/reaction links;
- `System`: save/update/restart/error recovery.

Each line should answer:
`что делает → над чем → прогресс → что уже получено → что будет дальше`.

Never hide a heavy job behind generic `RUN`, `working`, `market cycles` or CPU load.

If Research queue is empty, say directly: `Исследования сейчас не считаются; live collection/anomaly tracking continue` if that is true.

### Session / Night summary
A dedicated compact summary should answer `что TQS сделал с запуска / за ночь / за 24ч`:
- runtime duration/cycles;
- rows/candles/fills downloaded and Data Lake growth;
- coverage added;
- anomalies/episodes opened and closed;
- new In Play;
- account position/fill changes;
- research runs completed;
- strategy candidate/rejected/inconclusive counts;
- errors/retries/recoveries.

### System telemetry
CPU, RAM, TQS process memory, Data Root free space, Data Lake growth, snapshots/minute, errors, last successful save/update. Telemetry supports diagnosis; it is not a progress metric.

### Research & Strategy pulse
New findings, historical replays, candidate/rejected/inconclusive runs and latest diagnostics. Empty state must explain why queue is empty and how jobs are created automatically/manual override.

### Account / Position pulse
Largest tracked position changes, new accounts, long/short concentration and fills near active anomaly episodes.

### Briefing pulse
3–6 promoted stories, WHY SHOWN, LIVE/FROZEN state and direct entry to fullscreen briefing.

## Case View
A click on an anomaly opens one evidence-rich case:
- candlesticks + volume;
- anomaly active window and score timeline;
- round/buffer zones and other detector overlays;
- OI/funding/basis/participants when available;
- tracked account fills/position changes when relevant;
- similar historical cases;
- 15m/1h/4h/24h outcomes and MFE/MAE;
- Strategy Machine trades/controls/results;
- notes + create idea.

## Visual principles
Desktop-first, dense but readable, matte graphite/black, warm white, thin separators, green/red only for direction and amber for anomaly/warnings. Avoid generic card-wall/cyberpunk design.

Charts are primary evidence surfaces, not decoration. Prefer interactive candlesticks with crosshair/zoom/pan and overlays.

## MOEX on home
Promote connected stories rather than a 5,000-row dump:
- stocks/futures in play;
- unusual OI/delta OI;
- stock ↔ futures divergence;
- sector/index breadth;
- expiry/roll context;
- later participant (individual/legal) extremes.

## Product evolution
Every owner idea should either become research, StrategySpec, data adapter, detector, visualization or briefing feature inside the same TQS product. The home cockpit should expose a compact `Что нового` after updates.
