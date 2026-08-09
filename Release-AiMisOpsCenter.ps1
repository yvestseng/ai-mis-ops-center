[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectPath = 'D:\DEV\ai-mis-ops-center',

    [Parameter(Mandatory = $false)]
    [string]$CommitMessage,

    # Specify only reviewed migration files that are expected to be pending
    # for this release, for example:
    # -MigrationFiles @('drizzle\0021_xxx.sql')
    #
    # The script validates the pending D1 migration list before applying it.
    [string[]]$MigrationFiles = @(),

    [switch]$SkipPull,
    [switch]$SkipDeploy,

    # Deploy an already committed/pushed clean commit without creating
    # another Git commit.
    [switch]$DeployExistingCommit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Release configuration
# ---------------------------------------------------------------------------

$WorkerName = 'ai-mis-ops-center'
$D1DatabaseName = 'site-creator-d1'
$EnvironmentName = 'production'
$ReleaseOutputDirectoryName = 'release-output'
$ProductionUrl = 'https://ai-mis-ops-center.amtran.workers.dev'
$RequiredBranch = 'main'

$GitBashPath = 'C:\Program Files\Git\bin\bash.exe'

# ---------------------------------------------------------------------------
# Runtime state
# ---------------------------------------------------------------------------

$locationPushed = $false
$previousWranglerOutputPath = $null
$wranglerOutputEnvironmentWasChanged = $false

$releaseOutputDirectory = $null
$wranglerOutputPath = $null
$manifestPath = $null
$recordPath = $null

$metadata = $null
$deploymentMessage = $null
$cloudflareVersionId = $null
$cloudflareWorkerName = $WorkerName
$cloudflareTargets = @()

$lintStatus = 'NOT_RUN'
$buildStatus = 'NOT_RUN'
$testStatus = 'NOT_RUN'
$gitSyncStatus = 'NOT_RUN'
$d1MigrationStatus = 'NOT_CHECKED'
$deploymentStatus = 'NOT_RUN'


# ---------------------------------------------------------------------------
# Generic command wrapper
# ---------------------------------------------------------------------------

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host "`n=== $Description ===" -ForegroundColor Cyan

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code: $LASTEXITCODE). Release stopped; no later step was run."
    }
}


# ---------------------------------------------------------------------------
# Run npm through the known Git Bash installation.
#
# This intentionally avoids Windows accidentally resolving bash.exe to WSL.
# ---------------------------------------------------------------------------

function Invoke-BashNpm {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NpmCommand
    )

    if (-not (Test-Path -LiteralPath $GitBashPath -PathType Leaf)) {
        throw "Git Bash was not found: $GitBashPath"
    }

    if ($ProjectPath.Length -lt 3 -or $ProjectPath[1] -ne ':') {
        throw "Unsupported project path for Git Bash conversion: $ProjectPath"
    }

    $driveLetter = $ProjectPath.Substring(0, 1).ToLowerInvariant()

    $pathAfterDrive = $ProjectPath.Substring(2).Replace('\', '/')

    $bashPath = "/$driveLetter$pathAfterDrive"

    $escapedBashPath = $bashPath.Replace("'", "'\''")

    $command = "cd '$escapedBashPath' && $NpmCommand"

    & $GitBashPath -lc $command

    if ($LASTEXITCODE -ne 0) {
        throw "$NpmCommand failed (exit code: $LASTEXITCODE). Release stopped."
    }
}


# ---------------------------------------------------------------------------
# Secret / sensitive-file guard
# ---------------------------------------------------------------------------

function Assert-NoSensitiveFiles {
    Write-Host "`n=== Checking for sensitive files ===" -ForegroundColor Cyan

    $blockedFiles = git status --short |
        Where-Object {
            $_ -match '(?i)(^|\s)(\.dev\.vars|\.env($|\.)|.*\.pem|.*\.key|.*secret.*|.*credential.*)'
        }

    if ($blockedFiles) {
        Write-Host ($blockedFiles -join "`n") -ForegroundColor Yellow

        throw @"
Potential secret or credential file detected in the working tree.

Review the files before continuing.

Release stopped.
"@
    }

    Write-Host 'Sensitive-file guard passed.' -ForegroundColor Green
}


# ---------------------------------------------------------------------------
# Verify current Git branch
# ---------------------------------------------------------------------------

function Assert-RequiredBranch {
    $branch = (git branch --show-current).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to determine the current Git branch.'
    }

    Write-Host "Current branch: $branch"

    if ($branch -ne $RequiredBranch) {
        throw "Release must run from branch '$RequiredBranch'. Current branch: '$branch'."
    }
}


# ---------------------------------------------------------------------------
# Verify local HEAD matches GitHub origin/main
# ---------------------------------------------------------------------------

function Assert-GitHubSynchronization {
    Write-Host "`n=== Verifying GitHub synchronization ===" -ForegroundColor Cyan

    $localCommit = (git rev-parse HEAD).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to read local HEAD.'
    }

    $remoteCommit = (git rev-parse "origin/$RequiredBranch").Trim()

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read origin/$RequiredBranch."
    }

    Write-Host "Local HEAD            : $localCommit"
    Write-Host "origin/$RequiredBranch : $remoteCommit"

    if ($localCommit -ne $remoteCommit) {
        throw @"
Local HEAD does not match origin/$RequiredBranch.

Local:
$localCommit

Remote:
$remoteCommit

Deployment aborted.

Push the verified commit to GitHub before deploying Cloudflare.
"@
    }

    Write-Host 'GitHub synchronization verified.' -ForegroundColor Green
}


# ---------------------------------------------------------------------------
# Read release metadata
# ---------------------------------------------------------------------------

function Get-ReleaseMetadata {
    $packageJsonPath = Join-Path $ProjectPath 'package.json'

    if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
        throw "package.json was not found: $packageJsonPath"
    }

    $packageJson = Get-Content `
        -LiteralPath $packageJsonPath `
        -Raw `
        -Encoding UTF8 |
        ConvertFrom-Json

    $gitBranch = (git branch --show-current).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to determine Git branch.'
    }

    $gitCommit = (git rev-parse HEAD).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to determine Git commit.'
    }

    $gitShortCommit = (git rev-parse --short HEAD).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to determine short Git commit.'
    }

    $gitCommitMessage = (git log -1 --pretty=%s).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to determine Git commit message.'
    }

    $gitUserName = (git config user.name).Trim()

    if ($LASTEXITCODE -ne 0) {
        $gitUserName = ''
    }

    $gitUserEmail = (git config user.email).Trim()

    if ($LASTEXITCODE -ne 0) {
        $gitUserEmail = ''
    }

    $deployUser = [Environment]::UserName
    $deployMachine = [Environment]::MachineName

    $deployTime = Get-Date

    $deployTimeIso = $deployTime.ToString(
        'yyyy-MM-ddTHH:mm:sszzz',
        [System.Globalization.CultureInfo]::InvariantCulture
    )

    $timestamp = $deployTime.ToString(
        'yyyyMMdd-HHmmss',
        [System.Globalization.CultureInfo]::InvariantCulture
    )

    return [PSCustomObject]@{
        ApplicationVersion = [string]$packageJson.version
        GitBranch = $gitBranch
        GitCommit = $gitCommit
        GitShortCommit = $gitShortCommit
        GitCommitMessage = $gitCommitMessage
        GitUserName = $gitUserName
        GitUserEmail = $gitUserEmail
        DeployUser = $deployUser
        DeployMachine = $deployMachine
        DeployTime = $deployTimeIso
        Timestamp = $timestamp
    }
}


# ---------------------------------------------------------------------------
# Display metadata before deployment
# ---------------------------------------------------------------------------

function Show-ReleaseMetadata {
    param(
        [Parameter(Mandatory = $true)]
        $ReleaseMetadata
    )

    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host ' AI MIS OPS Center - Release Metadata' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan

    Write-Host "Application Version : $($ReleaseMetadata.ApplicationVersion)"
    Write-Host "Environment         : $EnvironmentName"

    Write-Host ''

    Write-Host "Git Branch          : $($ReleaseMetadata.GitBranch)"
    Write-Host "Git Commit          : $($ReleaseMetadata.GitCommit)"
    Write-Host "Git Short Commit    : $($ReleaseMetadata.GitShortCommit)"
    Write-Host "Git Message         : $($ReleaseMetadata.GitCommitMessage)"

    Write-Host ''

    Write-Host "Deploy User          : $($ReleaseMetadata.DeployUser)"
    Write-Host "Deploy Computer      : $($ReleaseMetadata.DeployMachine)"
    Write-Host "Deploy Time          : $($ReleaseMetadata.DeployTime)"

    Write-Host ''

    Write-Host "Cloudflare Worker    : $WorkerName"
    Write-Host "D1 Database          : $D1DatabaseName"

    Write-Host '============================================================'
}


# ---------------------------------------------------------------------------
# Read pending Cloudflare D1 migrations
# ---------------------------------------------------------------------------

function Get-D1MigrationStatus {
    Write-Host "`n=== Checking D1 migration status ===" -ForegroundColor Cyan

    $output = & npx.cmd wrangler d1 migrations list $D1DatabaseName --remote 2>&1

    $exitCode = $LASTEXITCODE

    $output |
        ForEach-Object {
            Write-Host $_
        }

    if ($exitCode -ne 0) {
        throw 'Unable to verify remote D1 migration status.'
    }

    $text = $output -join "`n"

    $pendingMigrations = @(
        [regex]::Matches(
            $text,
            '(?im)\b[0-9][A-Za-z0-9._-]*\.sql\b'
        ) |
        ForEach-Object {
            $_.Value
        } |
        Sort-Object -Unique
    )

    $isUpToDate = $text -match '(?i)No migrations to apply'

    if (-not $isUpToDate -and $pendingMigrations.Count -eq 0) {
        throw @"
Wrangler returned an unexpected D1 migration-list format.

Unable to safely determine whether migrations are pending.

Release stopped.
"@
    }

    return [PSCustomObject]@{
        IsUpToDate = $isUpToDate
        PendingMigrations = $pendingMigrations
        RawText = $text
    }
}


# ---------------------------------------------------------------------------
# Validate and apply reviewed D1 migrations
# ---------------------------------------------------------------------------

function Invoke-ReviewedD1Migrations {
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [AllowNull()]
        [string[]]$ReviewedMigrationFiles = @()
    )

    if ($null -eq $ReviewedMigrationFiles) {
        $ReviewedMigrationFiles = @()
    }

    $status = Get-D1MigrationStatus

    if ($status.IsUpToDate) {
        Write-Host 'D1 migrations are already up to date.' -ForegroundColor Green
        return
    }

    $pendingNames = @(
        $status.PendingMigrations |
        ForEach-Object {
            [System.IO.Path]::GetFileName($_)
        }
    )

    if ($ReviewedMigrationFiles.Count -eq 0) {
        Write-Host "`nPending migrations:" -ForegroundColor Yellow

        $pendingNames |
            ForEach-Object {
                Write-Host " - $_" -ForegroundColor Yellow
            }

        throw @"
Pending D1 migrations were detected.

No reviewed -MigrationFiles were supplied.

Review the migration files and run the release again, for example:

-MigrationFiles @('drizzle\0021_example.sql')

Release stopped before production deployment.
"@
    }

    $reviewedNames = @()

    foreach ($migration in $ReviewedMigrationFiles) {
        $migrationPath = Join-Path $ProjectPath $migration

        if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) {
            throw "Migration file was not found: $migration"
        }

        $reviewedNames += [System.IO.Path]::GetFileName($migrationPath)
    }

    $reviewedNames = @(
        $reviewedNames |
        Sort-Object -Unique
    )

    $pendingNames = @(
        $pendingNames |
        Sort-Object -Unique
    )

    $missingFromReview = @(
        $pendingNames |
        Where-Object {
            $_ -notin $reviewedNames
        }
    )

    $notActuallyPending = @(
        $reviewedNames |
        Where-Object {
            $_ -notin $pendingNames
        }
    )

    if ($missingFromReview.Count -gt 0 -or $notActuallyPending.Count -gt 0) {
        Write-Host "`nPending migrations:" -ForegroundColor Yellow

        $pendingNames |
            ForEach-Object {
                Write-Host " - $_"
            }

        Write-Host "`nReviewed migrations:" -ForegroundColor Yellow

        $reviewedNames |
            ForEach-Object {
                Write-Host " - $_"
            }

        throw @"
Reviewed migration files do not exactly match the migrations pending in Cloudflare D1.

Release stopped.

This prevents an unexpected migration from being applied to production.
"@
    }

    Write-Host "`nReviewed migrations match Cloudflare pending migrations." -ForegroundColor Green

    Invoke-Checked 'Applying reviewed D1 migrations' {
        npx.cmd wrangler d1 migrations apply $D1DatabaseName --remote
    }

    $verificationStatus = Get-D1MigrationStatus

    if (-not $verificationStatus.IsUpToDate) {
        throw 'D1 migrations were applied, but pending migrations still remain.'
    }

    Write-Host 'D1 migration verification passed.' -ForegroundColor Green
}


# ---------------------------------------------------------------------------
# Recursive JSON property lookup
#
# Used because Wrangler structured output can evolve slightly across versions.
# ---------------------------------------------------------------------------

function Find-JsonPropertyValue {
    param(
        [Parameter(Mandatory = $false)]
        $InputObject,

        [Parameter(Mandatory = $true)]
        [string]$PropertyName
    )

    if ($null -eq $InputObject) {
        return $null
    }

    if ($InputObject -is [string]) {
        return $null
    }

    if (
        $InputObject -is [System.Collections.IEnumerable] -and
        $InputObject -isnot [System.Collections.IDictionary] -and
        $InputObject -isnot [PSCustomObject]
    ) {
        foreach ($item in $InputObject) {
            $result = Find-JsonPropertyValue `
                -InputObject $item `
                -PropertyName $PropertyName

            if ($null -ne $result) {
                return $result
            }
        }

        return $null
    }

    if ($InputObject -is [System.Collections.IDictionary]) {
        foreach ($key in $InputObject.Keys) {
            if ([string]$key -ieq $PropertyName) {
                return $InputObject[$key]
            }

            $result = Find-JsonPropertyValue `
                -InputObject $InputObject[$key] `
                -PropertyName $PropertyName

            if ($null -ne $result) {
                return $result
            }
        }

        return $null
    }

    foreach ($property in $InputObject.PSObject.Properties) {
        if ($property.Name -ieq $PropertyName) {
            return $property.Value
        }

        $result = Find-JsonPropertyValue `
            -InputObject $property.Value `
            -PropertyName $PropertyName

        if ($null -ne $result) {
            return $result
        }
    }

    return $null
}


# ---------------------------------------------------------------------------
# Parse Wrangler NDJSON and obtain deployed Cloudflare version
# ---------------------------------------------------------------------------

function Get-CloudflareDeployRecord {
    param(
        [Parameter(Mandatory = $true)]
        [string]$StructuredOutputPath
    )

    if (-not (Test-Path -LiteralPath $StructuredOutputPath -PathType Leaf)) {
        throw "Wrangler structured output was not generated: $StructuredOutputPath"
    }

    $records = @()

    foreach ($line in Get-Content -LiteralPath $StructuredOutputPath -Encoding UTF8) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $records += ($line | ConvertFrom-Json)
        }
        catch {
            Write-Host "Ignoring non-JSON Wrangler output line." -ForegroundColor DarkYellow
        }
    }

    if ($records.Count -eq 0) {
        throw 'Wrangler structured output contained no readable JSON records.'
    }

    $candidateRecords = @()

    foreach ($record in $records) {
        $versionId = Find-JsonPropertyValue `
            -InputObject $record `
            -PropertyName 'version_id'

        if (-not $versionId) {
            continue
        }

        $workerNameValue = Find-JsonPropertyValue `
            -InputObject $record `
            -PropertyName 'worker_name'

        $targetsValue = Find-JsonPropertyValue `
            -InputObject $record `
            -PropertyName 'targets'

        $candidateRecords += [PSCustomObject]@{
            VersionId = [string]$versionId
            WorkerName = if ($workerNameValue) {
                [string]$workerNameValue
            }
            else {
                $WorkerName
            }
            Targets = if ($targetsValue) {
                @($targetsValue)
            }
            else {
                @()
            }
        }
    }

    if ($candidateRecords.Count -eq 0) {
        throw @"
Cloudflare deployment completed but no version_id could be found in Wrangler structured output.

Structured output:
$StructuredOutputPath

Release record generation stopped because the deployment cannot be safely correlated to a Cloudflare version.
"@
    }

    return $candidateRecords[-1]
}


# ---------------------------------------------------------------------------
# Build release manifest and human-readable release record
# ---------------------------------------------------------------------------

function Write-ReleaseArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        $ReleaseMetadata,

        [Parameter(Mandatory = $true)]
        [string]$ReleaseStatus,

        [Parameter(Mandatory = $false)]
        [AllowNull()]
        [string]$CloudflareVersion,

        [Parameter(Mandatory = $false)]
        [string]$CloudflareWorker,

        [Parameter(Mandatory = $false)]
        [object[]]$Targets = @()
    )

    if (-not (Test-Path -LiteralPath $releaseOutputDirectory)) {
        New-Item `
            -ItemType Directory `
            -Path $releaseOutputDirectory `
            -Force |
            Out-Null
    }

    $script:manifestPath = Join-Path `
        $releaseOutputDirectory `
        "release-manifest-$($ReleaseMetadata.Timestamp).json"

    $script:recordPath = Join-Path `
        $releaseOutputDirectory `
        "release-record-$($ReleaseMetadata.Timestamp).txt"

    $manifest = [ordered]@{
        application = 'AI MIS OPS Center'
        applicationVersion = $ReleaseMetadata.ApplicationVersion
        environment = $EnvironmentName

        git = [ordered]@{
            branch = $ReleaseMetadata.GitBranch
            commit = $ReleaseMetadata.GitCommit
            shortCommit = $ReleaseMetadata.GitShortCommit
            commitMessage = $ReleaseMetadata.GitCommitMessage
            userName = $ReleaseMetadata.GitUserName
            userEmail = $ReleaseMetadata.GitUserEmail
            remote = "origin/$RequiredBranch"
        }

        cloudflare = [ordered]@{
            worker = $CloudflareWorker
            versionId = $CloudflareVersion
            deploymentMessage = $deploymentMessage
            targets = @($Targets)
        }

        database = [ordered]@{
            provider = 'Cloudflare D1'
            name = $D1DatabaseName
            migrations = $d1MigrationStatus
        }

        verification = [ordered]@{
            lint = $lintStatus
            build = $buildStatus
            tests = $testStatus
            gitSynchronization = $gitSyncStatus
        }

        deployment = [ordered]@{
            user = $ReleaseMetadata.DeployUser
            computer = $ReleaseMetadata.DeployMachine
            status = $ReleaseStatus
        }

        deployedAt = $ReleaseMetadata.DeployTime
        productionUrl = $ProductionUrl
    }

    $manifest |
        ConvertTo-Json -Depth 10 |
        Set-Content `
            -LiteralPath $manifestPath `
            -Encoding UTF8

    $cloudflareVersionDisplay = if ($CloudflareVersion) {
        $CloudflareVersion
    }
    else {
        'N/A'
    }

    $cloudflareWorkerDisplay = if ($CloudflareWorker) {
        $CloudflareWorker
    }
    else {
        $WorkerName
    }

    $record = @"
============================================================
 AI MIS OPS Center - Production Release Record
============================================================

Application Version : $($ReleaseMetadata.ApplicationVersion)
Environment         : $EnvironmentName

Git Branch          : $($ReleaseMetadata.GitBranch)
Git Commit          : $($ReleaseMetadata.GitCommit)
Git Short Commit    : $($ReleaseMetadata.GitShortCommit)
Git Message         : $($ReleaseMetadata.GitCommitMessage)
Git User            : $($ReleaseMetadata.GitUserName)
Git Email           : $($ReleaseMetadata.GitUserEmail)

Cloudflare Worker   : $cloudflareWorkerDisplay
Cloudflare Version  : $cloudflareVersionDisplay
Deployment Message  : $deploymentMessage

D1 Database         : $D1DatabaseName
D1 Migration        : $d1MigrationStatus

Lint                : $lintStatus
Build               : $buildStatus
Tests               : $testStatus
GitHub Sync          : $gitSyncStatus

Deploy User          : $($ReleaseMetadata.DeployUser)
Deploy Computer      : $($ReleaseMetadata.DeployMachine)
Deploy Time          : $($ReleaseMetadata.DeployTime)

Deployment Status   : $ReleaseStatus

Production URL      : $ProductionUrl

============================================================
"@

    Set-Content `
        -LiteralPath $recordPath `
        -Value $record `
        -Encoding UTF8
}


# ---------------------------------------------------------------------------
# Main release workflow
# ---------------------------------------------------------------------------

try {
    # -----------------------------------------------------------------------
    # Resolve project
    # -----------------------------------------------------------------------

    $ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath '.git'))) {
        throw "This is not a Git repository: $ProjectPath"
    }

    Push-Location $ProjectPath
    $locationPushed = $true

    $releaseOutputDirectory = Join-Path `
        $ProjectPath `
        $ReleaseOutputDirectoryName


    # -----------------------------------------------------------------------
    # Git repository validation
    # -----------------------------------------------------------------------

    Invoke-Checked 'Checking Git repository state' {
        git status --short
    }

    Assert-RequiredBranch
    Assert-NoSensitiveFiles

    Invoke-Checked 'Fetching the latest GitHub main branch' {
        git fetch origin --prune
    }

    if (-not $SkipPull) {
        Invoke-Checked 'Updating local branch with GitHub main' {
            git pull --ff-only origin $RequiredBranch
        }
    }

    Assert-NoSensitiveFiles


    # -----------------------------------------------------------------------
    # If deploying an existing commit, working tree MUST already be clean.
    # -----------------------------------------------------------------------

    if ($DeployExistingCommit) {
        $existingChanges = git status --porcelain

        if ($existingChanges) {
            throw @"
-DeployExistingCommit requires a clean Git working tree.

Uncommitted changes were detected.

Commit/push those changes first or run the release without -DeployExistingCommit.
"@
        }
    }


    # -----------------------------------------------------------------------
    # Source validation
    # -----------------------------------------------------------------------

    Invoke-Checked 'Checking whitespace errors' {
        git diff --check
    }

    Write-Host "`n=== Running lint ===" -ForegroundColor Cyan

    Invoke-BashNpm 'npm run lint'

    $lintStatus = 'PASS'


    Write-Host "`n=== Running production build ===" -ForegroundColor Cyan

    Invoke-BashNpm 'npm run build'

    $buildStatus = 'PASS'


    Write-Host "`n=== Running automated tests ===" -ForegroundColor Cyan

    Invoke-BashNpm 'npm run test'

    $testStatus = 'PASS'


    # -----------------------------------------------------------------------
    # Secret check again before staging / deployment
    # -----------------------------------------------------------------------

    Assert-NoSensitiveFiles


    # -----------------------------------------------------------------------
    # Commit / Push or deploy existing commit
    # -----------------------------------------------------------------------

    if (-not $DeployExistingCommit) {
        $changes = git status --porcelain

        if (-not $changes) {
            throw @"
No Git changes were found.

Nothing was committed.

If you intentionally want to deploy the current already-committed HEAD,
run the script with:

-DeployExistingCommit
"@
        }

        if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
            throw @"
-CommitMessage is required when the release contains Git changes.

Example:

-CommitMessage "chore: add release traceability and deployment manifest"
"@
        }

        Invoke-Checked 'Staging changed source files' {
            git add -A
        }

        Invoke-Checked 'Checking staged whitespace errors' {
            git diff --cached --check
        }

        Invoke-Checked 'Reviewing staged change summary' {
            git diff --cached --stat
        }

        Invoke-Checked 'Committing release to GitHub history' {
            git commit -m $CommitMessage
        }

        Invoke-Checked 'Pushing commit to GitHub main' {
            git push origin $RequiredBranch
        }
    }
    else {
        Write-Host "`n=== Deploying existing verified Git commit ===" -ForegroundColor Cyan

        git log -1 --oneline
    }


    # -----------------------------------------------------------------------
    # Verify GitHub synchronization
    # -----------------------------------------------------------------------

    Invoke-Checked 'Refreshing GitHub reference after push' {
        git fetch origin --prune
    }

    Assert-GitHubSynchronization

    $gitSyncStatus = 'PASS'


    # -----------------------------------------------------------------------
    # Capture immutable release metadata AFTER commit and push
    # -----------------------------------------------------------------------

    $metadata = Get-ReleaseMetadata

    $deploymentMessage = "v$($metadata.ApplicationVersion) | $($metadata.GitBranch)@$($metadata.GitShortCommit) | $EnvironmentName"

    Show-ReleaseMetadata -ReleaseMetadata $metadata

    Write-Host "`nDeployment message:" -ForegroundColor Cyan
    Write-Host $deploymentMessage


    # -----------------------------------------------------------------------
    # D1 migration validation and application
    # -----------------------------------------------------------------------

    Invoke-ReviewedD1Migrations `
        -ReviewedMigrationFiles $MigrationFiles

    $d1MigrationStatus = 'up-to-date'


    # -----------------------------------------------------------------------
    # Cloudflare deployment
    # -----------------------------------------------------------------------

    if (-not $SkipDeploy) {
        if (-not (Test-Path -LiteralPath $releaseOutputDirectory)) {
            New-Item `
                -ItemType Directory `
                -Path $releaseOutputDirectory `
                -Force |
                Out-Null
        }

        $wranglerOutputPath = Join-Path `
            $releaseOutputDirectory `
            "wrangler-$($metadata.Timestamp).ndjson"

        if (Test-Path -LiteralPath $wranglerOutputPath) {
            Remove-Item `
                -LiteralPath $wranglerOutputPath `
                -Force
        }

        $previousWranglerOutputPath = $env:WRANGLER_OUTPUT_FILE_PATH

        $env:WRANGLER_OUTPUT_FILE_PATH = $wranglerOutputPath

        $wranglerOutputEnvironmentWasChanged = $true

        Invoke-Checked 'Deploying verified build to Cloudflare Workers' {
            npx.cmd wrangler deploy --message $deploymentMessage
        }

        $deployRecord = Get-CloudflareDeployRecord `
            -StructuredOutputPath $wranglerOutputPath

        $cloudflareVersionId = $deployRecord.VersionId
        $cloudflareWorkerName = $deployRecord.WorkerName
        $cloudflareTargets = @($deployRecord.Targets)

        $deploymentStatus = 'SUCCESS'


        # -------------------------------------------------------------------
        # Generate traceability artifacts
        # -------------------------------------------------------------------

        Write-ReleaseArtifacts `
            -ReleaseMetadata $metadata `
            -ReleaseStatus $deploymentStatus `
            -CloudflareVersion $cloudflareVersionId `
            -CloudflareWorker $cloudflareWorkerName `
            -Targets $cloudflareTargets
    }
    else {
        $deploymentStatus = 'SKIPPED'

        Write-Host "`nCloudflare deployment was skipped." -ForegroundColor Yellow

        Write-ReleaseArtifacts `
            -ReleaseMetadata $metadata `
            -ReleaseStatus $deploymentStatus `
            -CloudflareVersion $null `
            -CloudflareWorker $WorkerName `
            -Targets @()
    }


    # -----------------------------------------------------------------------
    # Final repository safety check
    # -----------------------------------------------------------------------

    Write-Host "`n=== Final Git repository state ===" -ForegroundColor Cyan

    git status

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to read final Git repository state.'
    }


    # -----------------------------------------------------------------------
    # Final release summary
    # -----------------------------------------------------------------------

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host ' AI MIS OPS Center - Release completed successfully' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green

    Write-Host "Application Version : $($metadata.ApplicationVersion)"
    Write-Host "Environment         : $EnvironmentName"

    Write-Host ''

    Write-Host "Git Branch          : $($metadata.GitBranch)"
    Write-Host "Git Commit          : $($metadata.GitCommit)"
    Write-Host "Git Short Commit    : $($metadata.GitShortCommit)"

    Write-Host ''

    Write-Host "Lint                : $lintStatus"
    Write-Host "Build               : $buildStatus"
    Write-Host "Tests               : $testStatus"
    Write-Host "GitHub Sync          : $gitSyncStatus"
    Write-Host "D1 Migration        : $d1MigrationStatus"

    Write-Host ''

    Write-Host "Deployment Status   : $deploymentStatus"

    if (-not $SkipDeploy) {
        Write-Host "Cloudflare Worker   : $cloudflareWorkerName"
        Write-Host "Cloudflare Version  : $cloudflareVersionId"
        Write-Host "Deployment Message  : $deploymentMessage"
    }

    Write-Host ''

    Write-Host "Manifest            : $manifestPath"
    Write-Host "Release Record      : $recordPath"

    if ($wranglerOutputPath) {
        Write-Host "Wrangler Output     : $wranglerOutputPath"
    }

    Write-Host ''

    Write-Host "Production URL      : $ProductionUrl"

    Write-Host '============================================================'

    Write-Host "`nLatest Git commit:" -ForegroundColor Cyan

    git log -1 --oneline
}
catch {
    $deploymentStatus = 'FAILED'

    Write-Host "`n============================================================" -ForegroundColor Red
    Write-Host ' AI MIS OPS Center - Release FAILED' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red

    Write-Error $_.Exception.Message

    exit 1
}
finally {
    # Restore Wrangler environment state.
    if ($wranglerOutputEnvironmentWasChanged) {
        if ([string]::IsNullOrEmpty($previousWranglerOutputPath)) {
            Remove-Item `
                Env:WRANGLER_OUTPUT_FILE_PATH `
                -ErrorAction SilentlyContinue
        }
        else {
            $env:WRANGLER_OUTPUT_FILE_PATH = $previousWranglerOutputPath
        }
    }

    if ($locationPushed) {
        Pop-Location -ErrorAction SilentlyContinue
    }
}