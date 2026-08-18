param(
    [Parameter(Mandatory=$true)][string]$BaseUrl,
    [Parameter(Mandatory=$true)][string]$AdminId,
    [Parameter(Mandatory=$true)][securestring]$AdminPassword
)

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $env:BASE_URL = $BaseUrl.TrimEnd('/')
    $env:ADMIN_ID = $AdminId
    $env:ADMIN_PASSWORD = $plain
    node "$PSScriptRoot\production-smoke-test.mjs"
    exit $LASTEXITCODE
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
