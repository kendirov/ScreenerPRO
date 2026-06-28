# AI_SESSION_STATE — Лаборатория рынка



---



## Текущая задача



**Local dev MOEX_DATA_MODE** — default live, dev scripts, root cause OFF (2026-06-23).



---



## Root cause: localhost OFF



- `frontend/.env` **не содержал** `MOEX_DATA_MODE=off` — default в коде = `live`.

- Dev-сервер был запущен с **inline env**: `MOEX_DATA_MODE=off pnpm dev --port 3000` (сессия стабилизации pipeline). Shell env перебивает `.env` до перезапуска.

- Production на Vercel: env не задан → default `live` → MOEX OK.



**Fix:** `MOEX_DATA_MODE=live` в `frontend/.env`, scripts `dev:live|dev:fallback|dev:off`, перезапуск dev.



---



## Dev commands



```bash

pnpm -C frontend dev:live       # recommended

pnpm -C frontend dev:fallback   # без VPN

pnpm -C frontend dev:off        # empty pipeline test

curl -s localhost:3000/api/screener/health | jq .moexDataMode

```



---



## API verification (2026-06-23)



| Mode | rows | source | isDemo | fallbackReason |

|------|------|--------|--------|----------------|

| prod live | 490 | moex | false | null |

| local live (no VPN) | 0 | moex | false | moex-unavailable |

| local fallback | 3 | fallback | true | explicit-dev-fallback |

| local off | 0 | off | false | data-disabled |



---



## MOEX local



DNS OK, TCP timeout — сеть/VPN. Production MOEX OK.

