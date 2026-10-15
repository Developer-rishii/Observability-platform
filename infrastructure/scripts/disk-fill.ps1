<#
.SYNOPSIS
    Fills disk space with test data up to 500 MB in the demo data directory and demonstrates cleanup.
.DESCRIPTION
    Triggers POST /admin/fault/disk/fill with a bounded size (max 500 MB total).
    Queries Prometheus metrics to show demo_data_dir_bytes increase, and optionally clears the data.
.PARAMETER SizeMb
    Megabytes of test data to write (1 to 500, default: 50).
.PARAMETER Clear
    If specified, immediately clears the generated test files after verifying creation.
.PARAMETER Token
    Administrative fault token. Defaults to $env:FAULT_TOKEN or 'demo-fault-secret-key'.
.PARAMETER BaseUrl
    Base URL of demo application (default: 'http://localhost:8081').
.EXAMPLE
    .\disk-fill.ps1 -SizeMb 100 -Clear
#>
[CmdletBinding()]
param (
    [ValidateRange(1, 500)]
    [int]$SizeMb = 50,

    [switch]$Clear,

    [string]$Token = $(if ($env:FAULT_TOKEN) { $env:FAULT_TOKEN } else { "demo-fault-secret-key" }),

    [string]$BaseUrl = $(if ($env:WORKLOAD_HOST_PORT) { "http://localhost:$($env:WORKLOAD_HOST_PORT)" } else { "http://localhost:8081" })
)

$ErrorActionPreference = "Stop"

Write-Host "=== S1 Demo Fault: Disk Fill ===" -ForegroundColor Cyan
Write-Host "Target URL: $BaseUrl/admin/fault/disk/fill"
Write-Host "Requested Size: $SizeMb MB (Max allowed total: 500 MB)"

$headers = @{
    "Content-Type"  = "application/json"
    "X-Fault-Token" = $Token
}

$body = @{
    "size_mb" = $SizeMb
} | ConvertTo-Json

try {
    # 1. Fill disk
    Write-Host "`n[1/3] Generating $SizeMb MB of test data in dedicated data directory..." -ForegroundColor Cyan
    $fillResp = Invoke-RestMethod -Uri "$BaseUrl/admin/fault/disk/fill" -Method Post -Headers $headers -Body $body
    Write-Host "[SUCCESS] Disk fill response:" ($fillResp | ConvertTo-Json -Compress) -ForegroundColor Green

    # 2. Check metrics endpoint
    Write-Host "`n[2/3] Checking /metrics for demo_data_dir_bytes..." -ForegroundColor Cyan
    try {
        $metricsResp = (Invoke-WebRequest -Uri "$BaseUrl/metrics" -Method Get -UseBasicParsing).Content
        $metricLine = ($metricsResp -split "`n") | Where-Object { $_ -match "^demo_data_dir_bytes " }
        Write-Host "Prometheus Metric Value: $metricLine" -ForegroundColor Yellow
    } catch {
        Write-Warning "Could not fetch /metrics: $_"
    }

    Write-Host "`nObservable Symptoms:" -ForegroundColor Yellow
    Write-Host " - Designated data directory size metric 'demo_data_dir_bytes' reflects new total size."
    Write-Host " - Host or container disk monitoring picks up volume expansion."

    # 3. Cleanup
    if ($Clear) {
        Write-Host "`n[3/3] -Clear parameter provided: Safely clearing fault test data..." -ForegroundColor Cyan
        $clearResp = Invoke-RestMethod -Uri "$BaseUrl/admin/fault/disk/clear" -Method Post -Headers $headers
        Write-Host "[SUCCESS] Disk clear response:" ($clearResp | ConvertTo-Json -Compress) -ForegroundColor Green
        Write-Host "Freed bytes:" $clearResp.freed_bytes
    } else {
        Write-Host "`n[3/3] Test data retained. To clear manually, run:" -ForegroundColor Cyan
        Write-Host "  Invoke-RestMethod -Uri '$BaseUrl/admin/fault/disk/clear' -Method Post -Headers @{'X-Fault-Token'='$Token'}"
        Write-Host "  OR run: .\disk-fill.ps1 -Clear -SizeMb 1"
    }
    exit 0
} catch {
    Write-Error "Failed to execute disk fill fault: $_"
    exit 1
}
