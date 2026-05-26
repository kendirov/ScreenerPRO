# Roll the working copy back to a checkpoint, commit, or relative ref.
# Usage:
#   .\restore.ps1                      → list checkpoints + recent commits (no changes)
#   .\restore.ps1 cp-before-x-2026...  → reset to that checkpoint
#   .\restore.ps1 HEAD~3               → roll back 3 commits
#   .\restore.ps1 <commit-hash>        → reset to a specific commit
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$Branch = (& git rev-parse --abbrev-ref HEAD).Trim()

function Show-Overview {
  & git fetch origin --tags --quiet 2>$null
  Write-Host "[restore] checkpoints (cp-*, last 30):"
  $tags = & git tag --list 'cp-*' --sort=-creatordate --format='  %(creatordate:short)  %(refname:short)' | Select-Object -First 30
  if ($tags) { $tags } else { Write-Host "  (none — make one with: .\checkpoint.ps1 ""label"")" }
  Write-Host ""
  Write-Host "[restore] recent commits on '$Branch' (last 15):"
  & git log -15 --pretty=format:"  %h  %ad  %s" --date=short
  Write-Host ""
  Write-Host ""
  Write-Host "Usage:  .\restore.ps1 <tag|hash|HEAD~N>"
}

if ($args.Count -eq 0) {
  Show-Overview
  exit 0
}

$Target = $args[0]

& git rev-parse --verify "$Target^{commit}" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[restore] ERROR: '$Target' is not a valid tag/commit ref."
  Write-Host "[restore] run without arguments to see available options."
  exit 1
}

Write-Host "[restore] target:"
& git log -1 --pretty=format:"  %h  %ad  %s" --date=short $Target
Write-Host ""
Write-Host "[restore] this will rewind '$Branch' to that point."
Write-Host "[restore] later, to publish the rollback so other machines see it, run:"
Write-Host "          git push --force-with-lease origin $Branch"
$answer = Read-Host "[restore] proceed? (type 'yes' to confirm)"
if ($answer -ne "yes") {
  Write-Host "[restore] cancelled"
  exit 0
}

$dirty = & git status --porcelain
if (-not [string]::IsNullOrWhiteSpace($dirty)) {
  & git stash push -u -m "auto-stash before restore to $Target" | Out-Null
  Write-Host "[restore] uncommitted changes stashed (see: git stash list)"
}

$Rescue = "rescue-" + (Get-Date -Format "yyyy-MM-dd-HHmmss")
& git tag -a $Rescue -m "state before restore to $Target"
& git push origin $Rescue --quiet 2>$null
Write-Host "[restore] safety tag created: $Rescue"

& git reset --hard $Target

Write-Host ""
Write-Host "[restore] '$Branch' is now at $Target"
Write-Host "[restore] to undo this restore:           git reset --hard $Rescue"
Write-Host "[restore] to publish rollback to GitHub:  git push --force-with-lease origin $Branch"
