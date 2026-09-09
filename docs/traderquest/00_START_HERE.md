# TraderQuest Crypto — TQ-004 public REST snapshot foundation

## Что это

TraderQuest Crypto — будущий crypto/execution/research контур внутри существующего Trading Workspace. TQ-002 фиксирует проверенный UTA v3 capability contract и public smoke boundary; новый frontend и trading не создаются.

## Где живёт

- Repository: `kendirov/ScreenerPRO`.
- Accepted foundation: `codex/traderquest-tq001-foundation-2026-09-09` at `acb00fe…`.
- Current TQ-002 branch: `codex/traderquest-tq002-bitget-contract-2026-09-09`.
- Existing Next.js/React Trading Workspace остаётся оболочкой.

## Source of truth

1. Google Drive canon: `Трейдинг → Платформа → Trading Workspace → 00_CANON`.
2. GitHub code/history: `kendirov/ScreenerPRO`.
3. Vercel deployment metadata: project `screenerpro`.

Conflict между этими источниками нельзя разрешать молча. Точные документы Drive: `09_PRODUCT_STANDARDS_AND_ANTIPATTERNS`, `03_VISUAL_DNA`, `04_PAGE_PATTERNS`, `05_DATA_TRUTH`, `07_RELEASE_STATE`, `08_WORK_PROMPT_SOUL_HIGH`.

## Что уже принято

Modular monorepo; runtimes `tq-api`, `tq-market`, `tq-research`, `tq-execution`; FastAPI для нового backend family; Postgres как operational truth; ClickHouse пока provisional; Parquet/S3-compatible archive; DuckDB/Polars research; Bitget UTA v3 первым adapter; единая StrategySpec semantics для backtest/paper/demo/live; deterministic Risk Engine; LLM вне execution loop; NULL/«—» вместо выдуманных данных; Market Case и BriefingBlueprint — first-class entities. EventContext и Alert Engine — будущие first-class domains, не реализация TQ-001.

## Нельзя менять случайно

Не дублировать `/screener/bitget`, `/screener/bitget/map`, public UTA adapter, briefing engine, private read-only bridge или crypto scanners. Не добавлять trading POST, order operations, secrets, migrations, infra, MCP, AI, ClickHouse, dependencies, merge или deployment без отдельной задачи. В TQ-002 public smoke read-only; private runtime и execution не вызываются.

## Текущее состояние

Existing Crypto/Bitget assets уже существуют и не равны production execution. Public market UI — live/preview surface; private bridge — preview-only и намеренно блокируется на production; scanners — GitHub Actions snapshots. Подробности: [`CURRENT_STATE.yaml`](./CURRENT_STATE.yaml), [`EXISTING_ASSET_INVENTORY.md`](./EXISTING_ASSET_INVENTORY.md), [`BITGET_UTA_V3_CAPABILITIES.md`](./BITGET_UTA_V3_CAPABILITIES.md), [`BITGET_SMOKE_MATRIX.md`](./BITGET_SMOKE_MATRIX.md) и [`uta-v3-capabilities.json`](../../contracts/traderquest/bitget/uta-v3-capabilities.json).

## Читать дальше

1. [`CURRENT_STATE.yaml`](./CURRENT_STATE.yaml) — machine-readable snapshot.
2. [`EXISTING_ASSET_INVENTORY.md`](./EXISTING_ASSET_INVENTORY.md) — salvage inventory.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — approved boundaries only.
4. ADR-001 и ADR-002 — product boundary и runtime topology.
5. [`BITGET_UTA_V3_CAPABILITIES.md`](./BITGET_UTA_V3_CAPABILITIES.md) — verified UTA contract и mapping existing code.
6. [`BITGET_SMOKE_MATRIX.md`](./BITGET_SMOKE_MATRIX.md) — отдельные docs/code/runtime статусы.

## TQ-003 core

Canonical contracts and pure Bitget normalization: [`MARKET_CONTRACTS.md`](./MARKET_CONTRACTS.md), [`ADR-003-market-contracts.md`](./DECISIONS/ADR-003-market-contracts.md).

TQ-004 public REST adapter and one-shot snapshots: [`BITGET_PUBLIC_REST_ADAPTER.md`](./BITGET_PUBLIC_REST_ADAPTER.md), [`ADR-004-public-rest-adapter.md`](./DECISIONS/ADR-004-public-rest-adapter.md).

## Следующая задача

`TQ-005` — Bitget Public WebSocket Capture Spike + Sequence Integrity. Approved, not started.
