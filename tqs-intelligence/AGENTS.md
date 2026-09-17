# TQS Intelligence — AGENTS

This directory is the **local compute/data/research engine module of the wider TQS Platform**. It is not the whole TQS umbrella and must not fork into another standalone screener/research product.

For cross-module/product decisions read repository root `../TQS_PLATFORM.md` first. TQS Screener/Cockpit, Knowledge and Briefing should consume the contracts/results produced here rather than reimplementing the same collection/research logic.

Read, in order, only as needed:
1. `../TQS_PLATFORM.md` — platform/module boundaries and source-of-truth map when the task crosses this module.
2. `AI_OPERATING_CONTEXT.md` — Intelligence meaning, research rules, current architecture.
3. `AUTONOMOUS_PRODUCT_CONTRACT.md` — automatic-first owner UX; GPT/chat is the primary product-development input.
4. `PRODUCT_CHANGE_PROTOCOL.md` — how an Artem idea becomes a verified update in the same product.
5. `MACHINE_ACTIVITY_CONTRACT.md` — runtime/activity truth.
6. `TQS_DIAGNOSTICS_CONTRACT.md` — support/full snapshot, redaction and incident handoff.
7. `OVERNIGHT_RUNBOOK.md` — autonomous MAX behavior and morning acceptance.
8. `METRIC_CATALOG.md` — canonical expandable data/metric families and provenance rules.
9. `DASHBOARD_NEXT_STAGE.md` — target future-cockpit owner UX.
10. `ARCHITECTURE.md` — technical boundaries.
11. `MOEX_DATA_MATRIX.md` — MOEX/data/selection/participant work.
12. `POSITION_ACCOUNT_INTELLIGENCE.md` — public account vs aggregate participant evidence contract.
13. `STRATEGY_MACHINE_V2.md` — parameter sweeps, controls and diagnostics.
14. `HOT_UPDATE_PROTOCOL.md` — safe one-click owner update contract.
15. `README.md` — install/run/operator workflow.
16. Current task + affected source/tests.

Non-negotiable rules:
- Russian owner-facing UI and explanations.
- **Automatic first:** if a universe/source/history can be discovered or derived automatically, do not make manual forms the main workflow. Use `cheap discovery → explainable priority → hot set → deep collection`.
- GPT/chat is the primary input for new sources, detectors, strategies, research and product/UI changes. Manual UI controls are secondary escape hatches.
- Every primary screen must answer `что происходит / почему показано / что машина делает дальше` in 5–20 seconds.
- Every autonomous loop must expose heartbeat, last success, next due time, progress/output and errors according to `MACHINE_ACTIVITY_CONTRACT.md`.
- **Never restart on one failed HTTP health probe.** Heavy history/research can delay API responses. Use process evidence + supervisor heartbeat + hysteresis. Destructive recovery is a last resort after a sustained outage.
- Supervisor heartbeat and backend HTTP health are different signals; do not collapse them into one boolean.
- Never call the machine `RUNNING` merely because CPU/RAM are non-zero, the browser is open, an old log exists, or cached data are visible.
- If backend is OFFLINE, Web must mark visible cached market data stale/offline and must not imply that collection/research continues.
- Empty primary sections must show collection/evidence state and next automatic action, not a blank form.
- `Research queue = 0` means no explicit research jobs are queued/running; in MAX, History Autopilot may generate the next useful jobs automatically. Market collection/anomaly tracking are independent.
- MAX is a work policy, not a cosmetic label: when safe capacity exists it should enrich data/research autonomously according to `OVERNIGHT_RUNBOOK.md`.
- Anomaly = a candidate **location/time of potential movement**, not automatically BUY/SELL.
- Direction/entry/exit belong to Strategy Machine and require historical tests.
- No trading edge claim without controls, chronological OOS/holdout, walk-forward/stability and realistic costs.
- Parameter diagnostics generate a new hypothesis; never retrofit a discovered filter into the same untouched holdout.
- Preserve provenance, negative results and data-quality limitations.
- Raw ticks/orderbook are never sent wholesale to an LLM.
- Deterministic research computes facts; AI proposes hypotheses/improvements and reads compact outputs.
- Explain `ПОЧЕМУ ПОКАЗАНО`; do not expose an unexplained magic score as the main rationale.
- Heavy history belongs in Parquet Data Lake, preferably on the largest non-system drive.
- New metric/source work follows `METRIC_CATALOG.md`: semantics/unit/provenance first, then collection/storage, then feature/research/UI use.
- Drive/GitHub/runtime truth boundaries from `TQS_PLATFORM.md` remain in force.
- **Public-repo rule:** never commit secrets, private Drive content/IDs for convenience, raw private diagnostic exports or private account payloads. Default support snapshots are redacted.
- UI changes require loading/empty/error/stale states and chart/drill-down usability.
- Safe updates preserve local data and roll back if healthcheck fails.
- MOEX work treats stock/futures/sector/index/OI/participants/news/anomalies as linkable objects, not independent flat tables.
- Public/authorized individual accounts and MOEX aggregate participant positions are different evidence levels.
- Do not infer trader motive, intelligence or hidden stops as fact from public account data; express measured patterns and testable hypotheses.
- A public leaderboard is a discovery universe, not a “best trader” list.
- Free/delayed and premium/realtime series must never be silently merged.
- New user ideas extend TQS through reusable adapters/features/StrategySpecs/views; no parallel app unless a concrete platform boundary justifies it.
- Do not stop at scaffold. Primary product slices require `source/input → processing → persisted state → owner-facing result → objective verification`.

Development execution rule:
`ordinary ChatGPT first → GitHub changes → deterministic FAST/FULL/CI → repair → runtime/UI evidence`. Work/Codex/Cursor are escalation only for a concrete capability gap that cannot be closed by GitHub Actions, connected plugins, deployment/runtime APIs, or a small observable bridge.

Checkpoint rule:
After each stable logical slice, commit/push and run the cheapest relevant verification before expanding scope. A long Chat turn is not a persistence layer; GitHub state is the recovery point.

Owner workflow:
`Артём говорит идею → AI resolves TQS module + true outcome → implement/research in same platform → verify → commit → кнопка Обновить → health/runtime proof → result becomes visible/reusable in TQS.`
