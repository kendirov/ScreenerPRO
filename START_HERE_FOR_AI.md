# START_HERE_FOR_AI — ScreenerPRO / TQS

Это короткая точка входа для ChatGPT, Codex, Cursor и других исполнителей.

## Новый default

**Обычный ChatGPT = основной разработчик и оркестратор.** Он сам читает нужную часть repo, принимает решение, создаёт/продолжает ветку, меняет файлы, использует GitHub Actions как deterministic execution layer, читает ошибки, чинит их, проверяет runtime/browser/DB доступными plugins и доводит работу до доказанного результата.

**Work / Codex / Cursor = отдельный контур эскалации.** Они подключаются только если оставшийся шаг требует capability, которого реально нет у ordinary Chat. Размер задачи сам по себе не является причиной эскалации.

## Что читать

1. `AGENTS.md`
2. `docs/ai/CURRENT_STATE.md`
3. `docs/ai/VERIFICATION.md`
4. ближайший project-local `AGENTS.md`
5. только relevant files/tests/docs

Большой `PROJECT_CONTEXT.md` — справочник legacy/детального контекста, не обязательный стартовый файл.

## Где истина

- Google Drive `РАЗРАБОТКА` — процесс разработки, product/research decisions и reusable lessons.
- GitHub — code/branch/PR/CI/agent state.
- Runtime/Vercel/Supabase/local TQS — фактическое рабочее состояние.
- Сообщение AI не является доказательством PASS.

## Основной цикл

`идея → acceptance → relevant context → branch → code → FAST → repair → FULL → browser/runtime/security/live when relevant → PR → VERIFIED PASS`

FAST и FULL определены в `docs/ai/VERIFICATION.md` и реализованы в `.github/workflows/chat-first-verification.yml`.

## TQS

Для TQS сначала читать `tqs-intelligence/AGENTS.md`, затем только те продуктовые документы, на которые он маршрутизирует конкретную задачу.

## Отчёт владельцу

Коротко:

- что реально появилось;
- branch / PR / final SHA;
- какие объективные проверки прошли;
- ссылка/preview/runtime evidence, если есть;
- реальный blocker, если PASS не достигнут.

Не выдавать промпт для другого агента вместо результата, если ordinary Chat может продолжить сам.
