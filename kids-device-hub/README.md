# Kendirov Family Device Hub

Private family device-control platform.

## Architecture
ChatGPT -> Windows Controller -> Tailscale -> Device Agent

The child device remains deliberately lightweight. It does not continuously stream video, run vision models, poll apps, or analyze the screen. The agent waits for a command and performs work only on demand.

## Devices
- roma — Lenovo Android tablet — active
- kirill — Windows laptop — next adapter

## Android stable agent
Capabilities:
- status / health / battery / storage / memory
- screenshot on demand
- accessibility UI tree on demand
- tap / long-press / swipe / text / click by visible text
- Home / Back / wake / lock
- launch apps and inspect installed apps
- UsageStats for screen-time analysis
- bounded repeat-tap macro
- bounded JSON scenario runner (max 100 steps)
- remote URL opening
- remote APK download + PackageInstaller flow
- uninstall flow and app settings
- shared-storage file list / mkdir / move / safe trash when All Files Access is enabled
- Device Owner-aware package suspension
- boot start
- Tailscale-first trust, pair-token fallback for non-Tailscale LAN access

## Low-load design
No continuous screenshots. No video stream. No OCR on the tablet. No LLM on the tablet. Accessibility subscribes only to window changes. Usage and file scans run only when requested. The foreground service blocks on a socket while idle.

## Remote scripting
The controller can send bounded JSON steps such as:
[
  {"action":"launch","package":"com.roblox.client"},
  {"action":"wait","ms":1500},
  {"action":"tap","x":100,"y":100},
  {"action":"swipe","x1":500,"y1":900,"x2":500,"y2":300,"ms":300}
]

Supported actions: wait, tap, longPress, swipe, text, clickText, home, back, launch.

This is the main extension mechanism: most new mini-bots and child experiments do not require rebuilding the APK.

## Updates
CI builds an unsigned stable release. The office Windows controller owns the persistent signing key and signs the family distribution with Android apksigner. It then serves:
- Kendirov-Kids-Device-Hub-stable.apk
- manifest.json

over the private Tailscale address on port 8770.

Future updates use the same package and signing key. The Android agent can request its own update. Android may show a system install confirmation in ordinary mode; the controller can operate that UI remotely through Accessibility. Device Owner mode can provide stronger managed-device installation capabilities.

## File and launcher organization
Shared-storage folders can be managed through file commands after optional All Files Access is granted. Launcher folders and icon organization are visual UI tasks: screenshot -> understand -> long-press/drag -> verify.

## Security boundaries
No hidden microphone recording, camera recording, keylogger, password extraction, or covert message collection. Protected Android windows may block screenshots. Full arbitrary Android shell/root access is not claimed; that requires root/privileged tooling and is intentionally separate from the normal lightweight agent.

## Controller examples
hub roma status
hub roma screenshot
hub roma apps
hub roma usage --days 1
hub roma tap 100 100
hub roma long-press 500 500 --ms 900
hub roma launch com.roblox.client
hub roma files Download
hub roma mkdir Kids/Projects
hub roma update
hub roma script --file my-script.json

## Core operating loop
OBSERVE -> UNDERSTAND -> ACT -> VERIFY -> LEARN

For visual actions, capture before and after whenever practical.
