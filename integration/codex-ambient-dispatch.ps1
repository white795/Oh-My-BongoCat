[CmdletBinding()]
param(
    [string]$Payload,
    [string]$BongoExecutable
)

$ErrorActionPreference = 'Stop'

try {
    if ([string]::IsNullOrWhiteSpace($Payload) -or $Payload -notmatch '^[A-Za-z0-9_-]+$') {
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($BongoExecutable)) {
        exit 0
    }

    $resolvedExecutable = [System.IO.Path]::GetFullPath($BongoExecutable)
    if (-not [System.IO.File]::Exists($resolvedExecutable)) {
        exit 0
    }

    $executable = Get-Item -LiteralPath $resolvedExecutable
    if ($executable.Name -notin @('BongoCat.exe', 'bongo-cat.exe')) {
        exit 0
    }

    $runningProcess = Get-CimInstance -ClassName Win32_Process -Filter "Name = '$($executable.Name)'" |
        Where-Object {
            $_.ExecutablePath -and [string]::Equals(
                [System.IO.Path]::GetFullPath($_.ExecutablePath),
                $resolvedExecutable,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        } |
        Select-Object -First 1

    if ($null -eq $runningProcess) {
        exit 0
    }

    Start-Process -FilePath $resolvedExecutable -ArgumentList @('--codex-ambient-event', $Payload) -WindowStyle Hidden | Out-Null
} catch {
    # This command runs from a Codex hook. Its failures must be silent and
    # cannot change the hook's exit status.
}

exit 0
