# START_HERE_FOR_AI — ScreenerPRO migration source

This repository is a **migration source**, not the default TQS repository.

## Mandatory routing

Before changing code, identify the actual product:

- **TQS Studio** -> target repository: `kendirov/tqs-studio` (private, to be created during migration). Drive canon: `Trading QS / 02_TQS STUDIO`.
- **TQS Intelligence** -> target repository: `kendirov/tqs-intelligence` (private, clean-slate implementation; old code is reference only). Drive canon: `Trading QS / 03_TQS INTELLIGENCE`.
- **TQS Cockpit** -> target repository: `kendirov/tqs-cockpit` (private, to be extracted from the current ScreenerPRO code). Drive canon: `Trading QS / 05_TQS COCKPIT`.
- **TQS Academy** -> Drive-first content project: `Trading QS / 04_TQS ACADEMY`; no standalone code repo unless a real deployment/toolchain boundary appears.
- **Trading** -> Drive-first knowledge/operations project: `Trading QS / 01_TRADING`.
- **Artem OS / Node Agent** -> current source `kendirov/tqs-development-factory`, target name `kendirov/artem-os`. Never implement generic device automation here.

## ScreenerPRO status

`kendirov/ScreenerPRO` is retained temporarily because current Studio and Cockpit code/deployments still originate here.

New cross-product work is **not allowed** here.

Use this repository only for:
1. migration/extraction to the correct target project;
2. urgent production fixes that cannot wait for migration;
3. read-only archaeology/reference.

Do not add new Intelligence implementations here.

## Current migration order

1. Create private target repos: `tqs-studio`, `tqs-intelligence`, `tqs-cockpit`.
2. Extract Studio with history/evidence and repoint its deployment.
3. Extract Cockpit and repoint its deployment.
4. Start Intelligence cleanly in its own repo; selectively import only proven reusable components.
5. Verify target repos and deployments.
6. Archive ScreenerPRO. Do not delete it during migration.

## Draft/prototype rule

There is no global "draft repo". Each product uses its own `experiment/*` or feature branches plus preview deployments. Once accepted, merge inside that product repository.

## Read next

- `TQS_PLATFORM.md`
- `AI_SESSION_STATE.md`
- affected product Drive START/CURRENT_STATE

Legacy `PROJECT_CONTEXT.md` is reference only.
