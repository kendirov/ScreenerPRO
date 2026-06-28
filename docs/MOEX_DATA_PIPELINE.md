# MOEX Data Pipeline

Live-first загрузка рыночных данных для скринера.

## Источник

- **Primary:** MOEX ISS (`https://iss.moex.com/iss`)
- **Stocks:** `/engines/stock/markets/shares/boards/TQBR/securities.json?iss.only=securities,marketdata`
- **Futures:** `/engines/futures/markets/forts/securities.json?iss.only=securities,marketdata`
- **Index (IMOEX):** secondary — не блокирует stocks/futures

## Режимы (`MOEX_DATA_MODE`)

| Mode | Default | Поведение |
|------|---------|-----------|
| `live` | **dev + prod** | Live MOEX → stale cache (до 30 min) → **503** без auto-demo |
| `fallback` | — (dev only) | Live MOEX → stale cache → **учебный набор** (`source=fallback`, `isDemo=true`, `fallbackReason=explicit-dev-fallback`) |
| `off` | — | **Не ходить в MOEX** → `rows=[]`, `source=off`, `fallbackReason=data-disabled` |

Production/Vercel: `fallback` и `off` **не подставляют demo** — при ошибке MOEX только 503 или stale cache. Demo только при явном `ALLOW_DEMO_MARKET_DATA=true` (аварийный override).

Legacy: `MOEX_DATA_MODE=demo` трактуется как `fallback`.

## Dev scripts (local)

```bash
pnpm -C frontend dev:live       # MOEX_DATA_MODE=live (рекомендуется)
pnpm -C frontend dev:fallback   # MOEX_DATA_MODE=fallback — учебный набор без VPN
pnpm -C frontend dev:off        # MOEX_DATA_MODE=off — пустой pipeline
pnpm -C frontend dev            # читает MOEX_DATA_MODE из frontend/.env (default live)
```

**Windows:** inline `MOEX_DATA_MODE=live` в scripts не работает в cmd — задайте `MOEX_DATA_MODE=live` в `frontend/.env` и запускайте `pnpm dev`.

### Почему localhost показывает OFF?

1. **`frontend/.env` содержит `MOEX_DATA_MODE=off`** — смените на `live`, перезапустите dev.
2. **Dev-сервер запущен с inline env** — например `MOEX_DATA_MODE=off pnpm dev` из прошлой сессии. Shell env **перебивает** `.env` до перезапуска.
3. **Не default в коде** — `getMoexDataMode()` без переменной возвращает `live`.

Проверить активный режим:

```bash
curl -s http://localhost:3000/api/screener/health | jq '{moexDataMode, moexFetchStatus}'
```

После смены режима **обязательно перезапустите** `next dev`.

## Env

```bash
MOEX_BASE_URL="https://iss.moex.com/iss"
MOEX_HTTP_TIMEOUT_MS="12000"   # clamp 3000–15000
MOEX_DATA_MODE="live"          # live | fallback | off
ALLOW_DEMO_MARKET_DATA="false" # true = разрешить demo после провала live (dev/prod override)
```

## Timeout

- Default: **12000 ms** (dev и prod)
- Retries: **0** на screener path
- Intraday baselines: budget ≤3s, не блокируют snapshot

## Fallback policy

Demo/fallback **не считается рабочим live-состоянием**.

1. `fetchStocksFromIss` ∥ `fetchFuturesFromIss` (`Promise.allSettled`)
2. Если есть rows → live response (`source=moex`, `isDemo=false`)
3. IMOEX/index — после empty-check, ошибка index не переводит в demo
4. При провале live: stale cache (до 30 min) → demo только если `MOEX_DATA_MODE=fallback` или `ALLOW_DEMO_MARKET_DATA=true`
5. Иначе: HTTP **503** + `buildUnavailableScreenerResponse` (`source=moex`, `fallbackReason=moex-unavailable`)

## Диагностика сети / MOEX

```bash
pnpm -C frontend exec tsx scripts/diagnose-moex-connectivity.ts --production
```

Проверяет: DNS, curl HEAD, Node fetch, timeout, proxy env, production/local API.

Ручные команды:

```bash
nslookup iss.moex.com
curl -I --connect-timeout 15 --max-time 15 \
  'https://iss.moex.com/iss/engines/stock/markets/shares/securities.json?iss.meta=off'
node -e "fetch('https://iss.moex.com/iss/engines/stock/markets/shares/securities.json?iss.only=securities&securities.limit=1',{signal:AbortSignal.timeout(12000)}).then(r=>console.log(r.status)).catch(e=>console.error(e))"
```

### Локально MOEX недоступен

Симптом: curl timeout / `TypeError: fetch failed`, DNS резолвится.

- API (live mode): **503**, `rows=0`, `source=moex`, `isDemo=false`, `fallbackReason=moex-unavailable`
- UI: error badge «ошибка данных», empty state с причиной — **не** demo rows
- Для UI без VPN: `MOEX_DATA_MODE=fallback` в `frontend/.env`, перезапуск dev

### Отличить live от fallback

| | Live OK | Live fail | Explicit fallback |
|--|---------|-----------|-------------------|
| HTTP | 200 | 503 | 200 |
| rows | >100 | 0 | >0 (mock) |
| source | moex | moex | fallback |
| isDemo | false | false | true |
| fallbackReason | null | moex-unavailable | explicit-dev-fallback |
| UI badge | LIVE + MOEX ISS | ошибка данных | DEV · учебный набор |

## Verify

```bash
# Local live (MOEX недоступен → 503)
curl -s -w '\nHTTP %{http_code}\n' 'http://localhost:3000/api/screener?assetClass=stock' \
  | jq '{source: .status.source, isDemo: .status.isDemo, rows: (.rows|length), fallback: .status.fallbackReason}'

# Local fallback (перед запуском: MOEX_DATA_MODE=fallback в .env)
curl -s 'http://localhost:3000/api/screener?assetClass=stock' \
  | jq '{source: .status.source, isDemo: .status.isDemo, rows: (.rows|length), fallback: .status.fallbackReason}'

# Production live
curl -s 'https://screenerpro.vercel.app/api/screener?assetClass=stock' \
  | jq '{source: .status.source, isDemo: .status.isDemo, rows: (.rows|length), fallback: .status.fallbackReason}'

pnpm -C frontend exec tsx scripts/verify-screener-api-schema.ts https://screenerpro.vercel.app
```

Успех (MOEX доступен): `source=moex`, `isDemo=false`, stock rows > 100.
