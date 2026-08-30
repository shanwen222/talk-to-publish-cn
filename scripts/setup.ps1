param(
  [switch]$SkipSystemTools,
  [switch]$SkipWhisper,
  [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$onWindows = $env:OS -eq "Windows_NT"
if (-not $onWindows) { throw "当前一键安装路径只支持 Windows + PowerShell。" }

function Find-Executable([string[]]$Names) {
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
  }
  return $null
}

function Invoke-WingetInstall([string]$Id) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) { return $false }
  Write-Host "安装系统依赖：$Id"
  & $winget.Source install --id $Id -e --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { return $false }
  return $true
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

$node = Find-Executable @("node.exe", "node")
if ($node) {
  $version = (& $node --version).Trim()
  $major = [int]($version.TrimStart("v").Split(".")[0])
  if ($major -lt 22) { $node = $null }
}
if (-not $node -and -not $SkipSystemTools) {
  if (-not (Invoke-WingetInstall "OpenJS.NodeJS.LTS")) { throw "Node.js 22+ 未找到，且 winget 安装失败。请安装 Node.js 22+ 后重新运行本脚本。" }
  Refresh-Path
  $node = Find-Executable @("node.exe", "node")
}
if (-not $node) { throw "Node.js 22+ 未找到。" }

$npm = Find-Executable @("npm.cmd", "npm.exe", "npm")
if (-not $npm) { throw "npm 未找到。请重新打开 PowerShell 后再次运行 setup.ps1。" }

$ffmpeg = Find-Executable @("ffmpeg.exe", "ffmpeg")
if (-not $ffmpeg -and -not $SkipSystemTools) {
  if (-not (Invoke-WingetInstall "Gyan.FFmpeg.Shared")) { throw "FFmpeg 未找到，且 winget 安装失败。" }
  Refresh-Path
  $ffmpeg = Find-Executable @("ffmpeg.exe", "ffmpeg")
}
if (-not $ffmpeg) { throw "FFmpeg 未找到。" }

function Find-Python312 {
  $launcher = Find-Executable @("py.exe", "py")
  if ($launcher) {
    try {
      & $launcher -3.12 --version *> $null
      if ($LASTEXITCODE -eq 0) { return @{ Command = $launcher; Args = @("-3.12") } }
    } catch { }
  }
  $python = Find-Executable @("python.exe", "python")
  if ($python) {
    try {
      $version = (& $python --version 2>&1).ToString()
      if ($version -match "Python 3\.12\.") { return @{ Command = $python; Args = @() } }
    } catch { }
  }
  return $null
}

$pythonSpec = Find-Python312
if (-not $pythonSpec -and -not $SkipSystemTools) {
  if (-not (Invoke-WingetInstall "Python.Python.3.12")) { throw "Python 3.12 未找到，且 winget 安装失败。" }
  Refresh-Path
  $pythonSpec = Find-Python312
}
if (-not $pythonSpec) { throw "Python 3.12 未找到。请安装 Python 3.12 后重新运行 setup.ps1。" }

Write-Host "安装 JavaScript 依赖..."
Push-Location $repoRoot
try {
  & $npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci 失败。" }
  Write-Host "准备 Remotion 浏览器（首次可能下载约 100 MB）..."
  & $node (Join-Path $repoRoot "node_modules\@remotion\cli\remotion-cli.js") browser ensure
  if ($LASTEXITCODE -ne 0) { throw "Remotion 浏览器准备失败。" }
  if (-not $SkipBrowser) {
    Write-Host "安装 Playwright Chromium..."
    & (Join-Path (Split-Path $npm) "npx.cmd") playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw "Playwright Chromium 安装失败。" }
  }
  if (-not $SkipWhisper) {
    $venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
      Write-Host "创建 Python 3.12 虚拟环境..."
      $venvArgs = @($pythonSpec.Args) + @("-m", "venv", (Join-Path $repoRoot ".venv"))
      & $pythonSpec.Command $venvArgs
      if ($LASTEXITCODE -ne 0) { throw "Python 虚拟环境创建失败。" }
    }
    Write-Host "安装本地 Whisper（第一次可能需要较长时间）..."
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "pip 升级失败。" }
    & $venvPython -m pip install -r requirements-whisper.txt
    if ($LASTEXITCODE -ne 0) { throw "Whisper 安装失败。" }
  }
} finally {
  Pop-Location
}

Write-Host "运行最终环境检查..."
& (Join-Path $PSScriptRoot "doctor.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$git = Get-Command git.exe -ErrorAction SilentlyContinue
if ($git -and (Test-Path (Join-Path $repoRoot ".git"))) {
  Push-Location $repoRoot
  try {
    & $git.Source config core.hooksPath .githooks
    if ($LASTEXITCODE -ne 0) { throw "Git pre-push security hook installation failed." }
    Write-Host "Enabled pre-push sensitive-data scan: .githooks/pre-push"
  } finally {
    Pop-Location
  }
} else {
  Write-Host "Git worktree not detected; skipped pre-push installation. Run security:validate before publishing."
}

Push-Location $repoRoot
try {
  $securityArgs = @($pythonSpec.Args) + @((Join-Path $repoRoot "scripts\check_sensitive.py"), "--history")
  & $pythonSpec.Command $securityArgs
  if ($LASTEXITCODE -ne 0) { throw "Sensitive-data scan failed; clean the repository before continuing." }
} finally {
  Pop-Location
}
Write-Host "安装完成。现在本地目录和 GitHub 仓库是一套代码。"
