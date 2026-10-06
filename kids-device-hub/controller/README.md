# Kids Device Hub Controller v2

Single control plane for family devices.

ChatGPT -> office controller -> Tailscale -> child device agent.

Secrets are never passed through chat commands. Android v2 accepts the trusted office controller over the private Tailscale path; LAN access keeps the per-install pair-token fallback.

Examples:
python controller.py roma status
python controller.py roma screenshot
python controller.py roma apps
python controller.py roma usage --days 1
python controller.py roma tap 100 100
python controller.py roma launch com.roblox.client
python controller.py roma install-url https://example.com/app.apk
python controller.py roma uninstall com.example.app

Every command is written to audit.jsonl. Screenshots are stored under screenshots/.

Normal Android can guide install/uninstall through system confirmation screens. Fully silent package management requires managed Device Owner provisioning.
