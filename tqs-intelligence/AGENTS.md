# TQS Intelligence — AGENTS

This directory is one product: **TQS Intelligence & Strategy Machine**. Do not fork it into another standalone screener/research app.

Read, in order, only as needed:
1. `AI_OPERATING_CONTEXT.md` — product meaning, research rules, current architecture.
2. `AUTONOMOUS_PRODUCT_CONTRACT.md` — automatic-first owner UX; GPT/chat is the primary product-development input.
3. `PRODUCT_CHANGE_PROTOCOL.md` — how an Artem idea becomes a verified update in the same product.
4. `MACHINE_ACTIVITY_CONTRACT.md` — runtime/activity truth; how the owner knows what is actually running and what useful result is being produced.
5. `DASHBOARD_NEXT_STAGE.md` — target future-cockpit owner UX.
6. `ARCHITECTURE.md` — technical boundaries.
7. `MOEX_DATA_MATRIX.md` — mandatory contract for MOEX/data/selection/participant work.
8. `POSITION_ACCOUNT_INTELLIGENCE.md` — public account vs aggregate participant evidence contract.
9. `STRATEGY_MACHINE_V2.md` — parameter sweeps, controls and profit/loss diagnostics.
10. `HOT_UPDATE_PROTOCOL.md` — safe one-click owner update contract.
11. `README.md` — install/run/operator workflow.
12. Current task + affected source/tests.

Non-negotiable rules:
- Russian owner-facing UI and explanations.
- **Automatic first:** if a universe/source/history can be discovered or derived automatically, do not make manual forms the main workflow. Use `cheap discovery → explainable priority → hot set → deep collection`.
- GPT/chat is the primary input for new sources, detectors, strategies, research and product/UI changes. Manual UI controls are secondary escape hatches.
- Every primary screen must answer `что происходит / почему показано / что машина делает дальше` in 5–20 seconds.
- Every autonomous loop must expose heartbeat, last success, next due time, progress/output and errors according to `MACHINE_ACTIVITY_CONTRACT.md`.
- Never call the machine `RUNNING` merely because CPU/RAM are non-zero, the browser is open, an old log exists, or cached data are visible. Backend heartbeat/runtime truth wins.
- If backend is OFFLINE, Web must mark the visible market snapshot as stale/offline and must not imply that collection/research continues.
- Empty primary sections must show collection/evidence state and next automatic action, not a blank form.
- `Research queue = 0` means no research jobs are currently queued/running; market collection/anomaly tracking may still be active and must be described separately.
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
- A public leaderboard is a **discovery universe**, not a “best trader” list. Rank for research priority and test persistence/copyability separately.
- Free/delayed and premium/realtime series must never be silently merged.
- New user ideas should extend this product through reusable adapters/features/StrategySpecs/views, not create a parallel app.
- Do not stop at scaffold. Primary product slices require an end-to-end path: source/input → processing → persisted state → owner-facing result → objective verification.

Development execution rule:
`ordinary ChatGPT first → GitHub changes → deterministic FAST/FULL/CI → repair → runtime/UI evidence`. Work/Codex/Cursor are escalation only for a concrete capability gap that cannot be closed by GitHub Actions, connected plugins, deployment/runtime APIs, or a small observable bridge.

Checkpoint rule:
After each stable logical slice, commit/push and run the cheapest relevant verification before expanding scope. A long Chat turn is not a persistence layer; GitHub state is the recovery point.

Owner workflow:
`Артём говорит идею → AI resolves true outcome → Idea/contract only if useful → implement/research in same repo → verify → commit → кнопка Обновить → health/runtime proof → функция появляется в той же TQS машине.`
