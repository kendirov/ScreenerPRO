# TQS Hot Update Protocol

## Goal

The `Обновить` button should update the same local TQS product without manual Git/pip rituals while preserving operational data.

## Required flow

1. Check upstream branch and show whether a new version exists.
2. Refuse automatic update if the working tree contains uncommitted user changes.
3. Record current commit as rollback point.
4. Defer non-forced update while a heavy research job is running.
5. Fast-forward pull only.
6. Reinstall changed Python dependencies.
7. Restart backend under the supervisor.
8. Wait for `/api/health`.
9. If healthy, mark update applied and expose a short change summary.
10. If unhealthy, restore the previous commit/dependencies and restart the previous version.

## Data safety

Code update must never remove:
- DuckDB operational data;
- SQLite lab/account databases;
- Parquet Data Lake;
- exported TQS snapshots;
- `.env` secrets/configuration.

## Owner-visible states

- `Обновлений нет`;
- `Доступна новая версия`;
- `Подготовка`;
- `Скачивание`;
- `Установка зависимостей`;
- `Перезапуск`;
- `Healthcheck`;
- `Обновлено`;
- `Ошибка — выполнен откат`;
- `Заблокировано: есть локальные изменения`;
- `Отложено: идёт тяжёлое исследование`.

## Update log

Store/show:
- old/new commit;
- start/finish time;
- failed step;
- healthcheck result;
- rollback result;
- backend version after restart.

## UX target

From the owner's perspective future development should be:

`идея в чате -> verified commit to the TQS runtime branch -> в интерфейсе появилась новая версия -> нажать Обновить -> функция появилась`

No branch switching should normally be needed after initial setup.
