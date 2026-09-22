[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$artifactsDirectory = Join-Path $projectRoot 'artifacts'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $artifactsDirectory "GPSS-Studio-portable-$timestamp.zip"
$excludedDirectoryNames = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]@('.git', '.logs', '.tmp', '.vs', 'artifacts', 'bin', 'dist', 'docs', 'node_modules', 'obj'),
    [System.StringComparer]::OrdinalIgnoreCase
)
$excludedFileNames = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]@('Thumbs.db', '.DS_Store'),
    [System.StringComparer]::OrdinalIgnoreCase
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
New-Item -ItemType Directory -Path $artifactsDirectory -Force | Out-Null

$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $files = Get-ChildItem -LiteralPath $projectRoot -File -Recurse | Where-Object {
        $relativePath = $_.FullName.Substring($projectRoot.TrimEnd('\').Length).TrimStart('\')
        $pathParts = $relativePath -split '[\\/]'
        $directoryParts = if ($pathParts.Length -gt 1) { $pathParts[0..($pathParts.Length - 2)] } else { @() }

        -not $excludedFileNames.Contains($_.Name) -and
        -not ($directoryParts | Where-Object { $excludedDirectoryNames.Contains($_) })
    }

    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($projectRoot.TrimEnd('\').Length).TrimStart('\').Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            "GPSS-Studio/$relativePath",
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

$archiveSizeMb = [Math]::Round((Get-Item -LiteralPath $archivePath).Length / 1MB, 2)
Write-Host "Transfer package created: $archivePath" -ForegroundColor Green
Write-Host "Size: $archiveSizeMb MB"
Write-Host 'On the target laptop, extract the archive and run START_GPSS_STUDIO.cmd.'
