# START HERE FOR AI — ScreenerPRO migration source

This repository is a **legacy mixed migration source**. It is not an active project identity.

Active projects are only:

- **System** -> target `kendirov/System`; Drive: `System / 00_START HERE — SYSTEM`
- **Studio** -> target `kendirov/Studio`; Drive: `Studio / 00_START HERE — STUDIO`
- **Intelligence** -> target `kendirov/Intelligence`; Drive: `Intelligence / 00_START HERE — INTELLIGENCE`
- **Screener** -> target `kendirov/Screener`; Drive: `Screener / 00_START HERE — SCREENER`
- **Academy** -> target `kendirov/Academy`; Drive: `Academy / 00_START HERE — ACADEMY`
- **Trading** -> target `kendirov/Trading`; Drive: `Trading / 00_START HERE — TRADING`
- **Family** -> target `kendirov/Family`; Drive: `Family / 00_START HERE — FAMILY`

## What ScreenerPRO is for now

Allowed:
1. migration/extraction;
2. urgent repair of a runtime that still depends on this repository;
3. read-only archaeology/reference.

Not allowed:
- new cross-project product work;
- new Intelligence implementation;
- new System / Agent work;
- treating ScreenerPRO as the default home for Studio or Screener.

## Migration direction

- extract current Studio code/runtime into `Studio`;
- extract trader-facing market display/search/briefing surfaces into `Screener`;
- start Intelligence as its own project and reuse old code only after explicit review;
- archive ScreenerPRO only after cutover and verification.

Legacy names such as TQS Studio, TQS Intelligence and Cockpit are retired.
