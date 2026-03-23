$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

function Write-Step([string]$Message) {
  Write-Host "[STEP] $Message"
}

function Write-Ok([string]$Message) {
  Write-Host "[OK] $Message"
}

function Write-WarnMsg([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrMsg([string]$Message) {
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Run-Cmd([string]$Command, [string]$FailMessage) {
  Write-Host "  > $Command"
  & cmd /c $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailMessage
  }
}

function Stop-Port3000 {
  try {
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        try {
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        } catch {
          # Ignore process stop errors, best effort only.
        }
      }
    }
  } catch {
    # Fallback for environments without Get-NetTCPConnection.
    $netstat = netstat -ano | Select-String ":3000"
    foreach ($line in $netstat) {
      $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
      if ($parts.Length -ge 5) {
        $pid = $parts[-1]
        if ($pid -match "^\d+$") {
          cmd /c "taskkill /PID $pid /F >nul 2>nul" | Out-Null
        }
      }
    }
  }
}

try {
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm is not installed. Install with: npm install -g pnpm"
  }

  Write-Step "Checking frontend environment file"
  $envPath = Join-Path $PSScriptRoot "frontend\.env"
  $envExamplePath = Join-Path $PSScriptRoot "frontend\.env.example"
  if (-not (Test-Path $envPath)) {
    if (-not (Test-Path $envExamplePath)) {
      throw "frontend\.env.example was not found."
    }
    Copy-Item -Path $envExamplePath -Destination $envPath -Force
    Write-Ok "Created frontend\.env from .env.example"
  } else {
    Write-Ok "frontend\.env already exists"
  }

  Write-Step "Stopping stale processes on port 3000"
  Stop-Port3000
  Write-Ok "Port 3000 cleanup completed"

  Write-Step "Installing dependencies"
  Run-Cmd "pnpm install" "Dependency install failed."
  Write-Ok "Dependencies installed"
  Write-WarnMsg "If you see ignored build scripts, run: pnpm approve-builds"

  Write-Step "Generating Prisma client"
  Run-Cmd "pnpm -C frontend prisma:generate" "Prisma generate failed. Close Node/IDE processes and retry if EPERM occurs."
  Write-Ok "Prisma client generated"

  Write-Step "Applying Prisma schema"
  Run-Cmd "pnpm -C frontend prisma:push" "Prisma db push failed. Verify DATABASE_URL in frontend\.env"
  Write-Ok "Prisma schema applied"

  Write-Step "Running MOEX ingest"
  try {
    Run-Cmd "pnpm -C frontend ingest:moex" "MOEX ingest failed."
    Write-Ok "MOEX ingest completed"
  } catch {
    Write-WarnMsg "MOEX ingest failed. Starting app with demo fallback mode."
  }

  Write-Step "Starting frontend dev server"
  Write-Host "[INFO] Open http://localhost:3000/screener"
  & cmd /c "pnpm -C frontend dev"
  exit $LASTEXITCODE
} catch {
  Write-ErrMsg $_.Exception.Message
  exit 1
}
