[CmdletBinding()]
param(
    [string]$Payload,
    [string]$PipeName = 'com.white795.bongocat.stats.codex-ambient'
)

$ErrorActionPreference = 'Stop'

try {
    if ([string]::IsNullOrWhiteSpace($Payload) -or $Payload -notmatch '^[A-Za-z0-9_-]+$') {
        exit 0
    }

    if ($Payload.Length -gt 4096) {
        exit 0
    }

    if (
        [string]::IsNullOrWhiteSpace($PipeName) -or
        $PipeName.Length -gt 128 -or
        $PipeName -notmatch '^[A-Za-z0-9._-]+$'
    ) {
        exit 0
    }

    $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $resolvedPipeName = "$PipeName.$userSid"
    $client = [System.IO.Pipes.NamedPipeClientStream]::new(
        '.',
        $resolvedPipeName,
        [System.IO.Pipes.PipeDirection]::Out,
        [System.IO.Pipes.PipeOptions]::None
    )

    try {
        $client.Connect(500)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Payload)
        $client.Write($bytes, 0, $bytes.Length)
        $client.Flush()
    }
    finally {
        $client.Dispose()
    }
} catch {
    # This command runs from a Codex hook. Its failures must be silent and
    # cannot change the hook's exit status.
}

exit 0
