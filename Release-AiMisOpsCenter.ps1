[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectPath = 'D:\DEV\ai-mis-ops-center',

    [Parameter(Mandatory = $true)]
    [string]$CommitMessage,

    # Only specify new, reviewed migration files. Existing D1 migrations must
    # not be replayed automatically.
    [string[]]$MigrationFiles = @(),

    [switch]$SkipPull,
    [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "`n=== $Description ===" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code: $LASTEXITCODE). Release stopped; no later step was run."
    }
}

function Invoke-BashNpm {
    param([Parameter(Mandatory = $true)][string]$NpmCommand)

    $gitBash = 'C:\Program Files\Git\bin\bash.exe'
    if (-not (Test-Path -LiteralPath $gitBash)) {
        throw "Git Bash was not found: $gitBash"
    }

    # Git Bash accepts this form for a Windows drive path. Single quotes prevent
    # spaces in the project path from breaking the shell command.
    $bashPath = '/' + $ProjectPath.Substring(0, 1).ToLower() + $ProjectPath.Substring(2).Replace('\', '/')
    $command = "cd '$bashPath' && $NpmCommand"
    & $gitBash -lc $command
    if ($LASTEXITCODE -ne 0) {
        throw "$NpmCommand failed (exit code: $LASTEXITCODE). Release stopped."
    }
}

try {
    $ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath '.git'))) {
        throw "This is not a Git repository: $ProjectPath"
    }

    Push-Location $ProjectPath

    Invoke-Checked 'Checking Git repository state' { git status --short }
    Invoke-Checked 'Fetching the latest GitHub main branch' { git fetch origin --prune }

    if (-not $SkipPull) {
        Invoke-Checked 'Updating local branch with GitHub main' { git pull --ff-only origin main }
    }

    # Run only migrations explicitly supplied for this release. This prevents
    # accidental replay of a CREATE/ALTER migration already applied to D1.
    foreach ($migration in $MigrationFiles) {
        $migrationPath = Join-Path $ProjectPath $migration
        if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) {
            throw "Migration file was not found: $migration"
        }

        Invoke-Checked "Applying D1 migration: $migration" {
            npx.cmd wrangler d1 execute site-creator-d1 --remote --file $migrationPath
        }
    }

    Invoke-Checked 'Checking whitespace errors' { git diff --check }

    Write-Host "`n=== Running lint ===" -ForegroundColor Cyan
    Invoke-BashNpm 'npm run lint'
    Write-Host "`n=== Running production build ===" -ForegroundColor Cyan
    Invoke-BashNpm 'npm run build'
    Write-Host "`n=== Running automated tests ===" -ForegroundColor Cyan
    Invoke-BashNpm 'npm run test'

    $blockedFiles = git status --short | Where-Object {
        $_ -match '(?i)(^|\s)(\.dev\.vars|\.env($|\.)|.*\.pem|.*\.key|.*secret.*|.*credential.*)'
    }
    if ($blockedFiles) {
        Write-Host ($blockedFiles -join "`n") -ForegroundColor Yellow
        throw 'Potential secret file detected in the working tree. Review it and stage files manually; release stopped.'
    }

    $changes = git status --porcelain
    if (-not $changes) {
        throw 'No Git changes were found. Nothing was committed or deployed.'
    }

    Invoke-Checked 'Staging changed source files' { git add -A }
    Invoke-Checked 'Reviewing staged change summary' { git diff --cached --stat }
    Invoke-Checked 'Committing release to GitHub history' { git commit -m $CommitMessage }
    Invoke-Checked 'Pushing commit to GitHub main' { git push origin main }

    if (-not $SkipDeploy) {
        Invoke-Checked 'Deploying verified build to Cloudflare Workers' { npx.cmd wrangler deploy }
    }

    Write-Host "`nRelease completed successfully." -ForegroundColor Green
    git log -1 --oneline
    if (-not $SkipDeploy) {
        Write-Host 'Cloudflare: https://ai-mis-ops-center.amtran.workers.dev'
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
finally {
    if (Get-Location) { Pop-Location -ErrorAction SilentlyContinue }
}
