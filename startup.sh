#!/bin/sh
set -eu
# Restart contract: this script lives at the project root (the platform runs
# /workspace/startup.sh), so resolve the root from the script's own location
# instead of assuming the mount point — a clone anywhere else then starts the
# same way the sandbox does.
cd "$(dirname "$0")"
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
