#Requires -Version 5.1
param(
    [ValidateSet('err', 'out', 'wrapper')]
    [string]$Stream = 'err',
    [ValidateRange(1, 10000)]
    [int]$Tail = 100
)
$ErrorActionPreference = 'Stop'
$logFile = Join-Path $PSScriptRoot "logs\EduNexaBackend.$Stream.log"
if (-not (Test-Path -LiteralPath $logFile)) {
    throw "Log does not exist yet: $logFile. Start the service first; use -Stream wrapper for service startup problems."
}
Write-Host "Watching $logFile. Press Ctrl+C to stop viewing; the backend keeps running."
Get-Content -LiteralPath $logFile -Tail $Tail -Wait
