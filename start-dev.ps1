$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " AI MIS Ops Center 開發環境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-Path ".\package.json")) {
    Write-Host "找不到 package.json" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".\node_modules")) {
    Write-Host "node_modules 不存在，開始安裝套件..." -ForegroundColor Yellow
    npm.cmd install

    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install 失敗" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host ""
Write-Host "啟動開發伺服器..." -ForegroundColor Green
Write-Host "網址：http://localhost:5173" -ForegroundColor Green
Write-Host ""

npm.cmd run dev