#!/bin/bash
# Tempo: environment setup & dependency installer
set -e

# Always resolve to the project directory regardless of where it is executed
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "============================================="
echo "  Tempo: Installation & Environment Check    "
echo "============================================="

# Ensure scripts are executable
chmod +x "$DIR/Tempo_run" "$DIR/Tempo_run.sh" "$DIR/installation" "$DIR/installation.sh" 2>/dev/null || true

# 1. Check Python
if command -v python3 >/dev/null 2>&1; then
    PY="python3"
elif command -v python >/dev/null 2>&1; then
    PY="python"
else
    echo "⚠️ Warning: Neither python3 nor python was found in PATH."
    echo "   Please install Python (3.9+) to run the local server."
fi

if [ -n "$PY" ]; then
    PY_VER=$($PY --version 2>&1)
    echo "✓ Python found: $PY_VER"
fi

# 2. Check Node & npm (optional, for test suite)
if command -v npm >/dev/null 2>&1; then
    echo "✓ npm found. Installing optional test runner dependencies (jsdom)..."
    npm install --silent
    echo "✓ Automated tests ready. (Run 'npm test' anytime to verify 35 test suites)."
else
    echo "ℹ️  Note: npm not found. Tests skipped. (The web app only requires a browser & Python)."
fi

echo ""
echo "============================================="
echo "  Setup Complete!                            "
echo "  To launch Tempo, simply run:               "
echo "    ./Tempo_run                              "
echo "  (or: bash Tempo_run.sh)                    "
echo "============================================="
