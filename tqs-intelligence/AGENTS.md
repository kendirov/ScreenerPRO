# TQS Intelligence — AGENTS

This directory is one product: **TQS Intelligence & Strategy Machine**. Do not fork it into another standalone screener/research app.

## Execution route

Repository-wide execution rules come from `../AGENTS.md` and `../docs/ai/VERIFICATION.md`.

Default executor = **ordinary ChatGPT + connected GitHub/CI/plugins**. Work/Codex/Cursor are capability-gap escalation only. A large task is not, by itself, an escalation reason.

Preferred loop:

`idea → formalize acceptance → same TQS product → automatic discovery first → branch/patch → FAST → repair → FULL/browser → PR → VERIFIED PASS → safe update`

## Read, in order, only as needed

1. `AI_OPERATING_CONTEXT.md` — product meaning, research rules, current architecture.
2. `AUTONOMOUS_PRODUCT_CONTRACT.md` — automatic-first owner UX; GPT/chat is the primary product-development input.
3. `PRODUCT_CHANGE_PROTOCOL.md` — how an Artem idea becomes a verified update in the same product.
4. `DASHBOARD_NEXT_STAGE.md` — target future-cockpit owner UX.
5. `ARCHITECTURE.md` — technical boundaries.
6. `MOEX_DATA_MATRIX.md` — mandatory contract for MOEX/data/selection/participant work.
7. `POSITION_ACCOUNT_INTELLIGENCE.md` — public account vs aggregate participant evidence contract.
8. `STRATEGY_MACHINE_V2.md` — parameter sweeps, controls and profit/loss diagnostics.
9. `HOT_UPDATE_PROTOCOL.md` — safe one-click owner update contract.
10. `README.md` — install/run/operator workflow.
11. Current task + affected source/tests.

Do not load all of these by default. Start from the task and open only the contracts that change implementation or acceptance.

## Non-negotiable product rules

- Russian owner-facing UI and explanations.
- **Automatic first:** if a universe/source/history can be discovered or derived automatically, do not make manual forms the main workflow. Use `cheap discovery → explainable priority → hot set → deep collection`.
- GPT/chat is the primary input for new sources, detectors, strategies, research and product/UI changes. Manual UI controls are secondary escape hatches.
- Every primary screen must answer `что происходит / почему показано / что машина делает дальше` in 5–20 seconds.
- Empty primary sections must show collection/evidence state and next automatic action, not a blank form.
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

## Verification details

TQS FAST/FULL are implemented by repository scripts in `../scripts/ci/` and orchestrated by `.github/workflows/chat-first-verification.yml`.

For deterministic FULL browser checks, external market providers are disabled and runtime data is isolated under `.verification/`. Real provider health belongs to the separate scheduled/manual LIVE workflow.

Owner workflow:
`Артём говорит идею → ordinary Chat делает максимум сам и сначала использует automatic discovery → deterministic verification → при реальном capability gap compact escalation → verified commit/PR → кнопка Обновить → функция появляется в той же TQS машине.`
