<#
.SYNOPSIS
    Triggers an authenticated artificial latency fault on the demo application.
.DESCRIPTION
    Injects artificial latency (up to 3,000ms) on HTTP requests for up to 120 seconds.
    Measures and demonstrates the latency increase on live API endpoints.
.PARAMETER LatencyMs
    Artificial delay to inject in milliseconds (0 to 3000, default: 2000).
.PARAMETER Duration
    Fault duration in seconds (1 to 120, default: 30).
.PARAMETER Token
    Administrative fault token. Defaults to $env:FAULT_TOKEN or 'demo-fault-secret-key'.
.PARAMETER BaseUrl
    Base URL of demo application (default: 'http://localhost:8081').
.EXAMPLE
    .\latency-spike.ps1 -LatencyMs 1500 -Duration 20
#>
[CmdletBinding()]
param (
    [ValidateRange(0, 3000)]
    [int]$LatencyMs = 2000,

    [ValidateRange(1, 120)]
    [int]$Duration = 30,

    [string]$Token = $(if ($env:FAULT_TOKEN) { $env:FAULT_TOKEN } else { "demo-fault-secret-key" }),

    [string]$BaseUrl = $(if ($env:WORKLOAD_HOST_PORT) { "http://localhost:$($env:WORKLOAD_HOST_PORT)" } else { "http://localhost:8081" })
)

$ErrorActionPreference = "Stop"

Write-Host "=== S1 Demo Fault: Latency Spike ===" -ForegroundColor Cyan
Write-Host "Target URL: $BaseUrl/admin/fault/latency"
Write-Host "Injected Latency: $LatencyMs ms (Max: 3000ms)"
Write-Host "Fault Duration: $Duration seconds (Max: 120s)"

$headers = @{
    "Content-Type"  = "application/json"
    "X-Fault-Token" = $Token
}

$body = @{
    "latency_ms" = $LatencyMs
    "duration"   = $Duration
} | ConvertTo-Json

try {
    # 1. Activate latency fault
    $response = Invoke-RestMethod -Uri "$BaseUrl/admin/fault/latency" -Method Post -Headers $headers -Body $body
    Write-Host "`n[1/2] Latency fault activated successfully!" -ForegroundColor Green
    Write-Host "Response:" ($response | ConvertTo-Json -Compress)

    # 2. Measure actual API latency
    Write-Host "`n[2/2] Measuring live round-trip request time to /api/products..." -ForegroundColor Cyan
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $apiResp = Invoke-RestMethod -Uri "$BaseUrl/api/products" -Method Get
    $sw.Stop()
    $elapsedMs = $sw.ElapsedMilliseconds

    Write-Host "Observed round-trip time: $elapsedMs ms (Injected delay was: $LatencyMs ms)" -ForegroundColor Green

    Write-Host "`nObservable Symptoms:" -ForegroundColor Yellow
    Write-Host " - Structured request log records duration_ms >= $LatencyMs ms."
    Write-Host " - Prometheus histogram 'http_request_duration_seconds' records higher duration buckets."
    Write-Host " - Upstream services experience high p95/p99 latency."

    Write-Host "`nRecovery Mechanism:" -ForegroundColor Cyan
    Write-Host " - Fault automatically resets after $Duration seconds."
    Write-Host " - Or reset immediately by posting to: $BaseUrl/admin/fault/latency/reset"
    exit 0
} catch {
    Write-Error "Failed to inject latency fault: $_"
    exit 1
}
