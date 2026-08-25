#!/usr/bin/env bash
# =============================================================================
# dsh-skill-7d-viewer mount smoke (CI + local):
#
#   1. npm-pack the plugin into a tarball;
#   2. mount it into a fresh scratch profile through the official CLI
#      (`dsh plugin --profile web add file:<tarball>`);
#   3. boot a real `dsh web` (keyless, --port 0 = OS-assigned port);
#   4. run the Playwright headless-render lane (tests/e2e): prove the plugin
#      mounts, bookmarks persist across a reload, and jump-back scrolls to the
#      anchor — without crashing the shell.
#
# Usage:
#   bash scripts/e2e-mount.sh [--grep <playwright-filter>]
#
# Env vars (all optional):
#   DSH_CMD        dsh command; defaults to PATH `dsh`, then npx @deepseek-ai/dsh
#   PORT           fixed port (default 0 = OS-assigned, parsed from the log)
#   DSH_HOME_BASE  override the scratch root (default system temp dir). The
#                  script only writes/deletes its own subdirectory under it.
#   KEEP_HOME      non-empty keeps the scratch home for debugging.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DSH_CMD="${DSH_CMD:-}"
PORT="${PORT:-0}"
GREP_FILTER=""
if [ "${1:-}" = "--grep" ]; then GREP_FILTER="${2:?--grep needs an argument}"; fi

say()  { printf '\033[32m[e2e-mount]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[e2e-mount]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m[e2e-mount]\033[0m %s\n' "$*" >&2; exit 1; }

command -v node  >/dev/null 2>&1 || die "node not found (DSH needs Node.js >= 20)"
command -v pnpm  >/dev/null 2>&1 || die "pnpm not found"

# dsh CLI: PATH first, then the published package via npx.
if [ -z "$DSH_CMD" ]; then
  if command -v dsh >/dev/null 2>&1; then
    DSH_CMD="dsh"
  elif command -v npx >/dev/null 2>&1; then
    say "no dsh on PATH; falling back to npx -y --package @deepseek-ai/dsh dsh"
    DSH_CMD="npx -y --package @deepseek-ai/dsh dsh"
  else
    die "no dsh or npx found; install DSH CLI or set DSH_CMD"
  fi
fi

# Pack the plugin (prepublishOnly runs `pnpm build`).
say "packing the plugin…"
(cd "$ROOT" && pnpm pack --pack-destination "$ROOT") >/dev/null
TARBALL="$(ls "$ROOT"/7dgroup-dsh-skill-7d-viewer-*.tgz 2>/dev/null | head -1 || true)"
[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || die "pack produced no tarball"
TARBALL="$(cd "$(dirname "$TARBALL")" && pwd)/$(basename "$TARBALL")"
say "tarball: $TARBALL"

# Scratch home (fresh every run; never touches the real ~/.dsh).
if [ -n "${DSH_HOME_BASE:-}" ]; then
  SCRATCH="$(mktemp -d "$DSH_HOME_BASE/dsh-e2e-mount.XXXXXX")"
else
  SCRATCH="$(mktemp -d /tmp/dsh-e2e-mount.XXXXXX)"
fi
export DSH_HOME="$SCRATCH/home"
WORKSPACE_DIR="$SCRATCH/workspace"
WEB_LOG="$SCRATCH/web.log"
mkdir -p "$DSH_HOME/profiles/web" "$WORKSPACE_DIR"
say "scratch home: $DSH_HOME"

SERVER_PID=""
cleanup() {
  local code=$?
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -z "${KEEP_HOME:-}" ]; then rm -rf "$SCRATCH"; else warn "KEEP_HOME set; kept $SCRATCH"; fi
  exit "$code"
}
trap cleanup EXIT

# Bootstrap the scratch web profile (mirrors dsh initProfile; pre-allow pnpm 11
# build scripts and <24h release-age exclusions).
PROFILE_DIR="$DSH_HOME/profiles/web"
cat > "$PROFILE_DIR/package.json" <<EOF
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {},
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } }
}
EOF
printf '[]\n' > "$PROFILE_DIR/cordis.patch.yml"
cat > "$PROFILE_DIR/pnpm-workspace.yaml" <<'EOF'
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false

allowBuilds:
  node-pty: true
  protobufjs: true

minimumReleaseAgeExclude:
  - "@7dgroup/dsh-skill-7d-viewer"
EOF

# Install the tarball through the official CLI + bundle reconciliation.
say "installing via: dsh plugin --profile web add file:$TARBALL"
$DSH_CMD plugin --profile web add "file:$TARBALL"

# Verify the bundle registered.
if ! node -e '
  const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  process.exit((p.dsh?.profile?.bundles ?? []).includes("@7dgroup/dsh-skill-7d-viewer") ? 0 : 1)
' "$PROFILE_DIR/package.json"; then
  die "@7dgroup/dsh-skill-7d-viewer missing from dsh.profile.bundles"
fi
say "bundle registered"

# Boot dsh web keyless on an OS-assigned port.
say "booting dsh web (port=$PORT)…"
$DSH_CMD web --port "$PORT" > "$WEB_LOG" 2>&1 &
SERVER_PID=$!

URL=""
for _ in $(seq 1 120); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "=== dsh web exited early; log tail ===" >&2
    tail -40 "$WEB_LOG" >&2 || true
    exit 1
  fi
  if URL="$(grep -oE 'dsh web: http://127\.0\.0\.1:[0-9]+' "$WEB_LOG" | head -1 | awk '{print $3}')" && [ -n "$URL" ]; then
    break
  fi
  sleep 1
done
[ -n "$URL" ] || { echo "=== no URL after 120s; log tail ===" >&2; tail -40 "$WEB_LOG" >&2 || true; exit 1; }
say "dsh web ready: $URL"

# Run the headless-render lane.
DSH_E2E_URL="$URL" DSH_E2E_WORKSPACE="$WORKSPACE_DIR" \
  pnpm exec playwright test ${GREP_FILTER:+--grep "$GREP_FILTER"}

say "smoke passed: plugin mounted and activated in a real dsh web without crashing"
