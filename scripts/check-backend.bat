@echo off
REM ============================================================
REM  check-backend.bat  -  Diagnose / fix whether the running backend
REM                        is the latest code.
REM
REM  This wrapper bypasses the PowerShell execution-policy restriction so
REM  check-backend.ps1 runs directly from both CMD and PowerShell, with -Fix.
REM
REM  Usage:
REM    scripts\check-backend.bat          (diagnose only)
REM    scripts\check-backend.bat -Fix     (diagnose + restart backend)
REM ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-backend.ps1" %*
