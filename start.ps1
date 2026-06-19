# VoiceBridge AI - Backend start script (Windows)

$nodeDir = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers"
$yarnDir = "$env:APPDATA\npm"
$port = 3001

if (-not (Test-Path "$nodeDir\node.exe")) {
    Write-Error "Node.js not found. Install from https://nodejs.org"
    exit 1
}

$env:PATH = "$nodeDir;$yarnDir;" + $env:PATH

$pythonCandidates = @(
    $env:PYTHON_PATH,
    "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if ($pythonCandidates.Count -gt 0) {
    $env:PYTHON_PATH = $pythonCandidates[0]
    Write-Host "Python: $($env:PYTHON_PATH)" -ForegroundColor Cyan
}

Set-Location $PSScriptRoot

$alreadyRunning = $false
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2
    if ($health.status -eq 'ok') {
        $alreadyRunning = $true
    }
} catch {
    $alreadyRunning = $false
}

if ($alreadyRunning) {
    Write-Host ""
    Write-Host "Backend already running on http://localhost:$port" -ForegroundColor Green
    Write-Host "Refresh your browser." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$listeners = netstat -ano | Select-String ":$port\s+.*LISTENING"
foreach ($line in $listeners) {
    $procId = ($line.ToString().Trim() -split '\s+')[-1]
    if ($procId -match '^\d+$') {
        Write-Host "Stopping stale process on port $port (PID $procId)..."
        taskkill /PID $procId /F 2>$null
    }
}
Start-Sleep -Seconds 1

if (-not (Test-Path "node_modules\@xenova\transformers")) {
    Write-Host "Installing dependencies..."
    yarn install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "VoiceBridge Backend -> http://localhost:$port"
Write-Host "Wait for: Whisper neural engine ready."
Write-Host ""

yarn start:dev
