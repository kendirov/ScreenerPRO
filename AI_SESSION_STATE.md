# AI_SESSION_STATE — TQS / ScreenerPRO

## Active development method

Owner experiment active since 2026-10-05:
- ChatGPT = product architect / researcher / critic / independent verifier / Cursor-prompt compressor.
- Cursor = primary implementation executor inside this repository.
- Durable continuity = Google Drive canon + GitHub repo state + runtime evidence + repo-level `.cursor/rules` / `AGENTS.md`.

See `AGENTS.md` and `.cursor/rules/artem-cursor-first.mdc`.

## Studio

- Ветка `chatgpt/tqs-studio-v6-productization-2026-10-04`. Воспроизводимый checkpoint живой рабочей станции: `6a4eea98451379bc23864a8ab91b75a7a921fb1e`. Поверх него — owner UX correction 2026-10-06. Нового repo, V7, базы и второй Studio нет.
- Сайт: https://tqs-studio.vercel.app/studio. До этой правки production был `dpl_71ePNgsBnAezkptxKygETcuWE5ZM` с metadata SHA `880312abaca941c96163620159ffeac8a22010ff`, source=CLI.
- Модель та же: One World + Documents. Режимы на экране: Доска и Документы. Камера доски не сбрасывается в Whole World. Header стабильный: `TQS Studio`, Undo, Redo, More, компактное сохранение.
- Поиск только ищет. Навигатор — карточки с миниатюрой, Недавние, «На доске» и «Документ». Палитра доски: выбор, рука, текст, заметка, задача, голос, изображение, карандаш, маркер, стрелка, ещё.
- Голос пишет реальный аудиопоток, таймер и расшифровку через распознавание браузера; пустая запись объект не создаёт. Пометка — векторный объект со связью `annotates`.
- Настройки отдельно от компактного статуса. Сброс примера убран из обычного статуса. Тёмная тема не заливает комнаты серыми карточками.
- Владелец этот экран ещё не принимал. Это не PASS.

## Memory

Cross-machine memory is the Drive document `00_ПАМЯТЬ РАЗРАБОТКИ — ЛЮБОЙ КОМПЬЮТЕР`. This file stays a short checkpoint.

## Boundary

Generic desktop automation stays in Artem OS, not this repo.

## Verification rule

Build success, HTTP 200 or deployment READY alone are not product PASS.
