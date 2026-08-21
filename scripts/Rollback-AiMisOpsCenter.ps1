param(
    [Parameter(Mandatory=$true)][string]$WorkerVersionId,
    [string]$WorkerName = "ai-mis-ops-center",
    [string]$DatabaseName = "site-creator-d1",
    [string]$D1Bookmark = "",
    [string]$Message = "AI MIS OPS Center controlled rollback",
    [switch]$Execute
)

$ErrorActionPreference = "Stop"

function Run-Step([string]$Description, [scriptblock]$Action) {
    Write-Host "`n=== $Description ===" -ForegroundColor Cyan
    if (-not $Execute) {
        Write-Host "[DRY-RUN] Command not executed." -ForegroundColor Yellow
        return
    }
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE"
    }
}

Write-Host "AI MIS OPS Center Rollback"
Write-Host "Worker version : $WorkerVersionId"
Write-Host "Worker name    : $WorkerName"
Write-Host "D1 bookmark    : $(if ($D1Bookmark) { $D1Bookmark } else { '<not requested>' })"
Write-Host "Mode           : $(if ($Execute) { 'EXECUTE' } else { 'DRY-RUN' })"

if ($D1Bookmark) {
    Write-Warning "D1 Time Travel restore overwrites the database in place."
    Run-Step "Restore D1 to approved bookmark" {
        npx wrangler d1 time-travel restore $DatabaseName --bookmark $D1Bookmark
    }
}

Run-Step "Rollback Worker to known-good version" {
    npx wrangler rollback $WorkerVersionId --name $WorkerName --message $Message
}

Write-Host "`nNext required step: run Production-Smoke-Test.ps1 and record the rollback evidence."
