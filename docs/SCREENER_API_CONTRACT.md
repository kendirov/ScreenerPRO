# Screener API Contract

Единый контракт ответа `GET /api/screener`.

## Query

| Param | Values | Default |
|-------|--------|---------|
| `assetClass` | `stock` \| `future` \| `all` | `all` |
| `date` | `YYYY-MM-DD` (historical) | live snapshot |

## Response

```typescript
type ScreenerApiResponse = {
  assetClass: "stock" | "future" | "all";
  rows: ScreenerInstrument[];
  benchmarks: ScreenerBenchmark[];
  status: ScreenerDataStatus;
  diagnostics?: ScreenerDiagnostics;
};
```

### `status` (UI source of truth)

| Field | Meaning |
|-------|---------|
| `source` | `moex` \| `fallback` \| `demo` \| `off` |
| `isDemo` | `true` → учебный/fallback набор, **не** live |
| `staleCache` | `true` → кэш последнего live-снимка |
| `fallbackReason` | `moex-unavailable` \| `validation-failed` \| `no-usable-rows` \| `explicit-dev-fallback` \| `data-disabled` \| null |
| `message` | Человекочитаемое объяснение для empty/error UI |

**Live OK:** `source=moex`, `isDemo=false`, `rows.length > 0`, `fallbackReason=null`.

**Live fail:** `source=moex`, `isDemo=false`, `rows.length === 0`, HTTP **503**, `fallbackReason=moex-unavailable`.

**Explicit dev fallback:** `source=fallback`, `isDemo=true`, `rows.length > 0`, `fallbackReason=explicit-dev-fallback`, HTTP 200.

**Data disabled:** `source=off`, `isDemo=false`, `rows.length === 0`, `fallbackReason=data-disabled`, HTTP 200.

**Stale cache:** `source=moex`, `staleCache=true`, rows > 0, HTTP 200.

### `diagnostics`

| Field | Meaning |
|-------|---------|
| `fetchMs` | Wall-clock пайплайна |
| `moexOk` | MOEX ISS вернул usable snapshot |
| `fallbackUsed` | demo, stale cache или disabled |
| `rowsRaw` / `rowsNormalized` | До клиентских фильтров |
| `rowsBeforeFilter` / `rowsAfterFilter` | Серверная агрегация по assetClass |
| `errors` | Технические сообщения (dev/debug) |

## Timeout policy

| Env | Default `MOEX_HTTP_TIMEOUT_MS` |
|-----|--------------------------------|
| development | 12000 ms |
| production | 12000 ms |

Override: env `MOEX_HTTP_TIMEOUT_MS` (clamped 3000–15000).

MOEX retries: **0** (screener path).

## Data mode (`MOEX_DATA_MODE`)

| Mode | Default | After live failure |
|------|---------|-------------------|
| `live` | dev + prod | 503 or stale cache |
| `fallback` | — | demo rows (dev only, explicit reason) |
| `off` | — | skip MOEX, empty off response |

Production: demo blocked unless `ALLOW_DEMO_MARKET_DATA=true`.

See `docs/MOEX_DATA_PIPELINE.md`.

## Client hook

`useScreenerQuery` читает **`rows`**, **`status`**, **`diagnostics`**.

Loading UI: только `isPending && data === undefined` (`isScreenerInitialLoading`).

`rows.length === 0` после завершения запроса → **empty**, не loading.

## Verify

```bash
pnpm -C frontend exec tsx scripts/diagnose-moex-connectivity.ts --production
curl -s 'http://localhost:3000/api/screener?assetClass=stock' | jq '{source: .status.source, isDemo: .status.isDemo, rows: (.rows|length), fetchMs: .diagnostics.fetchMs, fallback: .status.fallbackReason}'
pnpm -C frontend exec tsx scripts/verify-screener-api-schema.ts http://localhost:3000
```

Production URL: `https://screenerpro.vercel.app`

### Local dev scripts

```bash
pnpm -C frontend dev:live
pnpm -C frontend dev:fallback
pnpm -C frontend dev:off
curl -s localhost:3000/api/screener/health | jq '{moexDataMode, moexFetchStatus}'
```

If localhost shows `source=off` while `.env` has `live` — **restart dev** (shell env from previous launch overrides `.env`).
