param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoRoot
try {
  & git config core.hooksPath .githooks
  if ($LASTEXITCODE -ne 0) { throw "Unable to set Git hooks path." }
  Write-Host "Enabled versioned Git hooks: .githooks"
} finally {
  Pop-Location
}
