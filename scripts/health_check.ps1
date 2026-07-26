Write-Host "Checking Backend API..."

try {
    $response = Invoke-RestMethod "http://127.0.0.1:8000/api/health" -ErrorAction Stop
    $response
    Write-Host ""
    Write-Host "Backend OK"
} catch {
    Write-Error "Backend health check failed: $_"
    exit 1
}
