#!/bin/sh
set -e

CONFIG_DIR="${HOME}/.openclaw"
mkdir -p "$CONFIG_DIR"

echo "[entrypoint] Writing config to $CONFIG_DIR/openclaw.json..."
echo "$OPENCLAW_CONFIG" > "$CONFIG_DIR/openclaw.json"

echo "[entrypoint] Starting OpenClaw on port ${OPENCLAW_PORT:-18789}..."
exec node /app/dist/index.js gateway --bind lan --port "${OPENCLAW_PORT:-18789}"
