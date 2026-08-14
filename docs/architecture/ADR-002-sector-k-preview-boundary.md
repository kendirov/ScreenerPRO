# ADR-002: Sector K Preview boundary

Status: accepted for Preview

Date: 2026-08-14

## Context

ScreenerPRO production is stable on `main`, while experimental navigation, Bitget and Studio work live in independent Draft PRs. The new product direction needs a coherent visual and functional result without merging those histories or rewriting proven market logic.

## Decision

1. Sector K lives in the existing ScreenerPRO repository under the `/sector-k` namespace during the Preview phase.
2. Existing `/screener`, `/materials`, `/lab`, APIs and production aliases remain unchanged.
3. Sector K consumes the existing read-only `/api/screener` contract and pure domain selectors.
4. Sector K owns its semantic design tokens and shell; dark and light themes share one token system.
5. Studio v1 is content-as-code and Preview-only. It models lifecycle, visibility and revisions but does not claim browser persistence or production publishing.
6. Presentation OS remains an independent private Studio/Player runtime. Future integration is a versioned release manifest or API, never shared cookies, direct database reads or repository merging.
7. Bitget remains on its donor branch. Crypto UI in Sector K v1 exposes the provider boundary and an explicit not-connected state.

## Consequences

- The Preview diff stays reviewable and production-safe.
- The new visual direction can be tested with real MOEX data immediately.
- Studio persistence, authenticated publishing, crypto and strategy expansion remain explicit follow-up slices.
- A future production launch can promote the namespace, change the root route or use a dedicated domain only after owner review and Preview QA.
