#!/usr/bin/env bash
# Starts (or restarts) the headless Chromium used for verification screenshots.
# WebGL2 is provided by SwiftShader (CPU) — slow, but pixel-identical for
# geometry/lighting checks.
#
# Layout under /tmp/chr (rebuilt each session, does not persist):
#   bin_chromium              the browser binary
#   libs/lib                  glibc-adjacent shared objects (nss, nspr, ...)
#   sw/                       SwiftShader: libEGL, libGLESv2, libvk_swiftshader
set -e
CHROME=${CHROME:-/tmp/chr/bin_chromium}
LIBD=${LIBD:-/tmp/chr/libs/lib:/tmp/chr/sw}
PORT=${CDP_PORT:-9333}
PROFILE=${PROFILE:-/tmp/cdp/prof}

pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
sleep 0.4
rm -rf "$PROFILE"
mkdir -p "$PROFILE" /tmp/cdp

setsid env LD_LIBRARY_PATH="$LIBD" VK_ICD_FILENAMES=/tmp/chr/sw/vk_swiftshader_icd.json \
  "$CHROME" \
  --headless=old --no-sandbox --no-zygote \
  --disable-crash-reporter --disable-breakpad --disable-dev-shm-usage \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --disable-features=Vulkan \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  about:blank > /tmp/cdp/chrome.log 2>&1 &

for i in $(seq 1 40); do
  if curl -s -m 1 "http://127.0.0.1:$PORT/json/version" > /dev/null; then
    echo "chromium up on :$PORT"
    exit 0
  fi
  sleep 0.25
done
echo "chromium failed to start"; tail -20 /tmp/cdp/chrome.log; exit 1
