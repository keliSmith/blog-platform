<#
 .SYNOPSIS
   Check whether the running backend is the latest code, optionally -Fix to restart it.

 .DESCRIPTION
   Background: under uvicorn reload mode, if the parent reloader is killed, the
   worker child becomes an orphan that keeps listening on the port while running
   OLD code. This makes "I changed the code but it has no effect" look like a bug.
   This script detects such a stale backend by comparing the running backend's
   reported git commit with the disk git commit, and can restart it with -Fix.

 .PARAMETER Fix
   Free port 8000 and restart the backend with the current code.

 .EXAMPLE
   .\scripts\check-backend.ps1          # diagnose only
   .\scripts\check-backend.ps1 -Fix     # diagnose + restart
#>

param([switch]$Fix)

$ErrorActionPreference = "Stop"
$port       = 8000
$root       = Split-Path $PSScriptRoot
$backendDir = Join-Path $root "backend"
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"

function Free-Port($p) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        $ids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($id in $ids) {
            Write-Host "Port $p occupied by PID $id, stopping..." -ForegroundColor Yellow
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
}

# 1) Disk commit
$diskCommit = (git -C $root rev-parse --short HEAD 2>$null)
if (-not $diskCommit) { $diskCommit = "unknown" }

# 2) Running backend health (reports commit / started_at)
try {
    $hb = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -ErrorAction Stop
    $runningCommit = $hb.commit
    Write-Host "Running backend : commit=$runningCommit started=$($hb.started_at)" -ForegroundColor Cyan
} catch {
    Write-Host "Running backend : not running / cannot connect localhost:$port" -ForegroundColor Red
    $runningCommit = $null
}

Write-Host "Disk code      : commit=$diskCommit" -ForegroundColor Cyan
Write-Host "-----------------------------------------"

# 3) Decide
if (-not $runningCommit) {
    Write-Host ">>> Backend not running." -ForegroundColor Yellow
    if ($Fix) {
        Write-Host ">>> Starting backend with current code..." -ForegroundColor Green
        Free-Port $port
        Start-Process powershell -WorkingDirectory $backendDir -ArgumentList "-NoExit", "-Command", "& '$venvPython' run.py"
        Write-Host ">>> Backend starting; re-run this script in a few seconds to confirm." -ForegroundColor Green
    } else {
        Write-Host ">>> Run .\scripts\check-backend.bat -Fix to auto-start." -ForegroundColor White
        exit 1
    }
    exit 0
}

if ($runningCommit -ne $diskCommit) {
    Write-Host ">>> Running backend is NOT the latest code (stale backend)!" -ForegroundColor Red
    if ($Fix) {
        Write-Host ">>> Freeing port and restarting backend with current code..." -ForegroundColor Green
        Free-Port $port
        Start-Process powershell -WorkingDirectory $backendDir -ArgumentList "-NoExit", "-Command", "& '$venvPython' run.py"
        Write-Host ">>> Restarted; re-run this script in a few seconds to confirm commit matches." -ForegroundColor Green
    } else {
        Write-Host ">>> Run .\scripts\check-backend.bat -Fix to restart to latest code." -ForegroundColor White
        exit 2
    }
} else {
    Write-Host ">>> Backend is the latest code, nothing to do." -ForegroundColor Green
}
