# Create a named rollback point ("checkpoint") so you can come back here later.
# Usage:
#   .\checkpoint.ps1                       → auto label = cp-<date-time>
#   .\checkpoint.ps1 "before redesign"     → cp-before-redesign-<date-time>
#   .\checkpoint.ps1 list                  → show the last 30 checkpoints
#   .\checkpoint.ps1 delete <full-tag>     → remove a checkpoint (local + remote)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$Action = if ($args.Count -ge 1) { $args[0] } else { "create" }
$Stamp  = Get-Date -Format "yyyy-MM-dd-HHmmss"

switch ($Action) {
  "list" {
    Write-Host "[checkpoint] fetching tags from origin..."
    & git fetch origin --tags --quiet 2>$null
    Write-Host "[checkpoint] available rollback points (last 30):"
    $tags = & git tag --list 'cp-*' --sort=-creatordate --format='  %(creatordate:short)  %(refname:short)' | Select-Object -First 30
    if ($tags) { $tags } else { Write-Host "  (none yet — make one with: .\checkpoint.ps1 ""label"")" }
  }

  "delete" {
    if ($args.Count -lt 2) {
      Write-Host "Usage: .\checkpoint.ps1 delete <full-tag-name>"
      exit 2
    }
    $tag = $args[1]
    & git tag -d $tag 2>$null
    & git push origin ":refs/tags/$tag" 2>$null
    Write-Host "[checkpoint] deleted: $tag"
  }

  default {
    $label = if ($Action -ne "create") { $Action } else { "" }
    if ($label) {
      $safe = ($label.ToLower() -replace '[^a-z0-9_-]','-') -replace '-{2,}','-'
      $safe = $safe.Trim('-')
      $tag = "cp-${safe}-${Stamp}"
      $msg = "checkpoint: $label ($Stamp)"
    } else {
      $tag = "cp-$Stamp"
      $msg = "checkpoint: $Stamp"
    }

    $dirty = & git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace($dirty)) {
      Write-Host "[checkpoint] you have uncommitted changes — committing them first as WIP"
      & git add -A
      & git commit -m "wip before $tag" | Out-Null
    }

    & git tag -a $tag -m $msg
    Write-Host "[checkpoint] pushing tag to origin..."
    & git push origin $tag --quiet
    Write-Host "[checkpoint] created: $tag"
    Write-Host "[checkpoint]   restore later with:  .\restore.ps1 $tag"
  }
}
