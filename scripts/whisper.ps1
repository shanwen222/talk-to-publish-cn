param(
  [Parameter(Mandatory = $true)][Alias("Input")][string]$InputPath,
  [string]$Language = "zh",
  [string]$Model = "turbo",
  [string]$OutputDir = "subtitle",
  [ValidateSet("all", "srt", "json", "tsv", "vtt", "txt")]
  [string]$OutputFormat = "srt"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$whisper = Join-Path $root ".venv/Scripts/whisper.exe"
if (-not (Test-Path -LiteralPath $whisper)) { throw "Whisper is not installed in the project .venv." }
$resolvedInputPath = (Resolve-Path -LiteralPath $InputPath).Path
$destination = if ([IO.Path]::IsPathRooted($OutputDir)) {
  [IO.Path]::GetFullPath($OutputDir)
} else {
  [IO.Path]::GetFullPath((Join-Path $root $OutputDir))
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
& $whisper $resolvedInputPath --language $Language --model $Model --output_format $OutputFormat --output_dir $destination
if ($LASTEXITCODE -ne 0) { throw "Whisper transcription failed with exit code $LASTEXITCODE." }
