# VoiceBridge AI - Backend start script (Windows)
# Sets up Node/Yarn PATH and starts the dev server on port 3001

$nodeDir = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers"
$yarnDir = "$env:APPDATA\npm"
$port = 3001

if (-not (Test-Path "$nodeDir\node.exe")) {
    Write-Error "Node.js not found at $nodeDir. Install Node.js from https://nodejs.org or use Cursor's bundled runtime."
    exit 1
}

$env:PATH = "$nodeDir;$yarnDir;" + $env:PATH

Set-Location $PSScriptRoot

# If backend is already healthy, don't start a second instance
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2
    if ($health.status -eq "ok") {
        Write-Host "Backend is already running at http://localhost:$port"
        exit 0
    }
} catch {
    # Port may be stuck from a crashed process — try to free it
    $conn = netstat -ano | Select-String ":$port\s+.*LISTENING"
    if ($conn) {
        $pid = ($conn.ToString() -split '\s+')[-1]
        if ($pid -match '^\d+$') {
            Write-Host "Port $port is in use by PID $pid (not responding). Stopping it..."
            taskkill /PID $pid /F 2>$null
            Start-Sleep -Seconds 1
        }
    }
}

if (-not (Test-Path "node_modules\@xenova\transformers")) {
    Write-Host "Installing dependencies (includes Whisper AI + ffmpeg)..."
    yarn install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} elseif (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    yarn install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starting VoiceBridge backend on http://localhost:$port"
yarn start:dev
