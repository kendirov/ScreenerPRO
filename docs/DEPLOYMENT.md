# Деплой — Лаборатория рынка (ScreenerPRO)

Публичный продукт и черновой контур разделены **ветками Git и доменами Vercel**, а не маршрутами внутри приложения (никакого `/app.1`).

---

## Контуры

| Контур | Ветка Git | Домен (пример) | Назначение |
|--------|-----------|----------------|------------|
| **Production** | `main` | `screenerpro.vercel.app` | Публичное ядро: Рынок / Акции / Фьючерсы |
| **Draft / Lab** | `dev`, `draft` или feature | `screenerpro-lab.vercel.app`, preview URL | Эксперименты, лаборатории, материалы |

На **main** в навигации только:

- `/screener` — Рынок сейчас
- `/screener/stocks` — Акции
- `/screener/futures` — Фьючерсы

Старые разделы (`/materials`, `/academy`, `/lab/*`, `/sandbox`) остаются по **прямым URL**, но скрыты из публичного меню.

---

## Vercel

- Root directory: **`frontend`**
- `frontend/vercel.json`: install из monorepo, `pnpm build`
- Production deploy: push в `main` → GitHub Actions `.github/workflows/vercel-production.yml` (нужны secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
- Preview: автоматически для PR и веток

### Привязка домена к ветке

В Vercel Dashboard → Project → Settings → Domains:

- Production domain → **Production Branch: `main`**
- Draft domain → **Preview** или отдельный проект / branch alias на `dev`

---

## Переменные окружения

Документируем в `frontend/.env.example` (секреты не коммитить):

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | SQLite локально; на Vercel — внешняя БД или пусто (live скринер не зависит) |
| `MOEX_BASE_URL` | Ingest / Prisma (live UI использует hardcoded ISS) |
| `MOEX_HTTP_TIMEOUT_MS` | Таймаут ingest-клиента |
| `ALLOW_DEMO_MARKET_DATA` | `true` — явный demo fallback (опционально; на production включён stale/demo при сбое MOEX) |
| `NEXT_PUBLIC_SHOW_DRAFT_NAV` | `true` — показать блок «Черновики» в sidebar (draft-деплой) |
| `NEXT_PUBLIC_SUPABASE_*` | Не используется в публичном ядре |

---

## Как работать владельцу продукта

1. **Перед задачей:** `git checkout dev` (или `draft`)
2. **Разработка:** правки в draft-ветке, локально `pnpm -C frontend dev`
3. **Проверка:** `pnpm -C frontend build`
4. **Черновик на Vercel:** push в `dev` → preview / lab-домен
5. **Релиз:** после чек-листа `docs/PUBLIC_RELEASE_CHECKLIST.md` → merge в `main`

На main попадает только то, что готово для публичного терминала.

---

## Команды

```bash
pnpm install
pnpm -C frontend dev      # http://localhost:3000/screener
pnpm -C frontend build    # обязательно перед merge в main
```

---

## Не ломать

- Live MOEX ISS (`/api/screener`)
- Прямые URL лабораторий и материалов
- Fallback с пометкой DEMO / кэш MOEX при сбое
