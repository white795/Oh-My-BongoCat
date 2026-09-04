#!/usr/bin/env python3
"""Fail-open bridge from Claude Code hook payloads to a running Windows BongoCat.

Deliberately independent from `codex_ambient_adapter.py`. The two agents have
different payload shapes and lifecycles, and keeping the bridges separate means
a fix on one side can never regress the other.

Claude Code hook names are translated into the existing ambient protocol, so
BongoCat needs no changes to accept them:

    UserPromptSubmit    -> UserPromptSubmit      (WORKING, establishes the turn)
    PreToolUse          -> PreToolUse            (WORKING)
    PermissionRequest   -> PermissionRequest     (WAITING)
    PostToolUse         -> PostToolUse           (WORKING, restores from WAITING)
    PostToolUseFailure  -> PostToolUse           (WORKING, tool failed mid-turn)
    Stop                -> agent-turn-complete   (DONE, persists for the session)
    StopFailure         -> agent-turn-complete   (DONE, API error ended the turn)
    SessionEnd          -> session-end           (remove the session indicator)

Claude Code reports the turn as `prompt_id`, not `turn_id`. Subagent events
reuse the parent's `session_id` and `prompt_id` and only add `agent_id`, so any
payload carrying `agent_id` is dropped: subagents must not disturb the main
session's indicator, and `SubagentStop` must never read as DONE.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any, TextIO

# Claude Code hook name -> ambient protocol event accepted by BongoCat.
EVENT_TRANSLATIONS = {
    "UserPromptSubmit": "UserPromptSubmit",
    "PreToolUse": "PreToolUse",
    "PermissionRequest": "PermissionRequest",
    "PostToolUse": "PostToolUse",
    "PostToolUseFailure": "PostToolUse",
    "Stop": "agent-turn-complete",
    "StopFailure": "agent-turn-complete",
    "SessionEnd": "session-end",
}

# PowerShell cold start can exceed a sub-second budget on a busy machine, and a
# dropped DONE leaves a stuck indicator.
DISPATCH_TIMEOUT_SECONDS = 2.0
POWERSHELL = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
AMBIENT_PIPE_NAME = "com.white795.bongocat.stats.codex-ambient"
AMBIENT_SOURCE = "claude"
MAX_AMBIENT_PAYLOAD_BYTES = 4096


def normalize_hook_payload(payload: Any) -> dict[str, str] | None:
    if not isinstance(payload, Mapping):
        return None

    # Subagent events carry the parent's identifiers; forwarding them would let
    # a subagent's lifecycle drive the main session's indicator.
    if payload.get("agent_id") is not None:
        return None

    event = EVENT_TRANSLATIONS.get(payload.get("hook_event_name"))
    session_id = payload.get("session_id")
    turn_id = payload.get("prompt_id")

    if event is None:
        return None
    if not all(
        isinstance(value, str) and value.strip() for value in (session_id, turn_id)
    ):
        return None

    return {"event": event, "sessionId": session_id, "turnId": turn_id}


def encode_event(event: Mapping[str, str]) -> str:
    payload = {
        "event": event["event"],
        "sessionId": event["sessionId"],
        "turnId": event["turnId"],
        # Identity marker, used by BongoCat to pick the indicator's hue. Requires
        # a BongoCat build that knows this field: the Rust decoder sets
        # deny_unknown_fields, so an older build rejects the whole payload.
        "source": AMBIENT_SOURCE,
    }
    encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(encoded).decode("ascii").rstrip("=")


def dispatch_event(encoded_event: str, environ: Mapping[str, str]) -> bool:
    dispatcher = environ.get(
        "CLAUDE_AMBIENT_DISPATCHER",
        str(Path(__file__).with_name("claude-ambient-dispatch.ps1")),
    )
    pipe_name = environ.get("CLAUDE_AMBIENT_PIPE_NAME", AMBIENT_PIPE_NAME)

    if not dispatcher or not _is_base64url(encoded_event) or not _is_pipe_name(pipe_name):
        return False

    try:
        windows_dispatcher = _to_windows_path(dispatcher)
        if not windows_dispatcher:
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
                "-PipeName",
                pipe_name,
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
    stream = stdin if stdin is not None else sys.stdin
    environment = environ if environ is not None else os.environ

    try:
        normalized = normalize_hook_payload(json.load(stream))
        if normalized is not None:
            dispatch_event(encode_event(normalized), environment)
    except Exception:
        # A Claude Code hook must never surface bridge failures. Writing to
        # stdout would inject text into the model's context on UserPromptSubmit,
        # and a non-zero exit on UserPromptSubmit erases the user's prompt.
        pass

    return 0


def _is_base64url(value: str) -> bool:
    return 0 < len(value) <= MAX_AMBIENT_PAYLOAD_BYTES and all(
        "A" <= character <= "Z"
        or "a" <= character <= "z"
        or "0" <= character <= "9"
        or character in "-_"
        for character in value
    )


def _is_pipe_name(value: str) -> bool:
    return 0 < len(value) <= 128 and all(
        "A" <= character <= "Z"
        or "a" <= character <= "z"
        or "0" <= character <= "9"
        or character in "._-"
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
