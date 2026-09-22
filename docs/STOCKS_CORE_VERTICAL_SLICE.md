# Stocks Core — следующий проверяемый vertical slice

**Цель:** 20 ликвидных акций → reliable same-time Turnover x → cumulative Trades x → impulse → максимум 1–5 In Play → причина → inspector.

## Scope v0

- Instrument Master фиксирует 20 symbols, venue/session/tradable/tick/currency/source.
- Snapshot каждые 10 минут сохраняет cumulative `turnover` и `NUMTRADES` с `event_time`, `received_at`, `source`, `quality`.
- Baseline только same-time buckets; до покрытия минимум 20 сессий ratio = `null`.
- Activity: Turnover x, Trades x, trades/min, turnover/min, acceleration.
- Situation: `Quiet/Waking/In Play/Impulse/Hold/Pullback/Fade`.
- In Play: eligibility gates + reason dictionary; shortlist 1–5, без обязательного единого score.
- Inspector: provenance, freshness, baseline coverage, session timeline, impulse/hold, driver links.

## Acceptance

1. У каждого поля есть source, timestamp, freshness и quality flag.
2. Нет reliable ratio при missing/partial baseline.
3. Snapshot воспроизводит результат на fixture.
4. Причина восстанавливается из фактов и словаря.
5. Пустой In Play — нормальное состояние.
6. `/screener/stocks` не меняется до Preview QA.
7. Contract checks + build + smoke проходят; browser QA отмечен отдельно.

## Не включать в v0

Истинный DOM/replay, iceberg inference, news causality, paid entitlements и futures rollover.
