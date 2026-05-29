# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Deploy guardrails** — runbook, health endpoint, UI data-source strip, post-deploy checklist (2026-05-29).

---

## DEPLOYMENT STATUS / VERCEL

| Параметр | Значение |
|----------|----------|
| GitHub repo connected | `kendirov/ScreenerPRO` |
| Production branch | `main` |
| Root directory | `frontend` |
| Vercel project | `screenerpro` |
| Production URL | https://screenerpro.vercel.app |
| Latest production commit (target) | `2d3b0e0` (+ deploy guardrails после push) |
| Health route | `/api/screener/health` |
| Market route | `/api/screener?assetClass=stock` |

### Причина прошлой проблемы

- Vercel **не был связан** с GitHub → новые push не собирались.
- **Redeploy** старого artifact (`9qHhs8opV`) **не подтягивал** новый `main` — тот же старый build (~`16db98f`).
- Итог: health **404**, screener **3 demo-акции**.

### Правильный deploy

- **push в `main`** (Git integration) или **Create Deployment** из `main`.
- **Не** Redeploy старого deployment, если нужен новый код.

### Git integration (восстановлено)

- Deploy из GitHub `main`, commit `2d3b0e0` — build с `/api/screener/health` в output.

### После каждого deploy

- [docs/POST_DEPLOY_CHECKLIST.md](./docs/POST_DEPLOY_CHECKLIST.md)
- [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md)

### Production check (2026-05-29, commit `2d3b0e0`)

| URL | Факт |
|-----|------|
| `/api/screener/health` | **200**, `moexFetchStatus=ok`, `prismaStatus=skipped`, `demoFallbackAllowed=false`, `buildCommit=2d3b0e0` |
| `/api/screener?assetClass=stock` | `source=moex`, `isDemo=false`, **262** rows, `baselineStatus=skipped` |
| `/screener/stocks` | live MOEX (проверить UI badge после push guardrails) |

Следующий deploy добавит в health: `commitSha`, `branch`, `deploymentUrl` и UI strip DEMO/MOEX.

---

## Что сделано (deploy guardrails)

- `docs/DEPLOYMENT_RUNBOOK.md` — полный runbook
- `docs/POST_DEPLOY_CHECKLIST.md` — чеклист после deploy
- `/api/screener/health` — `commitSha`, `commitMessage`, `branch`, `deploymentUrl`, `generatedAt`
- `ScreenerDataSourceStrip` на `/screener/stocks` — MOEX ISS / DEMO DATA / degraded / baseline

---

## Файлы

- `docs/DEPLOYMENT_RUNBOOK.md`, `docs/POST_DEPLOY_CHECKLIST.md`
- `frontend/lib/server/screener-env.ts`
- `frontend/lib/server/services/moex-screener.ts`
- `shared/src/contracts/market.ts`
- `frontend/components/screener/screener-data-source-strip.tsx`
- `frontend/components/screener/stocks-screener-page.tsx`

---

## Последний промпт

Закрепить deploy-процесс: runbook, health, UI guard, checklist после восстановления Vercel↔GitHub.
