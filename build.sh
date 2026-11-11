#!/bin/sh
# 1) Rebuilds downloads/banner-forge-next.zip (the "Download forge-next" button)
#    from the banner-forge-next folder.
# 2) Builds dist/banner-hub-<version>.zip, the file to upload to the Chrome Web Store.
set -e
cd "$(dirname "$0")"

# --- 1) Template zip -------------------------------------------------------
# The real .env holds FTP and TinyPNG credentials, so it never goes in the zip.
# A blank .env.example is added instead.
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
rsync -a \
  --exclude '.env' --exclude '.DS_Store' --exclude 'node_modules' \
  --exclude 'published' --exclude '_temporal_preview' --exclude 'reports' \
  --exclude '.claude' --exclude '.git' \
  banner-forge-next "$stage/"
cat > "$stage/banner-forge-next/.env.example" <<'ENV'
// Copy this file to ".env" and fill in the values.

// FTP Credentials
FTP_USER=
FTP_PASS=

// TinyPNG Key
TYNYPNG_API=
ENV
mkdir -p downloads
rm -f downloads/banner-forge-next.zip
(cd "$stage" && zip -r -q -X "$OLDPWD/downloads/banner-forge-next.zip" banner-forge-next)
echo "Created downloads/banner-forge-next.zip"

# --- 2) Extension zip ------------------------------------------------------
# Only the extension itself goes in: no test banners, no template source, no git files.
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
out="dist/banner-hub-$version.zip"
rm -f "$out"
zip -r -q "$out" manifest.json index.html css js images icons downloads -x '*.DS_Store'
echo "Created $out"
