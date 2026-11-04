#!/bin/bash
# Tempo: start local server and launch in default browser
set -e

# Always resolve to the project directory regardless of where it is executed
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Detect Python command (python3, python, or py)
if command -v python3 >/dev/null 2>&1; then
    PY="python3"
elif command -v python >/dev/null 2>&1; then
    PY="python"
elif command -v py >/dev/null 2>&1; then
    PY="py"
else
    echo "❌ Error: Python is not installed or not in PATH."
    echo "   Please install Python 3 (python.org) or run with Node: npx serve -l 8000"
    exit 1
fi

# Pick port 8000 (or next available port if 8000 is already in use)
PORT=$($PY -c '
import socket
for p in range(8000, 8100):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", p)) != 0:
            print(p)
            break
else:
    print(8000)
' 2>/dev/null || echo 8000)

URL="http://localhost:$PORT"

echo "============================================="
echo "  Starting Tempo at: $URL"
echo "  Video never leaves browser. Press Ctrl+C to stop."
echo "============================================="

# Automatically open default browser after a brief delay
(
    sleep 1
    if command -v open >/dev/null 2>&1; then
        open "$URL"                        # macOS
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL"                    # Linux
    elif command -v cmd.exe >/dev/null 2>&1; then
        cmd.exe /c start "" "$URL" >/dev/null 2>&1  # Windows (Git Bash / WSL)
    elif command -v start >/dev/null 2>&1; then
        start "$URL"                       # Windows fallback
    fi
) &

# Run local HTTP server bound to loopback from the project directory
exec $PY -m http.server "$PORT" --bind 127.0.0.1
