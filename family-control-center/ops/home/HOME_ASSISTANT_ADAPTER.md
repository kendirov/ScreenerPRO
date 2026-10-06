# Home Assistant adapter contract

Family Core remains the system-of-record for the Family Control Center. Home Assistant is a smart-home adapter, not a replacement database.

## Planned connection

- Host: `kendirov-home` or the future always-on home mini-PC.
- Transport: local LAN/Tailscale only.
- Read: Home Assistant REST `GET /api/states`.
- Allowed actions: mapped Home Assistant `POST /api/services/<domain>/<service>`.
- Discovery: MQTT Discovery for ESP32 and future sensors.
- Secrets: Home Assistant long-lived access token stays only under `C:\HomeLab\secrets`.
- Family Core ingest: normalize HA entities into `control_integrations -> control_entities -> control_entity_states`.
- Commands: only explicit allow-listed capabilities become `control_entity_commands`.

## Domain mapping

| Home Assistant | Family Core domain | Default control |
| --- | --- | --- |
| light | light | TURN_ON / TURN_OFF |
| switch | switch | TURN_ON / TURN_OFF |
| climate | climate | REFRESH / SET_MODE (adapter-specific) |
| sensor | sensor | read-only |
| binary_sensor | binary_sensor | read-only |
| vacuum | vacuum | START / STOP / DOCK / SET_MODE |
| fan | fan | TURN_ON / TURN_OFF / SET_MODE |
| camera | camera | metadata/readiness only by default |
| media_player | media | read-only until explicitly allow-listed |

Unsupported capabilities must remain visible as unsupported; never fake state or control.

## Current gate

Home Assistant itself is deferred until the home Windows virtualization/SVM maintenance is completed. MQTT, Node-RED, Xiaomi OAuth, Yandex inventory and Family Core are already online, so enabling HA later does not require a Control Center redesign.
