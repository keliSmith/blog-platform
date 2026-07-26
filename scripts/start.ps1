<#
 .SYNOPSIS
    Blog Platform 一键启动脚本 (Windows / PowerShell)

 .DESCRIPTION
    1. 确保后端虚拟环境 backend/venv 存在并安装依赖
    2. 若缺少 backend/.env 则从 .env.example 复制
    3. 在新窗口启动后端 (uvicorn via run.py) 与前端 (npm run dev)
    注：MySQL/Redis 全栈由 Dev Container 提供（.devcontainer/docker-compose.yml）。
        本脚本以原生方式启动后端 + 前端，默认使用 SQLite（零配置）。
#>

$ErrorActionPreference = "Continue"
$root       = Split-Path $PSScriptRoot
$backendDir = Join-Path $root "backend"
$venvDir    = Join-Path $backendDir "venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

# 释放被占用的端口：若目标端口已被占用，结束占用进程后再启动，
# 避免重复运行 start.ps1 时后端/前端因 "Address already in use" 启动失败。
function Free-Port($port) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            Write-Host "Port $port occupied by PID $procId, stopping it..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Blog Platform - One-click Start"        -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# ------------------------------------------------------------------
# 1. 虚拟环境
# ------------------------------------------------------------------
if (-not (Test-Path $venvPython)) {
    Write-Host "[1/4] Creating virtualenv at $venvDir ..." -ForegroundColor Yellow
    python -m venv $venvDir
    if (-not (Test-Path $venvPython)) {
        Write-Error "Failed to create virtualenv. Please ensure 'python' is on PATH."
        exit 1
    }
} else {
    Write-Host "[1/4] Virtualenv already exists ($venvDir)" -ForegroundColor Green
}

# ------------------------------------------------------------------
# 2. 依赖安装 (幂等：仅当 uvicorn/fastapi 不可用时才装)
# ------------------------------------------------------------------
& $venvPython -c "import uvicorn, fastapi" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[2/4] Installing backend dependencies (pip install -e .[dev]) ..." -ForegroundColor Yellow
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -e ($backendDir + '[dev]')
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Dependency installation failed."
        exit 1
    }
} else {
    Write-Host "[2/4] Backend dependencies already satisfied" -ForegroundColor Green
}

# ------------------------------------------------------------------
# 3. .env 生成 (缺省时从 .env.example 复制)
# ------------------------------------------------------------------
$envFile    = Join-Path $backendDir ".env"
$envExample = Join-Path $backendDir ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item $envExample $envFile
    Write-Host "[3/4] Created backend/.env from .env.example" -ForegroundColor Yellow
} else {
    Write-Host "[3/4] backend/.env present" -ForegroundColor Green
}

# ------------------------------------------------------------------
# 4. 原生模式说明
#    MySQL/Redis 现由 Dev Container 提供（.devcontainer/docker-compose.yml），
#    本脚本仅以原生方式启动后端 + 前端，使用默认 SQLite（零配置）。
#    需要 MySQL/Redis 全栈时，请用 VS Code "Dev Containers: Reopen in Container"。
# ------------------------------------------------------------------
Write-Host "[4/4] Native mode: backend + frontend with SQLite (dev.db)." -ForegroundColor Green
Write-Host "       For full stack (MySQL 8.0 + Redis 7), open in Dev Container." -ForegroundColor White

# ------------------------------------------------------------------
# 启动后端 (新窗口，使用 venv python)
# ------------------------------------------------------------------
Free-Port 8000
Write-Host "Starting backend at http://localhost:8000 ..." -ForegroundColor Cyan
cd $backendDir
Start-Process powershell `
    -ArgumentList "-NoExit", "-Command", "& `"$venvPython`" run.py"

# ------------------------------------------------------------------
# 启动前端 (新窗口)
# ------------------------------------------------------------------
Free-Port 3000
Write-Host "Starting frontend at http://localhost:3000 ..." -ForegroundColor Cyan
cd (Join-Path $root "frontend")
Start-Process powershell `
    -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  All services started."                 -ForegroundColor Green
Write-Host "  Backend : http://localhost:8000  (API docs: /docs)" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000"       -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
