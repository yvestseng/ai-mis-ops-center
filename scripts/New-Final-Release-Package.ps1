param(
    [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path,
    [string]$OutputDirectory = (Join-Path (Resolve-Path "$PSScriptRoot\..").Path "release-package"),
    [switch]$IncludeReleaseOutput
)

$ErrorActionPreference = "Stop"
$project = (Resolve-Path $ProjectRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$package = Get-Content (Join-Path $project "package.json") -Raw | ConvertFrom-Json
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "ai-mis-ops-center-v$($package.version)-$stamp.zip"
$zipPath = Join-Path $OutputDirectory $zipName
$stage = Join-Path $env:TEMP "ai-mis-ops-center-release-$stamp"

$excludeNames = @(
    ".git", "node_modules", ".next", ".vinext", ".wrangler", ".sites-runtime",
    "coverage", "release-package", "drizzle-recovered"
)
$excludePatterns = @(
    "*.before-*", "*.log", ".dev.vars", ".dev.vars.*", ".env", ".env.*",
    "site-creator-d1-*.sql", "tsconfig.tsbuildinfo"
)

try {
    New-Item -ItemType Directory -Force -Path $stage | Out-Null

    Get-ChildItem -LiteralPath $project -Force | ForEach-Object {
        if ($excludeNames -contains $_.Name) { return }
        if (-not $IncludeReleaseOutput -and $_.Name -eq "release-output") { return }

        $skip = $false
        foreach ($pattern in $excludePatterns) {
            if ($_.Name -like $pattern -and $_.Name -ne ".env.example") {
                $skip = $true
                break
            }
        }
        if (-not $skip) {
            Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force
        }
    }

    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -CompressionLevel Optimal

    $hash = Get-FileHash -Algorithm SHA256 -Path $zipPath
    $hashFile = "$zipPath.sha256"
    "$($hash.Hash.ToLower())  $zipName" | Set-Content -Encoding ascii $hashFile

    Write-Host "Release ZIP : $zipPath"
    Write-Host "SHA256      : $($hash.Hash)"
    Write-Host "Hash file   : $hashFile"
}
finally {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
