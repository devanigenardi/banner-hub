#!/bin/sh
# Builds dist/banner-hub-<version>.zip, the file to upload to the Chrome Web Store.
# Only the extension itself goes in: no test banners, no git files.
set -e
cd "$(dirname "$0")"
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
out="dist/banner-hub-$version.zip"
rm -f "$out"
zip -r -q "$out" manifest.json index.html css js images icons -x '*.DS_Store'
echo "Created $out"
