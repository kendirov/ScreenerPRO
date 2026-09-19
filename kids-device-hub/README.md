# Kendirov Kids Device Hub

Private family device-control platform. First target: Roma's Lenovo Android tablet. Next target: Kirill's Windows laptop.

## Product goal
Allow an authorized parent to ask ChatGPT in natural language to inspect a managed child device, understand the current UI, take screenshots, launch apps, operate the UI, inspect real app usage, run bounded macros, and later apply family screen-time policies.

Core loop: OBSERVE -> UNDERSTAND -> ACT -> VERIFY -> LEARN.

## Android v1 capabilities
- foreground agent on port 8766
- per-install random pair token
- accessibility UI tree
- accessibility screenshot
- tap, swipe, text, Home, Back, Recents, notifications
- click visible UI by text
- launch installed apps
- list launchable apps
- UsageStats report for 1-30 days
- Device Admin lock
- Device Owner package suspend/unsuspend when provisioned
- bounded repeat-tap macro with stop command
- boot receiver
- works through LAN or an Android Tailscale address

## Privacy and safety
This is an explicit parent-managed family tool. It does not implement hidden keylogging, microphone recording, camera recording, clipboard collection, password extraction, or arbitrary remote shell. The persistent notification indicates that the agent is active. Protected Android windows may intentionally block screenshots or UI inspection.

## Pairing
Install APK. Open it once. Enable:
1. Accessibility -> Kids Device Hub
2. Usage Access -> Kids Device Hub
3. Device Admin (optional)
4. Tailscale on the tablet if remote control is needed outside the home LAN

The app displays tablet IPv4 addresses and a random Pair Token.

Every HTTP request must include:
X-Hub-Token: <pair-token>

Examples:
GET /status
GET /screenshot
GET /ui
GET /usage?days=1
GET /apps
POST /launch?package=com.roblox.client
POST /tap?x=500&y=800
POST /swipe?x1=500&y1=900&x2=500&y2=300&ms=350
POST /click-text?text=Play
POST /global?action=home
POST /repeat-tap?x=500&y=800&intervalMs=1000&count=60
POST /stop-macro
POST /lock
POST /suspend?package=com.roblox.client&value=true  (Device Owner only)

## Maximum managed mode / Device Owner
Device Owner must be provisioned on a fresh/reset Android device before normal setup. It cannot normally be silently granted to an already configured tablet. V1 includes DeviceAdminReceiver and Device Owner-aware controls so this mode can be activated during dedicated provisioning.

## Chat integration
Preferred topology:
ChatGPT -> Remote Desktop Commander on Kendirov Windows -> Kids Device Hub bridge -> Lenovo over LAN/Tailscale.

The existing Windows ArtemDeviceHub project is the bridge starting point. Do not store the pair token in public GitHub or Google Docs.

## Product family
- Roma / Lenovo Tab: Android agent first
- Kirill / Windows laptop: Windows guardian second
- future: shared parent dashboard, policies, usage analytics, scenario catalog
