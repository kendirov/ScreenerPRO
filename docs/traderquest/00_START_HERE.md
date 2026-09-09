# TraderQuest Crypto — TQ-001 foundation

## Что это

TraderQuest Crypto — будущий crypto/execution/research контур внутри существующего Trading Workspace. TQ-001 не создаёт новый frontend и не реализует trading: он фиксирует фактическую базу и запрещает вторую Bitget-реализацию.

## Где живёт

- Repository: `kendirov/ScreenerPRO`.
- Working branch: `codex/traderquest-tq001-foundation-2026-09-09`.
- Base: `codex/bitget-private-readonly-v1-2026-08-18`, commit `ebceeb89c0ea4d81e36a226bea13226127a2ce85`.
- Existing Next.js/React Trading Workspace остаётся оболочкой.

## Source of truth

1. Google Drive canon: `Трейдинг → Платформа → Trading Workspace → 00_CANON`.
2. GitHub code/history: `kendirov/ScreenerPRO`.
3. Vercel deployment metadata: project `screenerpro`.

Conflict между этими источниками нельзя разрешать молча. Точные документы Drive: `09_PRODUCT_STANDARDS_AND_ANTIPATTERNS`, `03_VISUAL_DNA`, `04_PAGE_PATTERNS`, `05_DATA_TRUTH`, `07_RELEASE_STATE`, `08_WORK_PROMPT_SOUL_HIGH`.

## Что уже принято

Modular monorepo; runtimes `tq-api`, `tq-market`, `tq-research`, `tq-execution`; FastAPI для нового backend family; Postgres как operational truth; ClickHouse пока provisional; Parquet/S3-compatible archive; DuckDB/Polars research; Bitget UTA v3 первым adapter; единая StrategySpec semantics для backtest/paper/demo/live; deterministic Risk Engine; LLM вне execution loop; NULL/«—» вместо выдуманных данных; Market Case и BriefingBlueprint — first-class entities. EventContext и Alert Engine — будущие first-class domains, не реализация TQ-001.

## Нельзя менять случайно

Не дублировать `/screener/bitget`, `/screener/bitget/map`, public UTA adapter, briefing engine, private read-only bridge или crypto scanners. Не добавлять trading POST, order operations, secrets, migrations, infra, MCP, AI, ClickHouse, dependencies, merge или deployment в TQ-001.

## Текущее состояние

Existing Crypto/Bitget assets уже существуют и не равны production execution. Public market UI — live/preview surface; private bridge — preview-only и намеренно блокируется на production; scanners — GitHub Actions snapshots. Подробности: [`CURRENT_STATE.yaml`](./CURRENT_STATE.yaml) и [`EXISTING_ASSET_INVENTORY.md`](./EXISTING_ASSET_INVENTORY.md).

## Читать дальше

1. [`CURRENT_STATE.yaml`](./CURRENT_STATE.yaml) — machine-readable snapshot.
2. [`EXISTING_ASSET_INVENTORY.md`](./EXISTING_ASSET_INVENTORY.md) — salvage inventory.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — approved boundaries only.
4. ADR-001 и ADR-002 — product boundary и runtime topology.

## Следующая задача

`TQ-002` — только после отдельного approval: превратить существующий Bitget market truth в проверяемый adapter contract и smoke-test matrix, без order execution и без нового UI. TQ-002 не начат.
