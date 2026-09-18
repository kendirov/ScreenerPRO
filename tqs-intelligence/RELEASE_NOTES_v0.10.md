# TQS v0.10.0 — MOEX Intelligence / Public Participant Evidence

Status: candidate release — 2026-09-18.

## Owner-facing outcome

v0.10 turns the MOEX reference vertical from a mostly collection/coverage surface into an explainable trader attention layer.

The new path is:

`MOEX snapshots/history → own-history features → explainable anomalies → episodes/research → one instrument timeline`

Participant evidence is kept as separate evidence classes:
- MOEX FUTOI aggregate physical/legal participant series;
- LCHI public individual portfolios and exact public CSV trade history;
- T-Bank Pulse public-profile evidence, with hidden operation size never inferred.

## MOEX own-history feature engine

New `MoexFeatureEngine` complements the existing cross-sectional detector.

It evaluates, where data is available:
- cumulative turnover vs the same Moscow time over the previous 60 days;
- cumulative volume vs same-time baseline;
- trade count vs same-time baseline;
- 5m / 15m / 60m price change;
- short-horizon price percentile;
- 15m / 60m OI change and recent OI percentile;
- spread shock vs recent median;
- high-activity / low-displacement absorption-compression candidates;
- price × OI divergence;
- LCHI position-change clusters.

Every promoted object carries literal Russian reasons. FUTOI with public delay is context only and does not pretend to be a realtime trigger.

## LCHI exact public trades

The 2026 public contest UI exposes a public deals snapshot workflow:
1. `POST /contest-api/api/v1/snapshot/deals/request` with `userId` and market;
2. poll `GET /snapshot/deals/{requestId}/status`;
3. retrieve the public CSV with `POST /snapshot/deals/{requestId}`.

TQS now supports this flow, parses/persists exact public trade timestamps when present, and keeps them separate from portfolio-diff observation timestamps.

MAX progressively downloads one public deals snapshot per LCHI cycle. A participant card can also request a fresh public trade snapshot manually.

## Pulse public profile layer

A separate read-only Pulse store/service was added.

It:
- tracks explicitly provided public handles;
- reads public server-rendered profile state where available;
- stores public operation markers only if they are actually present in public page data;
- always stores `size_known=false` / `quantity=null` when size is hidden;
- never derives notional from portfolio composition.

This is intentionally weaker evidence than LCHI and FUTOI and is labelled accordingly in the UI.

## Cockpit changes

### Мосбиржа
New **Что необычно сейчас** table shows:
- instrument;
- 2–3 concrete WHY SHOWN reasons;
- 15m move;
- turnover / time-of-day norm;
- 15m OI change;
- TQS attention score;
- baseline sample depth.

### Участники
LCHI now shows:
- catalog/portfolio coverage;
- observed position changes;
- exact public trade rows where downloaded;
- separate timestamps and evidence wording.

Pulse adds:
- tracked public profiles;
- sync state;
- public events count;
- explicit hidden-size warning.

### Инструмент
The event rail and price chart now distinguish:
- LCHI portfolio-diff observation markers;
- exact LCHI public trade markers;
- Pulse public operation markers;
- existing anomalies/episodes/news/strategies/accounts.

## API additions

- `GET /api/moex/intelligence`
- `GET /api/moex/participants/lchi/trades`
- `POST /api/moex/participants/lchi/account/{user_id}/trades/sync`
- `GET /api/moex/participants/pulse/status`
- `GET /api/moex/participants/pulse`
- `GET /api/moex/participants/pulse/events`
- `POST /api/moex/participants/pulse/track`

## Evidence and safety boundaries

- anomaly != BUY/SELL;
- public LCHI portfolio diff time != exact trade time;
- exact LCHI trade time is used only from public deals CSV evidence;
- delayed FUTOI never masquerades as realtime;
- Pulse quantity is unknown unless a public source explicitly provides it;
- no participant motive/intelligence/stop is inferred as fact.

## Remaining next layers

v0.10 does not claim the full end-state. High-value next extensions remain:
- richer candle-derived time-of-day baselines beyond locally accumulated quote snapshots;
- explicit stock ↔ future ↔ sector mapping registry for broader linked divergence;
- licensed realtime FUTOI adapter when credentials are available;
- automatic Pulse discovery only if a stable permitted public discovery surface exists;
- additional microstructure/trades/L2 inputs where MOEX/provider access permits;
- larger automated event-study library over the new v0.10 signals.

Runtime/UI acceptance still requires updating the Windows node and proving the new build against real local accumulated data.
