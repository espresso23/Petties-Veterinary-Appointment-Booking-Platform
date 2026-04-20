#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOG_PREFIX="[dev-ngrok-web]"
NGROK_API_URL="${NGROK_API_URL:-http://127.0.0.1:4040/api/tunnels}"
NGROK_LOG_FILE="${NGROK_LOG_FILE:-/tmp/petties-ngrok-8080.log}"

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*"
}

die() {
  printf '%s [LỖI] %s\n' "$LOG_PREFIX" "$*" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Thiếu command: ${cmd}"
}

resolve_ngrok_bin() {
  if command -v ngrok >/dev/null 2>&1; then
    echo "ngrok"
    return 0
  fi
  if command -v ngrok.exe >/dev/null 2>&1; then
    echo "ngrok.exe"
    return 0
  fi
  return 1
}

NGROK_PID=""

cleanup() {
  if [[ -n "${NGROK_PID}" ]] && kill -0 "${NGROK_PID}" >/dev/null 2>&1; then
    log "Dừng ngrok (PID ${NGROK_PID})..."
    kill "${NGROK_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

extract_ngrok_domain() {
  local tunnels_json="$1"

  if command -v jq >/dev/null 2>&1; then
    jq -r '
      .tunnels[]
      | select(
          (.config.addr == "http://localhost:8080")
          or (.config.addr == "localhost:8080")
          or (.config.addr == "8080")
        )
      | .public_url
      ' <<<"$tunnels_json" 2>/dev/null | head -n 1 | sed -E 's#^https?://##'
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, sys
data = json.load(sys.stdin)
for t in data.get("tunnels", []):
  addr = (t.get("config") or {}).get("addr", "")
  if addr in ("http://localhost:8080", "localhost:8080", "8080"):
    url = (t.get("public_url") or "")
    if url:
      print(url.replace("https://", "").replace("http://", ""))
      break
' <<<"$tunnels_json" 2>/dev/null | head -n 1
    return 0
  fi

  return 1
}

main() {
  local ngrok_bin=""
  ngrok_bin="$(resolve_ngrok_bin)" || die "Thiếu command: ngrok"
  require_command npm
  require_command curl

  if [[ ! -d "${REPO_DIR}/petties-web" ]]; then
    die "Không tìm thấy thư mục: ${REPO_DIR}/petties-web"
  fi

  log "Chạy ngrok cho port 8080..."
  log "Log ngrok: ${NGROK_LOG_FILE}"
  "${ngrok_bin}" http 8080 --log=stdout --log-format=logfmt >"${NGROK_LOG_FILE}" 2>&1 &
  NGROK_PID="$!"
  log "Ngrok PID: ${NGROK_PID}"
  log "Ngrok dashboard (local): http://127.0.0.1:4040"

  local public_domain=""
  for _ in $(seq 1 60); do
    local tunnels_json=""
    if tunnels_json="$(curl -fsS "${NGROK_API_URL}" 2>/dev/null)"; then
      public_domain="$(extract_ngrok_domain "$tunnels_json" || true)"
      if [[ -n "${public_domain}" ]]; then
        break
      fi
    fi
    sleep 0.5
  done

  if [[ -n "${public_domain}" ]]; then
    log "Ngrok public URL: https://${public_domain}"
  else
    log "Không lấy được public URL từ ngrok API (${NGROK_API_URL}). Bạn vẫn có thể xem trong ngrok terminal/dashboard."
  fi

  log "Chạy Web dev server..."
  cd "${REPO_DIR}/petties-web"
  npm run dev
}

main "$@"
