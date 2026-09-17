# ADR-001 — Chat-first development architecture

Date: 2026-09-17
Status: accepted

## Decision

Ordinary ChatGPT is the default development control plane for ScreenerPRO/TQS.

Architecture:

`Owner intent → ChatGPT → GitHub repo/PR → GitHub Actions deterministic execution → runtime/browser/DB evidence → ChatGPT repair loop`

Roles:

- ChatGPT: goal resolution, architecture, targeted code changes, repair orchestration.
- GitHub: technical source of truth and durable state.
- GitHub Actions: constrained execution harness, not an unrestricted remote shell exposed to the model.
- Playwright: repeatable browser interaction/screenshots/console evidence.
- Vercel/runtime: deployment and runtime truth for web surfaces.
- Supabase: DB/Auth/Storage/Edge operations and readback where that project surface is used.
- Google Drive: product/research/process canon, not duplicate code storage.
- Work/Codex/Cursor: explicit escalation for missing capabilities.

## Why

The expensive scarce resource is agentic execution allowance and human intervention. Compilation, tests, browser smoke and security scans are cheaper and more reliable when executed deterministically. The target metric is `cost per VERIFIED PASS`, not model tokens per answer.

## Safety boundary

Actions expose named verification workflows, not an owner-secret-bearing arbitrary command endpoint. Workflow permissions are minimized. Secrets remain in provider/GitHub secret stores and are never written into prompts, logs or repository content.

## Context architecture

Repository guidance uses progressive disclosure: short root `AGENTS.md` → current state/verification → project-local AGENTS → affected files. Large historical context is opt-in.

## Consequences

- Most bounded web/data/product changes should start in ordinary Chat.
- CI quality becomes a product capability: every useful deterministic check reduces future LLM work.
- Work/Codex/Cursor remain important for terminal/debugger/native/long-running capability gaps, but are not selected merely because a task is large.
