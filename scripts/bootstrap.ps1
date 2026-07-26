Write-Host "================================"
Write-Host " Blog Platform Bootstrap"
Write-Host "================================"


$root = Split-Path $PSScriptRoot


Write-Host ""
Write-Host "[1/6] Checking environment..."

powershell `
-ExecutionPolicy Bypass `
-File "$PSScriptRoot/check_env.ps1"



Write-Host ""
Write-Host "[2/6] Docker services (MySQL/Redis)"

Write-Host "MySQL/Redis are provided by the Dev Container (.devcontainer/docker-compose.yml)."
Write-Host "This script runs natively with default SQLite; for full stack, open in Dev Container."



Write-Host ""
Write-Host "[3/6] Installing backend dependencies..."

cd "$root/backend"


if (!(Test-Path "venv")) {

    python -m venv venv

}


.\venv\Scripts\activate


python -m pip install -e ".[dev]"



Write-Host ""
Write-Host "[4/6] Initializing database..."

alembic upgrade head



Write-Host ""
Write-Host "[5/6] Checking backend..."


powershell `
-ExecutionPolicy Bypass `
-File "$PSScriptRoot/health_check.ps1"



Write-Host ""
Write-Host "================================"
Write-Host " Bootstrap Finished"
Write-Host "================================"