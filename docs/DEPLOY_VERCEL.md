# Vercel production deploy — ScreenerPRO

## Текущая ситуация (2026-05-29)

- **GitHub `main`:** актуальный код (`d6bf5da` и новее).
- **Production URL:** https://screenerpro.vercel.app
- **Проблема:** GitHub → Vercel auto-deploy **не срабатывает** с ~апреля 2026. Production крутит старую сборку (demo-заглушки, нет `/api/screener/health`).

## Быстрый ручной deploy (рекомендуется сейчас)

```bash
cd frontend
vercel login          # один раз, откроется браузер
vercel link           # выбрать существующий проект screenerpro, НЕ создавать новый
vercel --prod
```

Или из корня:

```bash
chmod +x scripts/vercel-deploy-prod.sh
./scripts/vercel-deploy-prod.sh
```

### Настройки проекта в Vercel Dashboard

**Project → Settings → General**

| Поле | Значение |
|------|----------|
| Root Directory | `frontend` |
| Framework | Next.js |
| Build Command | `pnpm build` (или из `frontend/vercel.json`) |
| Install Command | `cd .. && pnpm install` (monorepo) |

**Project → Settings → Git**

| Поле | Значение |
|------|----------|
| Repository | `kendirov/ScreenerPRO` |
| Production Branch | `main` |
| Deploy Hooks | при необходимости |

Проверить: integration не paused, у GitHub App есть доступ к репозиторию.

## GitHub Actions (альтернатива auto-deploy)

Workflow: `.github/workflows/vercel-production.yml`

Добавить в **GitHub → Settings → Secrets and variables → Actions:**

1. `VERCEL_TOKEN` — [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. `VERCEL_ORG_ID` — Project → Settings → General
3. `VERCEL_PROJECT_ID` — там же

После push в `main` deploy пойдёт через Actions.

## Проверка после deploy

```bash
curl -s "https://screenerpro.vercel.app/api/screener/health"
curl -s "https://screenerpro.vercel.app/api/screener?assetClass=stock" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d['status']
print(s['source'], s['isDemo'], s['stockRows'])
"
```

Ожидание: `moex`, `False`, `~262`.

Страница: https://screenerpro.vercel.app/screener/stocks — сотни тикеров, badge MOEX ISS.
