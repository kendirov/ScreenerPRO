# AI_SESSION_STATE — ScreenerPRO migration checkpoint

## Status

**MIGRATION SOURCE ONLY.**

The owner has explicitly separated Trading QS into distinct projects. New cross-product work must not accumulate in ScreenerPRO.

## Target project map

- Studio -> `kendirov/tqs-studio` (private target; current implementation still here until migration).
- Intelligence -> `kendirov/tqs-intelligence` (private target; clean-slate implementation, old components are reference candidates only).
- Cockpit -> `kendirov/tqs-cockpit` (private target; extract current screener/preparation surfaces).
- Academy -> Drive-first project; no repo by default.
- Trading -> Drive-first project; no repo by default.
- Agent/device execution -> Artem OS, not this repository.

## Current Studio runtime

The current production Studio and its accepted behavior must remain operational during migration. Do not rebuild or replace it merely because the repository boundary changes.

## New work policy

Allowed here:
- migration/extraction;
- urgent production repair;
- evidence gathering for migration.

Not allowed here:
- new Intelligence product implementation;
- new Agent implementation;
- new cross-product TQS features that have an owning target project.

## Migration acceptance

ScreenerPRO can be archived only after:
1. Studio code is extracted to `tqs-studio`;
2. Studio deployment is repointed and verified;
3. Cockpit code is extracted to `tqs-cockpit`;
4. Cockpit deployment/runtime is verified;
5. all required shared code is either duplicated intentionally with ownership or moved into a justified shared package;
6. no active deployment still depends on ScreenerPRO.

Do not delete the repository.
