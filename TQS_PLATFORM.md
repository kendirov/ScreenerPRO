# TQS_PLATFORM — Technical System Map

## Identity

**Trading QS / TQS** is the umbrella trading platform.

`ScreenerPRO` is the historical GitHub repository name. Treat it as a codebase containing several TQS modules, not as the definition of the whole system.

## Canonical modules

| Module | Purpose | Current ownership |
|---|---|---|
| Intelligence | canonical market state, features, anomalies, health | TQS runtime / platform contracts |
| Launcher | local runtime/update/health/rollback | TQS WORK runtime |
| Screener / Cockpit | trader-facing selection and decision surface | this repo |
| Knowledge | validated cases, concepts, provenance | Drive canon + controlled product surfaces |
| Research / Strategy Lab | hypotheses, event studies, replay, OOS/stability/costs | this repo + canonical TQS runtime/data |
| Academy / Materials | interactive learning surfaces tied to real TQS practice | this repo |
| Briefing / Publishing | briefings, visual explanations, owner-facing outputs | TQS ecosystem |
| Connectors / Data | MOEX/market sources, normalized contracts, Data Lake | canonical TQS data/runtime |

## Source-of-truth split

- **Google Drive**: private owner/product/knowledge canon and decisions.
- **GitHub**: public-safe code, contracts, tests, CI and technical history.
- **Runtime / DB / deployment**: actual operational state.
- **Fresh primary sources**: current external facts.

Do not mirror private Drive into GitHub. Use stable IDs/contracts/manifests and controlled exports.

## Runtime identity

For live/local claims, inspect the current WORK/KENDIROV runtime and configuration. Do not infer liveness from an old URL, old screenshot, green CI or a stale document.

A web page being open does not prove Intelligence/Research is healthy.

## Repo boundaries

This repository is canonical for the current Screener/Cockpit code and Academy/material surfaces already implemented here.

It is **not** the canonical source for generic device automation. The older TQS Desktop Agent code/docs in this repository are historical/reference material; the generic persistent execution fabric is **Artem OS** in `kendirov/tqs-development-factory`.

Standalone experiments such as market maps, collectors or trainers must not silently become new canonical products. They graduate only after explicit ownership, verification and integration decisions.

## New capability rule

1. Identify the owning TQS module.
2. Find the existing code/runtime path.
3. Reuse mature compatible implementations and official APIs where useful.
4. Extend the existing module by default.
5. Split a repo/service only for a proven deployment, security, runtime, toolchain or scale boundary.
6. Verify the owner-facing outcome end-to-end.
