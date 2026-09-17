# TQS Dashboard — Future Cockpit

## Purpose

The home page is the owner's main market cockpit, not a static status page. In 5–20 seconds it should answer:

1. What is happening in the market now?
2. Where are potential movement locations forming?
3. What is TQS computing right now?
4. What new research/strategy/account evidence appeared?
5. Is the data/system healthy?

## Four simultaneous layers

### Market
Live instruments, anomalies, episodes, MOEX/crypto/global context.

### Machine
Collectors, jobs, queue, progress, CPU/RAM/data disk, errors and stale feeds.

### Research
Findings, historical replay, strategy candidates/rejections and account-position changes.

### Operator actions
STOP/LIGHT/MAX, refresh market, save TQS snapshot, update product, freeze briefing.

## Home layout target

### Operator strip
- STOP / LIGHT / MAX;
- market state online/degraded/paused;
- `Обновить рынок`;
- `Сохранить TQS`;
- `Обновить продукт`;
- version + short commit;
- freshness/stale indicator;
- active Data Root.

### Market pulse
Metrics plus small time-series sparklines:
- instruments online;
- anomalies now;
- active/new/closed episodes;
- sources online/degraded/error;
- new account position changes;
- research jobs running/queued.

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

### What the machine is doing
Show collector/research/account loops separately with current action and progress. Never hide a heavy job behind a generic `working` state.

### System telemetry
CPU, RAM, TQS process memory, Data Root free space, Data Lake growth, snapshots/minute, errors, last successful save/update.

### Research & Strategy pulse
New findings, historical replays, candidate/rejected/inconclusive runs and latest diagnostics.

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
