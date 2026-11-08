# Kimetomo: copy the latest encrypted backup from GitHub Actions to this PC
# (and to Google Drive if "Google Drive for desktop" is installed).
# Runs every day from Windows Task Scheduler (task name: KimetomoBackup).
# The file stays encrypted. The password is in the password app ("kimetomo-backup").
# ASCII only on purpose: Windows PowerShell 5.1 misreads non-ASCII .ps1 files without BOM.

$ErrorActionPreference = 'Stop'
$repo      = 't08028149495-prog/kimetomo'
$localDir  = Join-Path $env:USERPROFILE 'kimetomo-backups'
$keepLocal = 30
$keepDrive = 14
$logFile   = Join-Path $localDir 'backup-log.txt'

New-Item -ItemType Directory -Force $localDir | Out-Null
function Log($msg) {
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $msg
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    Write-Output $line
}

# Google Drive for desktop folder (My Drive), if present
function Find-DriveDir {
    foreach ($d in (Get-PSDrive -PSProvider FileSystem)) {
        foreach ($name in @('My Drive', ([string][char]0x30DE + [char]0x30A4 + [char]0x30C9 + [char]0x30E9 + [char]0x30A4 + [char]0x30D6))) {
            $p = Join-Path $d.Root $name
            if (Test-Path $p) { return (Join-Path $p 'kimetomo-backups') }
        }
    }
    return $null
}

function Prune($dir, $keep) {
    Get-ChildItem $dir -Filter 'kimetomo-backup-*.tar.gz.enc' | Sort-Object Name -Descending |
        Select-Object -Skip $keep | ForEach-Object {
            Remove-Item $_.FullName -Force
            $sha = $_.FullName -replace '\.tar\.gz\.enc$', '.sha256'
            if (Test-Path $sha) { Remove-Item $sha -Force }
        }
}

try {
    $run = gh run list -R $repo --workflow kimetomo-backup.yml --status success -L 1 --json databaseId,createdAt | ConvertFrom-Json
    if (-not $run) { throw 'No successful backup run found on GitHub.' }
    $runId = $run[0].databaseId
    $stamp = ([datetime]$run[0].createdAt).ToLocalTime().ToString('yyyyMMdd-HHmm')
    $name  = "kimetomo-backup-$stamp"
    $dest  = Join-Path $localDir "$name.tar.gz.enc"

    if (Test-Path $dest) {
        Log "Already saved: $name"
    } else {
        $tmp = Join-Path $env:TEMP "kimetomo-dl-$runId"
        if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
        gh run download $runId -R $repo -n kimetomo-full-backup -D $tmp
        if ($LASTEXITCODE -ne 0) { throw "gh run download failed ($LASTEXITCODE)" }

        $enc = Join-Path $tmp 'kimetomo-backup.tar.gz.enc'
        $expected = ((Get-Content (Join-Path $tmp 'kimetomo-backup.sha256')) -split '\s+')[0].ToLower()
        $actual   = (Get-FileHash $enc -Algorithm SHA256).Hash.ToLower()
        if ($expected -ne $actual) { throw 'Checksum mismatch: download is broken.' }

        Move-Item $enc $dest
        Move-Item (Join-Path $tmp 'kimetomo-backup.sha256') (Join-Path $localDir "$name.sha256")
        Remove-Item $tmp -Recurse -Force
        $mb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
        Log "Saved to PC: $name ($mb MB)"
    }
    Prune $localDir $keepLocal

    $driveDir = Find-DriveDir
    if ($driveDir) {
        New-Item -ItemType Directory -Force $driveDir | Out-Null
        $driveFile = Join-Path $driveDir "$name.tar.gz.enc"
        if (-not (Test-Path $driveFile)) {
            Copy-Item $dest $driveFile
            Copy-Item (Join-Path $localDir "$name.sha256") (Join-Path $driveDir "$name.sha256")
            Log "Copied to Google Drive: $name"
        }
        Prune $driveDir $keepDrive
    } else {
        Log 'Google Drive folder not found (Google Drive for desktop not installed?). PC copy only.'
    }
} catch {
    Log "ERROR: $($_.Exception.Message)"
    exit 1
}
