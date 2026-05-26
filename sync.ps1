# Cross-platform sync helper (Windows side).
# Usage:
#   .\sync.ps1 pull              # safe pull (rebase + autostash) — start of session
#   .\sync.ps1 save  ["msg"]     # commit everything as WIP and push — end of session
#   .\sync.ps1 status            # show current state vs origin
# Default (no args) = save with auto message.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Invoke-GitOrDie([string]$Args, [string]$FailMessage) {
  Write-Host "[sync] git $Args"
  & git $Args.Split(" ")
  if ($LASTEXITCODE -ne 0) { throw $FailMessage }
}

$Branch = (& git rev-parse --abbrev-ref HEAD).Trim()
$Host   = $env:COMPUTERNAME
$Stamp  = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

$Action = if ($args.Count -ge 1) { $args[0] } else { "save" }
$Msg    = if ($args.Count -ge 2) { $args[1] } else { "wip($Host): $Stamp" }

switch ($Action) {
  "pull" {
    Write-Host "[sync] pull --rebase --autostash on '$Branch'"
    Invoke-GitOrDie "fetch origin" "git fetch failed"
    Invoke-GitOrDie "pull --rebase --autostash origin $Branch" "git pull failed"
    Write-Host "[sync] up to date with origin/$Branch"
  }

  { $_ -in @("save", "push") } {
    $dirty = (& git status --porcelain)
    if ([string]::IsNullOrWhiteSpace($dirty)) {
      Write-Host "[sync] no local changes — pushing existing commits only"
      Invoke-GitOrDie "push origin $Branch" "git push failed"
      break
    }
    Write-Host "[sync] staging all changes"
    Invoke-GitOrDie "add -A" "git add failed"
    Write-Host "[sync] commit: $Msg"
    & git commit -m "$Msg"
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
    Write-Host "[sync] pulling remote (rebase) before push to avoid divergence"
    & git pull --rebase --autostash origin $Branch
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[sync] rebase has conflicts — resolve them, then run: git rebase --continue ; .\sync.ps1 save" -ForegroundColor Yellow
      exit 1
    }
    Invoke-GitOrDie "push origin $Branch" "git push failed"
    Write-Host "[sync] done"
  }

  "status" {
    & git fetch origin 2>$null
    Write-Host "[sync] branch: $Branch on $Host"
    & git status --short --branch
  }

  default {
    Write-Host "Usage: .\sync.ps1 {pull|save|status} [commit message]"
    exit 2
  }
}
