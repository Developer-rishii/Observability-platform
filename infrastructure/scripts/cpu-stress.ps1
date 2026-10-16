<#
.SYNOPSIS
    Triggers a controlled CPU stress fault on the demo application.
.DESCRIPTION
    Sends an authenticated request to POST /admin/fault/cpu on the demo application (port 8081).
    Enforces a maximum duration of 120 seconds. Automatically resets when the duration expires.
.PARAMETER Duration
    Duration of CPU stress in seconds (1 to 120, default: 30).
.PARAMETER Token
    Administrative fault token. Defaults to $env:FAULT_TOKEN or 'demo-fault-secret-key'.
.PARAMETER BaseUrl
    Base URL of the demo application (default: 'http://localhost:8081').
.EXAMPLE
    .\cpu-stress.ps1 -Duration 20
#>
[CmdletBinding()]
param (
    [ValidateRange(1, 120)]
    [int]$Duration = 30,

    [string]$Token = $(if ($env:FAULT_TOKEN) { $env:FAULT_TOKEN } else { "demo-fault-secret-key" }),

    [string]$BaseUrl = $(if ($env:WORKLOAD_HOST_PORT) { "http://localhost:$($env:WORKLOAD_HOST_PORT)" } else { "http://localhost:8081" })
)

$ErrorActionPreference = "Stop"

Write-Host "=== S1 Demo Fault: CPU Stress ===" -ForegroundColor Cyan
Write-Host "Target URL: $BaseUrl/admin/fault/cpu"
Write-Host "Duration: $Duration seconds (Max: 120s)"

if ($Duration -lt 1 -or $Duration -gt 120) {
    Write-Error "Duration must be between 1 and 120 seconds."
    exit 1
}

$headers = @{
    "Content-Type"  = "application/json"
    "X-Fault-Token" = $Token
}

$body = @{
    "duration" = $Duration
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/admin/fault/cpu" -Method Post -Headers $headers -Body $body
    Write-Host "`n[SUCCESS] CPU stress initiated successfully!" -ForegroundColor Green
    Write-Host "Response:" ($response | ConvertTo-Json -Compress)
    Write-Host "`nObservable Symptoms:" -ForegroundColor Yellow
    Write-Host " - Container simulated CPU usage gauge ('simulated_cpu_usage') set to 95.0%."
    Write-Host " - Real CPU load generated via background computation."
    Write-Host " - Observability platform triggers high CPU alert if threshold (80%) is breached."
    Write-Host "`nRecovery:" -ForegroundColor Cyan
    Write-Host " - CPU stress automatically ceases after $Duration seconds."
    Write-Host " - Simulated CPU gauge resets to 5.0% upon completion."
    exit 0
} catch {
    Write-Error "Failed to initiate CPU stress fault: $_"
    exit 1
}
