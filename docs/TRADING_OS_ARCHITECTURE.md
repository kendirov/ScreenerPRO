# Trading OS architecture

**Дата:** 2026-08-13  
**Канон:** ScreenerPRO — market terminal; Knowledge/Training — отдельный контур; Presentation OS — отдельное Studio/Player-приложение.

## Граница продуктов

```text
Trading OS
├── ScreenerPRO        market runtime: scan → inspect → prepare
├── Knowledge/Training training runtime: explain → practice → replay
└── Presentation OS    authoring/runtime: Studio → immutable Release → Player
```

Репозитории не объединяются автоматически, iframe и прямое чтение таблиц друг друга запрещены. Первая интеграция — deep links с `symbol`, `situation`, `source`; следующий шаг — версионируемый release manifest. SSO/entitlements — после стабилизации контрактов.

## ScreenerPRO L1/L2/L3

- **L1 Scan:** 1–5 кандидатов, Activity/Attention, Execution Quality, Setup Quality, reason, freshness и data-quality.
- **L2 Inspect:** stock/futures inspector, session memory, driver context, baseline provenance, scenario/invalidation.
- **L3 Deep:** DOM/tape/cluster analytics, replay, linked Knowledge cards, research evidence.

Все недоступные метрики — `null` и честный статус, никогда не demo/fallback без явной маркировки.

## Core model

Единый Situation Engine не заменяет данные одним score:

1. **Activity / Attention** — Turnover x, Trades x, trades/sec, turnover/sec, acceleration.
2. **Execution Quality** — spread ticks, depth, tick value, liquidity, DOM relevance, freshness.
3. **Setup Quality** — impulse, hold, breakout, pullback, absorption proxy, relative/driver confirmation.

Итоговый In Play — ограниченный shortlist, а причина — словарь фактов.

## Состояния сессии

`Quiet → Waking → In Play → Impulse → Hold → Pullback → Fade`

Snapshots: `now / 5m / 20m / 40m / 60m`; переход требует timestamp, входных фактов и quality flags.

## Контракт Presentation OS

ScreenerPRO публикует только `symbol`, `event_time`, `situation_key`, `evidence_refs`, `data_quality`, `source_version`. Presentation OS владеет draft/revision/release/player и не получает рыночные секреты, cookie-сессию ScreenerPRO или прямой доступ к его БД.
