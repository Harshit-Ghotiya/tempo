#!/bin/sh
# Builds one self-contained program per platform into dist/. Needs Go 1.20+ and npm (first run only).
# Copies the current portal files into site/ first; they are embedded at build time.
# macOS: run package_macos.py afterwards to make the universal Tempo.app.
set -e
cd "$(dirname "$0")"
mkdir -p site dist
cp ../index.html ../styles.css ../app.js ../hr.js ../ui.js ../affect.js ../voice.js ../preset_models.json site/
[ -f site/vendor/mediapipe/vision_bundle.mjs ] || sh fetch_vendor.sh
build() { GOOS=$1 GOARCH=$2 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "dist/$3" .; }
build windows amd64 Tempo.exe
build darwin arm64 tempo-darwin-arm64
build darwin amd64 tempo-darwin-amd64
build linux amd64 Tempo-linux
