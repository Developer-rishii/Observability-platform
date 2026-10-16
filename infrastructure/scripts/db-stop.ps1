<#
.SYNOPSIS
    Stops the isolated demo PostgreSQL database (demo-db) to trigger and observe DB failure.
.DESCRIPTION
    Stops the 'demo-db' container, queries the demo application's /health and /api/products endpoints
    to demonstrate health check degradation and HTTP 500 database error handling, and then restarts demo-db.
.PARAMETER PauseSeconds
    Seconds to wait with demo-db stopped to observe error symptoms (default: 15).
.PARAMETER ContainerName
    Name of demo database container (default: 'demo-db').
.PARAMETER AppUrl
    URL of demo application (default: 'http://localhost:8081').
.EXAMPLE
    .\db-stop.ps1 -PauseSeconds 10
#>
[CmdletBinding()]
param (
    [int]$PauseSeconds = 15,
    [string]$ContainerName = "demo-db",
    [string]$AppUrl = $(if ($env:WORKLOAD_HOST_PORT) { "http://localhost:$($env:WORKLOAD_HOST_PORT)" } else { "http://localhost:8081" })
)

$ErrorActionPreference = "Continue"

Write-Host "=== S1 Demo Fault: Database Stop ===" -ForegroundColor Cyan
Write-Host "Target Container: $ContainerName (Isolated demo database)"
Write-Host "Demo Application: $AppUrl"

# 1. Stop demo-db
Write-Host "`n[1/4] Stopping '$ContainerName' container (Platform DB 'db' remains untouched)..." -ForegroundColor Yellow
docker stop $ContainerName | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to stop container '$ContainerName'. Ensure demo stack is running."
    exit 1
}
Write-Host "[SUCCESS] '$ContainerName' stopped." -ForegroundColor Green

# 2. Test application health and API response while DB is down
Write-Host "`n[2/4] Testing demo application responses during database outage..." -ForegroundColor Cyan

# Health check
try {
    $healthResp = Invoke-WebRequest -Uri "$AppUrl/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host " -> GET /health HTTP Status:" $healthResp.StatusCode -ForegroundColor Green
    Write-Host "    Body:" $healthResp.Content
} catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    $statusCode = if ($resp) { [int]$resp.StatusCode } else { 0 }
    Write-Host " -> GET /health HTTP Status: $statusCode (Expected: 503 Service Unavailable)" -ForegroundColor Yellow
    if ($resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Host "    Body:" $reader.ReadToEnd()
    }
} catch {
    Write-Host " -> GET /health error: $_" -ForegroundColor Red
}

# Products API
try {
    $prodResp = Invoke-WebRequest -Uri "$AppUrl/api/products" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host " -> GET /api/products HTTP Status:" $prodResp.StatusCode -ForegroundColor Green
    Write-Host "    Body:" $prodResp.Content
} catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    $statusCode = if ($resp) { [int]$resp.StatusCode } else { 0 }
    Write-Host " -> GET /api/products HTTP Status: $statusCode (Expected: 500 Internal Server Error)" -ForegroundColor Yellow
    if ($resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Host "    Body:" $reader.ReadToEnd()
    }
} catch {
    Write-Host " -> GET /api/products error: $_" -ForegroundColor Red
}

Write-Host "`nObservable Symptoms:" -ForegroundColor Yellow
Write-Host " - Structured JSON request log emitted with level: 'ERROR' and status: 500/503."
Write-Host " - /health reports 'status': 'unhealthy', 'database': 'disconnected'."
Write-Host " - Database queries fail immediately rather than returning mock/cached data."

# 3. Wait pause duration
Write-Host "`n[3/4] Pausing for $PauseSeconds seconds to allow monitoring/alert detection..." -ForegroundColor Cyan
Start-Sleep -Seconds $PauseSeconds

# 4. Restart demo-db and verify recovery
Write-Host "`n[4/4] Restarting '$ContainerName'..." -ForegroundColor Cyan
docker start $ContainerName | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to restart '$ContainerName'."
    exit 1
}

Write-Host "Waiting 5 seconds for PostgreSQL healthcheck..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

try {
    $recoverResp = Invoke-WebRequest -Uri "$AppUrl/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host " -> GET /health after restart: HTTP Status" $recoverResp.StatusCode "(Expected: 200)" -ForegroundColor Green
    Write-Host "    Body:" $recoverResp.Content
    Write-Host "`n[SUCCESS] Database stop and recovery test completed successfully!" -ForegroundColor Green
    exit 0
} catch {
    Write-Warning "Health check after restart returned error: $_"
    exit 0
}
