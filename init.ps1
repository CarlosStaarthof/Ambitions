# init.ps1 — the verification gate.
#
# Every agent runs this. The reviewer may not approve unless it prints [OK].
# Windows PowerShell 5.1 compatible: no &&, no ternary, no null-coalescing.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Fail($msg) {
    Write-Host ""
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    exit 1
}

Write-Host "=== Ambitions verification gate ===" -ForegroundColor Cyan

# 1. Dependencies -------------------------------------------------------------
if (-not (Test-Path "node_modules")) {
    Write-Host "-> installing dependencies (npm ci)"
    npm ci
    if ($LASTEXITCODE -ne 0) { Fail "npm ci failed" }
} else {
    Write-Host "-> dependencies present"
}

# 2. Build --------------------------------------------------------------------
# There is no type-checker, so the production build is what catches bad imports,
# broken JSX and unresolved identifiers.
Write-Host "-> npm run build"
npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "build failed - run 'npm run build' to see the error" }

# 3. Tests --------------------------------------------------------------------
Write-Host "-> npm test"
npm test
if ($LASTEXITCODE -ne 0) { Fail "tests failed" }

# 4. Scope discipline ---------------------------------------------------------
# The harness allows exactly one feature in flight. More than one means someone
# started feature N+1 before N was reviewed.
if (Test-Path "feature_list.json") {
    $fl = Get-Content "feature_list.json" -Raw | ConvertFrom-Json
    $inProgress = @($fl.features | Where-Object { $_.status -eq "in_progress" })
    if ($inProgress.Count -gt 1) {
        $names = ($inProgress | ForEach-Object { "$($_.id) $($_.name)" }) -join ", "
        Fail "more than one feature is in_progress: $names"
    }
    if ($inProgress.Count -eq 1) {
        Write-Host "-> in progress: $($inProgress[0].id) $($inProgress[0].name)"
    } else {
        Write-Host "-> no feature in progress"
    }
} else {
    Fail "feature_list.json is missing"
}

Write-Host ""
Write-Host "[OK] build green, tests green, scope clean" -ForegroundColor Green
exit 0
