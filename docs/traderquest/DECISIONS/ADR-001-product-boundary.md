# ADR-001: TraderQuest is a bounded extension of Trading Workspace

- Status: accepted
- Date: 2026-09-09

## Decision

TraderQuest Crypto lives inside the existing `kendirov/ScreenerPRO` modular monorepo and existing Next.js/React Trading Workspace. A competing frontend is not created. Existing Bitget UI and adapters are salvage assets, not permission to clone them.

## Consequences

- Product logic follows Drive `00_CANON` and its exact canonical documents.
- Existing `/screener/bitget` and `/screener/bitget/map` remain the current user surfaces.
- New work must identify reuse/extraction before adding a provider or route.
- TQ-001 is docs/current-state only; no product implementation is started.
