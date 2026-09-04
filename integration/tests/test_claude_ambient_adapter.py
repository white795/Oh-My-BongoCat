import base64
import io
import json
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import claude_ambient_adapter as adapter

SESSION_ID = "b0b831d6-464e-4c1d-8223-689253e54539"
PROMPT_ID = "ceabfb3a-604f-49f2-831c-f7978bdaee1d"


def hook_payload(event: str, **extra: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "hook_event_name": event,
        "session_id": SESSION_ID,
        "prompt_id": PROMPT_ID,
        "cwd": "/home/devuser/VibeTool/BongoCat",
        "transcript_path": "/home/devuser/.claude/projects/x/transcript.jsonl",
    }
    payload.update(extra)
    return payload


class ClaudeAmbientAdapterTests(unittest.TestCase):
    def test_same_named_events_pass_through_with_prompt_id_as_turn(self) -> None:
        for event in ("UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse"):
            with self.subTest(event=event):
                self.assertEqual(
                    adapter.normalize_hook_payload(hook_payload(event)),
                    {"event": event, "sessionId": SESSION_ID, "turnId": PROMPT_ID},
                )

    def test_tool_failure_keeps_the_star_working(self) -> None:
        normalized = adapter.normalize_hook_payload(
            hook_payload("PostToolUseFailure", error="exit 1", is_interrupt=False)
        )

        self.assertEqual(
            normalized,
            {"event": "PostToolUse", "sessionId": SESSION_ID, "turnId": PROMPT_ID},
        )

    def test_turn_and_session_terminations_all_map_to_done(self) -> None:
        for event in ("Stop", "StopFailure"):
            with self.subTest(event=event):
                self.assertEqual(
                    adapter.normalize_hook_payload(hook_payload(event)),
                    {
                        "event": "agent-turn-complete",
                        "sessionId": SESSION_ID,
                        "turnId": PROMPT_ID,
                    },
                )

    def test_session_end_maps_to_session_end(self) -> None:
        self.assertEqual(
            adapter.normalize_hook_payload(hook_payload("SessionEnd")),
            {
                "event": "session-end",
                "sessionId": SESSION_ID,
                "turnId": PROMPT_ID,
            },
        )

    def test_subagent_events_are_dropped_even_when_the_event_name_is_known(self) -> None:
        for event in ("PreToolUse", "PostToolUse", "SubagentStop", "Stop"):
            with self.subTest(event=event):
                self.assertIsNone(
                    adapter.normalize_hook_payload(
                        hook_payload(event, agent_id="adc01d711798f327c", agent_type="Explore")
                    )
                )

    def test_unrelated_or_malformed_payloads_are_not_dispatched(self) -> None:
        self.assertIsNone(adapter.normalize_hook_payload(hook_payload("Notification")))
        self.assertIsNone(adapter.normalize_hook_payload(hook_payload("SubagentStart")))
        self.assertIsNone(adapter.normalize_hook_payload(hook_payload("SessionStart")))
        self.assertIsNone(
            adapter.normalize_hook_payload(hook_payload("PreToolUse", prompt_id=None))
        )
        self.assertIsNone(
            adapter.normalize_hook_payload(hook_payload("PreToolUse", session_id="   "))
        )
        self.assertIsNone(adapter.normalize_hook_payload(["not", "a", "mapping"]))

    def test_only_the_three_protocol_fields_cross_the_wsl_boundary(self) -> None:
        normalized = adapter.normalize_hook_payload(
            hook_payload(
                "PreToolUse",
                tool_name="Bash",
                tool_input={"command": "cat ~/.ssh/id_rsa"},
                permission_mode="default",
            )
        )

        self.assertEqual(set(normalized), {"event", "sessionId", "turnId"})

    def test_encoded_event_declares_claude_as_its_source(self) -> None:
        encoded = adapter.encode_event(
            {"event": "UserPromptSubmit", "sessionId": "session-a", "turnId": "turn-a"}
        )
        padded = encoded + "=" * (-len(encoded) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(padded))

        self.assertEqual(
            decoded,
            {
                "event": "UserPromptSubmit",
                "sessionId": "session-a",
                "turnId": "turn-a",
                "source": "claude",
            },
        )
        # The Rust decoder only accepts unpadded base64url.
        self.assertNotIn("=", encoded)
        self.assertTrue(adapter._is_base64url(encoded))

    def test_dispatch_targets_the_shared_pipe_through_the_claude_dispatcher(self) -> None:
        encoded_event = (
            "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ"
        )

        with patch.object(adapter, "_to_windows_path", return_value="D:\\bridge\\dispatch.ps1"):
            with patch.object(adapter.subprocess, "run") as run:
                run.return_value.returncode = 0

                dispatched = adapter.dispatch_event(
                    encoded_event,
                    {"CLAUDE_AMBIENT_DISPATCHER": "/bridge/dispatch.ps1"},
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
        self.assertEqual(adapter.AMBIENT_PIPE_NAME, "com.white795.bongocat.stats.codex-ambient")

    def test_dispatch_rejects_oversized_payloads_and_untrusted_pipe_names(self) -> None:
        with patch.object(adapter.subprocess, "run") as run:
            self.assertFalse(
                adapter.dispatch_event("A" * (adapter.MAX_AMBIENT_PAYLOAD_BYTES + 1), {})
            )
            self.assertFalse(
                adapter.dispatch_event("AAAA", {"CLAUDE_AMBIENT_PIPE_NAME": "..\\untrusted"})
            )

        run.assert_not_called()

    def test_main_is_silent_and_fail_open_when_windows_dispatch_is_unavailable(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()
        payload = (
            '{"hook_event_name":"Stop","session_id":"session-a","prompt_id":"turn-a",'
            '"last_assistant_message":"must not cross the WSL boundary"}'
        )

        with patch.object(adapter, "dispatch_event", return_value=False) as dispatch:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                result = adapter.main(["adapter"], io.StringIO(payload), {})

        self.assertEqual(result, 0)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")
        self.assertEqual(
            dispatch.call_args.args[0],
            adapter.encode_event(
                {"event": "agent-turn-complete", "sessionId": "session-a", "turnId": "turn-a"}
            ),
        )

    def test_main_never_raises_on_garbage_stdin(self) -> None:
        stdout = io.StringIO()
        stderr = io.StringIO()

        with patch.object(adapter, "dispatch_event") as dispatch:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                self.assertEqual(adapter.main(["adapter"], io.StringIO("{not json"), {}), 0)
                self.assertEqual(adapter.main(["adapter"], io.StringIO(""), {}), 0)

        dispatch.assert_not_called()
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
