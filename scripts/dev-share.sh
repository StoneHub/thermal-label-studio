#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5173}"
PUBLIC=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public)
      PUBLIC=1
      shift
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: pnpm dev:share [-- --public] [--port 5173]"
      exit 1
      ;;
  esac
done

LAN_IP="$(hostname -I | awk '{print $1}')"
if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="<your-lan-ip>"
fi

cleanup() {
  if [[ -n "${CF_PID:-}" ]]; then
    kill "$CF_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "$PUBLIC" -eq 1 ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared not found. Install it first, then run:"
    echo "  pnpm dev:share -- --public"
    exit 1
  fi

  echo "Starting temporary public tunnel (cloudflared)..."
  cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate > /tmp/tls-cloudflared.log 2>&1 &
  CF_PID=$!

  for _ in {1..30}; do
    if grep -qE "https://[-a-zA-Z0-9]+\.trycloudflare\.com" /tmp/tls-cloudflared.log; then
      break
    fi
    sleep 1
  done

  PUBLIC_URL="$(grep -Eo "https://[-a-zA-Z0-9]+\.trycloudflare\.com" /tmp/tls-cloudflared.log | head -n1 || true)"

  if [[ -n "$PUBLIC_URL" ]]; then
    echo "Public URL: ${PUBLIC_URL}"
  else
    echo "Tunnel started, but URL wasn't detected yet."
    echo "Check /tmp/tls-cloudflared.log"
  fi
fi

echo "LAN URL: http://${LAN_IP}:${PORT}"
echo "API URL: http://${LAN_IP}:3001"
echo "Starting API + Vite with host 0.0.0.0..."

pnpm --filter @tls/api dev > /tmp/tls-api.log 2>&1 &
API_PID=$!
trap 'kill "$API_PID" >/dev/null 2>&1 || true; cleanup' EXIT INT TERM

pnpm --filter @tls/web exec vite --host 0.0.0.0 --port "${PORT}"