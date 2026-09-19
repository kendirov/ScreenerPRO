# TQS TRADER PRODUCT CONTRACT

STATUS: ACTIVE — trader-facing product gate

## 1. Product role
TQS is one continuously running market research terminal. It is not a collection of backend modules, empty forms or independent screeners.

Owner loop:
`рынок → потенциальное движение → кейс → исторический контекст → гипотеза → стратегия → проверка → briefing/course/product knowledge`.

Every future AI/Chat/Codex run extends this same product.

## 2. Five-second rule
The main screen must answer within ~5 seconds:
1. Что происходит на рынках сейчас?
2. Где появились потенциальные места движения?
3. Почему они показаны?
4. Что TQS сейчас делает / считает / ждёт?
5. Куда нажать для доказательств и исторического контекста?

A wall of counters does not pass this gate.

## 3. Main cockpit
The default dashboard must contain useful visual surfaces, not only numbers:
- live resource/process telemetry;
- anomaly/event flow;
- IN PLAY with WHY SHOWN;
- live pipeline state;
- recent anomaly episodes;
- strategy pulse;
- research pulse;
- market/source coverage;
- clear stale/degraded/loading/error state.

STOP / LIGHT / MAX are operator modes, and the UI must make their effect visible.

## 4. Universal Instrument Lab — mandatory
Any instrument (BR, SBER, BTC, etc.) must resolve into one drill-down rather than fragmented pages.

The lab progressively combines, when available:
- candles and volume;
- all stored anomaly markers and episodes;
- anomaly score timeline;
- OI and delta OI;
- funding;
- basis/spread/liquidity/order-flow features;
- stock ↔ futures ↔ sector ↔ index / cross-exchange relations;
- public-account / participant positioning where the source lawfully provides it;
- news/events and later Telegram reaction context;
- Strategy Machine runs;
- research findings and similar historical cases.

Missing history is not a dead end: UI must explain coverage and offer/queue backfill where supported.

## 5. Anomaly semantics
An anomaly means **a location/time of elevated potential movement**, not automatically BUY or SELL.
Direction, entry, stop, target and position management belong to Strategy Machine and need historical validation.

Every anomaly shown to the trader must expose WHY SHOWN and allow graph drill-down before/through/after the event.

## 6. In Play semantics
IN PLAY is not a top-gainers table.
Primary surface = validated current anomalies / state changes.
If the threshold has no qualifying anomaly, a secondary WATCH list may show unusual movers/liquidity, but it must be explicitly labelled as observation, not signal.

Priority should evolve around abnormality × liquidity/relevance × freshness, with transparent reasons.

## 7. Strategy Machine
An owner idea such as `покупать каждое падение`, `отскок от круглых`, `буферная зона`, or a future pattern becomes a reproducible StrategySpec.

Required research path where applicable:
exploration → control/placebo → chronological validation/OOS → holdout → walk-forward/stability → costs/slippage → regime diagnostics → candidate/rejected/needs-data.

Strategy results must be visible in the trader UI and linked back to the instrument/cases that generated them.

## 8. Research surfaces
Empty research pages are forbidden as a final UI state.
When evidence is insufficient, show:
- what is accumulating;
- sample size / coverage;
- queued/running jobs;
- why no conclusion exists yet;
- next automatic action and required mode (LIGHT/MAX).

Machine findings are hypotheses/candidates until deterministic gates pass.

## 9. Idea Inbox = product queue
The primary idea input is the owner conversation, not a form.
A meaningful owner idea must become either:
- implemented product change, or
- persistent Idea Inbox object with origin, kind, priority/status, next_action and links to research/strategy/implementation when available.

A manual form is only a secondary capture path.

## 10. MOEX PRO
MOEX must be a linked market lab, not a flat catalog:
`stock ↔ futures ↔ sector ↔ index ↔ OI ↔ participants ↔ events/news ↔ anomalies ↔ historical cases ↔ strategies`.

Free/delayed and premium/realtime data must remain provenance-distinct.
Future premium participant data (physical/legal entities, OI, participant counts/deltas) plugs into the same feature/research/visual stack without a parallel app.

## 11. News / event intelligence
News is an event, not automatically a cause.
Future official/Telegram feeds are synchronized with price/volume/OI/anomaly response, and reaction hypotheses must be tested historically.

## 12. Briefing and course
Briefing is a view over the same intelligence core, not a second manual collection workflow.
Validated cases should be reusable for:
- interactive briefing / live stream;
- presentation/export;
- Telegram material;
- course examples/counterexamples.

## 13. Update UX
`Обновить продукт` must be an operator-grade action:
check remote → safe fast-forward → dependency/preflight → restart → healthcheck → rollback on failure → browser cache bust/reload → visible new version/change summary.

The trader should not need GitHub Desktop for normal future updates.

## 14. Definition of done for a TQS feature
A substantial trader feature is not done until the applicable chain exists:
`source/data → normalize/store → compute/research → explain → visual surface → drill-down/operator action → objective verification`.

For UI changes require at minimum:
- JS/API/CI gate;
- loading/empty/error/stale states;
- desktop usability;
- real browser/screenshot interaction evidence when an accessible runtime exists.

Do not report a hidden API, database table or empty placeholder page as a finished trader feature.
