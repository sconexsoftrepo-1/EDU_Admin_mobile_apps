#!/bin/bash
# Build the two zip files that go to Azure App Service.
#   bash deploy/azure/package.sh            # both
#   bash deploy/azure/package.sh backend    # only the API
#   bash deploy/azure/package.sh admin      # only the admin dashboard
#
# backend.zip  – the FastAPI source; App Service installs requirements.txt itself (Linux, Python 3.12).
# admin.zip    – the built Next.js server (.next/standalone + static files + public), started with
#                `node server.js`; nothing is built on Azure. Linux image libraries are added so
#                pictures are resized on the server exactly as on Vercel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deploy/azure/out"
WHAT="${1:-all}"
mkdir -p "$OUT"

if [[ "$WHAT" == "all" || "$WHAT" == "backend" ]]; then
  echo "== backend.zip"
  rm -f "$OUT/backend.zip"
  (cd "$ROOT/backend" && zip -qr "$OUT/backend.zip" . \
    -x ".venv/*" "var/*" "tests/*" "secrets/*" ".env" ".env.*" "*/__pycache__/*" "__pycache__/*" \
       ".pytest_cache/*" ".ruff_cache/*" ".migration-target/*" "*.pyc" ".DS_Store" "api/*" "vercel.json")
  unzip -l "$OUT/backend.zip" | grep -E " (app/asgi.py|requirements.txt|startup.sh)$" >/dev/null \
    || { echo "backend.zip is missing app/asgi.py, requirements.txt or startup.sh"; exit 1; }
  if unzip -l "$OUT/backend.zip" | grep -qE "\.env$|secrets/|service-account"; then
    echo "backend.zip contains a secret file - stopping"; exit 1
  fi
  ls -lh "$OUT/backend.zip"
fi

if [[ "$WHAT" == "all" || "$WHAT" == "admin" ]]; then
  echo "== admin.zip"
  cd "$ROOT/admin-dashboard"
  cp next-env.d.ts /tmp/edunexa-next-env.d.ts 2>/dev/null || true   # next build rewrites it
  npm ci --no-audit --no-fund
  npm run build
  cp /tmp/edunexa-next-env.d.ts next-env.d.ts 2>/dev/null || true
  STANDALONE=".next/standalone"
  [[ -f "$STANDALONE/server.js" ]] || { echo "no $STANDALONE/server.js - is output: \"standalone\" set in next.config.ts?"; exit 1; }
  rm -rf "$STANDALONE/.next/static" "$STANDALONE/public"
  cp -R .next/static "$STANDALONE/.next/static"
  cp -R public "$STANDALONE/public"
  rm -f "$STANDALONE/.env" "$STANDALONE/.env.local"
  # sharp ships per-platform binaries; App Service runs Linux x64 (glibc).
  SHARP_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('node_modules/sharp/package.json','utf8')).version" 2>/dev/null || true)"
  if [[ -n "$SHARP_VERSION" ]]; then
    # Fetch only the Linux binaries in a scratch folder and copy them in (an npm install inside the
    # bundle would reinstall every dependency listed in its package.json).
    SCRATCH="$(mktemp -d)"
    (cd "$SCRATCH" && npm init -y >/dev/null && npm install --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc "sharp@$SHARP_VERSION" >/dev/null)
    mkdir -p "$STANDALONE/node_modules/@img"
    cp -R "$SCRATCH"/node_modules/@img/sharp-linux-x64 "$SCRATCH"/node_modules/@img/sharp-libvips-linux-x64 "$STANDALONE/node_modules/@img/"
    rm -rf "$SCRATCH"
    ls "$STANDALONE/node_modules/@img" | grep -q "sharp-linux-x64" || { echo "Linux sharp was not added"; exit 1; }
  fi
  rm -f "$OUT/admin.zip"
  (cd "$STANDALONE" && zip -qry "$OUT/admin.zip" .)
  ls -lh "$OUT/admin.zip"
fi
echo "Done. Files in $OUT"
