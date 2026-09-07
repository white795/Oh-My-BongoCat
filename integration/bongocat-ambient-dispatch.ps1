[CmdletBinding()]
param(
    [string[]]$Payloads,
    [string]$PipeName = 'com.white795.bongocat.stats.codex-ambient'
)

$ErrorActionPreference = 'Stop'

try {
    if (
        [string]::IsNullOrWhiteSpace($PipeName) -or
        $PipeName.Length -gt 128 -or
        $PipeName -notmatch '^[A-Za-z0-9._-]+$'
    ) {
        exit 0
    }

    $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $resolvedPipeName = "$PipeName.$userSid"

    foreach ($payload in $Payloads) {
        if ([string]::IsNullOrWhiteSpace($payload) -or $payload -notmatch '^[A-Za-z0-9_-]+$') {
            continue
        }

        if ($payload.Length -gt 4096) {
            continue
        }

        $client = [System.IO.Pipes.NamedPipeClientStream]::new(
            '.',
            $resolvedPipeName,
            [System.IO.Pipes.PipeDirection]::Out,
            [System.IO.Pipes.PipeOptions]::None
        )

        try {
            $client.Connect(500)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
            $client.Write($bytes, 0, $bytes.Length)
            $client.Flush()
        }
        finally {
            $client.Dispose()
        }
    }
} catch {
    # This command runs from the relay daemon. Its failures must be silent.
}

exit 0
