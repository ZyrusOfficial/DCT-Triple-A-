#!/usr/bin/env bash
# Rebuilds the headless Chromium screenshot rig from scratch.
#
# WHY THIS EXISTS
# The rig lives in /tmp and does NOT persist between sandbox sessions — /tmp is
# wiped. Once the rig is gone there is no screenshot verification at all, and
# every appearance change becomes a guess. Rebuilding it by hand took a dozen
# probes, so the whole recipe is captured here.
#
# THREE TRAPS, all of which cost real time:
#
#   1. apt is firewalled and `libnss3` is not published on npm, but the
#      @sparticuz/chromium package ships Amazon Linux support tarballs that
#      contain exactly the shared objects a Debian host lacks. al2023.tar.br is
#      the useful one: libnspr4, libnss3, libnssutil3, libplc4, libplds4,
#      libsoftokn3, libfreebl*. al2.tar.br is MISSING libnspr4 — do not use it.
#
#   2. The SwiftShader tarball has FIVE members and the important one is
#      libvulkan.so.1. Extracting only the .so files that happen to appear in /tmp
#      leaves you without the Vulkan loader, and ANGLE dies with
#      "Internal Vulkan error (-3)" / "eglInitialize SwANGLE failed". If the rig
#      was assembled from stray /tmp files rather than from the tarball itself,
#      that is the bug.
#
#   3. GLES/EGL must be BOTH next to the binary and on LD_LIBRARY_PATH. Chromium
#      looks for libGLESv2.so beside its own executable:
#      "Failed to load GLES library: /tmp/chr/libGLESv2.so".
#
# Then run `bash tools/chrome.sh` and confirm.
set -e
BUILD=/tmp/rigbuild
CHR=/tmp/chr
VER=${CHROMIUM_VER:-131}

echo "==> installing @sparticuz/chromium@$VER"
mkdir -p "$BUILD" && cd "$BUILD"
npm install --silent "@sparticuz/chromium@$VER"

PKG="$BUILD/node_modules/@sparticuz/chromium/bin"

echo "==> extracting chromium binary"
node -e "
const fs=require('fs'),zlib=require('zlib');
fs.writeFileSync('/tmp/chromium', zlib.brotliDecompressSync(fs.readFileSync('$PKG/chromium.br')));
"
mkdir -p "$CHR/sw"
cp -f /tmp/chromium "$CHR/bin_chromium"
chmod +x "$CHR/bin_chromium"

echo "==> extracting swiftshader (all five members, libvulkan.so.1 included)"
rm -rf /tmp/swx && mkdir -p /tmp/swx && cd /tmp/swx
node -e "
const fs=require('fs'),zlib=require('zlib');
fs.writeFileSync('/tmp/sw.tar', zlib.brotliDecompressSync(fs.readFileSync('$PKG/swiftshader.tar.br')));
"
tar xf /tmp/sw.tar
cp -f /tmp/swx/* "$CHR/sw/"
# trap 3: also beside the binary
cp -f /tmp/swx/*.so /tmp/swx/*.so.1 /tmp/swx/*.json "$CHR/" 2>/dev/null || true

echo "==> extracting al2023 support libs (NOT al2 — it has no libnspr4)"
rm -rf /tmp/al2023x && mkdir -p /tmp/al2023x && cd /tmp/al2023x
node -e "
const fs=require('fs'),zlib=require('zlib');
fs.writeFileSync('/tmp/al2023.tar', zlib.brotliDecompressSync(fs.readFileSync('$PKG/al2023.tar.br')));
"
tar xf /tmp/al2023.tar
mkdir -p "$CHR/libs/lib"
cp -f /tmp/al2023x/lib/*.so* "$CHR/libs/lib/"

echo "==> verifying every dependency resolves"
if LD_LIBRARY_PATH="$CHR/libs/lib:$CHR/sw" ldd "$CHR/bin_chromium" 2>&1 | grep -q "not found"; then
  echo "STILL MISSING:"; LD_LIBRARY_PATH="$CHR/libs/lib:$CHR/sw" ldd "$CHR/bin_chromium" | grep "not found"
  exit 1
fi
echo "all resolved"
echo "==> rig assembled. Now run: bash tools/chrome.sh"
