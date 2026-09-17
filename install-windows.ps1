<#
  扫雷 Minesweeper · Windows 一键安装
  --------------------------------------------------------------
  这个脚本做两件事：
    1. 在本目录生成 assets\icon.ico（用 .NET 现画一个地雷图标，不联网）
    2. 在桌面创建快捷方式，用 Chrome / Edge 的“应用模式”打开游戏：
       没有地址栏和标签页，看起来就是一个独立小软件

  用法（在本目录打开 PowerShell）：
    powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
    powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Open
    powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Name "Minesweeper"
    powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Uninstall

  说明：本文件带有 UTF-8 BOM，因为 Windows PowerShell 5.1 只有在有 BOM 时才会把脚本
  按 UTF-8 读取；否则中文会乱码甚至直接报语法错误。请勿去掉 BOM。
#>
[CmdletBinding()]
param(
    [string] $Name = '扫雷 Minesweeper',
    [switch] $Open,
    [switch] $Uninstall
)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$game    = Join-Path $root 'minesweeper.html'
$assets  = Join-Path $root 'assets'
$icon    = Join-Path $assets 'icon.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk     = Join-Path $desktop ($Name + '.lnk')

if ($Uninstall) {
    if (Test-Path -LiteralPath $lnk) {
        Remove-Item -LiteralPath $lnk -Force
        Write-Host "已删除快捷方式：$lnk" -ForegroundColor Green
    } else {
        Write-Host "桌面上没有找到：$lnk" -ForegroundColor Yellow
    }
    exit 0
}

if (-not (Test-Path -LiteralPath $game)) {
    throw "找不到 minesweeper.html。请让本脚本和 minesweeper.html 放在同一个目录里。"
}

# ------------------------------------------------------------------
# 1. 画图标（纯 System.Drawing，无需联网、无需额外依赖）
# ------------------------------------------------------------------
function New-MineIcon {
    param([string] $Path)

    Add-Type -AssemblyName System.Drawing
    $size = 256
    $bmp  = New-Object System.Drawing.Bitmap $size, $size
    $g    = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $face   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(192, 192, 192))
    $white  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(128, 128, 128))
    $black  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(17, 17, 17))
    $lite   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205, 205, 205))

    # 外框 + 经典立体凸起
    $edge = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(64, 64, 64))
    $g.FillRectangle($edge, 0, 0, $size, $size)
    $g.FillRectangle($face, 4, 4, $size - 8, $size - 8)
    $b = 22
    $g.FillRectangle($white,  4, 4, $size - 8, $b)
    $g.FillRectangle($white,  4, 4, $b, $size - 8)
    $g.FillRectangle($shadow, 4, $size - 4 - $b, $size - 8, $b)
    $g.FillRectangle($shadow, $size - 4 - $b, 4, $b, $size - 8)
    $g.FillRectangle($face, 4 + $b, 4 + $b, $size - 8 - 2 * $b, $size - 8 - 2 * $b)

    # 地雷：八根尖刺 + 球体 + 高光
    $cx = $size / 2.0
    $cy = $size / 2.0
    $r  = $size * 0.205
    $spike = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(17, 17, 17)), ($size * 0.042)
    $spike.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $spike.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round

    for ($i = 0; $i -lt 8; $i++) {
        $a  = $i * [Math]::PI / 4.0
        $dx = [Math]::Cos($a)
        $dy = [Math]::Sin($a)
        $g.DrawLine($spike,
            [single]($cx + $dx * $r * 0.55), [single]($cy + $dy * $r * 0.55),
            [single]($cx + $dx * $r * 1.46), [single]($cy + $dy * $r * 1.46))
    }
    $g.FillEllipse($black, [single]($cx - $r), [single]($cy - $r), [single]($r * 2), [single]($r * 2))

    $hr = $size * 0.062
    $g.FillEllipse($white,
        [single]($cx - $r * 0.40 - $hr), [single]($cy - $r * 0.40 - $hr),
        [single]($hr * 2), [single]($hr * 2))
    $hr2 = $size * 0.028
    $g.FillEllipse($lite,
        [single]($cx + $r * 0.10 - $hr2), [single]($cy + $r * 0.42 - $hr2),
        [single]($hr2 * 2), [single]($hr2 * 2))

    # 写成单张 256x256 的 PNG-in-ICO（Vista 及以上都支持）
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $png = $ms.ToArray()

    $fs = [System.IO.File]::Create($Path)
    $bw = New-Object System.IO.BinaryWriter($fs)
    $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]1)      # ICONDIR：1 张图
    $bw.Write([byte]0);   $bw.Write([byte]0)                              # 宽高 256（0 表示 256）
    $bw.Write([byte]0);   $bw.Write([byte]0)                              # 调色板 / 保留
    $bw.Write([uint16]1); $bw.Write([uint16]32)                           # 色彩平面 / 位深
    $bw.Write([uint32]$png.Length); $bw.Write([uint32]22)                 # 数据长度 / 偏移
    $bw.Write($png)
    $bw.Flush(); $bw.Close(); $fs.Close(); $ms.Close()
    $g.Dispose(); $bmp.Dispose()
}

# ------------------------------------------------------------------
# 2. 找浏览器（优先 Edge / Chrome 的应用模式）
# ------------------------------------------------------------------
$candidates = @()
$pf86 = ${env:ProgramFiles(x86)}
$pf   = $env:ProgramFiles
$lad  = $env:LOCALAPPDATA
if ($pf86) {
    $candidates += (Join-Path $pf86 'Microsoft\Edge\Application\msedge.exe')
    $candidates += (Join-Path $pf86 'Google\Chrome\Application\chrome.exe')
}
if ($pf) {
    $candidates += (Join-Path $pf 'Microsoft\Edge\Application\msedge.exe')
    $candidates += (Join-Path $pf 'Google\Chrome\Application\chrome.exe')
}
if ($lad) {
    $candidates += (Join-Path $lad 'Google\Chrome\Application\chrome.exe')
}
$browser = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

# ------------------------------------------------------------------
# 3. 生成图标 + 创建桌面快捷方式
# ------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $assets)) { New-Item -ItemType Directory -Path $assets | Out-Null }

try {
    New-MineIcon -Path $icon
    Write-Host "已生成图标：$icon" -ForegroundColor Green
} catch {
    Write-Warning "图标生成失败（不影响游戏）：$($_.Exception.Message)"
    $icon = $null
}

$url = 'file:///' + ($game -replace '\\', '/')
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnk)
if ($browser) {
    $sc.TargetPath = $browser
    $sc.Arguments  = '--app="' + $url + '" --window-size=820,760'
    Write-Host "启动方式：$([System.IO.Path]::GetFileName($browser)) 应用模式" -ForegroundColor Cyan
} else {
    $sc.TargetPath = $game      # 没装 Edge/Chrome 就用默认浏览器打开
    Write-Host "未找到 Edge / Chrome，改用系统默认浏览器打开" -ForegroundColor Yellow
}
$sc.WorkingDirectory = $root
if ($icon -and (Test-Path -LiteralPath $icon)) { $sc.IconLocation = "$icon,0" }
$sc.Description = '扫雷 Minesweeper · 离线单文件版'
$sc.Save()

Write-Host ""
Write-Host "安装完成  桌面快捷方式：$lnk" -ForegroundColor Green
Write-Host "卸载：powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Uninstall" -ForegroundColor DarkGray

if ($Open) { Start-Process -FilePath $lnk }
