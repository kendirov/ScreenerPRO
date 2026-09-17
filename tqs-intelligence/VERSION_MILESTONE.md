# TQS v0.9 — Instrument-first Cockpit milestone

Status: ACTIVE MILESTONE — 2026-09-17

v0.9 marks the transition from a collection of backend/research surfaces to an instrument-first trader workspace.

Minimum contract:
- one instrument is the primary drill-down;
- candles + volume are central, not decorative cards;
- OI/funding/basis/participant metrics are time series with provenance;
- public-account fills may be overlaid only when exact timestamps are known;
- anomalies, episodes, news and strategy runs share the event timeline;
- cross-venue context preserves venue identity while linking the same economic asset;
- missing layers are shown as missing and can trigger bounded backfill;
- Data Lake distinguishes candle history from Metric Lake;
- MAX fills bounded history/metric gaps automatically;
- runtime/product version is one semantic version across API/Launcher/package.

This milestone does not claim that every venue provides every historical metric. Provider limits remain visible in provenance and UI.
