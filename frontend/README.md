# Super Screener Foundation

Production-oriented foundation for a MOEX stocks/futures platform built with Next.js App Router, strict TypeScript, and typed mock data.

## Local MOEX data modes

Default: **`MOEX_DATA_MODE=live`** (see `frontend/.env.example`).

```bash
pnpm dev:live       # live MOEX (recommended)
pnpm dev:fallback   # dev dataset when iss.moex.com unreachable
pnpm dev:off        # empty pipeline (source=off)
```

If UI shows **OFF · data-disabled** but `.env` says `live` — restart dev server (old process may have been started with `MOEX_DATA_MODE=off` in shell).

Check active mode: `curl -s localhost:3000/api/screener/health | jq .moexDataMode`

Details: `docs/MOEX_DATA_PIPELINE.md`

## Stack

- Next.js 16 + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn-style UI primitives
- Motion for React (academy scene animations)
- TanStack Query/Table/Virtual
- Lightweight Charts
- Supabase JS client (prepared, not connected)
- Zod runtime validation

## Architecture Decisions

- **Route groups:** `app/(public)` and `app/(app)` separate marketing/academy routes from authenticated product routes.
- **App shell boundary:** shared sidebar + top bar is applied only in authenticated route group.
- **Entitlement boundary:** premium gate handled by `components/premium/entitlement-boundary.tsx` to keep access control composable.
- **Typed domain layer:** `lib/types`, `lib/mock`, `lib/validation`, and `lib/formatters` isolate business data shape from UI concerns.
- **Client logic minimized:** rendering-heavy features (virtual table, chart, animations) are client components; page orchestration stays server-first.

## Routes Implemented

- `/`
- `/screener`
- `/stocks/[ticker]`
- `/futures/[ticker]`
- `/academy`
- `/academy/[slug]`
- `/pricing`
- `/login`
- `/app/watchlist`
- `/app/settings`

## Where Real Data Plugs In Later

- Replace `lib/mock/screener.ts` with query functions connected to MOEX ingestion services.
- Keep UI contracts stable by preserving `lib/types/market.ts` interfaces.
- Use TanStack Query in feature modules for cache and background refresh.
- Extend `lib/supabase/client.ts` with server/client auth helpers and RLS-aware data access.

## Premium Gating Model (Prepared)

- UI lock/unlock behavior lives in `EntitlementBoundary`.
- Entitlements currently come from `premiumFlagsMock` (mock only).
- Future flow: session -> entitlement lookup -> SSR gate at layout/page boundary + client fallback.

## Mock-only Areas in This Step

- Screener market feed and analytics metrics
- Instrument deep analytics modules
- Academy content catalog and article scenes
- Pricing/checkout behavior
- Auth and billing

## Run

```bash
pnpm install
pnpm dev
```
