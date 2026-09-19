# TQS Desktop Agent

Local Windows "eyes and hands" bridge for Trading QS and ChatGPT.

## Status

Version 0.1.0 is installed and smoke-tested on the Windows workstation:
- 6 monitors discovered and captured.
- Window enumeration and focus verified.
- Mouse move/click verified.
- Keyboard shortcuts verified.
- Unicode/Russian text entry verified.
- Windows UI Automation tree inspection verified.
- Multi-monitor event capture verified.
- Tray pause/kill-switch verified.

## Architecture

ChatGPT -> Remote Desktop Commander -> local CLI -> TQS Desktop Agent -> Windows desktop/apps.

The agent listens only on localhost (127.0.0.1:8765) and uses a random bearer token stored in the local config. It does not expose a public network port.

## Capabilities

- Health/status
- Monitor inventory
- Screenshot one monitor or the full virtual desktop
- Multi-monitor event capture with metadata
- Top-level window list and focus
- Mouse move/click
- Unicode text input
- Keyboard hotkeys
- UI Automation element discovery and click
- Declarative UI scenarios
- Tray toggle to pause all mutating control

## Installation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Installed location:

```text
%LOCALAPPDATA%\TQSDesktopAgent
```

A per-user Startup shortcut is created, so the tray agent starts automatically with Windows.

## CLI examples

```powershell
$py = Join-Path $env:LOCALAPPDATA "TQSDesktopAgent\venv\Scripts\python.exe"
$cli = Join-Path $env:LOCALAPPDATA "TQSDesktopAgent\app\client.py"

& $py $cli health
& $py $cli monitors
& $py $cli windows
& $py $cli shot --monitor 5
& $py $cli shot --monitor all
& $py $cli focus "TradingView"
& $py $cli move 1200 600
& $py $cli click 1200 600
& $py $cli type "BTCUSDT"
& $py $cli hotkey ctrl l
& $py $cli ui-find "TradingView" "Buy" --limit 20
& $py $cli capture --event order_filled
& $py $cli pause
& $py $cli resume
```

## Scenarios

The client can run a JSON file containing simple UI actions:

```json
[
  {"action": "focus", "title": "TradingView"},
  {"action": "wait", "seconds": 0.3},
  {"action": "click", "x": 1500, "y": 210},
  {"action": "type", "text": "BTCUSDT"},
  {"action": "hotkey", "keys": ["enter"]},
  {"action": "screenshot", "monitor": 1, "prefix": "btc_ready"}
]
```

Run:

```powershell
& $py $cli scenario .\scenario.json
```

## Trading event capture

TQS can send events such as:
- order_submitted
- order_filled
- position_opened
- stop_changed
- position_closed

The agent can write one PNG per monitor plus metadata.json with the event payload and current window list.

## Security model

- Server is bound to 127.0.0.1 only.
- Fresh installs generate a random local bearer token.
- There is no shell/PowerShell execution endpoint.
- Mutating control can be paused instantly from the tray.
- Screenshot/capture remains available while desktop control is paused.
- No credentials or local tokens are stored in Git.
- Trading execution should remain in the TQS exchange API/risk engine; desktop automation is for observation, workspace control, evidence capture, and apps without reliable APIs.

## Files

- agent.py - tray process and localhost API
- client.py - local CLI used by ChatGPT/Remote Desktop Commander
- install.ps1 - installer, venv, dependencies, startup shortcut
- uninstall.ps1 - stops autostart and agent while preserving captures/config
- requirements.txt - Python dependencies

## Next extensions

The same command model can later be implemented for:
- macOS using ScreenCaptureKit + Accessibility
- Android using ADB/scrcpy
- TQS trade-event hooks for automatic screenshots
- higher-level workspace presets for the six-monitor trading setup