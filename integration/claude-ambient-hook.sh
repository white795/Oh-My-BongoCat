#!/usr/bin/env bash

# Fail-open Claude Code hook wrapper for the BongoCat ambient indicator.
#
# Independent from the Codex wrapper on purpose: the two bridges are fixed and
# regression-tested separately.
#
# The Python adapter normalizes stdin, and the Windows dispatcher writes the
# result to the local named pipe owned by an already running BongoCat instance.
#
# Exit status and stdout are both load-bearing in Claude Code: a non-zero exit
# on UserPromptSubmit erases the user's prompt, a non-zero exit on Stop keeps the
# turn running, and stdout on UserPromptSubmit or SessionStart is injected into
# the model's context. Hence the unconditional silence and exit 0.

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
/usr/bin/python3 "$script_dir/claude_ambient_adapter.py" "$@" >/dev/null 2>&1 || true

exit 0
