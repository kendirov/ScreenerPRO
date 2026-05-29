# AI_SESSION_STATE — ScreenerPRO

---

## Текущая задача

**Vercel production deploy** — доставить фикс заглушек (`d6bf5da+`) на https://screenerpro.vercel.app (2026-05-29).

---

## Статус deploy pipeline

| Проверка | Результат |
|----------|-----------|
| Git `main` | чисто, HEAD `d6bf5da`, origin `kendirov/ScreenerPRO` |
| Локальный build | OK |
| Локальный `/api/screener` | `moex`, `isDemo=false`, ~262 stocks |
| **Production `/api/screener`** | **старое:** `demo`, 3 акции, Prisma error |
| **Production `/api/screener/health`** | **404** (новый код не задеплоен) |
| Локальный `.vercel/project.json` | **нет** (проект не привязан локально) |
| Vercel CLI auth | **нет** (`auth.json` пустой) — нужен `vercel login` |
| GitHub deployments (vercel[bot]) | последний **2026-04-14** (Preview); **auto-deploy не работает** |
| Production на Vercel | застрял на старой сборке (~март 2026, commit `c1c89e5f` era) |

---

## Что добавлено для deploy

- `.github/workflows/vercel-production.yml` — deploy на push в `main` (нужны secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
- `scripts/vercel-deploy-prod.sh` — ручной deploy + verify
- `docs/DEPLOY_VERCEL.md` — инструкция Dashboard + CLI

---

## Что сделать вручную (блокер)

**Вариант A — CLI (быстрее):**

```bash
cd frontend
vercel login
vercel link    # screenerpro, root=frontend
vercel --prod
```

**Вариант B — Dashboard:** Vercel → screenerpro → Deployments → **Redeploy** latest `main`

**Вариант C — GitHub Actions:** добавить 3 secrets → push в `main`

**Dashboard Git settings:** repo `kendirov/ScreenerPRO`, branch `main`, root `frontend`, integration не paused.

---

## После успешного deploy проверить

1. https://screenerpro.vercel.app/api/screener/health → `moexFetchStatus: ok`
2. https://screenerpro.vercel.app/api/screener?assetClass=stock → `isDemo: false`, ~262 rows
3. https://screenerpro.vercel.app/screener/stocks → реальные тикеры

---

## Последний промпт

Закрыть Vercel production deploy после фикса заглушек: проверить pipeline, manual deploy, verify API/UI.
