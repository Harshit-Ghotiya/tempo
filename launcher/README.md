# Launcher

One Go program per platform. It embeds the portal (../index.html, app.js, ui.js, hr.js) and MediaPipe Tasks Vision 0.10.14 (JS and WASM from npm, fetched by fetch_vendor.sh), serves them on 127.0.0.1 only, and opens the browser.
- Models: the two .task files are downloaded once from Google's MediaPipe host into the cache folder and served from there. A copy placed in a folder named models next to the app is used first (offline use).
- One instance: starting it again opens the running one. The page pings /__alive; with no ping for 3 minutes it quits.
- Environment (testing): TEMPO_CACHE_DIR, TEMPO_MODEL_BASE (alternative model host), TEMPO_IDLE_SECONDS. Flags: -port, -nobrowser.
- macOS: package_macos.py joins the two Mach-O builds into one universal Tempo.app and ad-hoc signs it with rcodesign (apple-codesign 0.29.0 from github.com/indygreg/apple-platform-rs). Not notarised.
- Sizes are about 25 MB per platform because of the WASM.
