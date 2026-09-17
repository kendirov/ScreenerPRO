# ScreenerPRO / TQS — AI agent front door

This repository is developed **Chat-first by default**.

The primary execution route is ordinary ChatGPT with connected tools: GitHub, GitHub Actions, Vercel, Supabase, browser/web and other relevant plugins. Work, Codex and Cursor are escalation executors, not the default route.

## Read order

Read only what the task needs:

1. `docs/ai/CURRENT_STATE.md` — current branch/PR/evidence and next action.
2. `docs/ai/VERIFICATION.md` — what FAST, FULL, LIVE, SECURITY and VERIFIED PASS mean.
3. The closest project-local `AGENTS.md` (for TQS: `tqs-intelligence/AGENTS.md`).
4. The active execution plan in `docs/exec-plans/active/`, if one exists for the task.
5. Only affected source/tests/docs.

Do **not** read `PROJECT_CONTEXT.md`, the whole repository, all Drive documents or old chat history by default. Use progressive disclosure: map first, detail only when it changes the decision.

## Default development loop

`goal → freshest state → branch → minimal patch → FAST → repair → FULL → relevant SECURITY/LIVE → PR → VERIFIED PASS`

Rules:

- Translate the owner's natural-language goal into observable acceptance criteria; do not require the owner to write a technical specification.
- Continue the existing product/branch/PR when that is the correct path. Do not create a parallel product to avoid understanding the current one.
- Write durable code/state to GitHub. Chat text is not technical truth.
- Prefer deterministic tests, scripts, schemas, CI and browser checks over repeated LLM self-review.
- On the first meaningful failure: read the exact failing step/log, fix the root cause, commit, and verify again.
- Do not loop blind retries. Repeated failure of the same root problem is a signal to reconsider or escalate.
- Never expose or commit secrets. Use placeholders in examples and repository files.
- Keep changes scoped. Avoid unrelated cleanup and mass refactors.

## Truth hierarchy

- Google Drive: product decisions, research canon, reusable lessons.
- GitHub: code, AGENTS, state, diffs, PRs, CI — technical truth.
- Runtime / deployment / database: operational truth.
- Official primary documentation: current external truth.
- AI narrative: explanation only, never evidence by itself.

## Verification

The canonical contract is `docs/ai/VERIFICATION.md`.

An agent must not claim `VERIFIED PASS` unless the relevant deterministic gates passed for the exact tested SHA and the evidence is available in GitHub Actions / deployment / runtime artifacts.

For UI work, FULL verification should include browser interaction/screenshot evidence when technically possible. For DB work, include migration/readback/advisor evidence. For external-market/live-data work, keep LIVE checks separate from deterministic merge gates.

## Escalation policy

Do not escalate because a task is large.

Use **Codex or Cursor** when the remaining blocker materially requires a capability ordinary Chat does not have, for example: arbitrary interactive terminal/debugger, local dev environment, native toolchain, complex Docker/process inspection, profiler, or a very large compiler-guided refactor that cannot be safely expressed and verified through the connected GitHub/CI surface.

Use **Work** when the remaining task materially requires a long-running cloud-computer/browser/cross-app workflow, scheduled/triggered execution, or persistent interactive state unavailable to ordinary Chat.

Before escalating, ordinary Chat should finish everything it can and pass only a compact execution packet: goal, current SHA/PR, relevant paths, acceptance, exact failure/evidence, attempted fixes and the concrete capability gap.

## State discipline

`docs/ai/CURRENT_STATE.md` is a compact resume point, not a diary. Update it only with durable facts tied to Git SHA/PR/check evidence. Historical details belong in Git history, PRs and completed execution plans.

## Owner interface

A sufficient owner command is:

`Сделай в проекте <цель>. Работай Chat-first, сам пиши в GitHub и доводи через проверки до VERIFIED PASS. Work/Codex/Cursor подключай только при конкретном capability gap.`
