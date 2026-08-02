# План: Trading OS shell v1

## Допущения

1. ScreenerPRO остаётся основным рыночным приложением и shell.
2. presentation-os остаётся отдельным приложением; в этой итерации только bridge.
3. Production deploy, auth и данные не меняются.
4. Existing market formulas и API contracts неизменны.
5. Незакоммиченный `feature/trading-os-platform` — аудитный прототип, не источник кода для merge.

## Реализация

1. Зафиксировать seven-section route manifest.
2. Сделать desktop sidebar читаемым по умолчанию.
3. Сделать mobile primary nav: Сегодня, Рынок, Лаборатория, Ещё.
4. Добавить contextual market subnavigation в top bar.
5. Создать `/studio` bridge с configured/unconfigured states.
6. Добавить `NEXT_PUBLIC_PRESENTATION_OS_URL` в env example.
7. Расширить navigation integrity verify.
8. Обновить `AI_SESSION_STATE.md`.

## Проверки

- targeted eslint изменённых TS/TSX;
- `tsc --noEmit`;
- `verify:navigation-design`;
- Market Radar, Situation Engine, Stocks Command Center verify;
- production build;
- browser desktop/mobile, loading/error/console.
