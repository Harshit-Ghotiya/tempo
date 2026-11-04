#!/bin/bash
# Tempo: start local server and launch in default browser
set -e

# Always resolve to the project directory regardless of where it is executed
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT=8000
URL="http://localhost:$PORT"

# Detect Python command (python3 or python)
if command -v python3 >/dev/null 2>&1; then
    PY="python3"
elif command -v python >/dev/null 2>&1; then
    PY="python"
else
    echo "❌ Error: Python is not installed or not in PATH."
    echo "   Please install Python 3 (python.org) or run with Node: npx serve -l $PORT"
    exit 1
fi

echo "============================================="
echo "  Starting Tempo at: $URL"
echo "  Video never leaves browser. Press Ctrl+C to stop."
echo "============================================="

# Automatically open default browser after a brief delay
(
    sleep 1
    if command -v open >/dev/null 2>&1; then
        open "$URL"              # macOS
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL"          # Linux
    elif command -v start >/dev/null 2>&1; then
        start "$URL"             # Windows (Git Bash / MSYS)
    fi
) &

# Run local HTTP server from the project directory
exec $PY -m http.server $PORT
