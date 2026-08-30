param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("acquire", "release", "status")]
  [string]$Action,
  [string]$TaskId,
  [string[]]$Files,
  [string]$Token
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$stateDir = Join-Path $root ".governance\leases"

function Get-Hash([string]$Value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $sha.Dispose()
  }
}

function Get-LeaseFiles {
  if (-not (Test-Path -LiteralPath $stateDir)) { return @() }
  return @(Get-ChildItem -LiteralPath $stateDir -Filter "*.json" -File)
}

function Get-LeaseRecords {
  return @(Get-LeaseFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json })
}

if ($Action -eq "status") {
  $records = @(Get-LeaseRecords)
  if ($records.Count -eq 0) { '{"active":false,"leases":[]}' } else { @{active=$true; leases=$records} | ConvertTo-Json -Depth 6 }
  exit 0
}

if ($Action -eq "acquire") {
  if (-not $TaskId -or -not $Files -or $Files.Count -eq 0) { throw "TaskId and immutable Files whitelist are required." }
  $normalizedFiles = @($Files | ForEach-Object { $_.Replace("\", "/").Trim() } | Sort-Object -Unique)
  $existing = @(Get-LeaseRecords)
  foreach ($record in $existing) {
    $overlap = @($record.files | Where-Object { $normalizedFiles -contains $_ })
    if ($overlap.Count -gt 0) { throw "Lease path conflict with task $($record.taskId): $($overlap -join ', ')" }
  }
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  $rawToken = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
  $record = [ordered]@{
    schemaVersion = 2
    active = $true
    taskId = $TaskId
    files = $normalizedFiles
    tokenSha256 = Get-Hash $rawToken
    createdAt = [DateTimeOffset]::Now.ToString("o")
  }
  $leasePath = Join-Path $stateDir ("{0}.json" -f (Get-Hash $TaskId).Substring(0, 24))
  if (Test-Path -LiteralPath $leasePath) { throw "A lease already exists for task $TaskId." }
  $json = $record | ConvertTo-Json -Depth 6
  [IO.File]::WriteAllText($leasePath, $json, (New-Object Text.UTF8Encoding($false)))
  Write-Output $rawToken
  exit 0
}

$recordsWithPaths = @(Get-LeaseFiles | ForEach-Object {
  [pscustomobject]@{Path=$_.FullName; Record=(Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json)}
})
$match = $null
foreach ($item in $recordsWithPaths) {
  if ($TaskId -and $item.Record.taskId -ne $TaskId) { continue }
  if ($Token -and (Get-Hash $Token) -ne $item.Record.tokenSha256) { continue }
  $match = $item
  break
}
if (-not $match) { throw "No matching lease exists." }
if (-not $Token) { throw "The original release token is required." }
if ((Get-Hash $Token) -ne $match.Record.tokenSha256) { throw "The release token does not own this lease." }
Remove-Item -LiteralPath $match.Path
Write-Output "released"
