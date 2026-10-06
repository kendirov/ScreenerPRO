# AI SESSION STATE — ScreenerPRO migration checkpoint

## Status

**MIGRATION SOURCE ONLY**

## Active destination map

- Studio -> `kendirov/Studio`
- Intelligence -> `kendirov/Intelligence`
- Screener -> `kendirov/Screener`
- System -> `kendirov/System`
- Academy -> `kendirov/Academy`
- Trading -> `kendirov/Trading`
- Family -> `kendirov/Family`

## Current runtime rule

Do not break a live runtime merely to clean repository names. Extract, repoint, verify, then archive the legacy source.

## Allowed here

- migration/extraction
- urgent production repair
- evidence gathering

## Not allowed here

- new cross-project features
- new Intelligence architecture
- System / Node Agent implementation
- treating old TQS/Cockpit naming as active

## Archive condition

Archive ScreenerPRO only after all live Studio/Screener dependencies are moved and verified.
