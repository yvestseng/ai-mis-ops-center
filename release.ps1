param(
    [string]$RepositoryPath = "D:\碩士班\ai-mis-ops-center-main",
    [string]$Branch = "main",
    [string]$Version = "0.5.5",
    [string]$DatabaseName = "site-creator-d1",
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$SourcePath = $PSScriptRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
}

function Copy-ReleaseSource {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $excludedDirectories = @(
        ".git", "node_modules", ".wrangler", ".vinext", ".next", "dist", "coverage"
    )
    $excludedFiles = @(
        "package-lock.json", "*.log"
    )

    $args = @($Source, $Destination, "/E", "/R:2", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    foreach ($directory in $excludedDirectories) {
        $args += @("/XD", (Join-Path $Source $directory))
    }
    foreach ($file in $excludedFiles) {
        $args += @("/XF", $file)
    }

    & robocopy @args
    $code = $LASTEXITCODE
    if ($code -ge 8) {
        throw "Robocopy failed with exit code $code"
    }
}

Write-Host "[1/13] Checking tools" -ForegroundColor Cyan
Invoke-Checked node --version
Invoke-Checked npm.cmd --version
Invoke-Checked git --version
Invoke-Checked npx.cmd wrangler --version

if (-not (Test-Path (Join-Path $RepositoryPath ".git"))) {
    throw "RepositoryPath is not a Git repository: $RepositoryPath"
}

Write-Host "[2/13] Updating repository branch" -ForegroundColor Cyan
Set-Location $RepositoryPath
Invoke-Checked git checkout $Branch
Invoke-Checked git pull --ff-only origin $Branch

Write-Host "[3/13] Copying corrected v$Version source" -ForegroundColor Cyan
Copy-ReleaseSource -Source $SourcePath -Destination $RepositoryPath
Set-Location $RepositoryPath

Write-Host "[4/13] Setting package version" -ForegroundColor Cyan
Invoke-Checked npm.cmd version $Version --no-git-tag-version --allow-same-version

Write-Host "[5/13] Installing dependencies" -ForegroundColor Cyan
Invoke-Checked npm.cmd install

Write-Host "[6/13] Verifying App Router build dependency" -ForegroundColor Cyan
Invoke-Checked npm.cmd ls "@vitejs/plugin-rsc" --depth=0

Write-Host "[7/13] Cleaning development caches" -ForegroundColor Cyan
Invoke-Checked npm.cmd run clean:dev

Write-Host "[8/13] Running source tests" -ForegroundColor Cyan
Invoke-Checked npm.cmd run test:source

Write-Host "[9/13] Running ESLint with zero warnings" -ForegroundColor Cyan
$env:npm_config_script_shell = "C:\Program Files\Git\bin\bash.exe"
Invoke-Checked npm.cmd run lint -- --max-warnings=0

Write-Host "[10/13] Building production bundle" -ForegroundColor Cyan
Invoke-Checked npm.cmd run build

Write-Host "[11/13] Applying D1 migrations" -ForegroundColor Cyan
Invoke-Checked npx.cmd wrangler d1 migrations apply $DatabaseName --remote

Write-Host "[12/13] Committing and pushing GitHub" -ForegroundColor Cyan
Invoke-Checked git add -A
& git diff --cached --quiet
$hasChanges = $LASTEXITCODE -ne 0
if ($hasChanges) {
    Invoke-Checked git commit -m "release: v$Version fix build dependencies and lint warnings"
    Invoke-Checked git push origin $Branch
} else {
    Write-Host "No Git changes to commit." -ForegroundColor Yellow
}

if ($SkipDeploy) {
    Write-Host "[13/13] Cloudflare deployment skipped" -ForegroundColor Yellow
} else {
    Write-Host "[13/13] Deploying Cloudflare Worker" -ForegroundColor Cyan
    Invoke-Checked npx.cmd wrangler deploy
}

Write-Host "Release v$Version completed successfully." -ForegroundColor Green
Write-Host "GitHub branch: $Branch" -ForegroundColor Green
Write-Host "Cloudflare deployment: $(-not $SkipDeploy)" -ForegroundColor Green
