#Requires -Version 5.1
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pythonExe = Join-Path $backendRoot '.venv\Scripts\python.exe'
$serviceExe = Join-Path $PSScriptRoot 'EduNexaBackend.exe'

if (Get-Service EduNexaBackend -ErrorAction SilentlyContinue) {
    throw 'Service already installed. Stop-Service EduNexaBackend before updating dependencies, then Start-Service EduNexaBackend. See README.md.'
}
if (-not (Test-Path (Join-Path $backendRoot '.env'))) {
    throw 'Place your production .env in the backend folder first. Configure the migrated database (127.0.0.1:1433, Edu Admin). See README.md.'
}

Push-Location $backendRoot
try {
    if (-not (Test-Path $pythonExe)) {
        if (Test-Path '.venv') {
            throw 'An incompatible .venv exists. Copy the backend without the Mac .venv; Windows needs its own virtual environment.'
        }
        if (-not (Get-Command py.exe -ErrorAction SilentlyContinue)) {
            throw 'Install 64-bit Python 3.12 for all users, including the Python launcher, then rerun this script.'
        }
        Write-Host 'Creating Windows virtual environment...'
        & py.exe -3.12 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 venv creation failed. Install Python 3.12 for all users.' }
    }

    Write-Host 'Installing backend dependencies...'
    & $pythonExe -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the pip output above.' }

    Write-Host 'Checking configuration and migrated database access...'
    & $pythonExe (Join-Path $PSScriptRoot 'verify-config.py')
    if ($LASTEXITCODE -ne 0) { throw 'Fix the configuration before installing the service.' }

    if (-not (Test-Path $serviceExe)) {
        Write-Host 'Downloading WinSW 2.12.0 from its official GitHub release...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $downloadPath = Join-Path $PSScriptRoot 'EduNexaBackend.download'
        Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' -OutFile $downloadPath
        Move-Item -LiteralPath $downloadPath -Destination $serviceExe
    }

    & (Join-Path $PSScriptRoot 'install-service.ps1')
    Write-Host 'Setup complete. Watch startup/error logs with:'
    Write-Host 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\windows\logs.ps1'
} finally {
    Pop-Location
}
