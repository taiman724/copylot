# CopyPal アイコン生成スクリプト
#
# Windows PowerShell で 16/48/128px の PNG を extension/icons/ に生成する。
# Segoe UI Emoji を使用するため Windows 10/11 で動作する。
#
# 使い方（リポジトリ直下から実行）:
#   powershell -ExecutionPolicy Bypass -File .\tools\make-icons.ps1

Add-Type -AssemblyName System.Drawing

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconDir = Join-Path $ScriptRoot "..\extension\icons"
$IconDir = [System.IO.Path]::GetFullPath($IconDir)

if (-not (Test-Path $IconDir)) {
    New-Item -ItemType Directory -Path $IconDir -Force | Out-Null
}

$Sizes = @(16, 48, 128)
$Glyph = [char]::ConvertFromUtf32(0x1F4CB)  # 📋 clipboard

foreach ($size in $Sizes) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 背景: 薄い青の角丸
    $bgColor = [System.Drawing.Color]::FromArgb(255, 234, 243, 255)
    $graphics.Clear($bgColor)

    # 角丸枠（小さいサイズだと潰れるので 32px 以上のときだけ）
    if ($size -ge 32) {
        $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 47, 111, 237)), ([Math]::Max(1, $size / 32))
        $radius = [Math]::Max(2, [int]($size * 0.18))
        $rect = New-Object System.Drawing.Rectangle 0, 0, ($size - 1), ($size - 1)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
        $path.AddArc(($rect.Right - $radius), $rect.Y, $radius, $radius, 270, 90)
        $path.AddArc(($rect.Right - $radius), ($rect.Bottom - $radius), $radius, $radius, 0, 90)
        $path.AddArc($rect.X, ($rect.Bottom - $radius), $radius, $radius, 90, 90)
        $path.CloseFigure()
        $graphics.DrawPath($borderPen, $path)
        $borderPen.Dispose()
        $path.Dispose()
    }

    # 絵文字描画
    $fontSize = [float]([Math]::Max(8, [int]($size * 0.65)))
    $font = New-Object System.Drawing.Font -ArgumentList @("Segoe UI Emoji", $fontSize, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rectF = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $graphics.DrawString($Glyph, $font, $brush, $rectF, $sf)

    $outPath = Join-Path $IconDir ("icon{0}.png" -f $size)
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

    Write-Host ("Generated: {0} ({1}x{1})" -f $outPath, $size)

    $font.Dispose()
    $brush.Dispose()
    $sf.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Host "Done. アイコンの生成が完了しました。"
