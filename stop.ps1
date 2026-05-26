# Kill any local ScreenerPRO dev process so the next run-dev*.cmd starts clean.
# Mirror of stop.sh — see that file for why this matters.
$ErrorActionPreference = "SilentlyContinue"
Set-Location -Path $PSScriptRoot

$killed = $false

# 1. Anything listening on port 3000.
try {
  $conns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
  if ($conns) {
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      $killed = $true
    }
  }
} catch {
  # Fallback for systems without Get-NetTCPConnection.
  $lines = netstat -ano | Select-String ":3000"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
    if ($parts.Length -ge 5) {
      $pid = $parts[-1]
      if ($pid -match "^\d+$") {
        cmd /c "taskkill /PID $pid /F >nul 2>nul" | Out-Null
        $killed = $true
      }
    }
  }
}

# 2. All next dev / next-server workers (best effort match on process command line).
$patterns = @("next-server", "next dev", "pnpm.*frontend.*dev")
foreach ($pat in $patterns) {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $pat } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      $killed = $true
    }
}

Start-Sleep -Milliseconds 500

if ($killed) {
  Write-Host "[stop] killed previous ScreenerPRO dev processes"
} else {
  Write-Host "[stop] nothing to kill"
}
