.PHONY: dev test lint format install clean help

PROJECT_ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
SHELL := /bin/bash
.ONESHELL:

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install production + dev dependencies
	pip install --upgrade pip
	pip install -e ".[dev]"
	@echo "✓ Dependencies installed"

dev: ## Start development environment (one command)
	@echo "=== Blog Platform Development ==="
	@echo "[1/4] Checking Python..."
	python3 --version 2>/dev/null || { echo "Error: Python 3.10+ required" >&2; exit 1; }
	@echo "[2/4] Installing dependencies..."
	$(MAKE) install 2>/dev/null
	@echo "[3/4] Checking Docker services..."
	@if docker info >/dev/null 2>&1; then \
		echo "Starting MySQL from docker-compose..."; \
		cd $(PROJECT_ROOT)/..
		docker-compose up -d mysql redis 2>/dev/null || true; \
		echo "Waiting for MySQL..."
		sleep 5; \
	else \
		echo "Docker not running. Ensure MySQL is available."; \
	fi
	@echo "[4/4] Starting Flask dev server..."
	cd $(PROJECT_ROOT)
	export FLASK_ENV=development
	export FLASK_DEBUG=1
	python -m flask run --port=8000 --reload

test: ## Run tests with coverage
	pytest -v --cov=app --cov-report=term-missing --cov-report=html
	@echo "✓ Tests complete — open htmlcov/index.html for coverage report"

test-quick: ## Run tests quickly (no coverage)
	pytest -x -q tests/

lint: ## Run all linters
	@echo "=== Running linters ==="
	@echo "--- Black (format check) ---"
	black --check --diff app/ tests/ || { echo "Run 'make format' to fix"; exit 1; }
	@echo "--- Ruff (linter) ---"
	ruff check app/ tests/
	@echo "--- MyPy (type check) ---"
	mypy app/ --ignore-missing-imports || true
	@echo "✓ All linters passed"

format: ## Format code with isort + black + ruff
	@echo "=== Formatting code ==="
	isort app/ tests/
	black app/ tests/
	ruff check --fix app/ tests/
	@echo "✓ Code formatted"

clean: ## Clean build artifacts and cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type f -name ".coverage" -delete 2>/dev/null || true
	rm -rf htmlcov/ .mypy_cache/ .ruff_cache/ 2>/dev/null || true
	@echo "✓ Cleanup done"

pre-commit-install: ## Install pre-commit hooks
	pre-commit install
	@echo "✓ Pre-commit hooks installed"

pre-commit-run: ## Run pre-commit on all files
	pre-commit run --all-files

db-init: ## Initialize database schema
	mysql -u root -p123456 -h 127.0.0.1 < migrations/init.sql
	@echo "✓ Database initialized"

db-migrate: ## Create new Alembic migration
	@read -p "Migration message: " msg; \
	alembic revision --autogenerate -m "$$msg"

db-upgrade: ## Apply all pending migrations
	alembic upgrade head
	@echo "✓ Migrations applied"

db-downgrade: ## Rollback last migration
	alembic downgrade -1
	@echo "✓ Migration rolled back"

preview: ## Build and preview production
	gunicorn -w 4 -b 0.0.0.0:8000 "app:create_app()"
