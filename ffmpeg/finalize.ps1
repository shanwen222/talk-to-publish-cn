param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination,
  [string]$FfmpegPath = "ffmpeg",
  [string]$AudioMix
)

$ErrorActionPreference = "Stop"
$inputPath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = [IO.Path]::GetFullPath($Destination)
$outputDirectory = Split-Path -Parent $outputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

if ($AudioMix) {
  $audioPath = (Resolve-Path -LiteralPath $AudioMix).Path
  & $FfmpegPath -hide_banner -loglevel warning -y -i $inputPath -i $audioPath -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart $outputPath
} else {
  & $FfmpegPath -hide_banner -loglevel warning -y -i $inputPath -map 0:v:0 -map 0:a:0 -c:v copy -c:a aac -b:a 160k -movflags +faststart $outputPath
}
if ($LASTEXITCODE -ne 0) { throw "FFmpeg finalization failed with exit code $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath $outputPath)) { throw "FFmpeg reported success but output is missing." }
