param(
    [string]$message="update database"
)


$root = Split-Path $PSScriptRoot


cd "$root/backend"


.\venv\Scripts\activate


python -m alembic revision --autogenerate -m $message


python -m alembic upgrade head


Write-Host "Migration finished"