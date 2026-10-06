# AI_SESSION_STATE — TQS / ScreenerPRO

## Active development method

Owner experiment active since 2026-10-05:
- ChatGPT = product architect / researcher / critic / independent verifier / Cursor-prompt compressor.
- Cursor = primary implementation executor inside this repository.
- Durable continuity = Google Drive canon + GitHub repo state + runtime evidence + repo-level `.cursor/rules` / `AGENTS.md`.
- Cursor User Rules / old chat history are not canonical memory.

See `AGENTS.md` and `.cursor/rules/artem-cursor-first.mdc`.

## Studio

- Ветка `chatgpt/tqs-studio-v6-productization-2026-10-04`. Checkpoint рабочей станции, которую смотрит владелец, зафиксирован отдельно от `880312ab`. Нового repo, V7, базы и второй Studio нет.
- Сайт: https://tqs-studio.vercel.app/studio. На момент checkpoint production ещё был `dpl_71ePNgsBnAezkptxKygETcuWE5ZM` с metadata SHA `880312abaca941c96163620159ffeac8a22010ff` и source=CLI. Этот commit — воспроизводимый source того дерева. Redeploy ещё не делался.
- Живая доска: blob `tqs-studio/live.json` через `/api/studio/live`. Свежий браузер принимает серверный штамп. Вход в Studio не подменяет доску вторым миром Supabase.
- Google Drive остаётся слоем знания. OAuth владельца на сайте ещё не пройден.
- Модель: One World + Documents. Урок-референс: `lesson-miro-scene`, документ `doc-lesson-workspace`.
- Владелец текущий UX не принял. Это не PASS. Следующий срез — owner correction 2026-10-06: стабильный header, Доска/Документы, search-only, navigator, tools, voice, annotations, settings, themes.

## Memory

Cross-machine memory is the Drive document `00_ПАМЯТЬ РАЗРАБОТКИ — ЛЮБОЙ КОМПЬЮТЕР` in the РАЗРАБОТКА folder. New chats read owner taste, «Получилось», and «Не повторять» there. This file stays a short checkpoint.

## Boundary

Generic desktop automation stays in Artem OS, not this repo.

## Verification rule

Build success, self-report, click success, HTTP 200 or deployment READY alone are not product PASS. Require observable owner-facing acceptance and exact runtime/source identity.
