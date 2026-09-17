#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash tqs-intelligence/deploy/linux/install-server.sh" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
for cmd in git docker systemctl; do
  command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 3; }
done
docker compose version >/dev/null
cd "$ROOT"
if [ ! -f .env ]; then cp .env.example .env; fi
chmod +x deploy/linux/*.sh
docker compose -f docker-compose.server.yml --project-directory . up -d --build
cat > /etc/systemd/system/tqs-intelligence-update.service <<EOF2
[Unit]
Description=TQS Intelligence safe auto-update
After=network-online.target docker.service
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=$ROOT/deploy/linux/update-server.sh
EOF2
cat > /etc/systemd/system/tqs-intelligence-update.timer <<'EOF2'
[Unit]
Description=Check TQS Intelligence updates every 30 minutes
[Timer]
OnBootSec=10min
OnUnitActiveSec=30min
Persistent=true
[Install]
WantedBy=timers.target
EOF2
systemctl daemon-reload
systemctl enable --now tqs-intelligence-update.timer
echo "TQS server started. UI/API bind: $(grep '^TQS_SERVER_BIND=' .env 2>/dev/null || echo 'TQS_SERVER_BIND=127.0.0.1') port 8787"
echo "Auto-update timer enabled with build + healthcheck + rollback."
