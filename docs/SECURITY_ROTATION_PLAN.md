# Security P0 — secrets rotation and history remediation

**Статус:** incident plan; значения секретов намеренно не записываются.  
**Дата:** 2026-08-13

## Сигналы

- В контексте предыдущего ScreenerPRO-аудита зафиксирован открытый API key в Google Drive; считать скомпрометированным до ротации.
- `00_НАВИГАЦИЯ_Сайт` перечисляет классы секретов: `SUPABASE_SERVICE_ROLE_KEY`, JWT, OAuth refresh tokens, `VERCEL_TOKEN`, `ADMIN_INGEST_SECRET`, платные MOEX credentials и `.env`; это policy text, не доказательство наличия значений.
- GitHub content search по `API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_TOKEN`, `MOEX_TOKEN`, `Bearer`, `secret` в текущих файлах `kendirov/ScreenerPRO` совпадений не дал. Full history scan ещё не выполнен.

## Немедленно, владелец

1. Отозвать и перевыпустить каждый ключ, который был в Drive/chat/issue/commit.
2. Проверить provider audit logs: MOEX/ALGOPACK, Supabase, Vercel, Google OAuth и платные data providers.
3. Новые значения хранить только в secret manager/Vercel env/Supabase server env.
4. В active Drive docs заменить plaintext на `[REVOKED — rotated 2026-08-13]`; сохранить private incident log.
5. Проверить live endpoints на новых credentials; отсутствие credential не считать проверкой подключения.

## Git history

После отзыва: полный scan всех refs/tags/unreachable objects (gitleaks/trufflehog или эквивалент) без вывода значений; inventory provider + repo/path/ref/commit + status; удаление из active files; history rewrite только отдельным согласованным шагом с backup; повторный scan и проверка GitHub secret alerts.

## Запреты

Не удалять документы/коммиты вслепую. Не публиковать маски, префиксы, checksum или фрагменты токена. Не считать имя переменной доказательством утечки значения. Не менять production credentials автоматически.
