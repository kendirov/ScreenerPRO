# Post-deploy checklist — ScreenerPRO

Короткий список после каждого production deploy. Время: ~3 минуты.

---

## 1. Health endpoint

Открыть или выполнить:

```bash
curl -s https://screenerpro.vercel.app/api/screener/health | python3 -m json.tool
```

- [ ] HTTP **200** (не 404)
- [ ] `moexFetchStatus` = `"ok"`
- [ ] `demoFallbackAllowed` = `false`
- [ ] `prismaStatus` = `"skipped"` или `"ok"`

## 2. Commit в production

- [ ] `commitSha` / `buildCommit` совпадает с ожидаемым (`git log origin/main -1`)
- [ ] `branch` = `"main"` (на Vercel)

## 3. Screener API

```bash
curl -s 'https://screenerpro.vercel.app/api/screener?assetClass=stock' | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d['status']
print('source', s['source'], 'isDemo', s['isDemo'], 'rows', s['stockRows'])
"
```

- [ ] `source` = `"moex"`
- [ ] `isDemo` = `false`
- [ ] `stockRows` > **50**

## 4. UI

Открыть: https://screenerpro.vercel.app/screener/stocks

- [ ] Badge **MOEX ISS** + **LIVE**
- [ ] Нет **DEMO DATA**
- [ ] В таблице **не 3** акции
- [ ] Время обновления актуальное

## 5. Vercel Dashboard

- [ ] Последний Production deployment из **Git / main**, не «Redeploy of …»
- [ ] Build **Ready**

## 6. Зафиксировать результат

Обновить `AI_SESSION_STATE.md` → **DEPLOYMENT STATUS / VERCEL**:

- commit в production
- health / screener статус
- дата проверки

---

**Если что-то не прошло:** см. [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) §7.
