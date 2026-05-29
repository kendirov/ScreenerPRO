# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Vercel screener: live MOEX вместо demo-заглушек** (2026-05-29).

---

## Что сделано

### Корневая причина

На Vercel `DATABASE_URL=file:./prisma/dev.db` → Prisma пытался открыть SQLite в serverless → ошибка пробивала весь `/api/screener` → silent fallback на 3 demo-акции (SBER, GAZP, LKOH). Локально SQLite доступен — MOEX работал.

Дополнительно: auto-deploy Vercel с GitHub не обновлял production с ~14 апреля (последний deploy от `vercel[bot]`).

### Исправление API

- `screener-env.ts` — флаги runtime: Vercel, demo allowed, Prisma baselines
- `moex-screener.ts` — Prisma только optional local baseline; lazy import `db`; demo fallback **только** при `ALLOW_DEMO_MARKET_DATA=true`; в production при сбое MOEX → HTTP 503 без fake stocks
- Новые поля status: `isDemo`, `degraded`, `baselineStatus`, `generatedAt`
- `GET /api/screener/health` — диагностика без секретов
- `force-dynamic` + `revalidate=0` + `Cache-Control: no-store` на market API

### Файлы

- `shared/src/contracts/market.ts`
- `frontend/lib/server/screener-env.ts` (new)
- `frontend/lib/server/services/moex-screener.ts`
- `frontend/app/api/screener/route.ts`
- `frontend/app/api/screener/health/route.ts` (new)
- `frontend/app/api/dev/diagnostics/route.ts`
- `frontend/components/ui/metrics-minimalism.tsx`
- `frontend/components/screener/stocks-screener-page.tsx`
- `frontend/.env.example`
- `frontend/vercel.json`

### Проверка

- `pnpm -C frontend build` — **OK**
- Local simulate Vercel: `source=moex`, `isDemo=false`, `262 stocks`, `baselineStatus=skipped`
- Local dev: `/api/screener`, `/api/screener/health` — OK

---

## Что проверить после Vercel redeploy

1. https://screenerpro.vercel.app/api/screener?assetClass=stock → `isDemo: false`, `source: "moex"`, ~262 rows
2. https://screenerpro.vercel.app/api/screener/health → `moexFetchStatus: "ok"`, `prismaStatus: "skipped"`, `demoFallbackAllowed: false`
3. https://screenerpro.vercel.app/screener/stocks → реальные тикеры, badge «MOEX ISS»

Если production всё ещё demo — **Redeploy** в Vercel Dashboard (Git integration мог не обновлять deploy).

---

## Последний промпт

Fix Vercel /screener/stocks demo fallback: MOEX live path без Prisma, health endpoint, no silent demo in production.
