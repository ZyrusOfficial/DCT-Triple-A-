#!/usr/bin/env bash
# Render a high-quality shot set in small batches, restarting Chrome between
# batches. SwiftShader leaks GPU memory across page loads, so a long run wedges
# after eight or so shots; four at a time is stable.
set -u
cd "$(dirname "$0")/.."

SET=${1:-tools/shotsets/highq.json}
SIZE=${2:-1920x1080}
QUALITY=${3:-high}
BATCH=${4:-4}
TMP=$(mktemp -d)

restart_chrome() {
  for pid in $(ps -eo pid,cmd | grep '[b]in_chromium' | awk '{print $1}'); do
    kill -9 "$pid" 2>/dev/null
  done
  sleep 2
  rm -rf /tmp/cdp/prof
  ( setsid bash tools/chrome.sh > /tmp/chrome.log 2>&1 & )
  for _ in $(seq 1 30); do
    curl -s --max-time 2 http://127.0.0.1:9333/json/version > /dev/null 2>&1 && return 0
    sleep 1
  done
  echo "!! chrome did not come up"; return 1
}

total=$(node -e "console.log(require('./$SET').length)")
echo "== $total shots, batches of $BATCH, $SIZE, $QUALITY =="

i=0
while [ $i -lt $total ]; do
  node -e "
    const s = require('./$SET');
    require('fs').writeFileSync('$TMP/b.json', JSON.stringify(s.slice($i, $i + $BATCH)));
  "
  restart_chrome || exit 1
  echo "-- batch $i..$(( i + BATCH - 1 > total - 1 ? total - 1 : i + BATCH - 1 ))"
  timeout 900 node tools/shots.mjs "$TMP/b.json" --size "$SIZE" --quality "$QUALITY" --hideui 2>&1 \
    | grep -E "✓|FAILED" || echo "   (batch failed)"
  i=$(( i + BATCH ))
done

rm -rf "$TMP"
echo "== done: $(ls captures/hi-*.png 2>/dev/null | wc -l) hi-res frames =="
