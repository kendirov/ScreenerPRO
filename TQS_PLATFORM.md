# TQS PLATFORM — Repository and product map

## Product identity

Trading QS is an umbrella **domain**, not one monolithic codebase.

The owner-facing projects are deliberately separated:

| Product | Canonical truth | Target repo |
|---|---|---|
| Trading | Drive: `Trading QS / 01_TRADING` | no repo by default |
| TQS Studio | Drive: `Trading QS / 02_TQS STUDIO` | `kendirov/tqs-studio` |
| TQS Intelligence | Drive: `Trading QS / 03_TQS INTELLIGENCE` | `kendirov/tqs-intelligence` |
| TQS Academy | Drive: `Trading QS / 04_TQS ACADEMY` | no repo by default |
| TQS Cockpit | Drive: `Trading QS / 05_TQS COCKPIT` | `kendirov/tqs-cockpit` |
| Artem OS / Agent | Development canon | `kendirov/artem-os` target name; current source `kendirov/tqs-development-factory` |

## Current repository role

`ScreenerPRO` is a historical mixed repository and is now **MIGRATION_SOURCE_ONLY**.

It must not become the owner of new Studio, Intelligence, Academy, Agent, or unrelated TQS work merely because code already exists here.

Current Studio and Cockpit functionality remain here only until extraction and deployment cutover are verified.

## TQS Intelligence rule

Intelligence is currently treated as **no accepted implementation**. Existing collectors, detectors, market-map, research and Strategy Lab code may be reused only after explicit inspection. Old code does not automatically define the new Intelligence architecture.

## TQS Studio rule

Studio is a separate product. Preserve the accepted current Studio behavior during extraction, but future Studio development belongs in `tqs-studio`, not ScreenerPRO.

## TQS Cockpit rule

Screener/Preparation/decision-surface functionality becomes TQS Cockpit and belongs in `tqs-cockpit` after extraction.

## Academy and Trading

These are separate visible projects in Drive, but code repositories are not created just to mirror content. Studio can render/publish Academy material; that does not make Academy part of Studio's code ownership.

## Draft/prototype policy

Do not create a shared scratch repository. Use branches such as `experiment/*`, preview deployments, and explicit acceptance inside the owning product. Accepted work merges there; rejected work is archived there.

## Sources of truth

- Drive = product/knowledge/owner canon.
- GitHub = code/tests/technical history for each product.
- Runtime/deployment/DB = operational truth.
- ScreenerPRO = migration source until retired.

## Retirement

Do not delete old repos as a cleanup mechanism. First migrate/verify, then archive. Archived repos are never automatic routing targets.
