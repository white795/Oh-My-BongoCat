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

    def test_session_end_without_turn_id_removes_the_session(self) -> None:
        normalized = adapter.normalize_lifecycle_payload(
            {
                "hook_event_name": "SessionEnd",
                "session_id": "session-a",
                "reason": "other",
                "transcript_path": "/must/not/cross/the/wsl/boundary",
            }
        )

        self.assertEqual(
            normalized,
            {
                "event": "session-end",
                "sessionId": "session-a",
                "turnId": "__session_end__",
            },
        )

    def test_stop_is_normalized_to_the_existing_done_protocol_event(self) -> None:
        normalized = adapter.normalize_lifecycle_payload(
            {
                "hook_event_name": "Stop",
                "session_id": "session-a",
                "turn_id": "turn-a",
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
            adapter.normalize_lifecycle_payload(
                {"hook_event_name": "Stop", "session_id": "session-a", "turn_id": 3}
            )
        )

    def test_legacy_notify_mode_is_ignored_without_dispatch(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()
        payload = (
            '{"type":"agent-turn-complete","thread-id":"session-a",'
            '"turn-id":"turn-a"}'
        )

        with patch.object(adapter, "dispatch_event") as dispatch:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                result = adapter.main(["adapter", "notify", payload], io.StringIO(), {})

        self.assertEqual(result, 0)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")
        dispatch.assert_not_called()

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

    def test_dispatch_writes_to_unix_socket(self) -> None:
        import socket
        from unittest.mock import MagicMock

        encoded_event = (
            "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ"
        )

        mock_socket = MagicMock()
        with patch.object(socket, "socket", return_value=mock_socket):
            mock_socket.__enter__ = MagicMock(return_value=mock_socket)
            mock_socket.__exit__ = MagicMock(return_value=False)

            dispatched = adapter.dispatch_event(
                encoded_event,
                {"XDG_RUNTIME_DIR": "/run/user/1000"},
            )

        self.assertTrue(dispatched)
        mock_socket.settimeout.assert_called_once_with(1.0)
        mock_socket.connect.assert_called_once_with("/run/user/1000/bongocat-ambient-relay.sock")
        mock_socket.sendall.assert_called_once_with(encoded_event.encode("utf-8") + b"\n")

    def test_dispatch_rejects_oversized_payloads(self) -> None:
        import socket

        with patch.object(socket, "socket") as mock_socket_cls:
            self.assertFalse(
                adapter.dispatch_event(
                    "A" * (adapter.MAX_AMBIENT_PAYLOAD_BYTES + 1),
                    {},
                )
            )

        mock_socket_cls.assert_not_called()

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
