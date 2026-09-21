# Family Core home bridge

Production runtime on `kendirov-home`:

- `C:\HomeLab\automation\family-core\family_core_home_bridge.py`
- Scheduled Task: `Kendirov Family Core Home Bridge`
- Runs as SYSTEM at startup and restarts on failure.
- Ingest cadence: about 120 seconds.
- Command polling: about 5 seconds.
- Local token file: `C:\HomeLab\secrets\family-core-home-token.txt` (never commit it).

Live integrations currently normalized into Family Core:
Xiaomi Home (X20+, purifier, cameras), Yandex Smart Home inventory, and home service health (Tailscale, MQTT, Node-RED, Jellyfin, Sunshine).

Control is allow-listed. There is no arbitrary shell command path through the web UI.
