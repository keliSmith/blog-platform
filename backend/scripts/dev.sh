#!/bin/bash
set -e

# Blog Platform - Backend Development Startup (FastAPI)
# =====================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Blog Platform Backend (FastAPI) ===${NC}"

# 1. Check Python
echo -e "${YELLOW}[1/5] Checking Python...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null && python --version 2>&1 | grep -q "3\.[0-9][0-9]\?"; then
    PYTHON=python
else
    echo -e "${RED}Error: Python 3.10+ is required but not found.${NC}"
    echo "Install Python from https://www.python.org/downloads/"
    exit 1
fi
$PYTHON --version

# 2. Create virtual environment (backend/venv) if needed
echo -e "${YELLOW}[2/5] Setting up virtual environment...${NC}"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment (venv)..."
    $PYTHON -m venv venv
else
    echo "Virtual environment exists."
fi
# shellcheck disable=SC1091
source venv/bin/activate

# 3. Install dependencies
echo -e "${YELLOW}[3/5] Installing dependencies...${NC}"
pip install --upgrade pip -q
pip install -e ".[dev]" -q

# 4. Prepare configuration
echo -e "${YELLOW}[4/5] Preparing configuration...${NC}"
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created .env from .env.example - adjust values if needed."
fi

# Optional: MySQL/Redis 现由 Dev Container 提供（.devcontainer/docker-compose.yml）。
# 本脚本以原生方式运行后端，默认使用 SQLite；需要 MySQL/Redis 全栈请用 Dev Container。
if command -v docker &> /dev/null && docker info >/dev/null 2>&1; then
    echo "Note: MySQL/Redis are provided by the Dev Container; using SQLite here."
    # Initialize MySQL schema (non-fatal when using SQLite)
    mysql -u root -p123456 -h 127.0.0.1 blog < migrations/init.sql 2>/dev/null || true
    # Apply Alembic migrations (non-fatal; dev auto-creates tables via create_all)
    alembic upgrade head 2>/dev/null || echo "Skipped Alembic (dev uses auto-created tables)."
else
    echo "Docker not available - using SQLite (tables auto-created on startup)."
fi

# 5. Start FastAPI dev server (uvicorn, hot reload)
echo -e "${GREEN}=== Starting FastAPI Dev Server on http://localhost:8000 ===${NC}"
echo -e "API docs: ${GREEN}http://localhost:8000/docs${NC}"
export APP_ENV=development
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
