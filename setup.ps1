# Polyjuice Video Studio: Windows setup (DEC-15 step 5). Safe to run again: done steps are skipped.
# From the studio folder, in PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Member <your-member-id>
# Full walkthrough: docs/JOINING.md
param(
  [string]$Member = "",
  [string]$ContentRepo = "https://github.com/gautham8793/polyjuice-channel.git"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue" # Invoke-WebRequest is very slow with its progress bar
Set-Location $PSScriptRoot

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
function Install($id) {
  Write-Host "  installing $id"
  winget install --id $id --exact --silent --accept-source-agreements --accept-package-agreements
  Refresh-Path
}
# Run a script block up to 3 times (downloads from GitHub / PyPI sometimes time out).
function Retry([scriptblock]$Do) {
  for ($n = 1; $n -le 5; $n++) {
    $global:LASTEXITCODE = 0 # cmdlets like Invoke-WebRequest don't set it; native commands do
    try { & $Do; if ($LASTEXITCODE -eq 0) { return } } catch { Write-Host "  $_" }
    Write-Host "  attempt $n failed; retrying in $($n * 10) s" -ForegroundColor Yellow
    Start-Sleep -Seconds ($n * 10)
  }
  throw "still failing after 5 attempts"
}
# Write UTF-8 without a byte-order mark (Node's JSON.parse rejects one).
function Write-Utf8($path, $text) { [IO.File]::WriteAllText((Join-Path $PWD $path), $text) }

Step "Tools: Git, Node.js, Python 3.12, FFmpeg"
if (-not (Have winget)) { throw "winget is missing. Install 'App Installer' from the Microsoft Store, then run this again." }
if (-not (Have git)) { Install "Git.Git" }
if (-not (Have node)) { Install "OpenJS.NodeJS.LTS" }
# On ARM PCs (e.g. Snapdragon) the voice tools (torch, spaCy parts, gRPC) only exist for x64, so
# use x64 Python there; Windows runs it through its built-in x64 emulation.
$arm = $env:PROCESSOR_ARCHITECTURE -eq "ARM64"
function Find-Python {
  # Candidates: the standard install folders (a fresh install may not be on PATH yet), the py
  # launcher's list, and any python on PATH. Each is asked what it is; on ARM keep x64 (AMD64) only.
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:ProgramFiles\Python312\python.exe",
    "${env:ProgramFiles(x86)}\Python312\python.exe"
  )
  if (Have py) {
    foreach ($line in (& py -0p 2>$null)) { if ($line -match "(\S.*python\.exe)\s*$") { $candidates += $Matches[1].Trim() } }
  }
  $candidates += (Get-Command python -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
  foreach ($exe in ($candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique)) {
    if ($exe -like "*WindowsApps*") { continue } # the Microsoft Store "python" stub
    $info = & $exe -c "import platform, sys; print(platform.machine(), '%d.%d' % sys.version_info[:2])" 2>$null
    if ($info -match "^(\S+) 3\.12$" -and (-not $arm -or $Matches[1] -eq "AMD64")) { return $exe }
  }
  return $null
}
$py = $null
try { $py = Find-Python } catch {}
if (-not $py) {
  if ($arm) {
    Write-Host "  ARM PC: installing x64 Python 3.12 (the voice tools have no ARM version)"
    winget install --id Python.Python.3.12 --exact --silent --architecture x64 --accept-source-agreements --accept-package-agreements
    Refresh-Path
  } else {
    Install "Python.Python.3.12"
  }
  try { $py = Find-Python } catch {}
}
if (-not (Have ffmpeg)) { Install "Gyan.FFmpeg" }
if (-not $py) { throw "Python 3.12$(if ($arm) { ' (x64)' }) still isn't found. Close this window, open a new PowerShell and run setup again." }
Write-Host "  Python: $py"
foreach ($cmd in "git", "node", "npm", "ffmpeg", "ffprobe") {
  if (-not (Have $cmd)) { throw "$cmd still isn't found. Close this window, open a new PowerShell and run setup again." }
}

Step "Studio packages (npm)"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

Step "Python packages (tools\.venv): Kokoro voice, Google TTS, image tools"
if (-not (Test-Path "tools\.venv\Scripts\python.exe")) { & $py -m venv tools\.venv }
Retry { & tools\.venv\Scripts\python.exe -m pip install --upgrade pip }
Retry { & tools\.venv\Scripts\python.exe -m pip install -r tools\requirements.txt }
# spaCy's English model (used by the Kokoro voice): GitHub release, else the official Hugging Face copy.
& tools\.venv\Scripts\python.exe -c "import en_core_web_sm" 2>$null
if ($LASTEXITCODE -ne 0) {
  try { Retry { & tools\.venv\Scripts\python.exe -m pip install "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl" } }
  catch { Retry { & tools\.venv\Scripts\python.exe -m pip install "https://huggingface.co/spacy/en_core_web_sm/resolve/main/en_core_web_sm-any-py3-none-any.whl" } }
}
# Scripts contain emoji and the rupee sign; without this Python on Windows reads them as cp1252.
[Environment]::SetEnvironmentVariable("PYTHONUTF8", "1", "User")
$env:PYTHONUTF8 = "1"

Step "Captions engine (whisper.cpp) and its model"
New-Item -ItemType Directory -Force "tools\bin", "tools\models" | Out-Null
if (-not (Test-Path "tools\bin\whisper-cli.exe")) {
  $release = Invoke-RestMethod "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest"
  $asset = $release.assets | Where-Object { $_.name -eq "whisper-bin-x64.zip" } | Select-Object -First 1
  if (-not $asset) { throw "whisper-bin-x64.zip isn't in the latest whisper.cpp release; download it by hand into tools\bin" }
  $zip = Join-Path $env:TEMP "whisper-bin-x64.zip"
  $unzip = Join-Path $env:TEMP "whisper-bin-x64"
  Retry { Invoke-WebRequest $asset.browser_download_url -OutFile $zip }
  Remove-Item $unzip -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive $zip $unzip
  Get-ChildItem $unzip -Recurse -File | Where-Object { $_.Extension -in ".exe", ".dll" } | Copy-Item -Destination "tools\bin" -Force
}
if (-not (Test-Path "tools\models\ggml-base.en.bin")) {
  Write-Host "  downloading the 148 MB English model"
  Retry { Invoke-WebRequest "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -OutFile "tools\models\ggml-base.en.bin" }
}

Step "Channel content (workspace\)"
if (-not (Test-Path "workspace\.git")) {
  if ((Test-Path "workspace") -and (Get-ChildItem "workspace" | Select-Object -First 1)) { throw "workspace\ exists but isn't the channel repo; move it away and run again." }
  Write-Host "  a GitHub sign-in window may open: use the account Gautham invited"
  git clone $ContentRepo workspace
  if ($LASTEXITCODE -ne 0) { throw "couldn't download the channel content. Has Gautham added your GitHub account to polyjuice-channel, and did you accept the invite?" }
}

Step "Who you are on this computer"
$members = (Get-Content "workspace\members.json" -Raw | ConvertFrom-Json).members
if (-not $Member) {
  $members | ForEach-Object { Write-Host ("  {0,-12} {1}" -f $_.id, $_.name) }
  $Member = Read-Host "Your member id"
}
if (-not ($members | Where-Object { $_.id -eq $Member })) {
  throw "'$Member' isn't a member yet. Ask Gautham to add you in Team & activity and Sync, then run this again."
}
New-Item -ItemType Directory -Force ".studio" | Out-Null
Write-Utf8 ".studio\me.json" "{ `"member`": `"$Member`" }`n"

Step "Keys (secrets\)"
New-Item -ItemType Directory -Force "secrets" | Out-Null
$missing = @("r2.json", "google-tts.json") | Where-Object { -not (Test-Path "secrets\$_") }
foreach ($m in $missing) { Write-Host "  missing secrets\$m : save the file Gautham sends you (privately) there" -ForegroundColor Yellow }

Step "Start Studio shortcut on the Desktop"
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Polyjuice Studio.lnk"))
$link.TargetPath = Join-Path $PWD "Start Studio.cmd"
$link.WorkingDirectory = "$PWD"
$link.Save()

Write-Host "`nDone." -ForegroundColor Green
if ($missing) { Write-Host "Add the missing key files above before your first Sync." -ForegroundColor Yellow }
Write-Host "Double-click 'Polyjuice Studio' on the Desktop, then press Sync (bottom left) to download the videos' media."
