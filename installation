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
chmod +x "$DIR/tempo_run" "$DIR/tempo_run.sh" "$DIR/Tempo_run" "$DIR/Tempo_run.sh" "$DIR/installation" "$DIR/installation.sh" 2>/dev/null || true

# On case-sensitive filesystems (e.g., Linux), create aliases so both ./tempo_run and ./Tempo_run work
if [ -e "$DIR/tempo_run" ] && [ ! -e "$DIR/Tempo_run" ]; then
    cp "$DIR/tempo_run" "$DIR/Tempo_run" 2>/dev/null || true
    chmod +x "$DIR/Tempo_run" 2>/dev/null || true
elif [ -e "$DIR/Tempo_run" ] && [ ! -e "$DIR/tempo_run" ]; then
    cp "$DIR/Tempo_run" "$DIR/tempo_run" 2>/dev/null || true
    chmod +x "$DIR/tempo_run" 2>/dev/null || true
fi
if [ -e "$DIR/tempo_run.sh" ] && [ ! -e "$DIR/Tempo_run.sh" ]; then
    cp "$DIR/tempo_run.sh" "$DIR/Tempo_run.sh" 2>/dev/null || true
    chmod +x "$DIR/Tempo_run.sh" 2>/dev/null || true
elif [ -e "$DIR/Tempo_run.sh" ] && [ ! -e "$DIR/tempo_run.sh" ]; then
    cp "$DIR/Tempo_run.sh" "$DIR/tempo_run.sh" 2>/dev/null || true
    chmod +x "$DIR/tempo_run.sh" 2>/dev/null || true
fi

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
    if npm install --silent 2>/dev/null; then
        echo "✓ Automated tests ready. (Run 'npm test' anytime to verify 35 test suites)."
    else
        echo "ℹ️  Note: npm install skipped (offline or restricted). Web app is unaffected."
    fi
else
    echo "ℹ️  Note: npm not found. Tests skipped. (The web app only requires a browser & Python)."
fi

echo ""
echo "============================================="
echo "  Setup Complete!                            "
echo "  To launch Tempo, simply run:               "
echo "    ./tempo_run                              "
echo "============================================="
