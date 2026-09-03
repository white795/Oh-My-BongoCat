#!/usr/bin/env python3
"""Fail-open bridge from Codex hook payloads to a running Windows BongoCat."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any, TextIO

EVENT_NAMES = frozenset(
    {
        "UserPromptSubmit",
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "agent-turn-complete",
    }
)
DISPATCH_TIMEOUT_SECONDS = 0.75
POWERSHELL = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"


def normalize_lifecycle_payload(payload: Mapping[str, Any]) -> dict[str, str] | None:
    return _normalized_event(
        payload.get("hook_event_name"),
        payload.get("session_id"),
        payload.get("turn_id"),
    )


def normalize_notify_payload(payload: Mapping[str, Any]) -> dict[str, str] | None:
    return _normalized_event(
        payload.get("type"),
        payload.get("thread-id"),
        payload.get("turn-id"),
    )


def encode_event(event: Mapping[str, str]) -> str:
    payload = {
        "event": event["event"],
        "sessionId": event["sessionId"],
        "turnId": event["turnId"],
    }
    source = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(source).decode("ascii").rstrip("=")


def dispatch_event(encoded_event: str, environ: Mapping[str, str]) -> bool:
    executable = environ.get("CODEX_AMBIENT_BONGOCAT_EXE", "")
    dispatcher = environ.get(
        "CODEX_AMBIENT_DISPATCHER",
        str(Path(__file__).with_name("codex-ambient-dispatch.ps1")),
    )

    if not executable or not dispatcher or not _is_base64url(encoded_event):
        return False

    try:
        windows_dispatcher = _to_windows_path(dispatcher)
        windows_executable = _to_windows_path(executable)
        if not windows_dispatcher or not windows_executable:
            return False

        completed = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                windows_dispatcher,
                "-Payload",
                encoded_event,
                "-BongoExecutable",
                windows_executable,
            ],
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=DISPATCH_TIMEOUT_SECONDS,
        )
        return completed.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def main(
    argv: list[str] | None = None,
    stdin: TextIO | None = None,
    environ: Mapping[str, str] | None = None,
) -> int:
    arguments = argv if argv is not None else sys.argv
    stream = stdin if stdin is not None else sys.stdin
    environment = environ if environ is not None else os.environ

    try:
        source = arguments[1] if len(arguments) > 1 else ""
        if source == "lifecycle":
            normalized = normalize_lifecycle_payload(json.load(stream))
        elif source == "notify" and len(arguments) > 2:
            normalized = normalize_notify_payload(json.loads(arguments[2]))
        else:
            return 0

        if normalized is not None:
            dispatch_event(encode_event(normalized), environment)
    except Exception:
        # Codex hooks must never expose bridge failures to the model context.
        pass

    return 0


def _normalized_event(event: Any, session_id: Any, turn_id: Any) -> dict[str, str] | None:
    if not isinstance(event, str) or event not in EVENT_NAMES:
        return None
    if not all(
        isinstance(value, str) and value.strip()
        for value in (event, session_id, turn_id)
    ):
        return None
    return {"event": event, "sessionId": session_id, "turnId": turn_id}


def _is_base64url(value: str) -> bool:
    return bool(value) and all(
        "A" <= character <= "Z"
        or "a" <= character <= "z"
        or "0" <= character <= "9"
        or character in "-_"
        for character in value
    )


def _to_windows_path(path: str) -> str | None:
    if not path.startswith("/"):
        return path

    converted = subprocess.run(
        ["wslpath", "-w", path],
        check=False,
        capture_output=True,
        text=True,
        timeout=DISPATCH_TIMEOUT_SECONDS,
    )
    if converted.returncode != 0:
        return None
    return converted.stdout.strip() or None


if __name__ == "__main__":
    raise SystemExit(main())
