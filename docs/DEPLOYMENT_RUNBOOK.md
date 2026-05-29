# Deployment Runbook — ScreenerPRO

Практическая памятка: как устроен deploy, как не откатиться на старую сборку и как проверить production.

---

## 1. Как устроен deploy

| Параметр | Значение |
|----------|----------|
| GitHub repo | `kendirov/ScreenerPRO` |
| Vercel project | `screenerpro` |
| Production URL | https://screenerpro.vercel.app |
| Branch | `main` |
| Root directory | **`frontend`** |
| Package manager | `pnpm` (monorepo: install из корня) |
| Build command | `pnpm build` (см. `frontend/vercel.json`) |

Источник рыночных данных на production: **MOEX ISS** (live). SQLite/Prisma — только optional baseline в local dev.

---

## 2. Как правильно деплоить

### Нормальный способ

1. Закоммитить изменения в `main`
2. `git push origin main`
3. Vercel собирает новый deployment из Git
4. Пройти [POST_DEPLOY_CHECKLIST.md](./POST_DEPLOY_CHECKLIST.md)

### Альтернатива (без push)

Vercel Dashboard → **Deployments** → **Create Deployment** → branch **`main`** → Production.

### Что НЕ делать

- **Не нажимать Redeploy** у старой строки в списке, если нужен **новый код** из Git.  
  Redeploy = тот же build artifact (старый commit), без сборки из актуального `main`.

---

## 3. Как проверить, что production свежий

В Vercel → Deployments → последний **Production**:

- [ ] **Commit hash** совпадает с `git log origin/main -1`
- [ ] **Source** = Git / `main`, не «Redeploy of …»
- [ ] Build logs содержат маршруты `/api/screener`, `/api/screener/health`, `/screener/stocks`
- [ ] `curl` на health не возвращает **404**

---

## 4. Контрольные URL

| URL | Назначение |
|-----|------------|
| https://screenerpro.vercel.app/api/screener/health | Диагностика deploy + MOEX + Prisma |
| https://screenerpro.vercel.app/api/screener?assetClass=stock | Живые акции |
| https://screenerpro.vercel.app/screener/stocks | UI скринера акций |

---

## 5. Что должно быть в норме

### `/api/screener/health`

```json
{
  "moexFetchStatus": "ok",
  "demoFallbackAllowed": false,
  "prismaStatus": "skipped",
  "vercel": true,
  "commitSha": "...",
  "branch": "main"
}
```

### `/api/screener?assetClass=stock`

- `status.source` = `"moex"`
- `status.isDemo` = `false`
- `status.stockRows` > 50 (обычно ~260+)
- Нет трёх знакомых demo-тикеров как единственного набора

### `/screener/stocks`

- Badge **MOEX ISS** + **LIVE**
- Нет **DEMO DATA**
- Сотни бумаг в таблице

---

## 6. Что значит проблема

| Симптом | Вероятная причина |
|---------|------------------|
| `/api/screener/health` → **404** | Production на старой сборке (до `d6bf5da`) |
| `isDemo: true` | Demo fallback (не должно быть на production) |
| `stockRows: 3`, SBER/GAZP/LKOH | Старый mock fallback |
| Deployment = **Redeploy of …** | Не новый main, старый artifact |
| `moexFetchStatus: "error"` | MOEX ISS недоступен с Vercel |
| GitHub не триггерит build | Settings → Git отключён / неверный root |

---

## 7. Как чинить

1. **Settings → Git** в Vercel:
   - Repository: `kendirov/ScreenerPRO`
   - Production Branch: `main`
   - Root Directory: `frontend`
2. Новый deploy: **push в main** или **Create Deployment** из `main`
3. Пройти [POST_DEPLOY_CHECKLIST.md](./POST_DEPLOY_CHECKLIST.md)
4. Обновить `AI_SESSION_STATE.md` → раздел **DEPLOYMENT STATUS / VERCEL**

Дополнительно: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (CLI, GitHub Actions).
