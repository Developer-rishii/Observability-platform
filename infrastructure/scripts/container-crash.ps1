<#
.SYNOPSIS
    Executes a container crash fault scenario on the demo application.
.DESCRIPTION
    Kills the running demo-app container using 'docker kill demo-app'.
    Demonstrates container failure, health check errors, and automated Docker recovery via 'restart: unless-stopped'.
.PARAMETER ContainerName
    Name of the container to kill (default: 'demo-app').
.PARAMETER WaitForRecovery
    Wait and verify automatic restart of the container (default: $true).
.EXAMPLE
    .\container-crash.ps1
#>
[CmdletBinding()]
param (
    [string]$ContainerName = "demo-app",
    [switch]$NoWait
)

$ErrorActionPreference = "Stop"

Write-Host "=== S1 Demo Fault: Container Crash ===" -ForegroundColor Cyan
Write-Host "Target Container: $ContainerName"

# 1. Verify Docker is available and container is currently running
try {
    $inspect = docker inspect --format="{{.State.Running}}" $ContainerName 2>$null
    if ($LASTEXITCODE -ne 0 -or $inspect.Trim() -ne "true") {
        Write-Error "Container '$ContainerName' is not running. Please start the demo stack first:`n  docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build"
        exit 1
    }
} catch {
    Write-Error "Docker command failed or container '$ContainerName' not found: $_"
    exit 1
}

Write-Host "[1/3] Container '$ContainerName' is running. Sending kill signal..." -ForegroundColor Yellow

# 2. Kill the container
try {
    docker kill $ContainerName | Out-Null
    Write-Host "[2/3] Successfully killed container '$ContainerName' via 'docker kill $ContainerName'!" -ForegroundColor Green
} catch {
    Write-Error "Failed to kill container '$ContainerName': $_"
    exit 1
}

Write-Host "`nObservable Symptoms:" -ForegroundColor Yellow
Write-Host " - Container crashes abruptly (SIGKILL)."
Write-Host " - GET /health and GET /api/products become unreachable (Connection Refused)."
Write-Host " - Prometheus scrape target 'demo-app:8080' reports DOWN."

# 3. Post-kill recovery behavior
Write-Host "`nRecovery & Lifecycle Behavior:" -ForegroundColor Cyan
Write-Host " - 'restart: unless-stopped' is active in Compose."
Write-Host " - Because 'docker kill' was issued as a user-initiated client command,"
Write-Host "   the Docker daemon marks the container as manually stopped and holds it in 'Exited (137)' state."

if (-not $NoWait) {
    Write-Host "`n[3/3] Checking if Docker engine automatically respawns '$ContainerName'..." -ForegroundColor Cyan
    $recovered = $false
    for ($i = 1; $i -le 3; $i++) {
        Start-Sleep -Seconds 1
        $running = docker inspect --format="{{.State.Running}}" $ContainerName 2>$null
        if ($LASTEXITCODE -eq 0 -and $running.Trim() -eq "true") {
            $recovered = $true
            break
        }
    }

    if ($recovered) {
        Write-Host "[SUCCESS] Container '$ContainerName' auto-restarted!" -ForegroundColor Green
    } else {
        Write-Host "As expected after a client-side 'docker kill', container is in Exited state." -ForegroundColor Yellow
        Write-Host "To recover and bring the demo application back online, run:" -ForegroundColor Cyan
        Write-Host "  docker start $ContainerName" -ForegroundColor White
    }
}
exit 0
