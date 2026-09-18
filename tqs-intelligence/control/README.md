# TQS AI Control Mailbox

This branch is a narrow outbound-control surface polled by the office TQS node.

File:
`tqs-intelligence/control/remote-command.json`

Allowed actions only:
- `noop`
- `set_control`
- `refresh_market`
- `request_update`

Allowed `set_control.params` keys:
- `mode` = stop | light | max
- `auto_update`
- `heavy_workers` = 1..4
- `history_batch_size` = 1..16
- `metric_batch_size` = 1..8
- `refresh_seconds_override` = 0..900
- `cpu_soft_limit_pct` = 50..99
- `ram_soft_limit_pct` = 50..99

Every non-noop command must have:
- unique `command_id`
- `issued_at_ms`
- `expires_at_ms` no more than one hour after issue

The runtime keeps replay protection and publishes the last command/result through Runtime Audit / Google Drive AI Bridge.

Security invariant: this mailbox is NOT a shell. Never add arbitrary command execution, arbitrary process kill, order placement, API keys, cookies, Tailscale credentials or other secrets here.
