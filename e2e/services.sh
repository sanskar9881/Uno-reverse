#!/bin/sh
# Starts/stops the rigged e2e game server and the built client preview.
# Usage: sh e2e/services.sh start|stop
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$1" in
  start)
    cd "$ROOT/server" && PORT=3001 CONTROL_PORT=3099 DETERMINISTIC=1 GAME_GRACE_MS=8000 HOST_TRANSFER_MS=3000 \
      LOBBY_GRACE_MS=5000 DISCONNECTED_TURN_MS=3000 CLIENT_ORIGIN=http://localhost:4173 \
      setsid nohup npx tsx tests/e2e/e2e-server.ts > /tmp/e2e-server.log 2>&1 < /dev/null &
    cd "$ROOT/client" && setsid nohup npx vite preview --port 4173 --strictPort > /tmp/preview.log 2>&1 < /dev/null &
    sleep 5
    curl -sf http://localhost:3001/health > /dev/null && echo "server up" || echo "server DOWN"
    curl -sf http://localhost:4173/ > /dev/null && echo "client up" || echo "client DOWN"
    ;;
  stop)
    pkill -f "e2e-serve[r].ts" 2>/dev/null
    pkill -f "vite previe[w]" 2>/dev/null
    sleep 1
    echo stopped
    ;;
esac
