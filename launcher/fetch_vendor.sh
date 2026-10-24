#!/bin/sh
# Downloads the pinned MediaPipe Tasks Vision build (JS and WASM) from npm into site/vendor/mediapipe/.
set -e
cd "$(dirname "$0")"
V=0.10.14
tmp=$(mktemp -d)
(cd "$tmp" && npm pack "@mediapipe/tasks-vision@$V" --silent >/dev/null && tar xzf "mediapipe-tasks-vision-$V.tgz")
mkdir -p site/vendor/mediapipe
cp "$tmp/package/vision_bundle.mjs" site/vendor/mediapipe/
cp -r "$tmp/package/wasm" site/vendor/mediapipe/
rm -rf "$tmp"
