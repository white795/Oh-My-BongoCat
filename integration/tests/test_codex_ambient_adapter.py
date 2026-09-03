import io
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import codex_ambient_adapter as adapter


class CodexAmbientAdapterTests(unittest.TestCase):
    def test_lifecycle_payload_is_reduced_to_the_three_allowed_fields(self) -> None:
        normalized = adapter.normalize_lifecycle_payload(
            {
                "hook_event_name": "PermissionRequest",
                "session_id": "session-a",
                "turn_id": "turn-a",
                "prompt": "must not cross the WSL boundary",
            }
        )

        self.assertEqual(
            normalized,
            {
                "event": "PermissionRequest",
                "sessionId": "session-a",
                "turnId": "turn-a",
            },
        )

    def test_notify_payload_uses_the_legacy_correlation_field_names(self) -> None:
        normalized = adapter.normalize_notify_payload(
            {
                "type": "agent-turn-complete",
                "thread-id": "session-a",
                "turn-id": "turn-a",
                "last-assistant-message": "must not cross the WSL boundary",
            }
        )

        self.assertEqual(
            normalized,
            {
                "event": "agent-turn-complete",
                "sessionId": "session-a",
                "turnId": "turn-a",
            },
        )

    def test_invalid_or_unrecognized_payloads_are_not_dispatched(self) -> None:
        self.assertIsNone(
            adapter.normalize_lifecycle_payload(
                {"hook_event_name": "Unknown", "session_id": "session-a", "turn_id": "turn-a"}
            )
        )
        self.assertIsNone(
            adapter.normalize_notify_payload(
                {"type": "agent-turn-complete", "thread-id": "session-a", "turn-id": 3}
            )
        )

    def test_event_is_base64url_encoded_without_padding(self) -> None:
        self.assertEqual(
            adapter.encode_event(
                {
                    "event": "UserPromptSubmit",
                    "sessionId": "session-a",
                    "turnId": "turn-a",
                }
            ),
            "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ",
        )

    def test_dispatch_uses_the_local_pipe_without_an_executable_path(self) -> None:
        encoded_event = (
            "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ"
        )

        with patch.object(adapter, "_to_windows_path", return_value="D:\\bridge\\dispatch.ps1"):
            with patch.object(adapter.subprocess, "run") as run:
                run.return_value.returncode = 0

                dispatched = adapter.dispatch_event(
                    encoded_event,
                    {"CODEX_AMBIENT_DISPATCHER": "/bridge/dispatch.ps1"},
                )

        self.assertTrue(dispatched)
        self.assertEqual(
            run.call_args.args[0],
            [
                adapter.POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                "D:\\bridge\\dispatch.ps1",
                "-Payload",
                encoded_event,
                "-PipeName",
                adapter.AMBIENT_PIPE_NAME,
            ],
        )

    def test_dispatch_rejects_oversized_payloads_and_untrusted_pipe_names(self) -> None:
        with patch.object(adapter.subprocess, "run") as run:
            self.assertFalse(
                adapter.dispatch_event(
                    "A" * (adapter.MAX_AMBIENT_PAYLOAD_BYTES + 1),
                    {},
                )
            )
            self.assertFalse(
                adapter.dispatch_event(
                    "AAAA",
                    {"CODEX_AMBIENT_PIPE_NAME": "..\\untrusted"},
                )
            )

        run.assert_not_called()

    def test_main_is_silent_and_fail_open_when_windows_dispatch_is_unavailable(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()
        payload = '{"hook_event_name":"UserPromptSubmit","session_id":"session-a","turn_id":"turn-a"}'

        with patch.object(adapter, "dispatch_event", return_value=False) as dispatch:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                result = adapter.main(
                    ["adapter", "lifecycle"],
                    io.StringIO(payload),
                    {},
                )

        self.assertEqual(result, 0)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")
        self.assertEqual(
            dispatch.call_args.args[0],
            "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ",
        )


if __name__ == "__main__":
    unittest.main()
