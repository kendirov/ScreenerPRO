# ADR-004 — Bitget public REST adapter

**Status:** accepted and implemented in TQ-004 (2026-09-09)

- `BitgetPublicRestAdapter` implements the public market port through an injectable stdlib transport.
- The boundary is one-shot, GET-only, unauthenticated and read-only. No retry, cache or global rate limiter.
- Bitget envelopes and endpoint shapes are validated centrally and explicitly.
- Unsupported combinations fail before network; MARGIN never silently proxies SPOT.
- `requestTime` is transport metadata, not market event time. Partial snapshot failures remain structured.
- No private calls, execution, WebSocket or persistence are part of TQ-004.
