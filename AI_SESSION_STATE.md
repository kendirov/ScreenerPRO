# AI_SESSION_STATE — compatibility pointer

Этот legacy-файл сохранён, потому что старые инструкции и инструменты могут на него ссылаться.

**Каноническое текущее состояние разработки теперь находится в `docs/ai/CURRENT_STATE.md`.**

Причина: прежний append-style session state быстро устаревал и смешивал несколько веток продукта. Новый state хранит только проверяемые факты, текущий PR/SHA, evidence и точный следующий шаг.

Перед разработкой: `AGENTS.md` → `docs/ai/CURRENT_STATE.md` → `docs/ai/VERIFICATION.md` → project-local `AGENTS.md`.
