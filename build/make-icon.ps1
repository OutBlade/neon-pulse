[Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null
$ErrorActionPreference = "Stop"

$outDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function New-Icon {
    param([int]$size)

    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $cx = $size / 2.0
    $cy = $size / 2.0
    $s  = [double]$size

    # Rounded-square background path
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = [int]($s * 0.18)
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $bgPath.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
    $bgPath.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
    $bgPath.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
    $bgPath.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
    $bgPath.CloseFigure()

    # Dark purple-black radial background
    $bgBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $bgPath
    $bgBrush.CenterColor = [System.Drawing.Color]::FromArgb(255, 30, 14, 58)
    $bgBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(255, 6, 2, 18))
    $bgBrush.CenterPoint = New-Object System.Drawing.PointF $cx, $cy
    $g.FillPath($bgBrush, $bgPath)
    $g.SetClip($bgPath)

    # Magenta halo behind everything
    $haloPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $haloSize = $s * 0.95
    $haloPath.AddEllipse($cx - $haloSize/2, $cy - $haloSize/2, $haloSize, $haloSize)
    $haloBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $haloPath
    $haloBrush.CenterColor = [System.Drawing.Color]::FromArgb(90, 255, 42, 109)
    $haloBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 42, 109))
    $g.FillPath($haloBrush, $haloPath)
    $haloBrush.Dispose()
    $haloPath.Dispose()

    # Arena ring: magenta with glow
    $ringR = $s * 0.36
    $passes = if ($size -ge 128) { 6 } else { 3 }
    for ($i = $passes; $i -ge 1; $i--) {
        $alpha = [int](18 * $i)
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($alpha, 255, 42, 109)), ([single]($s * 0.008 + $i * $s * 0.004))
        $g.DrawEllipse($pen, [single]($cx - $ringR), [single]($cy - $ringR), [single]($ringR*2), [single]($ringR*2))
        $pen.Dispose()
    }
    $penRing = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 42, 109)), ([single]($s * 0.014))
    $g.DrawEllipse($penRing, [single]($cx - $ringR), [single]($cy - $ringR), [single]($ringR*2), [single]($ringR*2))
    $penRing.Dispose()

    # Dash trail arc: cyan
    $trailR = $s * 0.30
    $trailRect = New-Object System.Drawing.RectangleF ([single]($cx - $trailR)), ([single]($cy - $trailR)), ([single]($trailR*2)), ([single]($trailR*2))
    for ($i = $passes; $i -ge 1; $i--) {
        $alpha = [int](16 * $i)
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($alpha, 5, 217, 232)), ([single]($s * 0.012 + $i * $s * 0.005))
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawArc($pen, $trailRect, 200, 140)
        $pen.Dispose()
    }
    $penTrail = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 5, 217, 232)), ([single]($s * 0.032))
    $penTrail.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penTrail.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($penTrail, $trailRect, 200, 140)
    $penTrail.Dispose()

    # Player core at end of trail
    $angle = 200 + 140
    $rad   = $angle * [Math]::PI / 180.0
    $px    = $cx + [Math]::Cos($rad) * $trailR
    $py    = $cy + [Math]::Sin($rad) * $trailR
    $pR    = $s * 0.105
    for ($i = $passes; $i -ge 1; $i--) {
        $alpha = [int](22 * $i)
        $gR = $pR + $i * $s * 0.018
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 5, 217, 232))
        $g.FillEllipse($brush, [single]($px - $gR), [single]($py - $gR), [single]($gR*2), [single]($gR*2))
        $brush.Dispose()
    }
    $brushCore = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 230, 252, 255))
    $g.FillEllipse($brushCore, [single]($px - $pR), [single]($py - $pR), [single]($pR*2), [single]($pR*2))
    $brushCore.Dispose()
    $brushInner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 5, 217, 232))
    $innerR = $pR * 0.55
    $g.FillEllipse($brushInner, [single]($px - $innerR), [single]($py - $innerR), [single]($innerR*2), [single]($innerR*2))
    $brushInner.Dispose()

    # Enemy target dot on ring
    $ea = 30
    $erad = $ea * [Math]::PI / 180.0
    $ex = $cx + [Math]::Cos($erad) * $ringR
    $ey = $cy + [Math]::Sin($erad) * $ringR
    $eR = $s * 0.048
    for ($i = $passes; $i -ge 1; $i--) {
        $alpha = [int](20 * $i)
        $gR = $eR + $i * $s * 0.012
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 255, 42, 109))
        $g.FillEllipse($brush, [single]($ex - $gR), [single]($ey - $gR), [single]($gR*2), [single]($gR*2))
        $brush.Dispose()
    }
    $brushE = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 140, 180))
    $g.FillEllipse($brushE, [single]($ex - $eR), [single]($ey - $eR), [single]($eR*2), [single]($eR*2))
    $brushE.Dispose()

    $g.ResetClip()

    # Border stroke
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 255, 42, 109)), ([single]($s * 0.008))
    $g.DrawPath($borderPen, $bgPath)
    $borderPen.Dispose()

    $g.Dispose()
    $bgBrush.Dispose()
    $bgPath.Dispose()

    return $bmp
}

$sizes = @(16, 24, 32, 48, 64, 128, 256, 512, 1024)
$bitmaps = @{}
foreach ($sz in $sizes) {
    $bmp = New-Icon -size $sz
    $bitmaps[$sz] = $bmp
    Write-Host ("rendered " + $sz)
}

# Save primary PNG for Linux
$bitmaps[512].Save((Join-Path $outDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# Build multi-res ICO (PNG-compressed entries)
$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$icoPath  = Join-Path $outDir "icon.ico"

$pngBytesList = @()
foreach ($sz in $icoSizes) {
    $msPng = New-Object System.IO.MemoryStream
    $bitmaps[$sz].Save($msPng, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += ,($msPng.ToArray())
    $msPng.Dispose()
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$icoSizes.Count)

$headerSize = 6 + 16 * $icoSizes.Count
$offset = $headerSize
for ($i = 0; $i -lt $icoSizes.Count; $i++) {
    $sz = $icoSizes[$i]
    $bytes = $pngBytesList[$i]
    $b = if ($sz -ge 256) { 0 } else { $sz }
    $bw.Write([byte]$b)
    $bw.Write([byte]$b)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $bytes.Length
}
foreach ($bytes in $pngBytesList) {
    $bw.Write($bytes)
}
$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose()
$ms.Dispose()
Write-Host ("wrote " + $icoPath)

foreach ($sz in $sizes) { $bitmaps[$sz].Dispose() }
Write-Host "done"
