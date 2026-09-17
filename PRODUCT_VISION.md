# PRODUCT VISION — TQS / TRADING QS

Status: ACTIVE PRODUCT VISION — 2026-09-17

Technical module boundaries live in `TQS_PLATFORM.md`. This file describes the owner/user outcome.

## What TQS is

**TQS is an AI-first market operating system and research machine.**

It is designed to help Artem observe markets, find what is genuinely in play, understand why something deserves attention, accumulate evidence, test ideas, prepare briefings/materials and progressively improve the trading/research workflow.

TQS is not one screener page, one database, one bot or one AI chat. The product is the connected loop between data, research, knowledge and trader-facing decisions.

## North Star

The system should become more useful as time passes because it remembers and links:
- what the market actually did;
- which instruments/states were unusual;
- what Artem noticed before the outcome;
- what news/events/participants were observable at that time;
- what later happened;
- which hypotheses survived testing and which failed;
- what should appear in future screeners, briefings, strategies, lessons and research.

The target owner experience is:

> I state an idea or look at the market. TQS collects, connects, tests, remembers and shows the useful result without making me operate the technical machinery.

## Main product surfaces

### TQS Screener / Cockpit
The everyday trader surface. In seconds it should answer:
- where is unusual movement/activity/liquidity now;
- why is the instrument shown;
- is this fresh or stale;
- what happened before/after;
- what related markets/accounts/news matter;
- what similar historical cases exist;
- what research/strategy evidence exists;
- what the machine is doing next.

The existing ScreenerPRO web product evolves into this role. “ScreenerPRO” remains a legacy/product name, not the definition of the whole TQS system.

### Universal Instrument Lab
One symbol should become one connected dossier: live state, candles, volume, OI/funding/basis where available, anomalies, episodes, news/events, related instruments, account/participant evidence, historical cases, strategy/research runs and data-quality limits.

### TQS Intelligence / Research Machine
Runs continuously or on demand: collect → normalize → store → feature → detect → track → replay → test → preserve findings. It should perform cheap deterministic work first and use AI only where reasoning adds value.

### TQS Knowledge
A durable memory of observations, hypotheses, cases, failures, lessons and validated findings with provenance. Courses/briefings/presentations should be views over this knowledge, not independent copies.

### TQS Briefing / Content
A briefing is not a news dump. It should show:
`что в игре → почему → насколько существенно → evidence → похожие случаи → что следить дальше`.

The same canonical intelligence should power live streams, web briefings, course cases, Telegram/materials and presentation outputs.

## Markets and data direction

TQS is multi-market by design:
- Russian market / MOEX: shares, futures, FX, indices, commodities, options, participant aggregates and events;
- crypto: spot, perpetuals/futures/options, OI, funding, basis, liquidations, microstructure, public account/on-chain context and events;
- global equities/ETFs/futures/FX/commodities as sources and licensed/available feeds are added.

Not every metric is available from every provider. The UI must distinguish unavailable, delayed, estimated and live data rather than inventing values.

## Research standard

The product must resist data-mining self-deception.

Interesting relationship → hypothesis, not truth.
Promotion requires appropriate controls such as chronological holdout/OOS, walk-forward/stability, regime analysis, realistic fees/slippage, sample-size checks, bootstrap/uncertainty and cross-market/cross-exchange replication where relevant.

Negative results remain searchable knowledge so TQS does not repeatedly test the same dead idea.

## AI-native principle

Use neural models where they amplify human/product intelligence:
- understand natural-language observations and goals;
- search and synthesize external evidence;
- propose hypotheses and counter-hypotheses;
- link similar cases;
- interpret compact research/event packages;
- develop TQS itself through connected GitHub/Drive/CI tools;
- produce evidence-grounded briefings and educational explanations.

Do not use an LLM as a substitute for deterministic market plumbing, timestamps, risk constraints, statistical tests, replay or continuous raw-tick processing.

## UX principles

- Russian owner-facing language by default.
- Terminal/cockpit density without visual noise.
- Matte graphite/black, warm light text, thin borders; green/red for direction and amber for anomaly/attention.
- “Why now” and provenance are more important than unexplained magic scores.
- Every empty state explains what is missing and what the machine will do next.
- Every autonomous process exposes current action/progress/result/error.
- Drill-down beats duplicated pages.
- The owner should not need Git, terminal or source-code knowledge for normal operation.

## What success looks like

TQS succeeds when it can increasingly answer questions such as:
- Где сейчас действительно необычная активность и чем она отличается от нормы?
- Где мы уже видели похожую структуру и чем это закончилось?
- Что Артём говорил до движения, а не после него?
- Какие сочетания признаков повторяются и проходят честную проверку?
- Какие публичные участники/счета заметно изменили поведение и как это связано с состоянием рынка?
- Какие идеи подтвердились, не подтвердились или зависят от режима?
- Что произошло за ночь и что машина узнала нового?
- Что сегодня стоит показать в брифинге/эфире/курсе?
- Какой следующий источник, feature, test или product surface даст наибольший прирост полезности?

The long-term moat is not “more indicators”. It is the connected, provenance-aware history of market states + research + Artem's observations + validated outcomes, continuously converted into better tools and knowledge.

## Product evolution rule

A new idea should normally extend one of the existing TQS modules. Create a separate service/repository only when there is a real deployment, security, toolchain or scaling boundary.

The product should get broader without becoming fragmented: **one platform, canonical contracts, many views and workers**.