# TQS Intelligence — AGENTS

This directory is one product: **TQS Intelligence & Strategy Machine**. Do not fork it into another standalone screener/research app.

Read, in order, only as needed:
1. `AI_OPERATING_CONTEXT.md` — product meaning, research rules, current architecture.
2. `PRODUCT_CHANGE_PROTOCOL.md` — how an Artem idea becomes a verified update in the same product.
3. `DASHBOARD_NEXT_STAGE.md` — target future-cockpit owner UX.
4. `ARCHITECTURE.md` — technical boundaries.
5. `MOEX_DATA_MATRIX.md` — mandatory contract for MOEX/data/selection/participant work.
6. `POSITION_ACCOUNT_INTELLIGENCE.md` — public account vs aggregate participant evidence contract.
7. `STRATEGY_MACHINE_V2.md` — parameter sweeps, controls and profit/loss diagnostics.
8. `HOT_UPDATE_PROTOCOL.md` — safe one-click owner update contract.
9. `README.md` — install/run/operator workflow.
10. Current task + affected source/tests.

Non-negotiable rules:
- Russian owner-facing UI and explanations.
- Anomaly = a candidate **location/time of potential movement**, not automatically BUY/SELL.
- Direction/entry/exit belong to Strategy Machine and require historical tests.
- No trading edge claim without controls, chronological OOS/holdout, walk-forward/stability and realistic costs.
- Parameter diagnostics generate a new hypothesis; never retrofit a discovered filter into the same untouched holdout.
- Preserve provenance, negative results and data-quality limitations.
- Raw ticks/orderbook are never sent wholesale to an LLM.
- The deterministic research layer computes facts; AI proposes hypotheses/improvements and reads compact outputs.
- Explain `ПОЧЕМУ ПОКАЗАНО`; do not expose an unexplained magic score as the main rationale.
- Heavy history belongs in Parquet Data Lake, preferably on the largest non-system drive.
- Existing Drive/GitHub/runtime truth boundaries remain in force.
- UI changes require loading/empty/error/stale states and chart/drill-down usability.
- Safe updates must preserve local data and roll back if healthcheck fails.
- MOEX work must treat stock/futures/sector/index/OI/participants/news/anomalies as linkable objects, not independent flat tables.
- Public/authorized individual accounts and MOEX aggregate participant positions are different evidence levels and must never be presented as the same thing.
- Do not infer trader motive, intelligence or hidden stops as fact from public account data; express measured patterns and testable hypotheses.
- Free/delayed and premium/realtime series must never be silently merged.
- New user ideas should extend this product through reusable adapters/features/StrategySpecs/views, not create a parallel app.

Owner workflow:
`Артём говорит идею → Idea Inbox → формализовать → реализовать/research → verify → commit → кнопка Обновить → функция появляется в той же TQS машине.`
