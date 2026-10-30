#Requires -Version 5.1
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$serviceExe = Join-Path $PSScriptRoot 'EduNexaBackend.exe'
$pythonExe = Join-Path $backendRoot '.venv\Scripts\python.exe'

foreach ($required in @($serviceExe, $pythonExe, (Join-Path $backendRoot '.env'))) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Missing $required. Follow the Windows service steps in backend/README.md."
    }
}
if (Get-Service -Name 'EduNexaBackend' -ErrorAction SilentlyContinue) {
    throw 'EduNexaBackend is already installed. Use Restart-Service EduNexaBackend after updating the backend.'
}
if (Get-NetTCPConnection -LocalPort 8010 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 8010 is already in use. Stop the existing backend process before installing this service.'
}

$logDirectory = Join-Path $PSScriptRoot 'logs'
$dataDirectory = Join-Path $backendRoot 'var'
New-Item -ItemType Directory -Force -Path $logDirectory, $dataDirectory | Out-Null
# LocalService can read the app and .env, and write only runtime data and logs.
& icacls.exe $backendRoot /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not grant service read access.' }
foreach ($directory in @($logDirectory, $dataDirectory)) {
    & icacls.exe $directory /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not grant write access to $directory." }
}

& $serviceExe install
if ($LASTEXITCODE -ne 0) { throw 'WinSW service installation failed.' }
& $serviceExe start
if ($LASTEXITCODE -ne 0) { throw "Service start failed. Check logs in $logDirectory." }

$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $result = Invoke-RestMethod 'http://127.0.0.1:8010/health' -TimeoutSec 2
        if ($result.status -eq 'ok' -and $result.storage -eq 'sqlserver') {
            $healthy = $true
            break
        }
    } catch { }
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    throw "Service installed, but SQL Server health configuration was not confirmed. Check $logDirectory. /health does not test SQL login; verify a database-backed API too."
}
if ((Get-Service EduNexaBackend).Status -ne 'Running') {
    throw "The backend service stopped. Check $logDirectory."
}
Get-Service EduNexaBackend
Write-Host 'Backend HTTP health passed. Verify SQL-backed API access separately before routing users here.'
