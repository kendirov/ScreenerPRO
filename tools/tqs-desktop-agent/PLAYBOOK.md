# TQS Desktop Agent — Operator & Learning Playbook

This document defines how an AI agent should use TQS Desktop Agent reliably and how the system should improve from real desktop work over time.

## 1. Purpose

TQS Desktop Agent is not only a remote mouse/keyboard bridge. It is a reusable desktop-control layer with a closed operating loop:

OBSERVE -> UNDERSTAND -> ACT -> VERIFY -> LEARN

The long-term goal is to turn repeated desktop work into tested, documented, increasingly reliable scenarios instead of re-solving the same UI problem in every chat.

## 2. Knowledge split

There are two knowledge layers.

### Repository knowledge — public/general

Keep here:
- agent architecture and API behavior;
- generic automation patterns;
- stable technical constraints;
- reusable scenario definitions;
- implementation bugs and fixes that are safe to publish;
- tests and expected behavior.

Do not store:
- passwords, tokens, cookies or session data;
- private screenshots;
- user-specific browsing history;
- private machine-specific preferences or personal information.

### Private operator knowledge — Google Drive

The private operator playbook is the source of truth for:
- machine aliases and roles;
- monitor/workspace map;
- preferred applications and browsers;
- VPN/browser routing conventions;
- application-specific habits;
- successful and unsuccessful real-world examples;
- user-specific automation rules.

When the AI is asked to operate a user's Windows machine, it should read the private operator playbook before making assumptions about the environment.

## 3. New-session bootstrap contract

Before a meaningful desktop task:

1. Load the private machine/operator profile.
2. Check TQS Desktop Agent health.
3. Read monitor inventory.
4. Read visible windows.
5. If the task is visual or the current state matters, capture the relevant monitor(s).
6. Reuse existing suitable windows before opening duplicate applications.
7. Select the least fragile control method.
8. Perform the smallest action that advances the task.
9. Verify the resulting UI/state.
10. Record a new learning only when it adds reusable information.

A new chat should not assume screen layout, browser choice, window location, or application state from memory alone if those can be checked live.

## 4. Control-method priority

Prefer methods in this order:

1. Application/API integration when the application exposes a reliable API.
2. Browser DOM automation for websites.
3. Windows UI Automation by semantic element.
4. Window focus + keyboard shortcuts.
5. Coordinate-based mouse actions.
6. Vision-guided coordinate actions as the fallback.

Coordinate clicks are inherently more fragile than semantic UI actions and should be followed by explicit verification.

## 5. Observe / Act / Verify loop

Every non-trivial scenario should contain evidence checkpoints.

### Observe

Collect only what is needed:
- health;
- windows;
- monitor map;
- screenshot;
- UI Automation tree;
- application/API state.

### Act

Keep actions atomic where possible:
- focus one window;
- click one control;
- type one value;
- execute one shortcut;
- launch one application;
- run one scenario step.

### Verify

Use one or more:
- screenshot after action;
- active-window check;
- UI element/state check;
- file/state readback;
- application API confirmation.

Never treat “command returned success” as the only proof for a UI operation.

## 6. Learning loop

Desktop work should continuously improve the playbook without turning it into an unstructured activity log.

Log an example when at least one of these is true:
- a new application was automated;
- a previously unknown machine preference was discovered;
- a reliable shortcut or UI selector was found;
- an action failed in a reusable way;
- a fragile coordinate action was replaced by a stronger method;
- a scenario was changed because the UI changed;
- the user corrected the agent's assumption;
- a new verification method proved useful.

Do not log routine repetitions that add no new information.

## 7. Successful-example record

Record:

- Goal
- Initial state
- Chosen method
- Actions
- Verification evidence
- Result
- Why it worked
- Reusable rule
- Scenario/version affected

Example:

Goal: open an existing chart workspace.
Initial state: browser already open.
Method: window inventory -> focus existing browser -> semantic navigation.
Verification: correct title visible and screenshot matched expected workspace.
Reusable rule: reuse a suitable existing browser window instead of launching a duplicate.

## 8. Failed-example record

Record:

- Goal
- Initial assumption
- What was attempted
- Exact failure mode
- Evidence
- Root cause if known
- Recovery
- Permanent lesson
- Whether code/profile/scenario was changed

Failure is useful only when it changes future behavior.

## 9. Rule promotion

Use three levels:

### Observation
A single useful fact or result.

### Candidate rule
A behavior that succeeded more than once or clearly resolves a recurring failure.

### Stable rule
A behavior that is reliable across repeated sessions and is now the default unless the user overrides it.

If a stable rule stops working, demote it and record why.

## 10. Scenario lifecycle

Each reusable scenario should have:

- name;
- user intent;
- prerequisites;
- preferred control method;
- fallback method;
- action sequence;
- verification;
- recovery path;
- safety boundary;
- version;
- last verified status.

Suggested states:
- DRAFT
- TESTED
- STABLE
- DEGRADED
- RETIRED

## 11. Failure taxonomy

Use consistent failure categories:
- WRONG_APP
- WRONG_WINDOW
- WRONG_BROWSER
- WINDOW_NOT_FOUND
- UI_ELEMENT_NOT_FOUND
- COORDINATE_DRIFT
- KEYBOARD_LAYOUT
- FOCUS_LOST
- NETWORK_OR_VPN
- AUTH_REQUIRED
- APP_CHANGED
- AGENT_UNAVAILABLE
- VERIFICATION_FAILED
- UNSAFE_TO_CONTINUE
- UNKNOWN

This makes recurring problems searchable.

## 12. Browser and app selection

Browser/application selection is operator-specific and therefore belongs in the private machine profile.

General behavior:
- inspect existing windows first;
- follow the private routing rule;
- reuse the correct existing instance when practical;
- do not silently switch browsers when cookies/auth/session state may differ;
- verify the final page/application.

## 13. Trading-specific boundary

For trading workflows:

Use structured exchange/TQS APIs for:
- order submission;
- cancellation;
- position management;
- risk enforcement.

Use Desktop Agent for:
- workspace setup;
- chart navigation;
- terminal observation;
- screenshots and evidence;
- journal capture;
- applications without a reliable API.

Do not make coordinate-based Buy/Sell clicks the default execution path.

## 14. Event evidence

Important events may capture:
- event name;
- timestamp;
- symbol;
- side;
- price;
- size;
- order/position ID;
- selected monitor screenshots;
- current window list;
- TQS snapshot ID;
- scenario version.

Example events:
- order_submitted
- order_filled
- position_opened
- stop_changed
- position_closed
- workspace_ready
- anomaly_detected

## 15. Safety and privacy

- Local agent listens on localhost only.
- Do not store secrets in scenario files or documentation.
- Redact/avoid private screenshot data when it is not required.
- A tray control switch must remain available.
- Destructive or financially consequential flows should prefer structured APIs and explicit guards.
- Verification failure should stop a multi-step scenario rather than blindly continuing.

## 16. Definition of a good desktop automation

A good automation is not “it clicked the right pixel once.”

It:
- starts from an observed state;
- uses the strongest available control method;
- minimizes unnecessary actions;
- verifies outcomes;
- has a recovery path;
- records reusable learning;
- becomes simpler and more reliable after repeated use.

## 17. Current implementation

See `README.md` for installation, CLI, endpoints and current Windows capabilities.

Private machine-specific routing and the live success/failure learning log are intentionally kept outside the public repository.
