#!/usr/bin/env python3
"""Fail-open bridge from Codex hook payloads to a running Windows BongoCat."""

from __future__ import annotations

import base64
import json
import os
import socket
import sys
from collections.abc import Mapping
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
MAX_AMBIENT_PAYLOAD_BYTES = 4096


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
    sock_path = os.path.join(
        environ.get('XDG_RUNTIME_DIR', '/run/user/1000'),
        'bongocat-ambient-relay.sock'
    )

    if not _is_base64url(encoded_event):
        return False

    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
            s.settimeout(1.0)
            s.connect(sock_path)
            s.sendall(encoded_event.encode('utf-8') + b'\n')
        return True
    except (FileNotFoundError, ConnectionRefusedError, socket.timeout, OSError):
        # Relay not running or busy — fail-open
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
    return 0 < len(value) <= MAX_AMBIENT_PAYLOAD_BYTES and all(
        "A" <= character <= "Z"
        or "a" <= character <= "z"
        or "0" <= character <= "9"
        or character in "-_"
        for character in value
    )


if __name__ == "__main__":
    raise SystemExit(main())
