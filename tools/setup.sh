#!/usr/bin/env bash
# One-command setup for a fresh sandbox: everything needed to see and verify
# the reconstruction.
#
#   bash tools/setup.sh
#
# Why this exists: this session lost a dozen uncommitted edits AND the screenshot
# rig when the sandbox was recreated. Committed work survives on GitHub, but the
# rig lives in /tmp (wiped) and node_modules is not committed. This script puts a
# new checkout back into a working state in one step.
#
# What it does:
#   1. npm install               (three, vite)
#   2. rebuild the Chromium rig  (tools/rebuild-rig.sh)
#   3. prove the world builds    (tools/buildtest.mjs, ~10 s, no browser needed)
#   4. start the dev server      (0.0.0.0:5173, for the live preview)
#   5. start headless Chromium   (CDP on :9333, for screenshots)
#
# After this, capture a view with:
#   node tools/shots.mjs tools/shotsets/verify.json --size 1280x720 \
#        --quality low --hideui
set -e
cd "$(dirname "$0")/.."

echo "==> 1/5 npm install"
# No --silent: under `set -e` a silent failure here is invisible, and this exact
# step already failed once without a word — the world build then died on
# "Cannot find package 'three'" with no hint that dependencies were missing.
npm install --no-audit --no-fund 2>&1 | tail -3
if [ ! -d node_modules/three ]; then
  echo "FATAL: npm install did not produce node_modules/three" >&2
  exit 1
fi

echo "==> 2/5 rebuilding the Chromium rig"
if [ -x /tmp/chr/bin_chromium ] && ! ldd /tmp/chr/bin_chromium 2>&1 | grep -q "not found"; then
  echo "    rig already present and complete, skipping"
else
  bash tools/rebuild-rig.sh
fi

echo "==> 3/5 headless world build (no browser needed)"
node tools/buildtest.mjs 2>&1 | tail -3

echo "==> 4/5 dev server on :5173"
if curl -s -o /dev/null -m 2 http://127.0.0.1:5173/; then
  echo "    already running"
else
  setsid npx vite --host 0.0.0.0 > /tmp/vite.log 2>&1 < /dev/null &
  for i in $(seq 1 30); do
    curl -s -o /dev/null -m 1 http://127.0.0.1:5173/ && break
    sleep 0.5
  done
fi

echo "==> 5/5 headless Chromium on CDP :9333"
if curl -s -o /dev/null -m 2 http://127.0.0.1:9333/json/version; then
  echo "    already running"
else
  bash tools/chrome.sh
fi

echo
echo "ready. Capture a view with:"
echo "  node tools/shots.mjs tools/shotsets/verify.json --size 1280x720 --quality low --hideui"
