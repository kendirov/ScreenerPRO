# AI_SESSION_STATE — TQS / ScreenerPRO

## Canonical status

- Default branch: `main`.
- TQS Studio V5 (World + Documents) is merged to main via PR #40.
- Permanent product route: `/studio`.
- Architecture decision: **ONE WORLD CANVAS + DOCUMENTS**. Do not return to Notion-like V1 or split the world into separate boards.
- Owner decision: authentication is deferred during active review; Studio opens directly.
- Status: **OWNER REVIEW READY / USER-FACING QA PASS**.
- Google Drive OAuth remains intentionally deferred until owner asks to enable it.

## TQS Studio V5 implemented surface

World:
- infinite graphite canvas;
- semantic Navigator for Projects / Courses / Lessons / Articles / Recent;
- seed frames: ARTEM OS / Agent, TQS / Trading / Intelligence, Обучение, Статьи, Inbox;
- courses: Бесплатный курс and Скальпинг по стакану;
- lesson frames, including canonical test lesson **Занятие 1 — Рабочее пространство**;
- pan/zoom with Mac two-finger pan + ctrlKey pinch zoom;
- free move/resize, snapping, nested semantic parent/child;
- quick create Text / Task / Voice / Link / image / frame / annotation;
- Smart Paste for URL / text / image;
- Voice record / stop / playback;
- image paste + pencil annotation relation + attached annotation movement;
- Light / Dark, JSON export/import, Reset demo.

Documents:
- separate linear Documents mode;
- stable block IDs + ordinals;
- insertion between blocks and drag reorder;
- Lesson / Article surfaces linked back to exact World frame;
- canonical lesson document and Si article seed;
- live MOEX Si chart;
- interactive Market Replay;
- clean public document route;
- PDF path.

## Verification evidence

Latest pre-merge V5 head: `e3934f32b66963f1f5ccc894037e0c3af97c805d`.

GitHub acceptance on that exact code:
- build PASS;
- second build gate PASS;
- browser-qa PASS;
- Vercel preview READY.

Browser QA passed:
- seed + Navigator;
- pan + pinch;
- create/edit Text;
- create/edit/complete Task;
- record/stop/playback Voice;
- Smart Paste URL/text/image;
- pencil annotation relation;
- move annotated image;
- full lesson document + chart + replay;
- document insert + reorder;
- Market Replay controls;
- Document → World;
- Light/Dark;
- reload persistence;
- JSON export/import;
- Reset demo.

## Persistence / backend state

- Existing TQS Supabase project is reused; no second database/project.
- `studio-api` is ACTIVE v25.
- Canonical Studio schema/migrations exist for world objects, activity, documents/blocks/revisions, assets, Drive refs/conflicts, shares/publication metadata.
- User interaction is **local-first** with a durable serialized sync outbox and bounded retry/backoff.
- A transient Supabase upstream/SSL incident was observed during V5 finalization. The UI remains functional and mutations stay queued for sync rather than failing visibly.
- Unsafe direct-Postgres transport experiments were fully reverted; no diagnostic DB transport is part of the active Studio implementation.

## Drive / auth boundary

- Owner explicitly chose to defer Studio authentication during review.
- Drive integration code and secure Vault-backed OAuth path exist, but Google OAuth client consent/configuration is not currently a product gate.
- Do not fake Drive sync. Re-enable only when owner explicitly asks to finish Drive connection.

## Current next-step rule

Studio is now a real product surface on main, not a prototype branch task.

Do not rebuild the architecture. Continue only with owner-visible defects/polish found in `/studio` or with explicitly requested capabilities.
