Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting AEGIS Fraud Detection System " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Ensure .env configuration file exists before container orchestration
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = "." }
$envPath = Join-Path $scriptDir ".env"
$envExamplePath = Join-Path $scriptDir ".env.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Write-Host "Notice: .env file not found. Initializing .env from .env.example..." -ForegroundColor Yellow
        Copy-Item $envExamplePath $envPath
        Write-Host "Created .env configuration successfully." -ForegroundColor Green
    } else {
        Write-Host "Error: Neither .env nor .env.example was found. Cannot start services." -ForegroundColor Red
        exit 1
    }
}

# Build and start all containers in detached mode
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker Compose failed to start services (exit code $LASTEXITCODE). Check Docker daemon status." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Wait for frontend service to be responsive on http://localhost:5173
Write-Host "Waiting for frontend to become available on http://localhost:5173..." -ForegroundColor Yellow
$maxRetries = 60
$retry = 0
$ready = $false

while (-not $ready -and $retry -lt $maxRetries) {
    Start-Sleep -Seconds 1
    $retry++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        # Waiting for dev server to bind and respond
    }
}

if ($ready) {
    Write-Host "Frontend is ready! Opening http://localhost:5173 in your default browser..." -ForegroundColor Green
    Start-Process "http://localhost:5173"
} else {
    Write-Host "Timed out waiting for frontend. Viewing logs..." -ForegroundColor Red
}

Write-Host "Streaming Docker Compose logs (Press Ctrl+C to detach logs)..." -ForegroundColor Cyan
docker compose logs -f
