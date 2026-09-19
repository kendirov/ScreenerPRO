# TQS Intelligence architecture v0.4

```text
PUBLIC / PREMIUM / OWNER INPUTS
Bitget | Binance | Bybit | OKX | MOEX ISS | Global providers | GDELT/RSS | future Telegram/MOEX premium | Artem ideas
                                      |
                                      v
                           PROVIDER ADAPTERS
                                      |
                                      v
              Canonical Instrument / Quote / Event / Quality
                                      |
                 +--------------------+--------------------+
                 |                                         |
                 v                                         v
          LIVE OPERATIONAL DB                         PARQUET DATA LAKE
       DuckDB snapshots/episodes                  2021+ historical candles
                 |                                         |
                 v                                         v
       STATE / ANOMALY ENGINE                     HISTORICAL REPLAY
                 |                              movement event studies
                 v                                         |
       persistent live episodes                            v
                 +--------------------+----------> STRATEGY MACHINE
                                      |          StrategySpec + controls
                                      |          OOS / walk-forward / costs
                                      v
                              LAB / IDEA / JOB DB
                                      |
              +-----------------------+-----------------------+
              v                       v                       v
        LOCAL RUSSIAN UI        BRIEFING SNAPSHOT       PORTABLE SNAPSHOT
        radar/charts/labs       fullscreen/freeze       Google Drive / AI
```

## Runtime control

- **STOP**: background market loop and heavy jobs paused; manual refresh still possible.
- **LIGHT**: live market/news/anomalies continue; bulk history/research waits.
- **MAX**: faster live loop plus historical backfill, replay and Strategy Machine.

Control state is persisted and shared between API and supervisor processes.

## Storage

- DuckDB: operational quote/anomaly/news/candle cache and live episodes.
- SQLite lab DB: ideas, persistent heavy jobs, StrategySpecs and strategy runs.
- Parquet/Zstandard Data Lake: heavy historical data, partitioned by provider/instrument/interval/year/month.
- Default Windows installer prefers `D:\TQS_DATA` when a large D: drive exists.
- Google Drive is for compact snapshot/export/canon, not massive raw market history.

## Research boundary

An anomaly means **unusual state / potential place of movement**, not direction.

Historical Replay evaluates post-anomaly movement versus background controls. Strategy Machine separately evaluates actionable direction/entry/exit. Statistical relation is never promoted silently to a trading rule.

Minimum strategy promotion evidence:
- no-lookahead event definition;
- control/placebo;
- chronological exploration/validation/untouched holdout;
- walk-forward/stability;
- effective sample size;
- spread/fees/slippage assumptions;
- negative cells remain visible.

## AI boundary

Raw high-frequency streams are not LLM inputs. Deterministic code computes facts. AI consumes compact snapshots/results and can propose:
- new hypotheses/anomaly features;
- missing controls;
- new StrategySpecs;
- source adapters;
- UI/chart improvements;
- briefing/course transformations.

Every market-edge proposal returns to deterministic research.

## Provider evolution

A logical instrument can have multiple provider mappings. Free/delayed and paid/realtime sources must never be silently merged.

Planned plug-in layers include:
- MOEX realtime/premium + participant OI positions;
- Telegram/official-news event sources;
- L1/L2/order flow/liquidations;
- options/on-chain/global macro providers.

## Self-update

Windows starts through `tqs_intelligence.supervisor`:
- fetch current upstream;
- reject dirty worktree;
- defer non-forced update while a heavy research job runs;
- fast-forward only;
- reinstall dependencies;
- restart + healthcheck;
- rollback to previous commit if healthcheck fails.

Server deployment keeps operational DB and data lake on persistent volumes.

See `AI_OPERATING_CONTEXT.md` for the product/research contract.
