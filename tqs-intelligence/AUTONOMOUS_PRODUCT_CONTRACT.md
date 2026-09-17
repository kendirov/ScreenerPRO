# TQS — AUTONOMOUS PRODUCT CONTRACT

Status: mandatory product rule.

## Product default

TQS is a continuously running market laboratory, not a collection of configuration forms.

The default owner experience is:

`start once → sources discover/collect → machine ranks what matters → history is accumulated → anomalies/cases/strategies/research appear → owner inspects results`.

Manual input is secondary. A screen that mainly asks Artem to paste addresses, tickers, feeds, URLs or parameters is not a finished TQS workflow when those objects can be discovered or derived automatically.

## GPT is the product-development input

For new ideas, strategies, anomalies, sources and interface changes the primary input is the conversation:

`Артём describes goal in normal language → AI reads current product state → researches source/constraints → implements same TQS product → CI/runtime verification → GitHub commit → owner presses Update`.

The UI may contain a manual escape hatch, but it must not require Artem to become a dispatcher/configurator.

## Automatic-first hierarchy

For every new source or feature ask, in order:

1. Can TQS discover the universe automatically?
2. Can it rank/filter cheaply before expensive collection?
3. Can only the hot subset receive high-frequency/deep processing?
4. Can missing history be backfilled automatically when a case/research task needs it?
5. Can the UI show what the machine found/did instead of asking the owner to configure it?
6. Can the resulting data feed anomaly/research/strategy/briefing layers without duplicate collection?

If yes, implement that path first. Manual controls go under an advanced/secondary disclosure.

## Tiered collection pattern

Large public universes must not be polled deeply at full frequency.

Use:

`cheap catalog/discovery → priority score + explicit reasons → hot set → deep/frequent collection → durable cases → research`.

Priority is a research/attention score, not a claim that an account/instrument is profitable or a trade recommendation.

## Account / position intelligence

### Hyperliquid

Default pipeline:

`public opted-in leaderboard catalog → local discovery DB → hot-set promotion → official positions/fills API → behavioral profile → MarketContext synchronization → event studies`.

Do not ask the owner to paste wallets for normal operation. A specific 0x address field is only for targeted investigation.

Do not call leaderboard leaders “best traders”. Persistence, copyability, latency, beta, leverage and turnover must be studied separately.

### Future public venues

New account-capable venues should implement reusable adapters with:
- discovery/catalog capability where lawful/public;
- account identity + aliases/tags when available;
- positions;
- fills/orders when public/authorized;
- rate limits/freshness/provenance;
- automatic tiering into hot/warm/cold observation.

### MOEX

Aggregate individuals/legal-entity positioning is a cohort feature layer, not individual-account discovery. Premium/realtime licensed feeds plug into the same MarketContext but retain source/entitlement/delay semantics.

## Screen contract

Every primary screen answers three questions in 5–20 seconds:

1. **Что происходит?**
2. **Почему это показано?**
3. **Что машина уже сделала / что будет делать дальше?**

Examples:
- Accounts: discovered universe, hot set, open positions, behavioral changes, current scan state.
- Data: actual coverage/gaps/verification, not mostly path settings.
- Ideas: product/research queue from GPT work, not mostly a blank input form.
- Strategies: actual library + runs + validation state + failure diagnostics.
- Research: jobs + findings + evidence strength + next automatic step.

## Empty-state rule

Empty sections must never look abandoned. They must state:
- what evidence is missing;
- whether collection is running;
- what next automatic action is scheduled;
- whether owner action is actually required.

## Verification definition

A feature is not complete because code exists. For owner-facing work require:
- deterministic tests where applicable;
- API/import/CI pass;
- trader-facing route/surface present;
- loading/empty/error state;
- evidence that data flows into the view;
- safe update path;
- no regression that turns automatic work back into manual configuration.

Success metric: **verified useful market/research output per unit of Artem's attention**.
