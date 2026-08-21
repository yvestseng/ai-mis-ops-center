param(
    [Parameter(Mandatory=$true)][string]$BaseUrl,
    [Parameter(Mandatory=$true)][string]$AdminId,
    [Parameter(Mandatory=$true)][securestring]$AdminPassword,
    [Parameter(Mandatory=$true)][string]$UserId,
    [Parameter(Mandatory=$true)][securestring]$UserPassword
)

$adminPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
$userPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($UserPassword)
try {
    $env:BASE_URL = $BaseUrl.TrimEnd('/')
    $env:ADMIN_ID = $AdminId
    $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPtr)
    $env:USER_ID = $UserId
    $env:USER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($userPtr)

    node "$PSScriptRoot\production-smoke-test.mjs"
    exit $LASTEXITCODE
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPtr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($userPtr)
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:USER_PASSWORD -ErrorAction SilentlyContinue
}
