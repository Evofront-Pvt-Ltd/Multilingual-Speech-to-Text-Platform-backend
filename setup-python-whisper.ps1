# Optional: install Python + OpenAI Whisper for best Telugu/Kannada/Hindi accuracy.
# Run from the backend folder: .\setup-python-whisper.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Find-Python {
    $candidates = @(
        $env:PYTHON_PATH,
        'py',
        'python',
        'python3',
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
        'C:\Python314\python.exe'
    ) | Where-Object { $_ }

    foreach ($cmd in $candidates) {
        if ($cmd -match '\\') {
            if (Test-Path $cmd) { return $cmd }
            continue
        }
        $exe = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($exe) { return $exe.Source }
    }
    return $null
}

$python = Find-Python
if (-not $python) {
    Write-Host "Python not found. Installing Python 3.12 via winget..."
    winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
    $python = Find-Python
}

if (-not $python) {
    Write-Error "Python is still not available. Install from https://www.python.org/downloads/ and re-run this script."
}

Write-Host "Using Python: $python"
& $python -m pip install --upgrade pip
& $python -m pip install openai-whisper

Write-Host ""
Write-Host "Python Whisper installed." -ForegroundColor Green
Write-Host "Indian languages will automatically use Python Whisper when Node Whisper output is invalid."
Write-Host ""
