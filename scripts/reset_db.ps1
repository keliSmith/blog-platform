$root = Split-Path $PSScriptRoot
$backendDir = Join-Path $root "backend"

# 删除 SQLite 开发/测试库（开发环境默认使用 SQLite，而非 Docker MySQL）
Write-Host "Removing SQLite dev/test databases (default dev storage)..."
Remove-Item (Join-Path $backendDir "dev.db") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $backendDir "test.db") -ErrorAction SilentlyContinue

# MySQL/Redis 现由 Dev Container 提供（.devcontainer/docker-compose.yml，卷名带 compose 项目前缀）。
# 如需重置 Dev Container 内的 MySQL 数据：在 VS Code 中 Rebuild Container，或手动：
#   docker compose -f .devcontainer/docker-compose.yml down -v
Write-Host "SQLite reset done. To reset Dev Container MySQL/Redis data, run:"
Write-Host "  docker compose -f .devcontainer/docker-compose.yml down -v"

Write-Host "Database reset finished"