#!/usr/bin/env bash
set -euo pipefail

# Capture the workspace root up front (we cd around later).
WS="$(pwd)"

echo "========================================="
echo "  Blog Platform - Dev Container Setup"
echo "========================================="

# --- Configure mirrors (China acceleration) ---
echo ">>> Configuring package mirrors..."
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple 2>/dev/null || true
npm config set registry https://registry.npmmirror.com 2>/dev/null || true

# --- Backend setup ---
echo ">>> Setting up backend..."
cd backend

# The .venv lives on a Docker named volume (see devcontainer.json), so it is owned
# by the container user and persists across rebuilds. Only create it when missing.
if [ ! -f ".venv/bin/python" ]; then
    echo "    Creating virtual environment..."
    python -m venv .venv
fi

source .venv/bin/activate

echo "    Installing Python dependencies..."
pip install --upgrade pip

# Remove any stale *.egg-info before the editable install. The source tree is on
# the Windows host bind mount, where setuptools fails with
# "Cannot update time stamp of directory '*.egg-info'" when it tries to utime an
# EXISTING egg-info dir. Deleting it first forces a fresh mkdir (no utime), which
# works under any mount consistency mode.
rm -rf *.egg-info

pip install -e ".[dev,mysql]"

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "    Created backend/.env from .env.example"
fi

# Ensure uploads directory exists
mkdir -p uploads

# --- Frontend setup ---
echo ">>> Setting up frontend..."
cd ../frontend
echo "    Installing Node.js dependencies..."
npm install

# The setup above runs as root (postCreateCommand uses sudo). Hand ownership of
# the workspace and the named volumes (.venv, node_modules) back to the dev user
# (vscode) so the interactive dev session can write to them without permission errors.
echo ">>> Fixing workspace ownership for dev user (vscode)..."
chown -R vscode:vscode "$WS"

echo "========================================="
echo "  Setup complete!"
echo ""
echo "  Start backend:"
echo "    cd backend && source .venv/bin/activate && python run.py"
echo ""
echo "  Start frontend (in a new terminal):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Then open: http://localhost:3000"
echo "========================================="
