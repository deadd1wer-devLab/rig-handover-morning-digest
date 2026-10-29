#!/usr/bin/env bash
# Plan morning-digest § 3. Run rig and save one page as a single HTML file (ADR 0001: the page
# is self-contained). LANE_MARKER comes from the environment or .env; unset → "no marker set".
# Usage: scripts/save-preview.sh <night> <out.html>
set -euo pipefail
night="${1:?night, e.g. 2026-10-28}"
out="${2:?output file}"
port="${PREVIEW_PORT:-8799}"

# A rig already on this port would answer for us, maybe from other code: refuse instead.
if curl -fsS "http://localhost:$port/health" >/dev/null 2>&1; then
  echo "port $port is busy; set PREVIEW_PORT" >&2
  exit 1
fi

PORT="$port" pnpm --silent start >/dev/null 2>&1 &
pid=$!
# pnpm → tsx → node: stop the whole tree, not only pnpm.
killtree() { for c in $(pgrep -P "$1" || true); do killtree "$c"; done; kill "$1" 2>/dev/null || true; }
trap 'killtree "$pid"' EXIT

for _ in $(seq 1 50); do
  curl -fsS "http://localhost:$port/health" >/dev/null 2>&1 && break
  sleep 0.2
done

mkdir -p "$(dirname "$out")"
curl -fsS "http://localhost:$port/digest/$night" -o "$out"
echo "saved /digest/$night → $out"
